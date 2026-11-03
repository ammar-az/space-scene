import type { Planet } from "./schema.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import { createRingProfile } from "../utils/planetSystems.ts";
export const defaultMoons: NonNullable<Planet["moons"]> = {
  colors: ["#aaa79d", "#d1c5ae", "#8e9ca9", "#b78268"],
  radius: [2, 4.2],
  speed: [2, 9],
  size: [0.08, 0.2],
  inclination: [-12, 12],
};
export function ringSettings(planet: Planet): NonNullable<Planet["rings"]> {
  return (
    planet.rings ?? {
      amount: Math.min(1, planet.ringCount),
      width: 1,
      opacity: 1,
      innerRadius: createRingProfile(
        planet.seeds.rings,
        planet.families[planet.type].color,
      ).inner,
    }
  );
}
/** One bounded annulus: sparse, narrow bands through the portfolio's full ring profile. */
export function planetRing(planet: Planet) {
  const settings = ringSettings(planet);
  if (settings.amount === 0) return undefined;
  const profile = createRingProfile(
    planet.seeds.rings,
    planet.families[planet.type].color,
  );
  const span =
    (profile.outer - profile.inner) *
    settings.width *
    (0.08 + 0.92 * settings.amount);
  return {
    ...profile,
    inner: settings.innerRadius,
    outer: settings.innerRadius + span,
    opacity:
      profile.opacity * settings.opacity * (0.35 + 0.65 * settings.amount),
    complexity: settings.amount,
  };
}
export type MoonProfile = {
  seed: string;
  color: string;
  accent: string;
  distance: number;
  speed: number;
  size: number;
  inclination: number;
  orientation: number;
  phase: number;
};
export function moonProfiles(planet: Planet): MoonProfile[] {
  const settings = planet.moons ?? defaultMoons,
    edge = planetRing(planet)?.outer ?? 1;
  return Array.from({ length: planet.moonCount }, (_, index) => {
    const seed = `${planet.seeds.moons}:moon:${index}`;
    const sample = (part: string, [low, high]: [number, number]) =>
      low + seededRandom(`${seed}:${part}`)() * (high - low);
    const color =
      settings.colors[Math.floor(sample("color", [0, settings.colors.length]))];
    const accent =
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(parseInt(color.slice(i, i + 2), 16) * 0.45)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    const size = sample("size", settings.size);
    return {
      seed,
      color,
      accent,
      size,
      distance: Math.max(edge + size + 0.12, sample("radius", settings.radius)),
      speed: sample("speed", settings.speed),
      inclination: sample("inclination", settings.inclination),
      orientation: sample("orientation", [-180, 180]),
      phase: sample("phase", [0, 360]),
    };
  });
}
export function moonPosition(
  moon: MoonProfile,
  time: number,
): [number, number, number] {
  const radians = Math.PI / 180,
    phase = (moon.phase + time * moon.speed) * radians;
  const angle = moon.orientation * radians,
    tilt = moon.inclination * radians;
  const x = moon.distance * Math.cos(phase),
    z = moon.distance * Math.sin(phase);
  return [
    x * Math.cos(angle) - z * Math.cos(tilt) * Math.sin(angle),
    z * Math.sin(tilt),
    x * Math.sin(angle) + z * Math.cos(tilt) * Math.cos(angle),
  ];
}
