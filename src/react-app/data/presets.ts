/** Editable JSON recipes; built-in generation samples their declared ranges. */
export const scenePresets = [
  {
    id: "portfolio",
    name: "Portfolio system",
    path: "/presets/portfolio.json",
    description:
      "The six portfolio worlds, with their original colors and new surfaces, moons and rings on each generation.",
    note: "The default scene. Keeps the portfolio layout while generating within its allowed ranges.",
    colors: ["#dfaa2b", "#b75330", "#528bea", "#a787d9", "#73b7b7", "#65b97b"],
  },
  {
    id: "solar-system",
    name: "Our solar system",
    path: "/presets/solar-system.json",
    description:
      "Mercury through Pluto, with named moons, physical periods, Earth-like oceans and moving clouds.",
    note: "50% planet-size compression, independent star scaling, named satellites including Charon, and rings for Saturn and Uranus. Saturn uses the icy visual family.",
    colors: [
      "#a6a39b",
      "#d7b675",
      "#2478c4",
      "#b75330",
      "#dfc5a8",
      "#d4c391",
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
