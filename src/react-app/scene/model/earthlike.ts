import type { Planet } from "./schema.ts";
import {
  defaultAtmosphere,
  defaultClouds,
  DEFAULT_CLOUD_SEED,
} from "./atmospheres.ts";

export type Earthlike = NonNullable<Planet["earthlike"]>;
export const defaultEarthlike: Earthlike = {
  enabled: true,
  oceanColor: "#216ca8",
  landColor: "#588342",
  desertColor: "#c6ad76",
  landCoverage: 0.3,
  continentScale: 1.8,
};
/** Initialize once; toggling or changing family later preserves the edited surface and weather. */
export function setEarthlike(planet: Planet, enabled: boolean): Planet {
  if (planet.earthlike)
    return { ...planet, earthlike: { ...planet.earthlike, enabled } };
  if (!enabled) return planet;
  return {
    ...planet,
    earthlike: { ...defaultEarthlike },
    atmosphere: {
      ...defaultAtmosphere,
      visible: true,
      color: "#75b5ff",
      density: 0.8,
    },
    clouds: { ...defaultClouds, visible: true, coverage: 0.48 },
    seeds: {
      ...planet.seeds,
      clouds: planet.seeds.clouds ?? DEFAULT_CLOUD_SEED,
    },
  };
}
