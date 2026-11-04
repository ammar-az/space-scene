import type {
  NotableMoon,
  RockyTerrain,
  RockyTerrainRanges,
} from "./schema.ts";
import { seededRandom } from "../utils/seededRandom.ts";

export const defaultRockyTerrain: RockyTerrain = {
  craterDensity: 1,
  craterSize: 1,
  roughness: 1,
};
export const defaultRockyRanges: RockyTerrainRanges = {
  craterDensity: [0.4, 1.4],
  craterSize: [0.65, 1.45],
  roughness: [0.6, 1.4],
};
export const defaultPlains = { coverage: 0, scale: 1, color: "#626064" };
export function rockyTerrain(
  terrain?: RockyTerrain,
  legacyDensity = 1,
): RockyTerrain {
  return terrain ?? { ...defaultRockyTerrain, craterDensity: legacyDensity };
}
export function rockyRanges(
  ranges?: RockyTerrainRanges,
  legacyDensity: [number, number] = defaultRockyRanges.craterDensity,
): RockyTerrainRanges {
  return ranges ?? { ...defaultRockyRanges, craterDensity: legacyDensity };
}
export function rollRockyTerrain(
  ranges: RockyTerrainRanges,
  seed: string | number,
  current?: RockyTerrain,
): RockyTerrain {
  const sample = (key: string, [low, high]: [number, number]) => {
    return Math.max(
      low,
      Math.min(
        high,
        Math.round(
          (low + seededRandom(`${seed}:rocky:${key}`)() * (high - low)) * 100,
        ) / 100,
      ),
    );
  };
  return {
    craterDensity: sample("craterDensity", ranges.craterDensity),
    craterSize: sample("craterSize", ranges.craterSize),
    roughness: sample("roughness", ranges.roughness),
    ...(current?.plains || ranges.plains
      ? {
          plains: {
            ...(current?.plains ?? defaultPlains),
            coverage: sample(
              "plains-coverage",
              ranges.plains?.coverage ?? [
                current?.plains?.coverage ?? 0,
                current?.plains?.coverage ?? 0,
              ],
            ),
            scale: sample(
              "plains-scale",
              ranges.plains?.scale ?? [
                current?.plains?.scale ?? 1,
                current?.plains?.scale ?? 1,
              ],
            ),
          },
        }
      : {}),
  };
}
export function rerollMoonSurface(
  moon: NotableMoon,
  seed: number,
): NotableMoon {
  if (moon.locked) return moon;
  return {
    ...moon,
    seed,
    surface: {
      ...moon.surface,
      terrain: rollRockyTerrain(
        rockyRanges(moon.surface.ranges, [
          moon.surface.detail,
          moon.surface.detail,
        ]),
        seed,
        moon.surface.terrain,
      ),
    },
  };
}
