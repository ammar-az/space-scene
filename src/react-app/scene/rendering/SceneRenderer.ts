import * as THREE from "three";
import type { Planet, SceneModel } from "../model/schema.ts";
import { orbitPosition, viewFrame } from "../model/geometry.ts";
import { createRingProfile } from "../utils/planetSystems.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import { getSolarActivity } from "../utils/solarActivity.ts";
import { solarCycleSeconds } from "../utils/solarShader.ts";
import { getGiantStormActivity } from "../utils/giantStorms.ts";
import { getPlanetShadowCasters } from "../utils/planetShadows.ts";
import type { ShadowSphere } from "../utils/planetShadows.ts";
import { SceneClock } from "./clock.ts";
import {
  createGlow,
  createPlanetSurface,
  createRingMaterial,
  createSunSurface,
  TextureStore,
} from "./materials.ts";
import type { PlanetSurface } from "./materials.ts";

type Moon = {
  mesh: THREE.Mesh;
  surface: PlanetSurface;
  distance: number;
  phase: number;
  speed: number;
  size: number;
  id: string;
};
type Entry = {
  signature: string;
  root: THREE.Group;
  axis: THREE.Group;
  body: THREE.Mesh;
  surface: PlanetSurface;
  moons: Moon[];
  rings: THREE.ShaderMaterial[];
  orbit: THREE.LineLoop;
  disposables: { dispose(): void }[];
};

/** World coordinates and actual sphere/ring geometry keep camera, axes, and picking coherent. */
export class SceneRenderer {
  private renderer: THREE.WebGLRenderer;
  private world = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(
    -200,
    200,
    160,
    -160,
    0.1,
    2000,
  );
  private sphere = new THREE.SphereGeometry(1, 80, 48);
  private entries = new Map<string, Entry>();
  private textures = new TextureStore();
  private sun: THREE.Mesh;
  private sunSurface: ReturnType<typeof createSunSurface>;
  private sunKey = "";
  private glow: THREE.Mesh;
  private selection: THREE.LineLoop;
  private model: SceneModel;
  private selected: string | null = null;
  private active = true;
  private frame = 0;
  private aspect = 1;
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private solarElapsed = 0;
  private previousElapsed = 0;
  private disposed = false;

