import {
  notableMoonLayout,
  notableMoonPosition,
} from "../model/notableMoons.ts";
import {
  rotationHoursPerSecond,
  orbitDaysPerSecond,
  rotationPhase,
} from "../model/time.ts";
import {
  largestPlanetDiameter,
  planetRenderRadius,
  starRenderRadius,
  starRenderPosition,
} from "../model/sizes.ts";
import {
  orbitLayoutFactors,
  scaleOrbitPoint,
  sceneEnvelopes,
} from "../model/layout.ts";
import * as THREE from "three";
import type { Planet, SceneModel } from "../model/schema.ts";
import { orbitPosition, viewFrame } from "../model/geometry.ts";
import { resolveFollowView } from "../model/camera.ts";
import { moonProfiles, moonPosition, planetRing } from "../model/systems.ts";
import type { MoonProfile } from "../model/systems.ts";
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
import { createPlanetEnvironment } from "./atmospheres.ts";
import type { PlanetEnvironment } from "./atmospheres.ts";
import type { PlanetSurface } from "./materials.ts";
import { AsteroidBeltRenderer } from "./AsteroidBeltRenderer.ts";
import { sceneLighting, stellarGlowRadius } from "../model/lighting.ts";
import { rockyTerrain, defaultRockyTerrain } from "../model/rockySurfaces.ts";
import { defaultGasSurface } from "../model/gas.ts";

