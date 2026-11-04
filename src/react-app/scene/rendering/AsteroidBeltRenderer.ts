import * as THREE from "three";
import type { AsteroidBelt, SceneModel } from "../model/schema.ts";
import {
  asteroidBeltDays,
  asteroidDistanceMapper,
  asteroidPosition,
  asteroidProfiles,
  asteroidRenderRadius,
  asteroidVariantCount,
} from "../model/asteroidBelt.ts";
import type { AsteroidProfile } from "../model/asteroidBelt.ts";
import { starRenderPosition } from "../model/sizes.ts";
import { smallBodyAppearance } from "../model/systems.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import { rotationPhase } from "../model/time.ts";
import { createPlanetSurface, TextureStore } from "./materials.ts";
import type { PlanetSurface } from "./materials.ts";

type Batch = {
  mesh: THREE.InstancedMesh;
  surface: PlanetSurface;
  profiles: AsteroidProfile[];
};
/** A small pool of cratered moon surfaces shared across irregular instanced rocks. */
export class AsteroidBeltRenderer {
  readonly root = new THREE.Group();
  private key = "";
  private batches: Batch[] = [];
  private settings?: AsteroidBelt;
  private mapDistance = (distance: number) => distance;
  private transform = new THREE.Object3D();
  constructor(
    private textures: TextureStore,
    private onError: (message: string) => void,
  ) {}
  setModel(scene: SceneModel, factors: Map<string, number>) {
    const belt = scene.asteroidBelt;
    this.settings = belt;
    this.root.visible = !!belt?.visible && belt.count > 0;
    this.root.position.set(...starRenderPosition(scene));
    this.mapDistance = asteroidDistanceMapper(scene, factors);
    if (!belt || !belt.count) {
      this.release();
      this.key = "";
      return;
    }
    if (!belt.visible) return;
    const key = belt
      ? JSON.stringify({
          ...belt,
          visible: undefined,
          playing: undefined,
          reverse: undefined,
          epochDays: undefined,
          offsetDays: undefined,
          sizeScale: undefined,
        })
      : "";
    if (key === this.key) return;
    // Acquire new texture leases before releasing the old batches.
    const next: Batch[] = [];
    if (belt && belt.count) {
      const profiles = asteroidProfiles(belt),
        variants = asteroidVariantCount(belt);
      for (let index = 0; index < variants; index++) {
        const group = profiles.filter((p) => p.variant === index);
        if (!group.length) continue;
        const seed = `${belt.seed}:asteroid-surface:${index}`;
        const palette = smallBodyAppearance(seed, belt.colors);
        const surface = createPlanetSurface(
          this.textures,
          {
            type: "terrestrial",
            intense: index % 2 === 0,
            color: palette.color,
            accentColor: palette.accent,
            seed,
            detail: "moon",
          },
          this.onError,
        );
        const geometry = new THREE.IcosahedronGeometry(1, 2);
        const vertices = geometry.getAttribute("position");
        for (let v = 0; v < vertices.count; v++) {
          const x = vertices.getX(v),
            y = vertices.getY(v),
            z = vertices.getZ(v);
          // Coordinate-based displacement keeps coincident triangle vertices joined.
          const bump =
            0.87 +
            seededRandom(
              `${seed}:${x.toFixed(5)}:${y.toFixed(5)}:${z.toFixed(5)}`,
            )() *
              0.13;
          vertices.setXYZ(v, x * bump, y * bump, z * bump);
        }
        geometry.computeVertexNormals();
        const mesh = new THREE.InstancedMesh(
          geometry,
          surface.material,
          group.length,
        );
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Its root moves with the star; the scene envelope handles full-orbit clipping.
        mesh.frustumCulled = false;
        mesh.raycast = () => {};
        next.push({ mesh, surface, profiles: group });
      }
    }
    this.release();
    this.batches = next;
    this.key = key;
    for (const batch of next) this.root.add(batch.mesh);
  }
  update(
    orbitDays: number,
    rotationHours: number,
    lightPosition: THREE.Vector3,
    sunVisible: boolean,
  ) {
    const belt = this.settings;
    if (!this.root.visible || !belt) return;
    const days = asteroidBeltDays(belt, orbitDays),
      transform = this.transform;
    for (const batch of this.batches) {
      const uniforms = batch.surface.material.uniforms;
      uniforms.u_sun.value.copy(lightPosition);
      uniforms.u_fill.value = sunVisible ? 0.3 : 0.58;
      uniforms.u_terminatorStart.value = sunVisible ? -0.5 : -0.24;
      for (let i = 0; i < batch.profiles.length; i++) {
        const p = batch.profiles[i],
          radius = asteroidRenderRadius(belt, p.diameter);
        transform.position.set(...asteroidPosition(p, days, this.mapDistance));
        transform.rotation.set(
          THREE.MathUtils.degToRad(p.tilt),
          THREE.MathUtils.degToRad(
            rotationPhase(
              {
                phase: p.spinPhase,
                periodHours: p.spinHours,
                reverse: false,
                playing: true,
              },
              rotationHours,
            ),
          ),
          0,
          "YXZ",
        );
        transform.scale.set(
          ...(p.stretch.map((v) => v * radius) as [number, number, number]),
        );
        transform.updateMatrix();
        batch.mesh.setMatrixAt(i, transform.matrix);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  private release() {
    for (const batch of this.batches) {
      this.root.remove(batch.mesh);
      batch.mesh.dispose();
      batch.mesh.geometry.dispose();
      batch.surface.dispose();
    }
    this.batches = [];
  }
  dispose() {
    this.release();
  }
}
