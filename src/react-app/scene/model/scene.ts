import { defaultMoonSystem } from "./notableMoons.ts";
import {
  defaultRockyTerrain,
  defaultRockyRanges,
  rockyRanges,
  rollRockyTerrain,
} from "./rockySurfaces.ts";
import { defaultLighting } from "./lighting.ts";
import { defaultGasSurface } from "./gas.ts";
import { defaultAsteroidBelt } from "./asteroidBelt.ts";
import { defaultSizing, roundDiameter } from "./sizes.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import type { Planet, SceneModel } from "./schema.ts";

export function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export function objectId(): string {
  return crypto.randomUUID();
}
const streamSeed = (seed: string | number, channel: string) =>
  Math.floor(seededRandom(`${seed}:${channel}`)() * 2 ** 32);
const palettes = {
  rocky: [
    ["#dfaa2b", "#453215"],
    ["#b75330", "#743a2b"],
    ["#a4a5a0", "#4e5059"],
    ["#d9a559", "#5c4630"],
    ["#ae604a", "#64352f"],
  ],
  gas: [
    ["#528bea", "#d8e7f2"],
    ["#a787d9", "#e2c7e7"],
    ["#8ca8cb", "#e2dce9"],
    ["#b988a5", "#f0d3c5"],
    ["#c09255", "#e6dbb5"],
  ],
  icy: [
    ["#73b7b7", "#d2e7e2"],
    ["#6b85b8", "#b7cef2"],
    ["#96a7ce", "#dfe5ef"],
  ],
} as const;

export function createPlanet(
  id: string,
  seed: string | number,
  index = 0,
  type: Planet["type"] = "rocky",
): Planet {
  const planet: Planet = {
    id,
    name: `Planet ${index + 1}`,
    type,
    ...(type === "gas" ? { gas: { ...defaultGasSurface } } : {}),
    terrain: { ...defaultRockyTerrain },
    visible: true,
    locked: false,
    diameter: type === "rocky" ? 12.76 : 120,
    moonCount: type === "rocky" ? 1 : 4,
    proceduralMoons: false,
    notableMoons: [],
    moonSystem: { ...defaultMoonSystem },
    ringCount: type === "gas" ? 1 : 0,
    rings: {
      amount: type === "gas" ? 0.55 : 0,
      width: 1,
      opacity: 1,
      innerRadius: 1.35,
    },
    seeds: {
      surface: seed,
      moons: streamSeed(seed, "moons"),
      rings: streamSeed(seed, "rings"),
      weather: streamSeed(seed, "weather"),
    },
    families: {
      rocky: { color: "#b75330", accent: "#743a2b", detail: 1 },
      gas: { color: "#528bea", accent: "#d8e7f2", detail: 1 },
      icy: { color: "#73b7b7", accent: "#d2e7e2", detail: 0.35 },
    },
    ranges: {
      diameter: type === "rocky" ? [5, 20] : [50, 150],
      moons: [0, 5],
      rings: [0, 2],
      ringAmount: [0, 1],
      detail: [0.4, 1.4],
      terrain: structuredClone(defaultRockyRanges),
    },
    orbit: {
      inclination: Math.min(30, index * 2),
      orientation: 0,
      phase: (25 + index * 115) % 360,
      periodDays: 365 * (1 + index * 0.7),
      reverse: false,
      playing: true,
      center: [0, 0, 0],
      ellipse: {
        radiusX: Math.min(225, 80 + index * 36),
        radiusZ: Math.min(225, 80 + index * 36) * Math.sqrt(1 - 0.04 ** 2),
        rotation: 0,
        anchor: "center",
      },
    },
    spin: {
      tilt: 12,
      orientation: 0,
      phase: 0,
      periodHours: type === "rocky" ? 24 : 10,
      reverse: false,
      playing: true,
    },
  };
  return planet;
}

export function createScene(): SceneModel {
  const rocky = createPlanet("planet-1", 1871, 0, "rocky");
  const gas = createPlanet("planet-2", 7284, 1, "gas");
  gas.orbit.phase = 325;
  gas.spin.tilt = 24;
  gas.diameter = 140;
  const icy = createPlanet("planet-3", 5921, 2, "icy");
  icy.orbit.phase = 35;
  icy.spin.tilt = 65;
  icy.diameter = 50;
  icy.moonCount = 2;
  icy.ringCount = 1;
  icy.rings!.amount = 0.4;
  return {
    name: "Untitled space",
    timeline: {
      elapsed: 0,
      solar: 0,
      rotationHours: 0,
      orbitDays: 0,
      moonDays: 0,
    },
    background: {
      visible: true,
      seed: 1871,
      density: 1,
      size: 1,
      brightness: 1,
      twinkle: true,
      clusterFrequency: 1,
      largeStarFrequency: 1,
      deepSky: {
        visible: true,
        seed: 1871,
        density: 1,
        size: 1,
        brightness: 1,
      },
    },
    sun: {
      visible: true,
      seed: 1871,
      diameter: 110,
      color: "#ffb400",
      highlight: "#fff01d",
      shadow: "#b52d00",
      activity: true,
      glow: 1,
      sunspots: { frequency: 1, size: 1 },
      position: [0, 0, 0],
    },
    planets: [rocky, gas, icy],
    asteroidBelt: structuredClone(defaultAsteroidBelt),
    sizing: { ...defaultSizing },
    lighting: defaultLighting,
    layout: { distanceCompression: 0.7, orbitScale: 1, orbitSpacing: 1 },
    view: { preset: "offset", framing: "portfolio", zoom: 1, pan: [0, 0, 0] },
    motion: {
      playing: true,
      speed: 1,
      orbitLines: true,
      orbitEpochDays: 0,
      moonEpochDays: 0,
      moonRate: { unit: "day/minute", multiplier: 3 },
      rotationRate: { unit: "hour/second", multiplier: 1 },
      orbitRate: { unit: "day/second", multiplier: 1 },
    },
  };
}

