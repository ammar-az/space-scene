import type { AsteroidBelt, SceneModel } from "./schema.ts";
import { seededRandom } from "../utils/seededRandom.ts";
import { orbitPhase } from "./time.ts";
import { starRenderRadius, WORLD_UNITS_PER_THOUSAND_KM } from "./sizes.ts";

export const defaultAsteroidBelt: AsteroidBelt = {
  visible: false,
  seed: 51721,
  count: 1200,
  distance: [329.12, 478.71],
  diameter: [0.01, 0.15],
  inclination: [-6, 6],
  eccentricity: [0.01, 0.1],
  periodDays: [1190, 2090],
  spinHours: [3, 18],
  colors: ["#8d857a", "#a39783", "#777b80", "#9b8271"],
  sizeScale: 50,
  playing: true,
  reverse: false,
  epochDays: 0,
  offsetDays: 0,
};
export type AsteroidProfile = {
  variant: number;
  major: number;
  eccentricity: number;
  inclination: number;
  orientation: number;
  rotation: number;
  phase: number;
  periodDays: number;
  diameter: number;
  spinHours: number;
  spinPhase: number;
  tilt: number;
  stretch: [number, number, number];
};
export const asteroidVariantCount = (belt: AsteroidBelt) =>
  Math.min(8, belt.colors.length * 2);
export function asteroidProfiles(belt: AsteroidBelt): AsteroidProfile[] {
  return Array.from({ length: belt.count }, (_, index) => {
    const seed = `${belt.seed}:asteroid:${index}`;
    const sample = (part: string, [low, high]: [number, number]) =>
      low + seededRandom(`${seed}:${part}`)() * (high - low);
    // Keep periapsis and apoapsis inside the configured physical annulus.
    const [inner, outer] = belt.distance;
    const e = Math.min(
      sample("eccentricity", belt.eccentricity),
      ((outer - inner) / (outer + inner)) * 0.98,
    );
    const major = sample("distance", [inner / (1 - e), outer / (1 + e)]);
    const t = outer === inner ? 0.5 : (major - inner) / (outer - inner);
    return {
      variant: index % asteroidVariantCount(belt),
      major,
      eccentricity: e,
      inclination: sample("inclination", belt.inclination),
      orientation: sample("orientation", [-180, 180]),
      rotation: sample("rotation", [-180, 180]),
      phase: sample("phase", [0, 360]),
      periodDays:
        belt.periodDays[0] + (belt.periodDays[1] - belt.periodDays[0]) * t,
      diameter: sample("diameter", belt.diameter),
      spinHours: sample("spin", belt.spinHours),
      spinPhase: sample("spin-phase", [0, 360]),
      tilt: sample("tilt", [-180, 180]),
      stretch: [
        sample("x", [0.65, 1]),
        sample("y", [0.55, 0.9]),
        sample("z", [0.65, 1]),
      ],
    };
  });
}
export function asteroidBeltDays(belt: AsteroidBelt, days: number): number {
  return (
    belt.offsetDays +
    (belt.playing ? (days - belt.epochDays) * (belt.reverse ? -1 : 1) : 0)
  );
}

/** Interpolate the planets' displayed radial scale without adding the belt to their layout reference. */
export function asteroidDistanceMapper(
  scene: SceneModel,
  factors: Map<string, number>,
) {
  const anchors = scene.planets
    .map((p) => {
      const physical = Math.max(
        p.orbit.ellipse.radiusX,
        p.orbit.ellipse.radiusZ,
      );
      return { physical, rendered: physical * (factors.get(p.id) ?? 1) };
    })
    .sort((a, b) => a.physical - b.physical)
    .filter((p, i, list) => !i || p.physical > list[i - 1].physical);
  const compression = scene.layout?.distanceCompression ?? 0.7;
  const fallback =
    Math.max(80, starRenderRadius(scene) * 1.5) *
    (scene.layout?.orbitScale ?? 1);
  return (physical: number): number => {
    if (!anchors.length)
      return (
        fallback *
        Math.pow(physical / defaultAsteroidBelt.distance[0], 1 - compression)
      );
    let high = anchors.findIndex((p) => p.physical >= physical);
    if (high < 0) high = anchors.length;
    if (high === 0 || high === anchors.length) {
      const anchor = anchors[high === 0 ? 0 : anchors.length - 1];
      return (
        anchor.rendered * Math.pow(physical / anchor.physical, 1 - compression)
      );
    }
    const low = anchors[high - 1],
      upper = anchors[high];
    const t =
      Math.log(physical / low.physical) /
      Math.log(upper.physical / low.physical);
    return Math.exp(
      Math.log(low.rendered) * (1 - t) + Math.log(upper.rendered) * t,
    );
  };
}
/** Physical orbit is compressed radially, keeping every asteroid in the mapped annulus. */
export function asteroidPosition(
  profile: AsteroidProfile,
  days: number,
  mapDistance: (radius: number) => number,
): [number, number, number] {
  const r = Math.PI / 180;
  const phase =
    orbitPhase({ ...profile, reverse: false, playing: true }, days) * r;
  const e = profile.eccentricity,
    a = profile.major;
  const x = a * (Math.cos(phase) - e),
    z = a * Math.sqrt(1 - e * e) * Math.sin(phase);
  const rotation = profile.rotation * r,
    inclination = profile.inclination * r,
    orientation = profile.orientation * r;
  const u = x * Math.cos(rotation) - z * Math.sin(rotation),
    v = x * Math.sin(rotation) + z * Math.cos(rotation);
  const point: [number, number, number] = [
    u * Math.cos(orientation) -
      v * Math.cos(inclination) * Math.sin(orientation),
    v * Math.sin(inclination),
    u * Math.sin(orientation) +
      v * Math.cos(inclination) * Math.cos(orientation),
  ];
  const physical = Math.hypot(...point),
    factor = mapDistance(physical) / physical;
  return point.map((value) => value * factor) as [number, number, number];
}
export function asteroidRenderRadius(
  belt: AsteroidBelt,
  diameter: number,
): number {
  return (diameter * WORLD_UNITS_PER_THOUSAND_KM * belt.sizeScale) / 2;
}
export function asteroidBeltBounds(
  scene: SceneModel,
  factors: Map<string, number>,
) {
  const belt = scene.asteroidBelt;
  if (!belt?.visible || !belt.count) return undefined;
  const map = asteroidDistanceMapper(scene, factors);
  const radius = Math.max(
    ...[
      ...belt.distance,
      ...scene.planets
        .map((p) => Math.max(p.orbit.ellipse.radiusX, p.orbit.ellipse.radiusZ))
        .filter((r) => r > belt.distance[0] && r < belt.distance[1]),
    ].map(map),
  );
  const [low, high] = belt.inclination.map((v) => Math.abs(v));
  const crossesPole =
    (belt.inclination[0] <= 90 && belt.inclination[1] >= 90) ||
    (belt.inclination[0] <= -90 && belt.inclination[1] >= -90);
  const height =
    radius *
    (crossesPole
      ? 1
      : Math.max(
          Math.sin((low * Math.PI) / 180),
          Math.sin((high * Math.PI) / 180),
        ));
  return { radius, height, body: asteroidRenderRadius(belt, belt.diameter[1]) };
}
