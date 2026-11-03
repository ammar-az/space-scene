export const starPalettes = [
    { id: "yellow", name: "Yellow", color: "#ffb400", highlight: "#fff01d", shadow: "#b52d00", laneAccent: 0 },
    { id: "red", name: "Red", color: "#ff3514", highlight: "#ff7b00", shadow: "#850408", laneAccent: 0 },
    { id: "blue", name: "Blue", color: "#8fbfff", highlight: "#e6f1ff", shadow: "#3e73b0", laneAccent: 0 },
    // Preserve the old key so an existing Cyan selection becomes White on live updates.
    { id: "cyan", name: "White", color: "#eff5ff", highlight: "#ffffff", shadow: "#adc1e3", laneAccent: 0.12 },
    { id: "green", name: "Green", color: "#9cffaa", highlight: "#e9ffdb", shadow: "#389a66", laneAccent: 0.08 },
    { id: "purple", name: "Dark star", color: "#222b86", highlight: "#827cfa", shadow: "#05091c", laneAccent: 0 },
] as const;

export type StarPalette = typeof starPalettes[number];
export type StarAppearance = { color: StarPalette["id"]; seed: number };