  constructor(
    privateCanvas: HTMLCanvasElement,
    model: SceneModel,
    clock: SceneClock,
    callbacks: {
      select(id: string | null): void;
      pan(dx: number, dy: number): void;
      zoom(factor: number): void;
      error(message: string): void;
    },
  ) {
    this.canvas = privateCanvas;
    this.clock = clock;
    this.callbacks = callbacks;
    this.model = model;
    this.solarElapsed = model.timeline.solar;
    this.previousElapsed = model.timeline.elapsed;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      console.error(
        "Scene shader compilation failed",
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(vertex),
        gl.getShaderInfoLog(fragment),
      );
      callbacks.error(
        "A scene shader could not compile. See the browser console for details.",
      );
    };
    this.sunSurface = createSunSurface(model.sun);
    this.sun = new THREE.Mesh(this.sphere, this.sunSurface.material);
    this.sunKey = this.sunSignature(model);
    this.world.add(this.sun);
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      createGlow(model.sun.color),
    );
    this.world.add(this.glow);
    const points = Array.from(
      { length: 128 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 128) * Math.PI * 2) * 1.28,
          Math.sin((i / 128) * Math.PI * 2) * 1.28,
          0,
        ),
    );
    this.selection = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: 0x9cdaef,
        transparent: true,
        opacity: 0.7,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.selection.renderOrder = 10;
    this.world.add(this.selection);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.canvas);
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    this.canvas.addEventListener("pointermove", this.pointerMove);
    this.canvas.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointercancel", this.pointerCancel);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.contextMenu);
    this.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.setModel(model, null);
    this.resize();
    this.frame = requestAnimationFrame(this.render);
  }
  private canvas: HTMLCanvasElement;
  private clock: SceneClock;
  private callbacks: {
    select(id: string | null): void;
    pan(dx: number, dy: number): void;
    zoom(factor: number): void;
    error(message: string): void;
  };
  private sunSignature(model: SceneModel) {
    return JSON.stringify([
      model.sun.seed,
      model.sun.color,
      model.sun.highlight,
      model.sun.shadow,
    ]);
  }

  setActive(active: boolean) {
    this.active = active;
  }
  snapshotTimeline() {
    return { elapsed: this.clock.elapsed, solar: this.solarElapsed };
  }
  setModel(model: SceneModel, selected: string | null) {
    if (model.timeline !== this.model.timeline) {
      this.solarElapsed = model.timeline.solar;
      this.previousElapsed = model.timeline.elapsed;
    }
    this.model = model;
    this.selected = selected;
    if (this.sunSignature(model) !== this.sunKey) {
      const next = createSunSurface(model.sun);
      this.sunSurface.dispose();
      this.sunSurface = next;
      this.sun.material = next.material;
      this.sunKey = this.sunSignature(model);
      (this.glow.material as THREE.ShaderMaterial).uniforms.u_color.value.set(
        model.sun.color,
      );
    }
    const existing = new Set(model.planets.map((planet) => planet.id));
    for (const [id, entry] of this.entries)
      if (!existing.has(id)) {
        this.releaseEntry(entry);
        this.entries.delete(id);
      }
    for (const planet of model.planets) {
      const signature = JSON.stringify([
        planet.type,
        planet.seeds,
        planet.families[planet.type],
        planet.moonCount,
        planet.ringCount,
        planet.orbit,
      ]);
      const previous = this.entries.get(planet.id);
      if (previous?.signature === signature) continue;
      const entry = this.buildPlanet(planet, signature);
      if (previous) this.releaseEntry(previous);
      this.entries.set(planet.id, entry);
    }
    this.updateCamera();
  }
  private buildPlanet(planet: Planet, signature: string): Entry {
    const family = planet.families[planet.type];
    const surface = createPlanetSurface(
      this.textures,
      {
        type: planet.type === "rocky" ? "terrestrial" : "giant",
        intense: family.intense ?? planet.type !== "icy",
        color: family.color,
        accentColor: family.accent,
        seed: planet.seeds.surface,
        cratering: planet.type === "rocky" ? family.detail : undefined,
        contrast: planet.type === "icy" ? family.detail : undefined,
      },
      this.callbacks.error,
    );
    const root = new THREE.Group(),
      axis = new THREE.Group();
    root.add(axis);
    const body = new THREE.Mesh(this.sphere, surface.material);
    body.userData.planetId = planet.id;
    axis.add(body);
    const disposables: { dispose(): void }[] = [surface];
    const rings: THREE.ShaderMaterial[] = [];
    let ringEdge = 1;
    for (let index = 0; index < planet.ringCount; index++) {
      const seed =
        typeof planet.seeds.rings === "number"
          ? planet.seeds.rings + index * 47
          : index === 0
            ? planet.seeds.rings
            : `${planet.seeds.rings}:belt:${index}`;
      const profile = createRingProfile(seed, family.color);
      const inner = index === 0 ? profile.inner : ringEdge + 0.08,
        outer = inner + profile.outer - profile.inner;
      ringEdge = outer;
      const geometry = new THREE.RingGeometry(inner, outer, 180);
      const material = createRingMaterial(family.color, seed, inner, outer);
      rings.push(material);
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.userData.planetId = planet.id;
      axis.add(ring);
      disposables.push(geometry, material);
    }
    const moons: Moon[] = [],
      moonRandom = seededRandom(`${planet.seeds.moons}:systems`);
    for (let index = 0; index < planet.moonCount; index++) {
      const moonSurface = createPlanetSurface(
        this.textures,
        {
          type: "terrestrial",
          intense: index % 2 === 0,
          color: "#aaa79d",
          accentColor: "#56534d",
          seed: `moon-rock-${index % 3}`,
          detail: "moon",
        },
        this.callbacks.error,
      );
      const mesh = new THREE.Mesh(this.sphere, moonSurface.material);
      const size = 0.1 + moonRandom() * 0.11;
      const tint = 0.75 + moonRandom() * 0.4;
      moonSurface.material.uniforms.u_tint.value.set(
        tint,
        tint * 0.97,
        tint * 0.92,
      );
      mesh.scale.setScalar(size);
      mesh.userData.planetId = planet.id;
      axis.add(mesh);
      moons.push({
        mesh,
        surface: moonSurface,
        distance:
          Math.max(1.8, ringEdge + 0.3) + index * 0.32 + moonRandom() * 0.1,
        phase: moonRandom() * Math.PI * 2,
        speed: (0.07 + moonRandom() * 0.08) / (1 + index * 0.2),
        size,
        id: `${planet.id}-moon-${index}`,
      });
      disposables.push(moonSurface);
    }
    const orbitPoints = Array.from(
      { length: 256 },
      (_, i) =>
        new THREE.Vector3(
          ...orbitPosition({ ...planet.orbit, phase: (i / 256) * 360 }, 0),
        ),
    );
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineBasicMaterial({
        color: 0x589bb7,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    disposables.push(orbit.geometry, orbit.material as THREE.Material);
    this.world.add(root, orbit);
    return {
      signature,
      root,
      axis,
      body,
      surface,
      moons,
      rings,
      orbit,
      disposables,
    };
  }
  private releaseEntry(entry: Entry) {
    this.world.remove(entry.root, entry.orbit);
    for (const disposable of entry.disposables) disposable.dispose();
  }
  private resize = () => {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.aspect = bounds.width / bounds.height;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.updateCamera();
  };
  private updateCamera() {
    const frame = viewFrame(this.model.view, this.aspect);
    this.camera.left = -frame.width / 2;
    this.camera.right = frame.width / 2;
    this.camera.top = frame.height / 2;
    this.camera.bottom = -frame.height / 2;
    this.camera.position.set(...frame.position);
    this.camera.up.set(frame.up[0], frame.up[1], frame.up[2]);
    this.camera.lookAt(...frame.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  private render = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.render);
    if (document.hidden) return;
    const time = this.clock.sample(now),
      delta = Math.max(0, time - this.previousElapsed);
    this.previousElapsed = time;
    if (this.model.sun.activity) this.solarElapsed += delta;
    if (!this.active) return;
    const sun = this.model.sun;
    this.sun.visible = this.glow.visible = sun.visible;
    this.sun.position.set(...sun.position);
    this.sun.scale.setScalar(sun.radius);
    this.glow.position.copy(this.sun.position);
    this.glow.scale.setScalar(sun.radius * 3.2);
    this.glow.quaternion.copy(this.camera.quaternion);
    const solar = getSolarActivity(sun.seed, this.solarElapsed * 1000),
      solarUniforms = this.sunSurface.material.uniforms;
    solarUniforms.u_solarPhase.value =
      (this.solarElapsed / solarCycleSeconds) * Math.PI * 2;
    for (let i = 0; i < solarUniforms.u_sunspots.value.length; i++) {
      solarUniforms.u_sunspots.value[i].fromArray(solar.centers, i * 4);
      solarUniforms.u_sunspotFrames.value[i].fromArray(solar.frames, i * 4);
    }
    const spheres: ShadowSphere[] = [];
    const frames: {
      surface: PlanetSurface;
      center: THREE.Vector3;
      radius: number;
      id: string;
      moon?: boolean;
    }[] = [];
    for (const planet of this.model.planets) {
      const entry = this.entries.get(planet.id)!;
      entry.root.visible = planet.visible;
      entry.orbit.visible = planet.visible && this.model.motion.orbitLines;
      (entry.orbit.material as THREE.LineBasicMaterial).opacity =
        this.selected === planet.id ? 0.45 : 0.16;
      if (!planet.visible) continue;
      entry.root.position.set(
        ...orbitPosition(planet.orbit, time - this.model.motion.orbitEpoch),
      );
      entry.axis.scale.setScalar(planet.radius);
      entry.axis.rotation.set(
        0,
        THREE.MathUtils.degToRad(planet.spin.orientation),
        THREE.MathUtils.degToRad(planet.spin.tilt),
        "YXZ",
      );
      entry.body.rotation.y = THREE.MathUtils.degToRad(
        planet.spin.phase + time * planet.spin.speed,
      );
      const uniforms = entry.surface.material.uniforms;
      const profiles = entry.surface.map?.storms;
      const activity = profiles?.length
        ? getGiantStormActivity(planet.seeds.weather, profiles, time * 1000)
        : null;
      const strength = planet.families[planet.type].detail;
      uniforms.u_stormsEnabled.value =
        planet.type !== "rocky" && activity && strength > 0 ? 1 : 0;
      if (activity)
        for (let i = 0; i < uniforms.u_storms.value.length; i++) {
          uniforms.u_storms.value[i].fromArray(activity.geometry, i * 4);
          uniforms.u_stormMotion.value[i].fromArray(activity.motion, i * 4);
          uniforms.u_stormMotion.value[i].x = Math.min(
            1,
            uniforms.u_stormMotion.value[i].x * strength,
          );
        }
      entry.root.updateMatrixWorld(true);
      frames.push({
        surface: entry.surface,
        center: entry.root.position.clone(),
        radius: planet.radius,
        id: planet.id,
      });
      for (const moon of entry.moons) {
        const phase = moon.phase + time * moon.speed;
        moon.mesh.position.set(
          Math.cos(phase) * moon.distance,
          Math.sin(phase * 0.8) * 0.08,
          Math.sin(phase) * moon.distance,
        );
        moon.mesh.rotation.y = phase;
        moon.mesh.updateMatrixWorld();
        frames.push({
          surface: moon.surface,
          center: moon.mesh.getWorldPosition(new THREE.Vector3()),
          radius: moon.size * planet.radius,
          id: moon.id,
          moon: true,
        });
      }
    }
    for (const frame of frames)
      spheres.push({
        id: frame.id,
        center: frame.center.toArray(),
        radius: frame.radius,
        opacity: 1,
      });
    const lightPosition = sun.visible
      ? this.sun.position
      : new THREE.Vector3(-120, 80, 60);
    for (const entry of this.entries.values())
      for (const ring of entry.rings)
        ring.uniforms.u_sun.value.copy(lightPosition);
    for (const frame of frames) {
      const uniforms = frame.surface.material.uniforms;
      uniforms.u_sun.value.copy(lightPosition);
      // Match the portfolio's gentle ambient fill; preserve the existing unlit-sun look.
      uniforms.u_fill.value = sun.visible ? (frame.moon ? 0.28 : 0.4) : 0.14;
      uniforms.u_terminatorStart.value = sun.visible
        ? -Math.max(
            0.4,
            Math.min(0.65, sun.radius / lightPosition.distanceTo(frame.center)),
          )
        : -0.24;
      const receiver = spheres.find((sphere) => sphere.id === frame.id)!;
      const shadowSun = {
        center: lightPosition.toArray() as [number, number, number],
        radius: sun.radius,
      };
      const casters = sun.visible
        ? getPlanetShadowCasters(receiver, spheres, shadowSun)
        : [];
      uniforms.u_shadowCount.value = casters.length;
      uniforms.u_shadowRadius.value = frame.radius;
      uniforms.u_shadowSun.value.set(
        ...lightPosition.clone().sub(frame.center).toArray(),
        sun.radius,
      );
      casters.forEach(({ sphere, opacity }, i) => {
        uniforms.u_shadowCasters.value[i].set(
          sphere.center[0] - frame.center.x,
          sphere.center[1] - frame.center.y,
          sphere.center[2] - frame.center.z,
          sphere.radius,
        );
        uniforms.u_shadowFades.value[i] = opacity;
      });
    }
    const selected = this.model.planets.find(
      (planet) => planet.id === this.selected && planet.visible,
    );
    this.selection.visible = !!selected;
    if (selected) {
      this.selection.position.copy(
        this.entries.get(selected.id)!.root.position,
      );
      this.selection.quaternion.copy(this.camera.quaternion);
      this.selection.scale.setScalar(selected.radius);
    }
    this.renderer.render(this.world, this.camera);
  };
  private pointerDown = (event: PointerEvent) => {
    this.drag = { x: event.clientX, y: event.clientY, moved: false };
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x,
      dy = event.clientY - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
    this.drag.moved = true;
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
    this.callbacks.pan(dx, dy);
  };
  private pointerUp = (event: PointerEvent) => {
    if (this.drag && !this.drag.moved) {
      const bounds = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const targets: THREE.Object3D[] = this.sun.visible ? [this.sun] : [];
      for (const entry of this.entries.values())
        if (entry.root.visible) targets.push(entry.axis);
      const intersection = this.raycaster.intersectObjects(targets, true)[0];
      this.callbacks.select(intersection?.object.userData.planetId ?? null);
    }
    this.drag = null;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
  };
  private pointerCancel = () => {
    this.drag = null;
  };
  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.callbacks.zoom(Math.exp(-event.deltaY * 0.001));
  };
  private contextMenu = (event: Event) => event.preventDefault();
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.error(
      "The graphics context was lost. Reload to restore the scene; export JSON to keep your settings.",
    );
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    for (const entry of this.entries.values()) this.releaseEntry(entry);
    this.entries.clear();
    this.sunSurface.dispose();
    this.sphere.dispose();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
    this.selection.geometry.dispose();
    (this.selection.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
