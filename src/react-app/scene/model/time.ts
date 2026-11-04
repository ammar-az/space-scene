import type { Planet, SceneModel } from "./schema.ts";
export const wrapDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;
export function rotationHoursPerSecond(
  rate: SceneModel["motion"]["rotationRate"],
): number {
  return (
    rate.multiplier /
    (rate.unit === "hour/hour" ? 3600 : rate.unit === "hour/minute" ? 60 : 1)
  );
}
export function orbitDaysPerSecond(
  rate: SceneModel["motion"]["orbitRate"],
): number {
  return rate.multiplier / (rate.unit === "day/minute" ? 60 : 1);
}
export function orbitPhase(
  orbit: Pick<Planet["orbit"], "phase" | "periodDays" | "reverse" | "playing">,
  days: number,
): number {
  return wrapDegrees(
    orbit.phase -
      (orbit.playing
        ? ((days % orbit.periodDays) / orbit.periodDays) *
          360 *
          (orbit.reverse ? -1 : 1)
        : 0),
  );
}
export function rotationPhase(
  spin: Pick<Planet["spin"], "phase" | "periodHours" | "reverse" | "playing">,
  hours: number,
): number {
  return wrapDegrees(
    spin.phase +
      (spin.playing
        ? ((hours % spin.periodHours) / spin.periodHours) *
          360 *
          (spin.reverse ? -1 : 1)
        : 0),
  );
}
export function rebaseOrbit<
  T extends Pick<
    Planet["orbit"],
    "phase" | "periodDays" | "reverse" | "playing"
  >,
>(orbit: T, patch: Partial<T>, days: number): T {
  const next = { ...orbit, ...patch };
  if (
    patch.phase === undefined &&
    (patch.periodDays !== undefined ||
      patch.reverse !== undefined ||
      patch.playing !== undefined)
  )
    next.phase = wrapDegrees(
      orbitPhase(orbit, days) - orbitPhase({ ...next, phase: 0 }, days),
    );
  return next;
}
export function rebaseSpin<
  T extends Pick<
    Planet["spin"],
    "phase" | "periodHours" | "reverse" | "playing"
  >,
>(spin: T, patch: Partial<T>, hours: number): T {
  const next = { ...spin, ...patch };
  if (
    patch.phase === undefined &&
    (patch.periodHours !== undefined ||
      patch.reverse !== undefined ||
      patch.playing !== undefined)
  )
    next.phase = wrapDegrees(
      rotationPhase(spin, hours) - rotationPhase({ ...next, phase: 0 }, hours),
    );
  return next;
}
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "paused";
  if (seconds < 60) return `${Number(seconds.toPrecision(4))} s`;
  if (seconds < 3600) return `${Number((seconds / 60).toPrecision(4))} min`;
  if (seconds < 86400)
    return `${Number((seconds / 3600).toPrecision(4))} hours`;
  return `${Number((seconds / 86400).toPrecision(4))} days`;
}
