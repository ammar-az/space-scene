import type { SceneModel } from "./schema.ts";
import { starRenderPosition, starRenderRadius } from "./sizes.ts";

export const defaultLighting = "realistic" as const;
export const stellarGlowRadius = 1.5;

export function starVisualRadius(scene: SceneModel): number {
  return (
    starRenderRadius(scene) *
    ((scene.sun.glow ?? 1) > 0 ? stellarGlowRadius : 1)
  );
}

/** The light source remains at the star even when its visible mesh is hidden. */
export function sceneLighting(scene: SceneModel) {
  const fullyLit = (scene.lighting ?? defaultLighting) === "fully-lit";
  return {
    fullyLit,
    fill: fullyLit ? 0.4 : 0.14,
    moonFill: fullyLit ? 0.28 : 0.14,
    ringFill: fullyLit ? 0.55 : 0.14,
    position: starRenderPosition(scene),
  };
}
