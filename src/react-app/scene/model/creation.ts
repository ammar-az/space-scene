import { applyStarPreset, starPresets } from "../../data/starPresets.ts";
import { createScene, createPlanet, rerollPlanet } from "./scene.ts";
import { createNotableMoon } from "./notableMoons.ts";
import { setEarthlike } from "./earthlike.ts";
import { defaultAtmosphere, defaultClouds } from "./atmospheres.ts";
import { planetSchema, sceneSchema } from "./schema.ts";
import type { Planet, SceneModel } from "./schema.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import { roundDiameter } from "./sizes.ts";

export type PlanetKind = Planet["type"] | "earthlike";
export type PlanetDraft = {
  name: string;
  kind: PlanetKind;
  diameterKm: number;
  radiusX: number;
  radiusZ: number;
  periodDays: number;
  rotationHours: number;
  inclination: number;
  tilt: number;
  moons: number;
  rings: number;
  atmosphere: boolean;
  clouds: boolean;
};
export const planetKindNames: Record<PlanetKind, string> = {
  rocky: "Rocky",
  earthlike: "Earth-like",
  gas: "Gas giant",
  icy: "Icy giant",
};

export function newPlanetDraft(scene: SceneModel): PlanetDraft {
  const radius = roundDiameter(
    Math.min(
      1e9,
      Math.max(
        149.6,
        ...scene.planets.map(
          (p) =>
            Math.max(p.orbit.ellipse.radiusX, p.orbit.ellipse.radiusZ) * 1.35,
        ),
      ),
    ),
  );
  return {
    name: `Planet ${scene.planets.length + 1}`,
    kind: "rocky",
    diameterKm: 12760,
    radiusX: radius,
    radiusZ: radius,
    periodDays: roundDiameter(Math.min(1e12, 365 * (radius / 149.6) ** 1.5)),
    rotationHours: 24,
    inclination: 0,
    tilt: 12,
    moons: 0,
    rings: 0,
    atmosphere: false,
    clouds: false,
  };
}

export function configurePlanet(
  draft: PlanetDraft,
  id: string,
  seed: number,
  index = 0,
  center: [number, number, number] = [0, 0, 0],
): Planet {
  if (!Number.isInteger(draft.moons) || draft.moons < 0 || draft.moons > 16)
    throw new Error("Choose between 0 and 16 named moons.");
  let planet = rerollPlanet(
    createPlanet(
      id,
      seed,
      index,
      draft.kind === "earthlike" ? "rocky" : draft.kind,
    ),
    seed,
  );
  if (draft.kind === "earthlike") planet = setEarthlike(planet, true);
  planet = {
    ...planet,
    name: draft.name.trim(),
    diameter: roundDiameter(draft.diameterKm / 1000),
    orbit: {
      ...planet.orbit,
      center: [...center],
      inclination: draft.inclination,
      periodDays: draft.periodDays,
      ellipse: {
        ...planet.orbit.ellipse,
        radiusX: draft.radiusX,
        radiusZ: draft.radiusZ,
      },
    },
    spin: {
      ...planet.spin,
      periodHours: draft.rotationHours,
      tilt: draft.tilt,
    },
    ringCount: draft.rings > 0 ? 1 : 0,
    rings: { ...planet.rings!, amount: draft.rings },
    atmosphere: {
      ...(planet.atmosphere ?? defaultAtmosphere),
      visible: draft.atmosphere,
    },
    clouds: { ...(planet.clouds ?? defaultClouds), visible: draft.clouds },
    notableMoons: Array.from({ length: draft.moons }, (_, i) => {
      const moon = createNotableMoon(
        `${id}-moon-${i + 1}`,
        Math.floor(seededRandom(`${seed}:moon:${i}`)() * 2 ** 32),
        i,
      );
      return {
        ...moon,
        diameter: Math.min(1, roundDiameter(draft.diameterKm / 1000) * 0.15),
      };
    }),
  };
  return planetSchema.parse(planet);
}

