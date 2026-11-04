import { starRenderPosition } from "./sizes.ts";
import type { SceneModel, ViewPreset } from "./schema.ts";
import {
  orbitLayoutFactors,
  scaleOrbitPoint,
  sceneFitSamples,
} from "./layout.ts";
import { MIN_VIEW_HEIGHT, orbitPosition, viewFrame } from "./geometry.ts";
type View = SceneModel["view"];
type Vector = [number, number, number];
const degrees = 180 / Math.PI;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const wrapAzimuth = (value: number) =>
  ((((value + 180) % 360) + 360) % 360) - 180;

export function zoomBounds(view: View) {
  const baseHeight = viewFrame({ ...view, zoom: 1 }, 1).height;
  return { min: 0.01, max: baseHeight / MIN_VIEW_HEIGHT };
}
export function clampZoom(view: View, zoom: number): number {
  const bounds = zoomBounds(view);
  return clamp(zoom, bounds.min, bounds.max);
}

/** Store a render-space offset so a followed planet can move without React updates. */
export function followPlanetView(
  scene: SceneModel,
  id: string,
  aspect: number,
): View {
  if (!scene.planets.some((p) => p.id === id && p.visible)) return scene.view;
  const view = setViewAngles(scene.view, aspect, {});
  return {
    ...view,
    camera: { ...view.camera!, target: [0, 0, 0], followPlanetId: id },
  };
}

/** Resolve a relative follow target to a fixed world view, also used when releasing follow. */
export function resolveFollowView(
  scene: SceneModel,
  orbitDays: number,
  factors?: Map<string, number>,
): View {
  const view = scene.view,
    camera = view.camera;
  if (!camera?.followPlanetId) return view;
  const { followPlanetId, ...fixed } = camera;
  const planet = scene.planets.find((p) => p.id === followPlanetId);
  const position = planet
    ? scaleOrbitPoint(
        orbitPosition(
          planet.orbit,
          orbitDays - scene.motion.orbitEpochDays,
          scene.sun.position,
        ),
        scene.sun.position,
        (factors ?? orbitLayoutFactors(scene)).get(planet.id) ?? 1,
      )
    : [0, 0, 0];
  return {
    ...view,
    camera: {
      ...fixed,
      target: fixed.target.map((v, i) => v + position[i]) as Vector,
    },
  };
}

export function viewAngles(view: View) {
  return view.camera
    ? { azimuth: view.camera.azimuth, elevation: view.camera.elevation }
    : {
        azimuth: 0,
        elevation:
          view.preset === "overhead"
            ? Math.atan2(400, 0.01) * degrees
            : Math.atan2(110, 360) * degrees,
      };
}
/** Capture the actual framing once; free rotation/zoom then keep this world-space target fixed. */
export function setViewAngles(
  view: View,
  aspect: number,
  patch: Partial<ReturnType<typeof viewAngles>>,
): View {
  const frame = viewFrame(view, aspect);
  return {
    ...view,
    camera: {
      target: [...frame.target],
      baseHeight: frame.height * view.zoom,
      ...viewAngles(view),
      ...view.camera,
      ...patch,
      azimuth: clamp(patch.azimuth ?? viewAngles(view).azimuth, -180, 180),
      elevation: clamp(patch.elevation ?? viewAngles(view).elevation, -90, 90),
    },
  };
}
export function rotateView(
  view: View,
  aspect: number,
  dx: number,
  dy: number,
): View {
  const angles = viewAngles(view);
  return setViewAngles(view, aspect, {
    azimuth: wrapAzimuth(angles.azimuth - dx * 0.3),
    elevation: angles.elevation + dy * 0.3,
  });
}
/** Translate in the camera's screen plane, including at both poles and below the orbital plane. */
export function panView(
  view: View,
  aspect: number,
  dx: number,
  dy: number,
  viewportHeight: number,
): View {
  const frame = viewFrame(view, aspect),
    angles = viewAngles(view);
  const a = angles.azimuth / degrees,
    e = angles.elevation / degrees;
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const up = [
    -Math.sin(a) * Math.sin(e),
    Math.cos(e),
    -Math.cos(a) * Math.sin(e),
  ];
  const scale = frame.height / Math.max(1, viewportHeight);
  const delta = right.map((v, i) => (-dx * v + dy * up[i]) * scale);
  if (view.camera)
    return {
      ...view,
      camera: {
        ...view.camera,
        target: view.camera.target.map((v, i) =>
          clamp(v + delta[i], -1000000, 1000000),
        ) as Vector,
      },
    };
  return {
    ...view,
    pan: view.pan.map((v, i) => clamp(v + delta[i], -2000, 2000)) as Vector,
  };
}
/** The named buttons and reset always return to a composed position, discarding custom orientation. */
export function snapView(view: View, preset: ViewPreset = view.preset): View {
  const next = {
    ...view,
    preset,
    framing: "portfolio" as const,
    zoom: 1,
    pan: [0, 0, 0] as Vector,
  };
  delete next.camera;
  return next;
}

/** Frame full orbital paths and their satellite systems while retaining the current viewing angle. */
export function fitSceneView(scene: SceneModel, aspect: number): View {
  const angles = viewAngles(scene.view);
  const a = angles.azimuth / degrees,
    e = angles.elevation / degrees;
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const up = [
    -Math.sin(a) * Math.sin(e),
    Math.cos(e),
    -Math.cos(a) * Math.sin(e),
  ];
  const depth = [
    Math.sin(a) * Math.cos(e),
    Math.sin(e),
    Math.cos(a) * Math.cos(e),
  ];
  const axes = [right, up, depth],
    min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const samples = sceneFitSamples(scene);
  if (!samples.length)
    samples.push({ center: starRenderPosition(scene), radius: 10 });
  for (const sample of samples)
    for (let i = 0; i < 3; i++) {
      const coordinate = sample.center.reduce(
        (sum, value, j) => sum + value * axes[i][j],
        0,
      );
      min[i] = Math.min(min[i], coordinate - sample.radius);
      max[i] = Math.max(max[i], coordinate + sample.radius);
    }
  const mid = min.map((value, i) => (value + max[i]) / 2);
  const target = right.map((_, i) =>
    axes.reduce((sum, axis, j) => sum + axis[i] * mid[j], 0),
  ) as Vector;
  const baseHeight = Math.min(
    1000000,
    Math.max(20, max[1] - min[1], (max[0] - min[0]) / Math.max(0.1, aspect)) *
      1.25,
  );
  return { ...scene.view, zoom: 1, camera: { ...angles, target, baseHeight } };
}
