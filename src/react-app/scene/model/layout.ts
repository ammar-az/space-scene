import { planetRenderRadius, starRenderRadius } from "./sizes.ts";
import type { Planet, SceneModel } from "./schema.ts";
import { orbitCenter, orbitEllipse, orbitPosition } from "./geometry.ts";
import { environmentSettings } from "./atmospheres.ts";
import { moonProfiles, planetRing } from "./systems.ts";
type Vector = [number, number, number];
export const defaultLayout = { orbitScale: 1, orbitSpacing: 1 };

/** Scale each entire path about the Sun; hidden worlds retain their place in the layout. */
export function orbitLayoutFactors(scene: SceneModel): Map<string, number> {
  const settings = scene.layout ?? defaultLayout;
  const radii = scene.planets.map((planet) => {
    const ellipse = orbitEllipse(planet.orbit);
    return Math.max(ellipse.radiusX, ellipse.radiusZ);
  });
  const inner = Math.min(...radii);
  return new Map(
    scene.planets.map((planet, i) => [
      planet.id,
      (settings.orbitScale *
        (inner + (radii[i] - inner) * settings.orbitSpacing)) /
        radii[i],
    ]),
  );
}
export function scaleOrbitPoint(
  point: Vector,
  sun: Vector,
  factor: number,
): Vector {
  if (factor === 1) return point;
  return point.map((value, i) => sun[i] + (value - sun[i]) * factor) as Vector;
}
/** Parent-relative moons/rings/layers contribute to fit/clipping, without being resized. */
export function planetSystemRadius(scene: SceneModel, planet: Planet) {
  const environment = environmentSettings(planet);
  return (
    planetRenderRadius(scene, planet) *
    Math.max(
      1,
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
    ? [{ center: scene.sun.position, radius: starRenderRadius(scene) }]
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
  return spheres;
}
/** Samples the complete paths so the fitted system stays in frame as it orbits. */
export function sceneFitSamples(scene: SceneModel) {
  const factors = orbitLayoutFactors(scene);
  const samples: { center: Vector; radius: number }[] = scene.sun.visible
    ? [{ center: scene.sun.position, radius: starRenderRadius(scene) }]
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
  return samples;
}