export type SystemDraft = {
  name: string;
  seed: number;
  starPreset: string;
  starDiameterKm: number;
  counts: Record<PlanetKind, number>;
  innerOrbit: number;
  outerOrbit: number;
  moons: number;
  ringChance: number;
  sizeCompression: number;
  distanceCompression: number;
  asteroidBelt: boolean;
  view: SceneModel["view"]["preset"];
};
export function newSystemDraft(seed: number): SystemDraft {
  return {
    name: "New solar system",
    seed,
    starPreset: "main-g",
    starDiameterKm: 1391400,
    counts: { rocky: 3, earthlike: 1, gas: 2, icy: 2 },
    innerOrbit: 60,
    outerOrbit: 4500,
    moons: 0,
    ringChance: 0.35,
    sizeCompression: 0.5,
    distanceCompression: 0.7,
    asteroidBelt: false,
    view: "centered",
  };
}
export function configureSystem(draft: SystemDraft): SceneModel {
  if (
    Object.values(draft.counts).some(
      (n) => !Number.isInteger(n) || n < 0 || n > 32,
    )
  )
    throw new Error("Planet counts must be whole numbers from 0 to 32.");
  if (draft.outerOrbit < draft.innerOrbit)
    throw new Error(
      "The outer orbit must be at least as large as the inner orbit.",
    );
  const count = Object.values(draft.counts).reduce((sum, n) => sum + n, 0);
  if (count > 64) throw new Error("Choose up to 64 planets.");
  const random = seededRandom(draft.seed);
  const sample = (low: number, high: number) => low + random() * (high - low);
  const base = createScene();
  const recipe =
    starPresets.find((p) => p.id === draft.starPreset) ?? starPresets[1];
  base.name = draft.name.trim();
  base.sun = {
    ...applyStarPreset(base.sun, recipe),
    diameter: roundDiameter(draft.starDiameterKm / 10000),
    seed: draft.seed,
  };
  base.background.seed = draft.seed;
  if (base.background.deepSky) base.background.deepSky.seed = draft.seed;
  base.layout = {
    ...base.layout!,
    distanceCompression: draft.distanceCompression,
  };
  base.sizing.planetCompression = draft.sizeCompression;
  base.view.preset = draft.view;
  let index = 0;
  base.planets = (Object.keys(planetKindNames) as PlanetKind[]).flatMap(
    (kind) =>
      Array.from({ length: draft.counts[kind] }, () => {
        const i = index++;
        const radius =
          draft.innerOrbit *
          (draft.outerOrbit / draft.innerOrbit) **
            (count > 1 ? i / (count - 1) : 0);
        const eccentricity = sample(0, 0.1);
        const [min, max] =
          kind === "rocky"
            ? [3000, 22000]
            : kind === "earthlike"
              ? [9000, 18000]
              : kind === "gas"
                ? [65000, 150000]
                : [30000, 65000];
        const seed = Math.floor(random() * 2 ** 32);
        const settings: PlanetDraft = {
          name: `Planet ${i + 1}`,
          kind,
          diameterKm: sample(min, max),
          radiusX: radius,
          radiusZ: radius * Math.sqrt(1 - eccentricity ** 2),
          periodDays: Math.min(1e12, 365 * (radius / 149.6) ** 1.5),
          rotationHours: sample(8, 40),
          inclination: sample(-3, 3),
          tilt: sample(0, 35),
          moons: draft.moons,
          rings: random() < draft.ringChance ? sample(0.05, 0.8) : 0,
          atmosphere: kind === "earthlike",
          clouds: kind === "earthlike",
        };
        return configurePlanet(
          settings,
          `planet-${draft.seed}-${i + 1}`,
          seed,
          i,
        );
      }),
  );
  base.asteroidBelt = {
    ...base.asteroidBelt!,
    visible: draft.asteroidBelt,
    seed: draft.seed,
    distance: [
      draft.innerOrbit * (draft.outerOrbit / draft.innerOrbit) ** 0.45,
      draft.innerOrbit * (draft.outerOrbit / draft.innerOrbit) ** 0.55,
    ],
  };
  return sceneSchema.parse(base);
}
