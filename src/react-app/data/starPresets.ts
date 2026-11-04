import type { SceneModel } from "../scene/model/schema.ts";
import { roundDiameter } from "../scene/model/sizes.ts";

type Star = SceneModel["sun"];
type Appearance = Pick<Star, "diameter" | "color" | "highlight" | "shadow">;
export type StarPreset = {
  id: string;
  name: string;
  group: "Main sequence" | "Remnants and giants";
  description: string;
  appearance: Appearance;
};

// Diameter is stored in 10,000 km. Non-solar sizes are illustrative examples,
// not unique values for a spectral class. Palettes retain the scene's art style.
const solarDiameter = 139.14;
const mainSequence = (
  type: string,
  name: string,
  solarSizes: number,
  color: string,
  highlight: string,
  shadow: string,
): StarPreset => ({
  id: `main-${type.toLowerCase()}`,
  name: `${type} · ${name}`,
  group: "Main sequence",
  description:
    type === "G"
      ? "The familiar warm-gold Sun-like star."
      : `${name} main-sequence star.`,
  appearance: {
    diameter: roundDiameter(solarDiameter * solarSizes),
    color,
    highlight,
    shadow,
  },
});

export const starPresets: StarPreset[] = [
  {
    id: "white-dwarf",
    name: "White dwarf",
    group: "Remnants and giants",
    description: "A compact stellar remnant with an icy-white palette.",
    appearance: {
      diameter: 1.2,
      color: "#e2eeff",
      highlight: "#ffffff",
      shadow: "#819dbf",
    },
  },
  mainSequence("G", "Sun-like", 1, "#ffb400", "#fff01d", "#b52d00"),
  {
    id: "red-giant",
    name: "Red giant",
    group: "Remnants and giants",
    description: "An expanded star with a warm red-orange palette.",
    appearance: {
      diameter: roundDiameter(solarDiameter * 50),
      color: "#ff7744",
      highlight: "#ffc476",
      shadow: "#a1321b",
    },
  },
  mainSequence("O", "Blue", 20, "#9db5ff", "#f0f5ff", "#3959a6"),
  mainSequence("B", "Blue-white", 5, "#b7cdff", "#f4f8ff", "#536da7"),
  mainSequence("A", "White", 2, "#edf2ff", "#ffffff", "#818dab"),
  mainSequence("F", "Yellow-white", 1.3, "#fff5dd", "#fffdf7", "#b69c71"),
  mainSequence("K", "Orange", 0.75, "#ff9b45", "#ffdd9b", "#a3441a"),
  mainSequence("M", "Red dwarf", 0.25, "#ff633a", "#ffb780", "#8b2320"),
];

/** Recipes apply once; saved/custom stars keep explicit values and no preset dependency. */
export function applyStarPreset(star: Star, preset: StarPreset): Star {
  return { ...star, ...preset.appearance };
}
export function matchingStarPreset(star: Star): StarPreset | undefined {
  return starPresets.find(
    ({ appearance: p }) =>
      p.diameter === star.diameter &&
      p.color === star.color.toLowerCase() &&
      p.highlight === star.highlight.toLowerCase() &&
      p.shadow === star.shadow.toLowerCase(),
  );
}
