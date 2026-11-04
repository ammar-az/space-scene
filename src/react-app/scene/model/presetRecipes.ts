import portfolio from "../presets/portfolio.json" with { type: "json" };
import { presetSchema } from "./schema.ts";
import type { SceneModel } from "./schema.ts";
import { rerollScene } from "./scene.ts";

/** Built-ins are recipes; importing an exported JSON snapshot still restores exact values. */
export function generateScenePreset(
  template: SceneModel,
  seed: number,
): SceneModel {
  const source = structuredClone(template);
  return {
    ...rerollScene(source, seed),
    background: source.background,
    sun: source.sun,
    timeline: {
      elapsed: 0,
      solar: 0,
      rotationHours: 0,
      orbitDays: 0,
      moonDays: 0,
    },
  };
}
const defaultPreset = presetSchema.parse(portfolio);
export function createDefaultScene(seed = 1871): SceneModel {
  if (defaultPreset.kind !== "space-scene")
    throw new Error("The default preset must contain a scene.");
  return generateScenePreset(defaultPreset.scene, seed);
}