export type RerollScope = "all" | "surface" | "moons" | "rings" | "clouds";
/** Separate streams and explicit values keep unrelated settings stable and JSON portable. */
export function rerollPlanet(
  planet: Planet,
  nonce: number,
  scope: RerollScope = "all",
): Planet {
  if (planet.locked) return planet;
  const next = structuredClone(planet);
  const sample = (
    channel: string,
    [min, max]: [number, number],
    integer = false,
  ) => {
    const random = seededRandom(`${nonce}:${planet.id}:${channel}`)();
    return integer
      ? min + Math.floor(random * (max - min + 1))
      : Math.max(
          min,
          Math.min(max, Math.round((min + random * (max - min)) * 100) / 100),
        );
  };
  if (scope === "all" || scope === "surface") {
    next.seeds.surface = streamSeed(nonce, `${planet.id}:surface`);
    next.seeds.weather = streamSeed(nonce, `${planet.id}:weather`);
    const family = next.families[next.type];
    const allowed =
      family.palette ??
      palettes[next.type].map(([color, accent]) => ({ color, accent }));
    const palette = allowed[sample("palette", [0, allowed.length - 1], true)];
    next.families[next.type] = {
      ...family,
      ...palette,
      detail: sample("detail", next.ranges.detail),
    };
    if (next.type === "rocky" && !next.earthlike?.enabled) {
      next.terrain = rollRockyTerrain(
        rockyRanges(next.ranges.terrain, next.ranges.detail),
        `${nonce}:${planet.id}`,
        next.terrain,
      );
    }
  }
  if (
    scope === "clouds" ||
    (scope === "all" && (next.clouds || next.seeds.clouds !== undefined))
  ) {
    next.seeds.clouds = streamSeed(nonce, `${planet.id}:clouds`);
  }
  if (scope === "all")
    next.diameter = roundDiameter(sample("diameter", next.ranges.diameter));
  if (scope === "all" || scope === "moons") {
    next.seeds.moons = streamSeed(nonce, `${planet.id}:moons`);
    next.moonCount = sample("moons", next.ranges.moons, true);
  }
  if (scope === "all" || scope === "rings") {
    next.seeds.rings = streamSeed(nonce, `${planet.id}:rings`);
    next.ringCount = sample("rings", next.ranges.rings, true);
    if (next.rings || next.ranges.ringAmount) {
      next.rings = {
        amount: 0,
        width: 1,
        opacity: 1,
        innerRadius: 1.35,
        ...next.rings,
      };
      next.rings.amount =
        next.ranges.ringProbability !== undefined &&
        seededRandom(`${nonce}:${planet.id}:ring-chance`)() >=
          next.ranges.ringProbability
          ? 0
          : sample("ring-amount", next.ranges.ringAmount ?? [0, 1]);
      if (next.ranges.ringProbability !== undefined)
        next.ringCount = next.rings.amount > 0 ? 1 : 0;
    }
  }
  return next;
}
export function rerollScene(scene: SceneModel, nonce: number): SceneModel {
  return {
    ...scene,
    background: {
      ...scene.background,
      seed: streamSeed(nonce, "background"),
      ...(scene.background.deepSky
        ? {
            deepSky: {
              ...scene.background.deepSky,
              seed: streamSeed(nonce, "deep-sky"),
            },
          }
        : {}),
    },
    sun: { ...scene.sun, seed: streamSeed(nonce, "sun") },
    ...(scene.asteroidBelt
      ? {
          asteroidBelt: {
            ...scene.asteroidBelt,
            seed: streamSeed(nonce, "asteroid-belt"),
          },
        }
      : {}),
    planets: scene.planets.map((planet) => rerollPlanet(planet, nonce)),
  };
}
/** Importing a planet always creates a new identity; appearance and recipe are preserved. */
export function instantiatePlanet(planet: Planet, id: string): Planet {
  return { ...structuredClone(planet), id };
}
