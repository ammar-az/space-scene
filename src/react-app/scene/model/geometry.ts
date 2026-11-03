import type { Planet, SceneModel } from "./schema.ts";

type Vector = [number, number, number];
const radians = Math.PI / 180;
function orient(orbit: Planet["orbit"], x: number, z: number): Vector {
  const inclination = orbit.inclination * radians,
    orientation = orbit.orientation * radians;
  const y = z * Math.sin(inclination),
    depth = z * Math.cos(inclination);
  return [
    x * Math.cos(orientation) - depth * Math.sin(orientation),
    y,
    x * Math.sin(orientation) + depth * Math.cos(orientation),
  ];
}
export function orbitEllipse(
  orbit: Planet["orbit"],
): NonNullable<Planet["orbit"]["ellipse"]> {
  return (
    orbit.ellipse ?? {
      radiusX: orbit.radius,
      radiusZ: orbit.radius * Math.sqrt(1 - orbit.eccentricity ** 2),
      rotation: 0,
      anchor: "center",
    }
  );
}
/** Geometric center, including legacy focus-offset orbits. */
export function orbitCenter(
  orbit: Planet["orbit"],
  sun: Vector = [0, 0, 0],
): Vector {
  if (!orbit.ellipse) {
    const offset = orient(orbit, -orbit.radius * orbit.eccentricity, 0);
    return orbit.center.map((v, i) => v + offset[i]) as Vector;
  }
  if (orbit.ellipse.anchor === "center") return [...orbit.center];
  const { radiusX, radiusZ, rotation } = orbit.ellipse;
  const focus = Math.sqrt(Math.abs(radiusX ** 2 - radiusZ ** 2));
  const x = radiusX >= radiusZ ? -focus : 0,
    z = radiusZ > radiusX ? -focus : 0;
  const angle = rotation * radians;
  const offset = orient(
    orbit,
    x * Math.cos(angle) - z * Math.sin(angle),
    x * Math.sin(angle) + z * Math.cos(angle),
  );
  return sun.map((v, i) => v + offset[i]) as Vector;
}
/** Upgrade a legacy ellipse without shifting it; shape edits then retain its center. */
export function editOrbit(
  orbit: Planet["orbit"],
  patch: Partial<NonNullable<Planet["orbit"]["ellipse"]>>,
  sun: Vector,
): Planet["orbit"] {
  return {
    ...orbit,
    center: orbitCenter(orbit, sun),
    ellipse: { ...orbitEllipse(orbit), ...patch },
  };
}
export function orbitPosition(
  orbit: Planet["orbit"],
  elapsedSeconds: number,
  sun: Vector = [0, 0, 0],
): Vector {
  const ellipse = orbitEllipse(orbit);
  const phase = (orbit.phase + elapsedSeconds * orbit.speed) * radians,
    angle = ellipse.rotation * radians;
  const x = ellipse.radiusX * Math.cos(phase),
    z = ellipse.radiusZ * Math.sin(phase);
  const offset = orient(
    orbit,
    x * Math.cos(angle) - z * Math.sin(angle),
    x * Math.sin(angle) + z * Math.cos(angle),
  );
  const center = orbitCenter(orbit, sun);
  return center.map((v, i) => v + offset[i]) as Vector;
}
/** Portfolio sun framing: 112% of viewport height, with its visible limb at ~37% of height. */
export const PORTFOLIO_FRAMING = {
  sunRadius: 55,
  heightRatio: 1.12,
  visibleLimbRatio: (1.12 * 0.86) / 2 - 0.11,
};

export function viewFrame(view: SceneModel["view"], aspect: number) {
  if (view.camera) {
    const { azimuth, elevation, target, baseHeight } = view.camera;
    const a = azimuth * radians,
      e = elevation * radians;
    const height = baseHeight / view.zoom;
    const direction = [
      Math.sin(a) * Math.cos(e),
      Math.sin(e),
      Math.cos(a) * Math.cos(e),
    ];
    return {
      height,
      width: height * aspect,
      target: [...target] as Vector,
      position: target.map((v, i) => v + direction[i] * 4000) as Vector,
      up: [-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e)],
    };
  }
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
