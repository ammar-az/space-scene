/** Complete, editable scene JSON files; the catalogue contains presentation metadata only. */
export const scenePresets = [
  {
    id: "portfolio",
    name: "Portfolio system",
    path: "/presets/portfolio.json",
    description:
      "The six portfolio worlds, including Project X, with their original colors and artwork seeds.",
    note: "Portfolio composition adapted to 3D at a desktop reference size.",
    colors: ["#dfaa2b", "#b75330", "#528bea", "#a787d9", "#73b7b7", "#65b97b"],
  },
  {
    id: "solar-system",
    name: "Our solar system",
    path: "/presets/solar-system.json",
    description: "Mercury through Neptune, with a blue rocky Earth for now.",
    note: "Illustrative sizes and spacing; selected moons and Saturn’s prominent rings. Starting positions are composed, not current sky positions.",
    colors: [
      "#a6a39b",
      "#d7b675",
      "#2478c4",
      "#b75330",
      "#c79874",
      "#c8b581",
      "#83cbce",
      "#3769ce",
    ],
    source: {
      label: "NASA planetary data",
      url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    },
  },
] as const;
export type ScenePreset = (typeof scenePresets)[number];
