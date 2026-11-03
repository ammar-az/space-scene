import type { Earthlike } from "../model/earthlike.ts";
import type { PlanetMap } from "./planetMaps.ts";
import { seededRandom } from "./seededRandom.ts";
import { noise, fractal } from "./noise3d.ts";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** All terrain and climate fields use sphere coordinates, including at the poles and seam. */
export function generateEarthMap(
  surfaceSeed: string | number,
  settings: Earthlike,
): PlanetMap {
  const random = seededRandom(`${surfaceSeed}:earthlike`);
  const seed = Math.floor(random() * 2147483647);
  const offset = [random() * 20 + 20, random() * 20 + 20, random() * 20 + 20];
  const continent = (x: number, y: number, z: number) => {
    const warp = (a: number, b: number, c: number) =>
      (noise(a * 3 + 7, b * 3 + 13, c * 3 + 29, seed + 17) - 0.5) * 0.42;
    return fractal(
      (x + warp(x, y, z)) * settings.continentScale + offset[0],
      (y + warp(y, z, x)) * settings.continentScale + offset[1],
      (z + warp(z, x, y)) * settings.continentScale + offset[2],
      seed,
    );
  };
  // Uniform sphere sampling makes coverage stable across seeds and continent scales.
  const samples = Array.from({ length: 2048 }, (_, i) => {
    const y = 1 - ((i + 0.5) * 2) / 2048,
      r = Math.sqrt(1 - y * y),
      angle = i * 2.399963229728653;
    return continent(Math.cos(angle) * r, y, Math.sin(angle) * r);
  }).sort((a, b) => a - b);
  const seaLevel =
    samples[Math.floor((1 - settings.landCoverage) * (samples.length - 1))];
  const ocean = rgb(settings.oceanColor),
    green = rgb(settings.landColor),
    desert = rgb(settings.desertColor);
  const width = 512,
    height = 256,
    pixels = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py++) {
    const latitude = ((py + 0.5) / height - 0.5) * Math.PI;
    const y = Math.sin(latitude),
      r = Math.cos(latitude);
    for (let px = 0; px < width; px++) {
      const longitude = ((px + 0.5) / width - 0.5) * Math.PI * 2;
      const x = Math.sin(longitude) * r,
        z = Math.cos(longitude) * r;
      const field = continent(x, y, z),
        land = smooth(seaLevel - 0.004, seaLevel + 0.006, field);
      const climate = fractal(x * 4 + 8, y * 4 + 2, z * 4 + 12, seed + 41);
      const dryBelt = Math.exp(-(((Math.abs(y) - 0.43) / 0.22) ** 2));
      const dryness = smooth(0.45, 0.72, climate * 0.65 + dryBelt * 0.38);
      const mountain =
        smooth(seaLevel + 0.08, seaLevel + 0.19, field) *
        smooth(0.48, 0.68, climate);
      const ice = smooth(0.91, 0.985, Math.abs(y) + (climate - 0.5) * 0.09);
      const coast = Math.exp(-Math.abs(field - seaLevel) * 65);
      const waterBrightness = 0.68 + 0.22 * climate + coast * 0.34;
      const index = (py * width + px) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const water =
          ocean[channel] * waterBrightness + coast * [0, 8, 8][channel];
        let ground =
          mix(green[channel], desert[channel], dryness) *
          (0.88 + climate * 0.23);
        ground = mix(ground, [151, 145, 129][channel], mountain * 0.65);
        const combined = mix(
          mix(water, ground, land),
          [220, 232, 227][channel],
          ice,
        );
        pixels[index + channel] = Math.round(
          Math.max(0, Math.min(255, combined)),
        );
      }
      pixels[index + 3] = Math.round(
        (0.48 +
          land * (0.025 + Math.max(0, field - seaLevel) * 0.22) +
          mountain * 0.02) *
          255,
      );
    }
  }
  return { width, height, pixels };
}
