import type { Planet, SceneModel } from "./schema.ts";

export const PLANET_DIAMETER_LIMITS = [0.01, 1000000] as const;
export const STAR_DIAMETER_LIMITS = [0.01, 1000000000] as const;
/** Physical diameter unit: 1,000 km for planets; 10,000 km for the star. */
export const roundDiameter = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
/** Presentation conversion only: 1,000 km occupies 0.16 scene units before display scaling. */
export const WORLD_UNITS_PER_THOUSAND_KM = 0.16;
export const defaultSizing: SceneModel["sizing"] = {
  planetCompression: 0.5,
  planetScale: 1,
  starScale: 0.63,
};
export function largestPlanetDiameter(scene: SceneModel): number {
  // Hiding a planet does not resize the rest of the system.
  return Math.max(0.01, ...scene.planets.map((planet) => planet.diameter));
}
export function compressedPlanetDiameter(
  scene: SceneModel,
  planet: Planet,
  largest = largestPlanetDiameter(scene),
): number {
  return (
    largest *
    Math.pow(planet.diameter / largest, 1 - scene.sizing.planetCompression)
  );
}
export function renderedPlanetDiameter(
  scene: SceneModel,
  planet: Planet,
  largest = largestPlanetDiameter(scene),
): number {
  return (
    compressedPlanetDiameter(scene, planet, largest) * scene.sizing.planetScale
  );
}
export function planetRenderRadius(
  scene: SceneModel,
  planet: Planet,
  largest = largestPlanetDiameter(scene),
): number {
  return (
    (renderedPlanetDiameter(scene, planet, largest) *
      WORLD_UNITS_PER_THOUSAND_KM) /
    2
  );
}
export function renderedStarDiameter(scene: SceneModel): number {
  return scene.sun.diameter * scene.sizing.starScale;
}
export function starRenderRadius(scene: SceneModel): number {
  return (renderedStarDiameter(scene) * 10 * WORLD_UNITS_PER_THOUSAND_KM) / 2;
}

/** Physical position units are millions of km; camera coordinates remain scene units. */
export const WORLD_UNITS_PER_MILLION_KM = WORLD_UNITS_PER_THOUSAND_KM * 1000;
export function starRenderPosition(
  scene: SceneModel,
): [number, number, number] {
  return scene.sun.position.map(
    (value) => value * WORLD_UNITS_PER_MILLION_KM,
  ) as [number, number, number];
}
