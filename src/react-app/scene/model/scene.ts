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
    visible: true,
    locked: false,
    radius: type === "rocky" ? 3.6 : 7,
    moonCount: type === "rocky" ? 1 : 4,
    ringCount: type === "gas" ? 1 : 0,
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
      radius: [2.5, 8],
      moons: [0, 5],
      rings: [0, 2],
      detail: [0.4, 1.4],
    },
    orbit: {
      radius: Math.min(225, 80 + index * 36),
      eccentricity: 0.04,
      inclination: Math.min(30, index * 2),
      orientation: 0,
      phase: (25 + index * 115) % 360,
      speed: 3 / (1 + index * 0.7),
      center: [0, 0, 0],
    },
    spin: {
      tilt: 12,
      orientation: 0,
      phase: 0,
      speed: type === "rocky" ? 4 : 8,
    },
  };
  return planet;
}

export function createScene(): SceneModel {
  const rocky = createPlanet("planet-1", 1871, 0, "rocky");
  const gas = createPlanet("planet-2", 7284, 1, "gas");
  gas.orbit.phase = 325;
  gas.spin.tilt = 24;
  gas.radius = 7.5;
  const icy = createPlanet("planet-3", 5921, 2, "icy");
  icy.orbit.phase = 35;
  icy.spin.tilt = 65;
  icy.radius = 5.5;
  icy.moonCount = 2;
  icy.ringCount = 1;
  return {
    name: "Untitled space",
    timeline: { elapsed: 0, solar: 0 },
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
      radius: 55,
      color: "#ffb400",
      highlight: "#fff01d",
      shadow: "#b52d00",
      activity: true,
      position: [0, 0, 0],
    },
    planets: [rocky, gas, icy],
    view: { preset: "offset", framing: "portfolio", zoom: 1, pan: [0, 0, 0] },
    motion: { playing: true, speed: 1, orbitLines: true, orbitEpoch: 0 },
  };
}

export type RerollScope = "all" | "surface" | "moons" | "rings";
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
      : Math.round((min + random * (max - min)) * 100) / 100;
  };
  if (scope === "all" || scope === "surface") {
    next.seeds.surface = streamSeed(nonce, `${planet.id}:surface`);
    next.seeds.weather = streamSeed(nonce, `${planet.id}:weather`);
    const palette =
      palettes[next.type][
        sample("palette", [0, palettes[next.type].length - 1], true)
      ];
    next.families[next.type] = {
      color: palette[0],
      accent: palette[1],
      detail: sample("detail", next.ranges.detail),
    };
  }
  if (scope === "all") next.radius = sample("radius", next.ranges.radius);
  if (scope === "all" || scope === "moons") {
    next.seeds.moons = streamSeed(nonce, `${planet.id}:moons`);
    next.moonCount = sample("moons", next.ranges.moons, true);
  }
  if (scope === "all" || scope === "rings") {
    next.seeds.rings = streamSeed(nonce, `${planet.id}:rings`);
    next.ringCount = sample("rings", next.ranges.rings, true);
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
    planets: scene.planets.map((planet) => rerollPlanet(planet, nonce)),
  };
}
/** Importing a planet always creates a new identity; appearance and recipe are preserved. */
export function instantiatePlanet(planet: Planet, id: string): Planet {
  return { ...structuredClone(planet), id };
}
