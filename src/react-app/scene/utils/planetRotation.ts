import { seededRandom } from "./seededRandom.ts";
import type { PlanetTextureOptions } from "./planetTextures.ts";

export const planetRotationPeriodSeconds = 120;
export const planetRotationRanges = {
    terrestrial: [90, 120],
    banded: [30, 60],
    icy: [60, 90],
} as const;

export function getPlanetRotation(seed: string | number, appearance?: Pick<PlanetTextureOptions, "type" | "intense">, periodOverride?: number) {
    // Independent stream: changing rotation parameters never consumes terrain's random sequence.
    const random = seededRandom(`${seed}:rotation`);
    const direction = random() < 1 / 6 ? -1 : 1;
    const phase = random() * Math.PI * 2;
    const family = appearance?.type === "terrestrial" ? "terrestrial" : appearance?.intense ? "banded" : "icy";
    const [minimum, maximum] = planetRotationRanges[family];
    const periodSeconds = periodOverride ?? (appearance ? minimum + random() * (maximum - minimum) : planetRotationPeriodSeconds);
    return { direction, phase, periodSeconds };
}
