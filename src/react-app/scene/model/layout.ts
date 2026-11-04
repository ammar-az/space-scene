import { notableSystemExtent } from "./notableMoons.ts";
import { asteroidBeltBounds } from "./asteroidBelt.ts";
import {
  planetRenderRadius,
  starRenderRadius,
  starRenderPosition,
  WORLD_UNITS_PER_MILLION_KM,
} from "./sizes.ts";
import type { Planet, SceneModel } from "./schema.ts";
import { orbitCenter, orbitEllipse, orbitPosition } from "./geometry.ts";
import { environmentSettings } from "./atmospheres.ts";
import { moonProfiles, planetRing } from "./systems.ts";
type Vector = [number, number, number];
export const defaultLayout = {
  distanceCompression: 0.7,
  orbitScale: 1,
  orbitSpacing: 1,
};

/** Physical-to-render factors preserve each complete ellipse while compressing distance ratios. */
export function orbitLayoutFactors(scene: SceneModel): Map<string, number> {
  const settings = scene.layout ?? defaultLayout;
  const paths = scene.planets
    .map((planet) => {
      const ellipse = orbitEllipse(planet.orbit),
        major = Math.max(ellipse.radiusX, ellipse.radiusZ);
      let near = Infinity,
        far = 0;
      for (let phase = 0; phase < 360; phase += 2) {
        const point = orbitPosition(
          { ...planet.orbit, phase },
          0,
          scene.sun.position,
        );
        const distance = Math.hypot(
          ...point.map((v, i) => v - scene.sun.position[i]),
        );
        near = Math.min(near, distance);
        far = Math.max(far, distance);
      }
      const centered =
        ellipse.anchor === "sun" ||
        Math.hypot(
          ...planet.orbit.center.map((v, i) => v - scene.sun.position[i]),
        ) < 1e-8;
      const environment = environmentSettings(planet);
      const body =
        planetRenderRadius(scene, planet) *
        Math.max(
          1,
          environment.hasAtmosphere ? environment.atmosphereScale : 1,
          environment.hasClouds ? environment.cloudScale : 1,
        );
      return { planet, major, near, far, centered, body };
    })
    .sort((a, b) => a.major - b.major);
  if (!paths.length) return new Map();
  const inner = paths[0],
    star = starRenderRadius(scene);
  const baseline = Math.max(
    80,
    star * 1.5,
    inner.near > 1e-8
      ? ((star + planetSystemRadius(scene, inner.planet) + 12) * inner.major) /
          inner.near
      : 0,
  );
  const result = new Map<string, number>();
  let previous: (typeof paths)[number] | undefined,
    previousFactor = 0;
  for (const path of paths) {
    const compressed =
      baseline *
      Math.pow(path.major / inner.major, 1 - settings.distanceCompression);
    let displayed = baseline + (compressed - baseline) * settings.orbitSpacing;
    // Retain intentionally crossing/off-center source paths; keep originally nested, centered paths readable.
    if (
      previous &&
      path.centered &&
      previous.centered &&
      path.near > previous.far &&
      path.near > 1e-8
    ) {
      const needed =
        ((previous.far * previousFactor + previous.body + path.body + 6) /
          path.near) *
        path.major;
      displayed = Math.max(displayed, needed);
    }
    const factor = displayed / path.major;
    result.set(path.planet.id, factor * settings.orbitScale);
    previous = path;
    previousFactor = factor;
  }
  return result;
}
/** Convert physical Mkm coordinates around the star into scene coordinates. */
export function scaleOrbitPoint(
  point: Vector,
  sun: Vector,
  factor: number,
): Vector {
  return point.map(
    (value, i) =>
      sun[i] * WORLD_UNITS_PER_MILLION_KM + (value - sun[i]) * factor,
  ) as Vector;
}
/** Parent-relative moons/rings/layers contribute to fit/clipping, without being resized. */
export function planetSystemRadius(scene: SceneModel, planet: Planet) {
  const environment = environmentSettings(planet);
  return (
    planetRenderRadius(scene, planet) *
    Math.max(
      1,
      notableSystemExtent(planet),
      planetRing(planet)?.outer ?? 1,
      environment.hasAtmosphere ? environment.atmosphereScale : 1,
      environment.hasClouds ? environment.cloudScale : 1,
      ...moonProfiles(planet).map((moon) => moon.distance + moon.size),
    )
  );
}
export function sceneEnvelopes(
  scene: SceneModel,
  factors = orbitLayoutFactors(scene),
) {
  const spheres: { center: Vector; radius: number }[] = scene.sun.visible
    ? [{ center: starRenderPosition(scene), radius: starRenderRadius(scene) }]
    : [];
  for (const planet of scene.planets) {
    if (!planet.visible) continue;
    const factor = factors.get(planet.id) ?? 1,
      ellipse = orbitEllipse(planet.orbit);
    spheres.push({
      center: scaleOrbitPoint(
        orbitCenter(planet.orbit, scene.sun.position),
        scene.sun.position,
        factor,
      ),
      radius:
        Math.max(ellipse.radiusX, ellipse.radiusZ) * factor +
        planetSystemRadius(scene, planet),
    });
  }
  const belt = asteroidBeltBounds(scene, factors);
  if (belt)
    spheres.push({
      center: starRenderPosition(scene),
      radius: belt.radius + belt.body,
    });
  return spheres;
}
/** Samples the complete paths so the fitted system stays in frame as it orbits. */
export function sceneFitSamples(scene: SceneModel) {
  const factors = orbitLayoutFactors(scene);
  const samples: { center: Vector; radius: number }[] = scene.sun.visible
    ? [{ center: starRenderPosition(scene), radius: starRenderRadius(scene) }]
    : [];
  for (const planet of scene.planets) {
    if (!planet.visible) continue;
    const radius = planetSystemRadius(scene, planet),
      factor = factors.get(planet.id) ?? 1;
    for (let phase = 0; phase < 360; phase += 2)
      samples.push({
        center: scaleOrbitPoint(
          orbitPosition({ ...planet.orbit, phase }, 0, scene.sun.position),
          scene.sun.position,
          factor,
        ),
        radius,
      });
  }
  const belt = asteroidBeltBounds(scene, factors);
  if (belt) {
    const center = starRenderPosition(scene);
    for (let i = 0; i < 64; i++) {
      const phase = (i / 64) * Math.PI * 2;
      samples.push({
        center: [
          center[0] + Math.cos(phase) * belt.radius,
          center[1],
          center[2] + Math.sin(phase) * belt.radius,
        ],
        radius: belt.height + belt.body,
      });
    }
  }
  return samples;
}
