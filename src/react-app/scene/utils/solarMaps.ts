import type { PlanetMap } from "./planetMaps.ts";
import { seededRandom } from "./seededRandom.ts";

export type SolarFields = { detail: PlanetMap; sites: PlanetMap };
const cache = new Map<number, SolarFields>();
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, n: number) => {
    const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/** Palette-independent fields: site lifetimes and fine structure. */
export function getSolarFields(seed: number): SolarFields {
    const cached = cache.get(seed);
    if (cached) return cached;
    const random = seededRandom(`${seed}:solar-cells-v2`);
    const sites = { width: 256, height: 256, pixels: Uint8Array.from({ length: 256 * 256 * 4 }, () => Math.floor(random() * 256)) };
    const width = 512, height = 512;
    const detail = { width, height, pixels: new Uint8Array(width * height * 4) };
    const grid = 64, noise = Float32Array.from({ length: grid * grid * 3 }, random);
    const at = (x: number, y: number, c: number) => noise[((y % grid) * grid + x % grid) * 3 + c];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, u = x / width, v = y / height;
        const gx = u * grid, gy = v * grid, ix = Math.floor(gx), iy = Math.floor(gy);
        const tx = smooth(0, 1, gx - ix), ty = smooth(0, 1, gy - iy);
        for (let c = 0; c < 3; c++) detail.pixels[i + c] = Math.round(255 * mix(
            mix(at(ix, iy, c), at(ix + 1, iy, c), tx), mix(at(ix, iy + 1, c), at(ix + 1, iy + 1, c), tx), ty));
        detail.pixels[i + 3] = 255;
    }
    const fields = { detail, sites };
    if (cache.size >= 2) cache.delete(cache.keys().next().value!);
    cache.set(seed, fields);
    return fields;
}

export async function generateSolarMaps(seed: number): Promise<SolarFields> {
    return getSolarFields(seed);
}