type Moon = MoonProfile & {
  mesh: THREE.Mesh;
  surface: PlanetSurface;
  id: string;
};
type NamedMoon = {
  id: string;
  key: string;
  node: THREE.Group;
  mesh: THREE.Mesh;
  surface: PlanetSurface;
  orbitLine: THREE.LineLoop;
  radius: number;
  factor: number;
};
type Entry = {
  signature: string;
  root: THREE.Group;
  axis: THREE.Group;
  body: THREE.Mesh;
  surface: PlanetSurface;
  moons: Moon[];
  notableMoons: NamedMoon[];
  rings: THREE.ShaderMaterial[];
  environment?: PlanetEnvironment;
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
  private asteroidBelt: AsteroidBeltRenderer;
  private sun: THREE.Mesh;
  private sunSurface: ReturnType<typeof createSunSurface>;
  private sunKey = "";
  private glow: THREE.Mesh;
  private selection: THREE.LineLoop;
  private model: SceneModel;
  private layoutSource?: SceneModel;
  private largestDiameter = 1;
  private orbitFactors = new Map<string, number>();
  private envelopes: ReturnType<typeof sceneEnvelopes> = [];
  private selected: string | null = null;
  private sunSelected = false;
  private selectedMoon: string | null = null;
  private active = true;
  private frame = 0;
  private aspect = 1;
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private drag: {
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
    rotate: boolean;
  } | null = null;
  private solarElapsed = 0;
  private rotationHours = 0;
  private orbitDays = 0;
  private moonDays = 0;
  private previousElapsed = 0;
  private disposed = false;

  constructor(
    privateCanvas: HTMLCanvasElement,
    model: SceneModel,
    clock: SceneClock,
    callbacks: {
      select(id: string | null): void;
      selectSun(): void;
      selectMoon(parentId: string, moonId: string): void;
      pan(dx: number, dy: number): void;
      rotate(dx: number, dy: number): void;
      zoom(factor: number): void;
      error(message: string): void;
    },
  ) {
    this.canvas = privateCanvas;
    this.clock = clock;
    this.callbacks = callbacks;
    this.model = model;
    this.solarElapsed = model.timeline.solar;
    this.rotationHours = model.timeline.rotationHours;
    this.orbitDays = model.timeline.orbitDays;
    this.moonDays = model.timeline.moonDays;
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
    this.asteroidBelt = new AsteroidBeltRenderer(
      this.textures,
      callbacks.error,
    );
    this.world.add(this.asteroidBelt.root);
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
    this.canvas.addEventListener("lostpointercapture", this.pointerCancel);
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
    selectSun(): void;
    selectMoon(parentId: string, moonId: string): void;
    pan(dx: number, dy: number): void;
    rotate(dx: number, dy: number): void;
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
    return {
      elapsed: this.clock.elapsed,
      solar: this.solarElapsed,
      rotationHours: this.rotationHours,
      orbitDays: this.orbitDays,
      moonDays: this.moonDays,
    };
  }
  setModel(
    model: SceneModel,
    selected: string | null,
    sunSelected = false,
    selectedMoon: string | null = null,
  ) {
    if (model.timeline !== this.model.timeline) {
      this.solarElapsed = model.timeline.solar;
      this.rotationHours = model.timeline.rotationHours;
      this.orbitDays = model.timeline.orbitDays;
      this.moonDays = model.timeline.moonDays;
      this.previousElapsed = model.timeline.elapsed;
    }
    if (
      !this.layoutSource ||
      model.layout !== this.layoutSource.layout ||
      model.sizing !== this.layoutSource.sizing ||
      model.planets !== this.layoutSource.planets ||
      model.asteroidBelt !== this.layoutSource.asteroidBelt ||
      model.sun !== this.layoutSource.sun
    ) {
      this.largestDiameter = largestPlanetDiameter(model);
      this.orbitFactors = orbitLayoutFactors(model);
      this.envelopes = sceneEnvelopes(model, this.orbitFactors);
      this.layoutSource = model;
    }
    this.model = model;
    this.asteroidBelt.setModel(model, this.orbitFactors);
    this.selected = selected;
    this.sunSelected = sunSelected;
    this.selectedMoon = selectedMoon;
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
        planet.diameter,
        planet.earthlike,
        planet.terrain,
        planet.type === "gas" ? planet.gas : undefined,
        planet.seeds,
        planet.families[planet.type],
        planet.moonCount,
        planet.proceduralMoons,
        planet.notableMoons.map((moon) => [
          moon.id,
          moon.seed,
          moon.diameter,
          [
            moon.surface.color,
            moon.surface.accent,
            moon.surface.detail,
            moon.surface.terrain,
          ],
          moon.orbit.radiusX,
          moon.orbit.radiusZ,
          moon.orbit.rotation,
          moon.orbit.inclination,
          moon.orbit.orientation,
        ]),
        planet.moonSystem,
        planet.ringCount,
        planet.rings,
        planet.moons,
        planet.atmosphere,
        planet.clouds,
        planet.orbit.ellipse?.anchor === "sun" ? model.sun.position : null,
        [
          planet.orbit.center,
          planet.orbit.ellipse,
          planet.orbit.inclination,
          planet.orbit.orientation,
        ],
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
        bandShadow: family.bandShadow,
        earthlike: planet.type === "rocky" ? planet.earthlike : undefined,
        seed: planet.seeds.surface,
        cratering: planet.type === "rocky" ? family.detail : undefined,
        terrain:
          planet.type === "rocky" && !planet.earthlike?.enabled
            ? rockyTerrain(planet.terrain, family.detail)
            : undefined,
        resolution: planet.type === "rocky" ? 1024 : undefined,
        contrast: planet.type === "icy" ? family.detail : undefined,
        gas:
          planet.type === "gas" ? (planet.gas ?? defaultGasSurface) : undefined,
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
    const environment = createPlanetEnvironment(
      this.sphere,
      planet,
      surface.material,
    );
    if (environment) {
      if (environment.clouds) axis.add(environment.clouds);
      if (environment.atmosphere) axis.add(environment.atmosphere);
      disposables.push(environment);
    }
    const rings: THREE.ShaderMaterial[] = [];
    const profile = planetRing(planet);
    if (profile) {
      const geometry = new THREE.RingGeometry(
        profile.inner,
        profile.outer,
        180,
      );
      const material = createRingMaterial(profile);
      rings.push(material);
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.userData.planetId = planet.id;
      axis.add(ring);
      disposables.push(geometry, material);
    }
    const moons: Moon[] = moonProfiles(planet).map((profile, index) => {
      const moonSurface = createPlanetSurface(
        this.textures,
        {
          type: "terrestrial",
          intense: index % 2 === 0,
          color: profile.color,
          accentColor: profile.accent,
          seed: profile.seed,
          detail: "moon",
          terrain: defaultRockyTerrain,
          resolution: 128,
        },
        this.callbacks.error,
      );
      const mesh = new THREE.Mesh(this.sphere, moonSurface.material);
      mesh.scale.setScalar(profile.size);
      mesh.userData.planetId = planet.id;
      axis.add(mesh);
      disposables.push(moonSurface);
      return {
        ...profile,
        mesh,
        surface: moonSurface,
        id: `${planet.id}-moon-${index}`,
      };
    });
    const notableLayout = notableMoonLayout(planet);
    const notableMoons: NamedMoon[] = planet.notableMoons.map((moon) => {
      const profile = notableLayout.get(moon.id)!;
      const moonSurface = createPlanetSurface(
        this.textures,
        {
          type: "terrestrial",
          intense: true,
          color: moon.surface.color,
          accentColor: moon.surface.accent,
          cratering: moon.surface.detail,
          terrain: rockyTerrain(moon.surface.terrain, moon.surface.detail),
          resolution: 512,
          seed: moon.seed,
          detail: "moon",
        },
        this.callbacks.error,
      );
      const plane = new THREE.Group(),
        shape = new THREE.Group(),
        node = new THREE.Group();
      plane.rotation.set(
        -THREE.MathUtils.degToRad(moon.orbit.inclination),
        -THREE.MathUtils.degToRad(moon.orbit.orientation),
        0,
        "YXZ",
      );
      shape.rotation.y = -THREE.MathUtils.degToRad(moon.orbit.rotation);
      plane.add(shape);
      shape.add(node);
      axis.add(plane);
      const mesh = new THREE.Mesh(this.sphere, moonSurface.material);
      mesh.scale.setScalar(profile.radius);
      mesh.userData.planetId = planet.id;
      mesh.userData.moonId = moon.id;
      const raycast = mesh.raycast;
      mesh.raycast = function (raycaster, hits) {
        if (node.visible) raycast.call(this, raycaster, hits);
      };
      node.visible = moon.visible;
      node.add(mesh);
      const points = Array.from(
        { length: 192 },
        (_, i) =>
          new THREE.Vector3(
            ...notableMoonPosition(
              { ...moon, orbit: { ...moon.orbit, phase: (i / 192) * 360 } },
              0,
              profile.factor,
            ),
          ),
      );
      const geometry = new THREE.BufferGeometry().setFromPoints(points),
        material = new THREE.LineBasicMaterial({
          color: 0x76a6bd,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        });
      const orbitLine = new THREE.LineLoop(geometry, material);
      orbitLine.raycast = () => {};
      shape.add(orbitLine);
      disposables.push(moonSurface, geometry, material);
      return {
        id: moon.id,
        key: `${planet.id}:notable:${moon.id}`,
        node,
        mesh,
        surface: moonSurface,
        orbitLine,
        radius: profile.radius,
        factor: profile.factor,
      };
    });
    const orbitPoints = Array.from(
      { length: 256 },
      (_, i) =>
        new THREE.Vector3(
          ...orbitPosition(
            { ...planet.orbit, phase: (i / 256) * 360 },
            0,
            this.model.sun.position,
          ),
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
      notableMoons,
      rings,
      orbit,
      disposables,
      environment,
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
    const frame = viewFrame(
      resolveFollowView(this.model, this.orbitDays, this.orbitFactors),
      this.aspect,
    );
    const direction = new THREE.Vector3(...frame.position).sub(
      new THREE.Vector3(...frame.target),
    );
    const reach = Math.max(
      1,
      ...this.envelopes.map(
        (sphere) =>
          Math.hypot(
            ...sphere.center.map((value, i) => value - frame.target[i]),
          ) + sphere.radius,
      ),
    );
    const distance = Math.max(direction.length(), reach + 100);
    this.camera.far = distance + reach + 100;
    this.camera.left = -frame.width / 2;
    this.camera.right = frame.width / 2;
    this.camera.top = frame.height / 2;
    this.camera.bottom = -frame.height / 2;
    this.camera.position
      .set(...frame.target)
      .add(direction.normalize().multiplyScalar(distance));
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
    this.rotationHours +=
      delta * rotationHoursPerSecond(this.model.motion.rotationRate);
    this.orbitDays += delta * orbitDaysPerSecond(this.model.motion.orbitRate);
    this.moonDays += delta * orbitDaysPerSecond(this.model.motion.moonRate);
    if (!this.active) return;
    if (this.model.view.camera?.followPlanetId) this.updateCamera();
    const sun = this.model.sun;
    this.sun.visible = sun.visible;
    this.glow.visible = sun.visible && (sun.glow ?? 1) > 0;
    this.sun.position.set(...starRenderPosition(this.model));
    const sunRadius = starRenderRadius(this.model);
    this.sun.scale.setScalar(sunRadius);
    this.glow.position.copy(this.sun.position);
    this.glow.scale.setScalar(sunRadius * stellarGlowRadius);
    (this.glow.material as THREE.ShaderMaterial).uniforms.u_strength.value =
      sun.glow ?? 1;
    this.glow.quaternion.copy(this.camera.quaternion);
    const solar = getSolarActivity(
        sun.seed,
        this.solarElapsed * 1000,
        sun.sunspots,
      ),
      solarUniforms = this.sunSurface.material.uniforms;
    solarUniforms.u_solarPhase.value =
      (this.solarElapsed / solarCycleSeconds) * Math.PI * 2;
    for (let i = 0; i < solarUniforms.u_sunspots.value.length; i++) {
      if (i * 4 < solar.centers.length) {
        solarUniforms.u_sunspots.value[i].fromArray(solar.centers, i * 4);
        solarUniforms.u_sunspotFrames.value[i].fromArray(solar.frames, i * 4);
      } else {
        solarUniforms.u_sunspots.value[i].set(0, 0, 0, 0);
        solarUniforms.u_sunspotFrames.value[i].set(0, 0, 0, 0);
      }
    }
    const viewDirection = this.camera
      .getWorldDirection(new THREE.Vector3())
      .negate();
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
      const factor = this.orbitFactors.get(planet.id) ?? 1;
      entry.root.position.set(
        ...scaleOrbitPoint(
          orbitPosition(
            planet.orbit,
            this.orbitDays - this.model.motion.orbitEpochDays,
            sun.position,
          ),
          sun.position,
          factor,
        ),
      );
      entry.orbit.scale.setScalar(factor);
      entry.orbit.position.set(
        ...(starRenderPosition(this.model).map(
          (value, i) => value - sun.position[i] * factor,
        ) as [number, number, number]),
      );
      const radius = planetRenderRadius(
        this.model,
        planet,
        this.largestDiameter,
      );
      entry.axis.scale.setScalar(radius);
      entry.axis.rotation.set(
        0,
        THREE.MathUtils.degToRad(planet.spin.orientation),
        THREE.MathUtils.degToRad(planet.spin.tilt),
        "YXZ",
      );
      const spinDegrees = rotationPhase(planet.spin, this.rotationHours);
      entry.body.rotation.y = THREE.MathUtils.degToRad(spinDegrees);
      entry.environment?.update(time, radius, viewDirection, spinDegrees);
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
        radius,
        id: planet.id,
      });
      for (const moon of entry.moons) {
        moon.mesh.position.set(...moonPosition(moon, time));
        moon.mesh.rotation.y =
          ((moon.phase + time * moon.speed) * Math.PI) / 180;
        moon.mesh.updateMatrixWorld();
        frames.push({
          surface: moon.surface,
          center: moon.mesh.getWorldPosition(new THREE.Vector3()),
          radius: moon.size * radius,
          id: moon.id,
          moon: true,
        });
      }
      for (const named of entry.notableMoons) {
        const moon = planet.notableMoons.find((m) => m.id === named.id)!;
        named.node.visible = moon.visible;
        named.orbitLine.visible =
          moon.visible &&
          this.model.motion.orbitLines &&
          this.selected === planet.id;
        (named.orbitLine.material as THREE.LineBasicMaterial).opacity =
          this.selectedMoon === moon.id ? 0.5 : 0.2;
        if (!moon.visible) continue;
        const point = notableMoonPosition(
          moon,
          this.moonDays - this.model.motion.moonEpochDays,
          named.factor,
        );
        named.node.position.set(...point);
        if (moon.spin.tidallyLocked) {
          named.node.rotation.set(0, Math.atan2(-point[0], -point[2]), 0);
          named.mesh.rotation.y = THREE.MathUtils.degToRad(moon.spin.phase);
        } else {
          named.node.rotation.set(
            0,
            THREE.MathUtils.degToRad(moon.spin.orientation),
            THREE.MathUtils.degToRad(moon.spin.tilt),
            "YXZ",
          );
          named.mesh.rotation.y = THREE.MathUtils.degToRad(
            rotationPhase(moon.spin, this.rotationHours),
          );
        }
        named.node.updateMatrixWorld(true);
        frames.push({
          surface: named.surface,
          center: named.mesh.getWorldPosition(new THREE.Vector3()),
          radius: named.radius * radius,
          id: named.key,
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
    const lighting = sceneLighting(this.model);
    const lightPosition = new THREE.Vector3(...lighting.position);
    this.asteroidBelt.update(
      this.orbitDays,
      this.rotationHours,
      lightPosition,
      lighting.fullyLit,
    );
    for (const entry of this.entries.values())
      for (const ring of entry.rings) {
        ring.uniforms.u_sun.value.copy(lightPosition);
        ring.uniforms.u_fill.value = lighting.ringFill;
      }
    for (const frame of frames) {
      const uniforms = frame.surface.material.uniforms;
      uniforms.u_sun.value.copy(lightPosition);
      uniforms.u_fill.value = frame.moon ? lighting.moonFill : lighting.fill;
      uniforms.u_terminatorStart.value = -Math.max(
        lighting.fullyLit ? 0.4 : 0.08,
        Math.min(0.65, sunRadius / lightPosition.distanceTo(frame.center)),
      );
      const receiver = spheres.find((sphere) => sphere.id === frame.id)!;
      const shadowSun = {
        center: lightPosition.toArray() as [number, number, number],
        radius: sunRadius,
      };
      const casters = getPlanetShadowCasters(receiver, spheres, shadowSun);
      uniforms.u_shadowCount.value = casters.length;
      uniforms.u_shadowRadius.value = frame.radius;
      uniforms.u_shadowSun.value.set(
        ...lightPosition.clone().sub(frame.center).toArray(),
        sunRadius,
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
    const selectedNamed =
      selected && this.selectedMoon
        ? this.entries
            .get(selected.id)
            ?.notableMoons.find(
              (m) => m.id === this.selectedMoon && m.node.visible,
            )
        : undefined;
    this.selection.visible =
      this.selectedMoon && selected
        ? !!selectedNamed
        : !!selected || (this.sunSelected && sun.visible);
    if (selectedNamed && selected) {
      this.selection.position.copy(
        selectedNamed.mesh.getWorldPosition(new THREE.Vector3()),
      );
      this.selection.quaternion.copy(this.camera.quaternion);
      this.selection.scale.setScalar(
        selectedNamed.radius *
          planetRenderRadius(this.model, selected, this.largestDiameter),
      );
    } else if (selected && !this.selectedMoon) {
      this.selection.position.copy(
        this.entries.get(selected.id)!.root.position,
      );
      this.selection.quaternion.copy(this.camera.quaternion);
      this.selection.scale.setScalar(
        planetRenderRadius(this.model, selected, this.largestDiameter),
      );
    } else if (this.sunSelected && sun.visible) {
      this.selection.position.copy(this.sun.position);
      this.selection.quaternion.copy(this.camera.quaternion);
      this.selection.scale.setScalar((sunRadius * 1.05) / 1.28);
    }
    this.renderer.render(this.world, this.camera);
  };
  private pointerDown = (event: PointerEvent) => {
    if (this.drag || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      rotate: event.button === 2,
    };
    this.canvas.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const dx = event.clientX - this.drag.x,
      dy = event.clientY - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
    this.drag.moved = true;
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
    if (this.drag.rotate) this.callbacks.rotate(dx, dy);
    else this.callbacks.pan(dx, dy);
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (!this.drag.rotate && !this.drag.moved) {
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
      if (intersection?.object === this.sun) this.callbacks.selectSun();
      else if (intersection?.object.userData.moonId)
        this.callbacks.selectMoon(
          intersection.object.userData.planetId,
          intersection.object.userData.moonId,
        );
      else
        this.callbacks.select(intersection?.object.userData.planetId ?? null);
    }
    this.drag = null;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
  };
  private pointerCancel = (event: PointerEvent) => {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
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
    this.canvas.removeEventListener("lostpointercapture", this.pointerCancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    for (const entry of this.entries.values()) this.releaseEntry(entry);
    this.entries.clear();
    this.asteroidBelt.dispose();
    this.sunSurface.dispose();
    this.sphere.dispose();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
    this.selection.geometry.dispose();
    (this.selection.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
