import type { Planet } from "./schema.ts";
import { seededRandom } from "../utils/seededRandom.ts";
export const DEFAULT_CLOUD_SEED = 1871;
export type Atmosphere = NonNullable<Planet["atmosphere"]>;
export type Clouds = NonNullable<Planet["clouds"]>;
export const defaultAtmosphere: Atmosphere = {
  visible: false,
  color: "#79b8ff",
  density: 0.7,
  height: 0.035,
};
export const defaultClouds: Clouds = {
  visible: false,
  color: "#f4f7ff",
  coverage: 0.5,
  opacity: 0.92,
  scale: 4.5,
  altitude: 0.012,
  speed: 0.15,
  evolution: 0.6,
};
/** Disabled layers add no geometry; gas/icy families retain their existing cloud surfaces. */
export function environmentSettings(planet: Planet) {
  const atmosphere = planet.atmosphere ?? defaultAtmosphere,
    clouds = planet.clouds ?? defaultClouds;
  const rocky = planet.type === "rocky";
  const hasClouds =
    rocky && clouds.visible && clouds.opacity > 0 && clouds.coverage > 0;
  const hasAtmosphere = rocky && atmosphere.visible && atmosphere.density > 0;
  const height = Math.max(
    atmosphere.height,
    hasClouds ? clouds.altitude + 0.008 : 0,
  );
  return {
    atmosphere,
    clouds,
    hasClouds,
    hasAtmosphere,
    cloudScale: 1 + clouds.altitude,
    atmosphereScale: 1 + height,
  };
}
export function cloudSeedOffset(planet: Planet): [number, number, number] {
  const random = seededRandom(
    `${planet.seeds.clouds ?? DEFAULT_CLOUD_SEED}:field`,
  );
  return [random() * 200 + 10, random() * 200 + 10, random() * 200 + 10];
}
export function cloudRotation(
  planet: Planet,
  time: number,
  spin = planet.spin,
) {
  return (
    ((spin.phase +
      time * (spin.speed + (planet.clouds ?? defaultClouds).speed)) *
      Math.PI) /
    180
  );
}

/** A bounded, looping phase prevents long-running clocks from losing shader precision. */
export function cloudEvolution(
  planet: Planet,
  time: number,
): [number, number, number] {
  const phase =
    ((time * (planet.clouds?.evolution ?? 0.6) * Math.PI) / 60) % (Math.PI * 2);
  return [
    Math.sin(phase) * 0.65,
    (Math.cos(phase) - 1) * 0.65,
    Math.sin(phase * 2) * 0.25,
  ];
}
