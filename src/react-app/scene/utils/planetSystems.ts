import { seededRandom } from "./seededRandom.ts";
import type { PlanetTextureOptions } from "./planetTextures.ts";
import { getMoonShape } from "./moonShapes.ts";
import type { MoonShape } from "./moonShapes.ts";

export type Vector3 = [number, number, number];
export type MoonProfile = {
  seed: string;
  material: number;
  size: number;
  distance: number;
  phase: number;
  period: number;
  direction: number;
  angle: number;
  opening: number;
  tint: Vector3;
  shape: MoonShape;
};
export type RingProfile = {
  seed: string;
  inner: number;
  outer: number;
  opening: number;
  tint: Vector3;
  bands: Float32Array;
  opacity: number;
};
export type PlanetSystem = {
  moons: MoonProfile[];
  ring?: RingProfile;
  extent: number;
};

/** The portfolio ring recipe, also usable when the editor explicitly requests rings. */
export function createRingProfile(
  seed: string | number,
  color: string,
): RingProfile {
  const ringRandom = seededRandom(`rings:${seed}`);
  ringRandom(); // Preserve the original eligibility draw before the appearance recipe.
  const inner = 1.28 + ringRandom() * 0.24;
  const outer = inner + 0.42 + ringRandom() * 0.45;
  const primary = [1, 3, 5].map(
    (i) => parseInt(color.slice(i, i + 2), 16) / 255,
  );
  return {
    seed: `rings:${seed}`,
    inner,
    outer,
    opening: 0.22 + ringRandom() * 0.16,
    tint: primary.map(
      (c, i) => c * 0.27 + [0.78, 0.76, 0.71][i] * 0.73,
    ) as Vector3,
    opacity: 0.52 + ringRandom() * 0.26,
    bands: new Float32Array(Array.from({ length: 16 }, () => ringRandom())),
  };
}

/** Separate streams leave the accepted planet artwork and rotation unchanged. Distances use parent radii. */
export function getPlanetSystem(options: PlanetTextureOptions): PlanetSystem {
  const random = seededRandom(`${options.seed}:satellites`);
  const rocky = options.type === "terrestrial",
    gas = !rocky && options.intense;
  const ringRandom = seededRandom(`rings:${options.seed}`);
  let ring: RingProfile | undefined;
  if (!rocky && ringRandom() < (gas ? 0.5 : 0.25)) {
    ring = createRingProfile(options.seed, options.color);
  }
  const count = rocky
    ? Math.floor(random() * 4)
    : gas
      ? 3 + Math.floor(random() ** 1.5 * 8)
      : 2 + Math.floor(random() * 4);
  const commonAngle = (random() - 0.5) * 0.5,
    opening = ring?.opening ?? 0.3 + random() * 0.4;
  const moons = Array.from({ length: count }, (_, index): MoonProfile => {
    const size = rocky
      ? 0.2 + random() * 0.25
      : gas
        ? 0.08 + random() * 0.07
        : 0.12 + random() * 0.1;
    const distance =
      (ring ? ring.outer + 0.13 + size : 1.15 + size) +
      (index / Math.max(1, count - 1)) * (ring ? 0.25 : 0.6) +
      random() * 0.06;
    const color = seededRandom(`${options.seed}:moon-color:${index}`);
    const tones: Vector3[] = [
      [0.96, 0.98, 1],
      [1.11, 1.03, 0.86],
      [0.96, 0.98, 1],
      [1.11, 1.03, 0.86],
      [1.14, 0.83, 0.66],
      [0.64, 0.42, 0.28],
      [1.16, 1.1, 0.84],
      [0.54, 0.56, 0.58],
      [1.38, 1.4, 1.38],
      [0.91, 1.01, 1.1],
      [1.12, 0.98, 0.95],
    ];
    const tone = tones[Math.floor(color() * tones.length)],
      brightness = 0.88 + color() * 0.2;
    const tint = tone.map((value) => value * brightness) as Vector3;
    return {
      seed: `${options.seed}:moon:${index}`,
      material: Math.floor(random() * moonMaterialCount),
      size,
      tint,
      shape: getMoonShape(`${options.seed}:moon:${index}`, size),
      distance,
      phase: random() * Math.PI * 2,
      period: (18 + random() * 7) * (distance / 1.45) ** 1.5,
      direction: random() < 0.08 ? -1 : 1,
      angle: commonAngle + (random() - 0.5) * 0.16,
      opening: Math.max(0.22, Math.min(0.8, opening + (random() - 0.5) * 0.12)),
    };
  });
  return {
    moons,
    ring,
    extent: Math.max(
      1,
      ring?.outer ?? 1,
      ...moons.map((m) => m.distance + m.size),
    ),
  };
}

