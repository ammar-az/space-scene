import { buildSurfaceNormals } from "./surfaceNormals.ts";
import type { RockyTerrain } from "../model/schema.ts";
import type { PlanetTextureOptions } from "./planetTextures.ts";
import type { PlanetMap } from "./planetMaps.ts";
import { seededRandom } from "./seededRandom.ts";
import { noise, fractal } from "./noise3d.ts";

const pi = Math.PI,
  tau = pi * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (color: string) => {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
type Crater = {
  x: number;
  y: number;
  z: number;
  radius: number;
  eastX: number;
  eastZ: number;
  northX: number;
  northY: number;
  northZ: number;
  age: number;
  phase: number;
  rays: number;
};

/** Spherical fields and indexed impacts produce wrapping albedo, height and tangent normals. */
export function generateRockyMap(
  options: PlanetTextureOptions,
  terrain: RockyTerrain,
): PlanetMap {
  const width = options.resolution ?? (options.detail === "moon" ? 512 : 1024),
    height = width / 2;
  const pixels = new Uint8Array(width * height * 4),
    heights = new Float32Array(width * height);
  const primary = rgb(options.color),
    accent = rgb(options.accentColor ?? "#625f59");
  const random = seededRandom(`${options.seed}:rocky-fields-v1`),
    seed = Math.floor(random() * 2147483647);
  const plains = terrain.plains;
  const plainsColor = rgb(plains?.color ?? "#626064");
  const plainsSeed = Math.floor(
    seededRandom(`${options.seed}:plains-basins-v2`)() * 2147483647,
  );
  // A few connected basin groups avoid threshold-noise islands scattered across the globe.
  const basins = Array.from(
    {
      length: plains?.coverage ? Math.max(1, Math.round(plains.scale * 2)) : 0,
    },
    (_, index) => {
      const sample = seededRandom(`${options.seed}:plains-basin-v2:${index}`);
      const longitude = sample() * tau,
        y = sample() * 2 - 1,
        horizontal = Math.sqrt(1 - y * y);
      const center = [
        Math.sin(longitude) * horizontal,
        y,
        Math.cos(longitude) * horizontal,
      ];
      const east = [Math.cos(longitude), 0, -Math.sin(longitude)];
      const north = [
        -y * Math.sin(longitude),
        horizontal,
        -y * Math.cos(longitude),
      ];
      return Array.from({ length: 3 }, (_, lobe) => {
        const angle = sample() * tau,
          spread = lobe ? (0.3 + sample() * 0.2) / Math.sqrt(plains!.scale) : 0;
        const point = center.map(
          (value, i) =>
            value * Math.sqrt(1 - spread * spread) +
            (east[i] * Math.cos(angle) + north[i] * Math.sin(angle)) * spread,
        );
        return { point, bias: (index === 0 ? 0.06 : 0) - lobe * 0.035 };
      });
    },
  ).flat();
  const plainsField = (x: number, y: number, z: number) => {
    const qx =
      x + (noise(x * 2 + 7, y * 2 + 19, z * 2 + 3, plainsSeed) - 0.5) * 0.3;
    const qy =
      y +
      (noise(x * 2 + 13, y * 2 + 5, z * 2 + 23, plainsSeed + 1) - 0.5) * 0.3;
    const qz =
      z +
      (noise(x * 2 + 17, y * 2 + 11, z * 2 + 7, plainsSeed + 2) - 0.5) * 0.3;
    const length = Math.hypot(qx, qy, qz);
    let nearest = -Infinity;
    for (const basin of basins)
      nearest = Math.max(
        nearest,
        (qx * basin.point[0] + qy * basin.point[1] + qz * basin.point[2]) /
          length +
          basin.bias,
      );
    // Broad geological variation breaks circular outlines without adding small noise islands.
    return (
      -nearest +
      (noise(x * 3 + 29, y * 3 + 5, z * 3 + 17, plainsSeed + 3) - 0.5) * 0.32
    );
  };
  const samples = plains?.coverage
    ? Array.from({ length: 1024 }, (_, i) => {
        const y = 1 - ((i + 0.5) * 2) / 1024,
          r = Math.sqrt(1 - y * y),
          angle = i * 2.399963229728653;
        return plainsField(Math.cos(angle) * r, y, Math.sin(angle) * r);
      }).sort((a, b) => a - b)
    : [];
  const level = samples.length
    ? samples[Math.floor(plains!.coverage * (samples.length - 1))]
    : 0;
  const columns = 64,
    rows = 32;
  const bins: Crater[][] = Array.from({ length: columns * rows }, () => []);
  const count = Math.round(
    (options.detail === "moon" ? 800 : 480) * terrain.craterDensity,
  );
  for (let i = 0; i < count; i++) {
    const sample = seededRandom(`${options.seed}:impact-v1:${i}`);
    const longitude = sample() * tau - pi,
      y = sample() * 2 - 1;
    const latitude = Math.asin(y),
      horizontal = Math.sqrt(1 - y * y);
    const radius = Math.min(
      0.5,
      (0.009 + Math.pow(sample(), 4) * 0.187) * terrain.craterSize,
    );
    const crater: Crater = {
      x: Math.sin(longitude) * horizontal,
      y,
      z: Math.cos(longitude) * horizontal,
      radius,
      eastX: Math.cos(longitude),
      eastZ: -Math.sin(longitude),
      northX: -y * Math.sin(longitude),
      northY: horizontal,
      northZ: -y * Math.cos(longitude),
      age: sample(),
      phase: sample() * tau,
      rays: 7 + Math.floor(sample() * 14),
    };
    // Ejecta and irregular rims fit inside this conservative spherical cap.
    const cap = Math.min(pi, radius * 1.8);
    const minRow = Math.max(
      0,
      Math.floor(((latitude - cap + pi / 2) / pi) * rows),
    );
    const maxRow = Math.min(
      rows - 1,
      Math.floor(((latitude + cap + pi / 2) / pi) * rows),
    );
    const reachesPole = Math.abs(latitude) + cap >= pi / 2;
    const longitudeSpan = reachesPole
      ? pi
      : Math.asin(Math.min(1, Math.sin(cap) / horizontal));
    for (let row = minRow; row <= maxRow; row++)
      for (let col = 0; col < columns; col++) {
        const center = ((col + 0.5) / columns) * tau - pi;
        const delta = Math.abs(
          Math.atan2(
            Math.sin(center - longitude),
            Math.cos(center - longitude),
          ),
        );
        if (delta <= longitudeSpan + pi / columns)
          bins[row * columns + col].push(crater);
      }
  }
  for (let py = 0; py < height; py++) {
    const latitude = ((py + 0.5) / height - 0.5) * pi,
      y = Math.sin(latitude),
      horizontal = Math.cos(latitude);
    const row = Math.min(rows - 1, Math.floor(((py + 0.5) / height) * rows));
    for (let px = 0; px < width; px++) {
      const longitude = ((px + 0.5) / width - 0.5) * tau;
      const x = Math.sin(longitude) * horizontal,
        z = Math.cos(longitude) * horizontal;
      const warp = noise(x * 3 + 11, y * 3 + 7, z * 3 + 19, seed) - 0.5;
      const qx = x + warp * 0.14,
        qy = y + warp * 0.09,
        qz = z - warp * 0.12;
      const geology = fractal(qx * 3 + 17, qy * 3 + 9, qz * 3 + 23, seed + 1);
      const ridges =
        1 -
        Math.abs(
          noise(qx * 13 + 8, qy * 13 + 19, qz * 13 + 4, seed + 7) * 2 - 1,
        );
      const grit = noise(x * 70 + 5, y * 70 + 2, z * 70 + 11, seed + 11);
      const plainsValue =
        plains?.coverage && plains.coverage < 1 ? plainsField(x, y, z) : 0;
      const plain = !plains?.coverage
        ? 0
        : plains.coverage === 1
          ? 1
          : 1 - smooth(level - 0.007, level + 0.007, plainsValue);
      const terrainPlain = !plains?.coverage
        ? 0
        : plains.coverage === 1
          ? 1
          : 1 - smooth(level - 0.04, level + 0.04, plainsValue);
      const mottling =
        terrainPlain > 0
          ? fractal(x * 8 + 7, y * 8 + 19, z * 8 + 3, plainsSeed + 11)
          : 0.5;
      const ruggedHeight =
        0.5 +
        terrain.roughness *
          ((geology - 0.5) * 0.17 +
            Math.pow(ridges, 5) * 0.025 +
            (grit - 0.5) * 0.009);
      // Plains keep shallow regional terrain rather than becoming a uniform depressed floor.
      const plainHeight =
        0.5 +
        terrain.roughness *
          ((geology - 0.5) * 0.08 +
            (mottling - 0.5) * 0.006 +
            Math.pow(ridges, 5) * 0.002);
      const baseHeight = mix(ruggedHeight, plainHeight, terrainPlain);
      let elevation = baseHeight,
        basinTone = 0,
        ejecta = 0;
      const column = Math.min(
        columns - 1,
        Math.floor(((px + 0.5) / width) * columns),
      );
      for (const crater of bins[row * columns + column]) {
        const distanceSquared = Math.max(
          0,
          2 - 2 * (x * crater.x + y * crater.y + z * crater.z),
        );
        if (distanceSquared > Math.pow(crater.radius * 1.65, 2)) continue;
        const angle = Math.atan2(
          x * crater.northX + y * crater.northY + z * crater.northZ,
          x * crater.eastX + z * crater.eastZ,
        );
        const edge =
          1 +
          0.045 * Math.sin(angle * 5 + crater.phase) +
          0.025 * Math.sin(angle * 11 - crater.phase);
        const d = Math.sqrt(distanceSquared) / (crater.radius * edge);
        const fresh = 1 - crater.age;
        const resurfacing =
          1 -
          terrainPlain *
            (crater.age > 0.2 ? 0.9 : crater.radius > 0.08 ? 0.7 : 0.3);
        const depth =
          (0.022 + Math.sqrt(crater.radius) * 0.15) *
          (0.6 + fresh * 0.4) *
          resurfacing;
        const bowl = Math.pow(Math.max(0, 1 - d * d), 1.3);
        const rim = Math.exp(
          -Math.pow((d - 1.02) / (0.085 + crater.age * 0.06), 2),
        );
        const peak =
          crater.radius > 0.075 ? Math.exp(-d * d * 55) * depth * 0.45 : 0;
        // Later impacts resurface older relief rather than stacking black discs.
        const interior = 1 - smooth(0.75, 1.05, d);
        elevation = mix(
          elevation,
          baseHeight - depth * bowl + peak,
          interior * 0.85,
        );
        elevation += rim * depth * 0.3;
        const apron = smooth(0.9, 1.08, d) * (1 - smooth(1.2, 1.65, d));
        const rays = Math.pow(
          Math.max(0, Math.cos(angle * crater.rays + crater.phase)),
          9,
        );
        ejecta +=
          (apron * fresh * (0.025 + rays * 0.075) + rim * fresh * 0.025) *
          resurfacing;
        basinTone +=
          bowl *
          (0.025 + crater.age * Math.min(0.16, crater.radius * 0.7)) *
          resurfacing;
      }
      heights[py * width + px] = clamp(elevation);
      const mineral = 0.08 + smooth(0.35, 0.7, geology) * 0.32;
      const tone = 1 + (grit - 0.5) * 0.035 - Math.min(0.24, basinTone);
      const index = (py * width + px) * 4;
      for (let c = 0; c < 3; c++) {
        const stone =
          mix(
            mix(primary[c], accent[c], mineral),
            plainsColor[c] * (0.9 + mottling * 0.2 + (grit - 0.5) * 0.025),
            plain,
          ) * tone;
        pixels[index + c] = Math.round(
          clamp(
            mix(
              stone / 255,
              Math.min(1, (primary[c] / 255) * 1.12 + 0.055),
              Math.min(0.15, ejecta),
            ),
          ) * 255,
        );
      }
      pixels[index + 3] = Math.round(clamp(elevation) * 255);
    }
  }
  return {
    width,
    height,
    pixels,
    normals: buildSurfaceNormals(heights, width, height),
  };
}
