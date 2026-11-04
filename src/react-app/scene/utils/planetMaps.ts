import { hash, noise, fractal } from "./noise3d.ts";
import { generateEarthMap } from "./earthMaps.ts";
import { generateGiantMap } from "./giantMaps.ts";
import { generateRockyMap } from "./rockyMaps.ts";
import type { PlanetTextureOptions } from "./planetTextures.ts";
import { seededRandom } from "./seededRandom.ts";
import type { GiantStormProfile } from "./giantStorms.ts";

type RGB = [number, number, number];
export type PlanetMap = {
  width: number;
  height: number;
  pixels: Uint8Array<ArrayBuffer>;
  equalArea?: boolean;
  axisTilt?: number;
  storms?: GiantStormProfile[];
  normals?: Uint8Array<ArrayBuffer>;
};
const cache = new Map<string, PlanetMap | Promise<PlanetMap>>();
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const color = (hex: string): RGB => {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
};

/** Wrapping color (RGB) and unlit terrain height (A); SVG giant materials rasterize asynchronously. */
export function generatePlanetMap(
  options: PlanetTextureOptions,
): PlanetMap | Promise<PlanetMap> {
  const key = JSON.stringify([
    options.color,
    options.accentColor,
    options.type,
    options.intense,
    options.seed,
    options.detail,
    options.cratering,
    options.contrast,
    options.bandShadow,
    options.earthlike
      ? { ...options.earthlike, oceanReflectivity: undefined }
      : undefined,
    options.terrain,
    options.resolution,
    options.gas,
  ]);
  const existing = cache.get(key);
  if (existing) return existing;
  if (options.type === "terrestrial" && options.earthlike?.enabled) {
    const map = generateEarthMap(
      options.seed,
      options.earthlike,
      options.resolution ?? 1024,
    );
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, map);
    return map;
  }
  if (options.type === "giant") {
    const pending = generateGiantMap(options).catch((error) => {
      if (cache.get(key) === pending) cache.delete(key);
      throw error;
    });
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, pending);
    return pending;
  }
  if (options.terrain) {
    const map = generateRockyMap(options, options.terrain);
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, map);
    return map;
  }
  const random = seededRandom(`${options.seed}:surface-map`);
  const seed = Math.floor(random() * 2147483647);
  const primary = color(options.color);
  const accent = options.accentColor
    ? color(options.accentColor)
    : (primary.map((c) => c * 0.4) as RGB);
  const width = options.detail === "moon" ? 128 : 512,
    height = width / 2;
  const pixels = new Uint8Array(width * height * 4);
  // Edge detail has its own stream so it preserves the existing crater centers and sizes.
  const craterEdgeRandom = seededRandom(`${options.seed}:crater-edges`);
  const moon = options.detail === "moon";
  const craterCount = Math.round(
    (moon ? (options.intense ? 210 : 110) : options.intense ? 65 : 40) *
      (options.cratering ?? 1),
  );
  const craterMinimum = moon ? (options.intense ? 0.035 : 0.055) : 0.025;
  const craterSpread = moon ? (options.intense ? 0.18 : 0.24) : 0.14;
  const craters = Array.from({ length: craterCount }, () => {
    const longitude = random() * Math.PI * 2,
      y = random() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    return {
      x: Math.sin(longitude) * r,
      y,
      z: Math.cos(longitude) * r,
      radius: craterMinimum + random() ** 2 * craterSpread,
      eastX: Math.cos(longitude),
      eastZ: -Math.sin(longitude),
      northX: -y * Math.sin(longitude),
      northY: r,
      northZ: -y * Math.cos(longitude),
      phase: craterEdgeRandom() * Math.PI * 2,
      finePhase: craterEdgeRandom() * Math.PI * 2,
      roughness: 0.85 + craterEdgeRandom() * 0.3,
    };
  });
  const geologyRandom = seededRandom(`${options.seed}:geology`);
  const plates = Array.from({ length: 28 }, () => {
    const longitude = geologyRandom() * Math.PI * 2,
      y = geologyRandom() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    return {
      x: Math.sin(longitude) * r,
      y,
      z: Math.cos(longitude) * r,
      height: 0.03 + geologyRandom() * 0.07,
      tone: (geologyRandom() - 0.5) * 0.06,
    };
  });
  const mineral = (base: RGB): RGB => {
    const value = base[0] * 0.3 + base[1] * 0.55 + base[2] * 0.15;
    return base.map((channel, i) =>
      mix(channel, value + [9, 5, -2][i], 0.34),
    ) as RGB;
  };
  const stone = mineral(primary),
    darkStone = mineral(accent);
  const dustValue = primary[0] * 0.3 + primary[1] * 0.55 + primary[2] * 0.15;
  const dust: RGB = [dustValue + 32, dustValue + 27, dustValue + 17];

  for (let py = 0; py < height; py++) {
    const latitude = ((py + 0.5) / height - 0.5) * Math.PI;
    const sy = Math.sin(latitude),
      latitudeScale = Math.cos(latitude);
    for (let px = 0; px < width; px++) {
      const longitude = ((px + 0.5) / width - 0.5) * Math.PI * 2;
      const sx = Math.sin(longitude) * latitudeScale,
        sz = Math.cos(longitude) * latitudeScale;
      let r = primary[0],
        g = primary[1],
        b = primary[2],
        elevation = 0.5;
      const grain = (hash(px, py, 0, seed) - 0.5) * latitudeScale;
      if (options.type === "terrestrial") {
        // All fields live on the sphere, so fractures and small relief wrap without seams.
        const qx =
          sx +
          (noise(sx * 4 + 11, sy * 4 + 3, sz * 4 + 7, seed + 11) - 0.5) * 0.12;
        const qy =
          sy +
          (noise(sx * 4 + 5, sy * 4 + 17, sz * 4 + 2, seed + 12) - 0.5) * 0.12;
        const qz =
          sz +
          (noise(sx * 4 + 8, sy * 4 + 6, sz * 4 + 13, seed + 13) - 0.5) * 0.12;
        let nearest = -Infinity,
          second = -Infinity;
        let plate = plates[0],
          neighbor = plates[0];
        for (const cell of plates) {
          const score = qx * cell.x + qy * cell.y + qz * cell.z;
          if (score > nearest) {
            second = nearest;
            neighbor = plate;
            nearest = score;
            plate = cell;
          } else if (score > second) {
            second = score;
            neighbor = cell;
          }
        }
        const field = fractal(qx * 4.5 + 12, qy * 4.5 + 7, qz * 4.5 + 19, seed);
        const edgeDistance = nearest - second;
        const transition = 0.5 + 0.5 * smooth(0, 0.055, edgeDistance);
        // Broken, partly eroded faults avoid drawing an outline around every plateau.
        const fracture =
          (1 - smooth(0.003, 0.015, edgeDistance)) * smooth(0.44, 0.61, field);
        const ridge =
          (1 -
            Math.abs(
              noise(qx * 18 + 4, qy * 18 + 9, qz * 18 + 6, seed + 21) * 2 - 1,
            )) **
          5;
        const micro = noise(qx * 38 + 3, qy * 38 + 12, qz * 38 + 8, seed + 22);
        const pitting = 1 - smooth(0.2, 0.44, micro);
        elevation =
          0.36 +
          mix(neighbor.height, plate.height, transition) +
          smooth(0.36, 0.49, field) * 0.08 +
          smooth(0.54, 0.64, field) * 0.08 +
          ridge * 0.025 +
          (micro - 0.5) * 0.018 -
          pitting * 0.035 -
          fracture * 0.065;
        const depression = clamp((0.61 - elevation) / 0.25);
        const tint = 0.08 + depression * 0.3;
        const weathering = 0.06 + smooth(0.45, 0.64, elevation) * 0.1;
        r = mix(mix(stone[0], darkStone[0], tint), dust[0], weathering);
        g = mix(mix(stone[1], darkStone[1], tint), dust[1], weathering);
        b = mix(mix(stone[2], darkStone[2], tint), dust[2], weathering);
        let shade =
          1 +
          grain * 0.045 +
          mix(neighbor.tone, plate.tone, transition) -
          fracture * 0.09;
        for (const crater of craters) {
          const distanceSquared =
            2 - 2 * (sx * crater.x + sy * crater.y + sz * crater.z);
          if (distanceSquared > crater.radius ** 2 * 2.2) continue;
          const angle = Math.atan2(
            sx * crater.northX + sy * crater.northY + sz * crater.northZ,
            sx * crater.eastX + sz * crater.eastZ,
          );
          // Angular scars stay fixed on the sphere, including across the longitude seam.
          const edge =
            1 +
            crater.roughness *
              (0.12 * Math.sin(angle * 3 + crater.phase) +
                0.055 * Math.sin(angle * 7 + crater.finePhase) +
                0.03 * Math.sin(angle * 11 + crater.phase));
          const distance =
            Math.sqrt(Math.max(0, distanceSquared)) / (crater.radius * edge);
          const bowl = 1 - smooth(0.78, 1, distance);
          const rim =
            smooth(0.94, 1.015, distance) * (1 - smooth(1.045, 1.16, distance));
          elevation += -0.13 * bowl + 0.04 * rim;
          shade += -0.16 * bowl + 0.025 * rim;
        }
        r *= shade;
        g *= shade;
        b *= shade;
      }
      const index = (py * width + px) * 4;
      pixels[index] = Math.round(Math.max(0, Math.min(255, r)));
      pixels[index + 1] = Math.round(Math.max(0, Math.min(255, g)));
      pixels[index + 2] = Math.round(Math.max(0, Math.min(255, b)));
      pixels[index + 3] = Math.round(clamp(elevation) * 255);
    }
  }
  const map = { width, height, pixels };
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, map);
  return map;
}