export function systemBasis(
  angle: number,
  opening: number,
): { major: Vector3; minor: Vector3 } {
  return {
    major: [Math.cos(angle), Math.sin(angle), 0],
    minor: [
      -Math.sin(angle) * opening,
      Math.cos(angle) * opening,
      Math.sqrt(1 - opening * opening),
    ],
  };
}

export function moonOffset(
  moon: MoonProfile,
  radius: number,
  elapsedMs: number,
  angle: number,
): Vector3 {
  const basis = systemBasis(angle + moon.angle, moon.opening);
  const phase =
    moon.phase +
    ((moon.direction * elapsedMs) / (moon.period * 1000)) * Math.PI * 2;
  return basis.major.map(
    (v, i) =>
      radius *
      moon.distance *
      (v * Math.cos(phase) + basis.minor[i] * Math.sin(phase)),
  ) as Vector3;
}

/** Separate projected systems cannot physically intersect: reserve an entire depth band for each. */
export function systemDepthLayers(
  systems: { id: string; depth: number; extent: number }[],
) {
  const centers = new Map<string, number>();
  let cursor = 0;
  for (const system of [...systems].sort(
    (a, b) => a.depth - b.depth || a.id.localeCompare(b.id),
  )) {
    const half = Math.max(1, system.extent) + 2;
    centers.set(system.id, cursor + half);
    cursor += half * 2;
  }
  return { centers, range: Math.max(1, cursor + 2) };
}

const moonMaterials = [
  {
    color: "#aaa79d",
    accentColor: "#56534d",
    intense: true,
    seed: "moon-rock-0",
  },
  {
    color: "#b0aaa0",
    accentColor: "#696458",
    intense: false,
    seed: "moon-plains-1",
  },
  {
    color: "#a6a8a6",
    accentColor: "#494c4b",
    intense: true,
    seed: "moon-rock-2",
  },
] as const;
export const moonMaterialCount = moonMaterials.length;

/** Three neutral maps are shared across systems, independently of each moon's tint and shape. */
export function moonMaterial(index: number): PlanetTextureOptions {
  return { ...moonMaterials[index], type: "terrestrial", detail: "moon" };
}

/** A one-dimensional radial opacity profile: broad belts, fine ringlets, and two real gaps. */
export function ringPixels(profile: RingProfile, complexity = 1) {
  const pixels = new Uint8Array(512 * 4),
    b = profile.bands;
  const smooth = (a: number, z: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (z - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < 512; i++) {
    const t = i / 511;
    let density =
      0.63 +
      0.12 * complexity * Math.sin(t * (10 + b[0] * 10) + b[1] * 6.28) +
      0.05 * complexity * Math.sin(t * (40 + b[2] * 25)) +
      0.018 * complexity * Math.sin(t * 180 + b[3] * 6.28);
    for (const [center, width] of [
      [0.57 + b[4] * 0.12, 0.025 + b[5] * 0.025],
      [0.25 + b[6] * 0.08, 0.009],
    ]) {
      density *=
        1 -
        Math.max(0, (complexity - 0.4) / 0.6) *
          (1 - smooth(width * 0.5, width, Math.abs(t - center)));
    }
    density *= smooth(0, 0.02, t) * (1 - smooth(0.95, 1, t));
    const value = Math.round(Math.max(0, Math.min(1, density)) * 255);
    pixels.set([value, value, value, 255], i * 4);
  }
  return pixels;
}
