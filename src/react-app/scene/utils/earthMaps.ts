import type { Earthlike } from "../model/earthlike.ts";
import type { PlanetMap } from "./planetMaps.ts";
import { seededRandom } from "./seededRandom.ts";
import { noise, fractal } from "./noise3d.ts";
import { buildSurfaceNormals } from "./surfaceNormals.ts";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Land, climate and relief are spherical; ocean masks stay independent of palette and lighting. */
export function generateEarthMap(
  surfaceSeed: string | number,
  settings: Earthlike,
  resolution = 1024,
): PlanetMap {
  const random = seededRandom(`${surfaceSeed}:earthlike`),
    seed = Math.floor(random() * 2147483647);
  const offset = [random() * 20 + 20, random() * 20 + 20, random() * 20 + 20];
  const continent = (x: number, y: number, z: number) => {
    const warp = (a: number, b: number, c: number) =>
      (noise(a * 3 + 7, b * 3 + 13, c * 3 + 29, seed + 17) - 0.5) * 0.42;
    return (
      fractal(
        (x + warp(x, y, z)) * settings.continentScale + offset[0],
        (y + warp(y, z, x)) * settings.continentScale + offset[1],
        (z + warp(z, x, y)) * settings.continentScale + offset[2],
        seed,
      ) +
      (fractal(x * 15 + 3, y * 15 + 17, z * 15 + 9, seed + 71) - 0.5) * 0.028
    );
  };
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
  const width = resolution,
    height = width / 2,
    pixels = new Uint8Array(width * height * 4);
  const heights = new Float32Array(width * height),
    water = new Float32Array(width * height);
  const mountains = settings.mountainHeight ?? 1,
    polar = settings.iceCoverage ?? 0.08;
  for (let py = 0; py < height; py++) {
    const latitude = ((py + 0.5) / height - 0.5) * Math.PI,
      y = Math.sin(latitude),
      r = Math.cos(latitude);
    for (let px = 0; px < width; px++) {
      const longitude = ((px + 0.5) / width - 0.5) * Math.PI * 2,
        x = Math.sin(longitude) * r,
        z = Math.cos(longitude) * r;
      const field = continent(x, y, z),
        above = field - seaLevel;
      const land = smooth(-0.0025, 0.0035, above);
      const climate = fractal(x * 4 + 8, y * 4 + 2, z * 4 + 12, seed + 41);
      const detail = noise(x * 48 + 7, y * 48 + 13, z * 48 + 3, seed + 85);
      const dryBelt = Math.exp(-Math.pow((Math.abs(y) - 0.43) / 0.22, 2));
      const dryness = smooth(0.34, 0.68, climate * 0.6 + dryBelt * 0.44);
      const ridge = Math.pow(
        1 -
          Math.abs(
            fractal(x * 10 + 13, y * 10 + 7, z * 10 + 19, seed + 51) * 2 - 1,
          ),
        7,
      );
      const tectonic = smooth(
        0.38,
        0.65,
        noise(x * 5 + 9, y * 5 + 17, z * 5 + 3, seed + 54),
      );
      const elevation =
        (Math.max(0, above) * 0.28 +
          ridge * tectonic * smooth(0.002, 0.025, above) * 0.055) *
        mountains;
      const polarIce =
        polar === 0
          ? 0
          : smooth(
              1 - polar - 0.02,
              1 - polar + 0.02,
              Math.abs(y) + (climate - 0.5) * 0.025,
            );
      const alpineSnow =
        smooth(0.035, 0.085, elevation) *
        smooth(0.05, 0.65, Math.abs(y) + elevation * 3) *
        land;
      const ice = Math.max(polarIce, alpineSnow);
      const depth = Math.max(0, -above),
        shelf = Math.exp(-depth * 80);
      const waterBrightness =
        0.53 + 0.25 * Math.exp(-depth * 18) + shelf * 0.25;
      const beach = Math.exp(-Math.abs(above) * 360) * land * (1 - ice);
      const forest = smooth(0.3, 0.68, climate) * (1 - dryness);
      const index = (py * width + px) * 4;
      for (let c = 0; c < 3; c++) {
        const sea = ocean[c] * waterBrightness + shelf * [0, 10, 13][c];
        let ground =
          mix(green[c], desert[c], dryness) *
          (0.96 - forest * 0.14 + (detail - 0.5) * 0.07);
        ground = mix(
          ground,
          [139, 132, 117][c],
          smooth(0.018, 0.075, elevation) * 0.65,
        );
        ground = mix(ground, desert[c] * 1.12, beach * 0.55);
        const combined = mix(mix(sea, ground, land), [224, 234, 235][c], ice);
        pixels[index + c] = Math.round(clamp(combined / 255) * 255);
      }
      heights[py * width + px] =
        0.48 +
        land * (0.04 + elevation + (detail - 0.5) * 0.003 * mountains) +
        polarIce * 0.003;
      water[py * width + px] = (1 - land) * (1 - ice);
      pixels[index + 3] = Math.round(clamp(heights[py * width + px]) * 255);
    }
  }
  return {
    width,
    height,
    pixels,
    normals: buildSurfaceNormals(heights, width, height, 0.065, water),
  };
}
