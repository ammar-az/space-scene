import type { Planet, SceneModel } from "./schema.ts";

/** A focus-centered ellipse in its own plane, then oriented in common world space. */
export function orbitPosition(
  orbit: Planet["orbit"],
  elapsedSeconds: number,
): [number, number, number] {
  const toRadians = Math.PI / 180;
  const phase = (orbit.phase + elapsedSeconds * orbit.speed) * toRadians;
  const inclination = orbit.inclination * toRadians,
    orientation = orbit.orientation * toRadians;
  const x = orbit.radius * (Math.cos(phase) - orbit.eccentricity);
  const z =
    orbit.radius * Math.sqrt(1 - orbit.eccentricity ** 2) * Math.sin(phase);
  const y = z * Math.sin(inclination),
    depth = z * Math.cos(inclination);
  return [
    orbit.center[0] + x * Math.cos(orientation) - depth * Math.sin(orientation),
    orbit.center[1] + y,
    orbit.center[2] + x * Math.sin(orientation) + depth * Math.cos(orientation),
  ];
}
/** Portfolio sun framing: 112% of viewport height, with its visible limb at ~37% of height. */
export const PORTFOLIO_FRAMING = {
  sunRadius: 55,
  heightRatio: 1.12,
  visibleLimbRatio: (1.12 * 0.86) / 2 - 0.11,
};

export function viewFrame(view: SceneModel["view"], aspect: number) {
  const portfolio = view.preset === "offset" && view.framing === "portfolio";
  const baseHeight = portfolio
    ? (PORTFOLIO_FRAMING.sunRadius * 2) / PORTFOLIO_FRAMING.heightRatio
    : 325;
  const height = baseHeight / view.zoom;
  const crop =
    PORTFOLIO_FRAMING.heightRatio / 2 - PORTFOLIO_FRAMING.visibleLimbRatio;
  const offset = portfolio
    ? (height * aspect) / 2 + height * crop
    : view.preset === "offset"
      ? height * aspect * 0.43
      : 0;
  const target: [number, number, number] = [
    view.pan[0] + offset,
    view.pan[1],
    view.pan[2],
  ];
  const position: [number, number, number] =
    view.preset === "overhead"
      ? [target[0], target[1] + 400, target[2] + 0.01]
      : [target[0], target[1] + 110, target[2] + 360];
  return {
    height,
    width: height * aspect,
    target,
    position,
    up: view.preset === "overhead" ? [0, 0, -1] : [0, 1, 0],
  };
}
