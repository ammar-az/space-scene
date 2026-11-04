import type { NotableMoon, Planet } from "./schema.ts";
import { orbitPhase } from "./time.ts";
import { planetRing } from "./systems.ts";
import { environmentSettings } from "./atmospheres.ts";
import { defaultRockyTerrain, defaultRockyRanges } from "./rockySurfaces.ts";
export const defaultMoonSystem: Planet["moonSystem"] = {
  distanceCompression: 0.65,
  orbitScale: 1,
  sizeCompression: 0.35,
  sizeScale: 1,
};
export function normalizeMoon(moon: NotableMoon): NotableMoon {
  return moon.spin.tidallyLocked
    ? {
        ...moon,
        spin: { ...moon.spin, periodHours: moon.orbit.periodDays * 24 },
      }
    : moon;
}
export function createNotableMoon(
  id: string,
  seed: number,
  index = 0,
): NotableMoon {
  return {
    id,
    name: `Moon ${index + 1}`,
    visible: true,
    locked: false,
    diameter: 1,
    seed,
    surface: {
      color: "#b9b5aa",
      accent: "#625f59",
      detail: 1,
      terrain: { ...defaultRockyTerrain },
      ranges: structuredClone(defaultRockyRanges),
    },
    orbit: {
      radiusX: 100 + index * 80,
      radiusZ: 100 + index * 80,
      rotation: 0,
      inclination: 0,
      orientation: 0,
      phase: (index * 97) % 360,
      periodDays: 3 + index * 2,
      reverse: false,
      playing: true,
    },
    spin: {
      tidallyLocked: true,
      periodHours: (3 + index * 2) * 24,
      tilt: 0,
      orientation: 0,
      phase: 0,
      reverse: false,
      playing: true,
    },
  };
}
/** Moon sizes remain relative to their parent, with their own optional ratio compression. */
export function notableMoonSize(planet: Planet, moon: NotableMoon): number {
  return (
    Math.pow(
      moon.diameter / planet.diameter,
      1 - planet.moonSystem.sizeCompression,
    ) * planet.moonSystem.sizeScale
  );
}
export type NotableMoonLayout = {
  id: string;
  radius: number;
  factor: number;
  extent: number;
};
/** Relative distances in parent radii; this mapping never depends on the planet's solar orbit. */
export function notableMoonLayout(
  planet: Planet,
): Map<string, NotableMoonLayout> {
  const list = [...planet.notableMoons].sort(
    (a, b) =>
      Math.max(a.orbit.radiusX, a.orbit.radiusZ) -
      Math.max(b.orbit.radiusX, b.orbit.radiusZ),
  );
  if (!list.length) return new Map();
  const env = environmentSettings(planet);
  const edge = Math.max(
    1,
    planetRing(planet)?.outer ?? 1,
    env.hasAtmosphere ? env.atmosphereScale : 1,
    env.hasClouds ? env.cloudScale : 1,
  );
  const inner = Math.max(list[0].orbit.radiusX, list[0].orbit.radiusZ),
    result = new Map<string, NotableMoonLayout>();
  let outer = edge,
    previousPhysicalFar = 0;
  const baseline = edge + notableMoonSize(planet, list[0]) + 0.35;
  for (const moon of list) {
    const a = Math.max(moon.orbit.radiusX, moon.orbit.radiusZ),
      b = Math.min(moon.orbit.radiusX, moon.orbit.radiusZ);
    const focal = Math.sqrt(a * a - b * b),
      near = Math.max(0.000001, a - focal),
      far = a + focal,
      radius = notableMoonSize(planet, moon);
    const target =
      baseline * Math.pow(a / inner, 1 - planet.moonSystem.distanceCompression);
    const factor = Math.max(
      target / a,
      (edge + radius + 0.15) / near,
      previousPhysicalFar > 0 && near > previousPhysicalFar
        ? (outer + radius + 0.15) / near
        : 0,
    );
    const scaledFactor = factor * planet.moonSystem.orbitScale;
    // Individual size and ring clearance also apply when shrinking the group.
    const safe = Math.max(scaledFactor, (edge + radius + 0.12) / near);
    result.set(moon.id, {
      id: moon.id,
      radius,
      factor: safe,
      extent: far * safe + radius,
    });
    outer = far * factor + radius;
    previousPhysicalFar = far;
  }
  return result;
}
/** Position before the orbit-plane transform; the parent sits at a focus. */
export function notableMoonPosition(
  moon: NotableMoon,
  days: number,
  factor: number,
): [number, number, number] {
  const o = moon.orbit,
    phase = (orbitPhase(o, days) * Math.PI) / 180;
  const focus = Math.sqrt(
    Math.abs(o.radiusX * o.radiusX - o.radiusZ * o.radiusZ),
  );
  return [
    (o.radiusX * Math.cos(phase) - (o.radiusX >= o.radiusZ ? focus : 0)) *
      factor,
    0,
    (o.radiusZ * Math.sin(phase) - (o.radiusZ > o.radiusX ? focus : 0)) *
      factor,
  ];
}
export function notableSystemExtent(planet: Planet): number {
  const layout = notableMoonLayout(planet);
  return Math.max(
    1,
    ...planet.notableMoons
      .filter((m) => m.visible)
      .map((m) => layout.get(m.id)?.extent ?? 1),
  );
}
