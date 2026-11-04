import type { GasSurface } from "../model/gas.ts";
import type { PlanetMap } from "./planetMaps.ts";
import { noise, fractal } from "./noise3d.ts";
import { seededRandom } from "./seededRandom.ts";

/** Gas-only wisps and filtered belt edges; the icy/Saturn rasterizer bypasses this path. */
export function refineGasMap(
  map: PlanetMap,
  surfaceSeed: string | number,
  settings: GasSurface,
): PlanetMap {
  if (!settings.turbulence && !settings.softness && !settings.detail)
    return map;
  const { width, height } = map,
    pixels = new Uint8Array(map.pixels.length);
  const seed = Math.floor(
    seededRandom(`${surfaceSeed}:gas-cloud-detail-v1`)() * 2147483647,
  );
  const sample = (u: number, v: number, channel: number) => {
    const px = (((u % 1) + 1) % 1) * width - 0.5,
      py = Math.max(0, Math.min(height - 1, v * height - 0.5));
    const x = Math.floor(px),
      y = Math.floor(py),
      tx = px - x,
      ty = py - y;
    const at = (xx: number, yy: number) =>
      map.pixels[
        (Math.min(height - 1, yy) * width + ((xx + width) % width)) * 4 +
          channel
      ];
    const a = at(x, y) * (1 - tx) + at(x + 1, y) * tx,
      b = at(x, y + 1) * (1 - tx) + at(x + 1, y + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height,
      y = 1 - v * 2,
      horizontal = Math.sqrt(Math.max(0, 1 - y * y));
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width,
        angle = u * Math.PI * 2;
      const x = Math.sin(angle) * horizontal,
        z = Math.cos(angle) * horizontal;
      const large = fractal(x * 6 + 3, y * 24 + 9, z * 6 + 17, seed);
      const fine = noise(x * 40 + 7, y * 140 + 13, z * 40 + 5, seed + 23);
      const shear = noise(x * 12 + 19, y * 45 + 3, z * 12 + 11, seed + 7);
      const uu = u + (shear - 0.5) * 0.008 * settings.turbulence;
      const vv =
        v +
        ((large - 0.5) * 0.015 + (fine - 0.5) * 0.002) *
          settings.turbulence *
          horizontal;
      const variation = 1 + (fine - 0.5) * 0.045 * settings.detail;
      const index = (py * width + px) * 4;
      for (let c = 0; c < 3; c++) {
        const center = sample(uu, vv, c);
        const blur =
          (sample(uu, vv - 1.5 / height, c) +
            center * 2 +
            sample(uu, vv + 1.5 / height, c)) /
          4;
        pixels[index + c] = Math.round(
          Math.max(
            0,
            Math.min(
              255,
              (center * (1 - settings.softness) + blur * settings.softness) *
                variation,
            ),
          ),
        );
      }
      pixels[index + 3] = 128;
    }
  }
  return { ...map, pixels };
}
