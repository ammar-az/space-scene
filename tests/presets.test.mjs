import {
  orbitLayoutFactors,
  scaleOrbitPoint,
} from "../src/react-app/scene/model/layout.ts";
import {
  planetRenderRadius,
  starRenderRadius,
} from "../src/react-app/scene/model/sizes.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  parsePreset,
  serializeScene,
  serializePlanet,
} from "../src/react-app/scene/model/schema.ts";
import { scenePresets } from "../src/react-app/data/presets.ts";
import {
  orbitPosition,
  viewFrame,
  orbitEllipse,
} from "../src/react-app/scene/model/geometry.ts";
import { rerollPlanet } from "../src/react-app/scene/model/scene.ts";
import { getPlanetSystem } from "../src/react-app/scene/utils/planetSystems.ts";
const readScene = async (id) =>
  parsePreset(
    await readFile(
      new URL(`../public/presets/${id}.json`, import.meta.url),
      "utf8",
    ),
  ).scene;

test("every built-in is a complete portable JSON scene with independent mutable copies", async () => {
  assert.equal(scenePresets.length, 2);
  for (const preset of scenePresets) {
    const scene = await readScene(preset.id);
    assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
    assert.equal(preset.path, `/presets/${preset.id}.json`);
    assert.equal(scene.timeline.elapsed, 0);
    assert.equal(
      new Set(scene.planets.map((p) => p.id)).size,
      scene.planets.length,
    );
    const original = structuredClone(scene);
    scene.planets[0].diameter = 12;
    scene.background.seed++;
    assert.deepEqual(await readScene(preset.id), original);
    for (const planet of original.planets) {
      assert.deepEqual(parsePreset(serializePlanet(planet)).planet, planet);
      const rolled = rerollPlanet(planet, 9171);
      assert.deepEqual(rolled.orbit, planet.orbit);
      assert.notEqual(rolled.seeds.surface, planet.seeds.surface);
    }
  }
});

test("portfolio preset retains original artwork streams, palettes and satellite counts", async () => {
  const scene = await readScene("portfolio");
  assert.deepEqual(
    scene.planets.map((p) => p.id),
    ["word-wasp", "potential", "tasked", "ltg", "potential-cpp", "project-x"],
  );
  const expectedColors = [
    "#dfaa2b",
    "#b75330",
    "#528bea",
    "#a787d9",
    "#73b7b7",
    "#65b97b",
  ];
  for (const [i, planet] of scene.planets.entries()) {
    const family = planet.families[planet.type];
    assert.equal(
      planet.seeds.surface,
      planet.id === "project-x" ? "planet-x" : planet.id,
    );
    assert.equal(family.color, expectedColors[i]);
    const system = getPlanetSystem({
      seed: planet.seeds.surface,
      color: family.color,
      accentColor: family.accent,
      type: planet.type === "rocky" ? "terrestrial" : "giant",
      intense: family.intense,
    });
    assert.equal(planet.moonCount, system.moons.length);
    assert.equal(planet.ringCount, system.ring ? 1 : 0);
  }
  assert.equal(scene.planets[0].families.rocky.intense, false);
  assert.equal(scene.planets[4].families.icy.detail, 1);
});

test("portfolio preset projects onto the original desktop positions and body sizes", async () => {
  const scene = await readScene("portfolio"),
    factors = orbitLayoutFactors(scene);
  // Reference composition, with Word Wasp moved back to 18 degrees and Project X retaining its start.
  const expected = JSON.parse(
    await readFile(
      new URL("./fixtures/portfolio-preset-layout.json", import.meta.url),
      "utf8",
    ),
  );
  const frame = viewFrame(scene.view, expected.width / expected.height);
  const length = Math.hypot(110, 360),
    upY = 360 / length,
    upZ = -110 / length;
  for (const planet of scene.planets) {
    const point = scaleOrbitPoint(
        orbitPosition(planet.orbit, 0),
        scene.sun.position,
        factors.get(planet.id),
      ),
      original = expected.planets.find((p) => p.id === planet.id);
    const x =
      expected.width / 2 +
      ((point[0] - frame.target[0]) / frame.height) * expected.height;
    const y =
      expected.height / 2 -
      (((point[1] - frame.target[1]) * upY +
        (point[2] - frame.target[2]) * upZ) /
        frame.height) *
        expected.height;
    assert.ok(
      Math.abs(x - original.x) < 1,
      `${planet.name}: x ${x} vs ${original.x}`,
    );
    assert.ok(
      Math.abs(y - original.y) < 1,
      `${planet.name}: y ${y} vs ${original.y}`,
    );
    assert.ok(
      Math.abs(
        (planetRenderRadius(scene, planet) / frame.height) * expected.height -
          original.radius,
      ) < 0.01,
    );
  }
});

test("solar preset includes the eight ordered planets, Earth-like rocky Earth and illustrative satellite choices", async () => {
  const scene = await readScene("solar-system"),
    factors = orbitLayoutFactors(scene);
  assert.deepEqual(
    scene.planets.map((p) => p.name),
    [
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
      "Pluto",
    ],
  );
  assert.deepEqual(
    scene.planets.map((p) => p.type),
    ["rocky", "rocky", "rocky", "rocky", "gas", "icy", "icy", "icy", "rocky"],
  );
  const earth = scene.planets[2];
  assert.equal(earth.families.rocky.color, "#2478c4");
  assert.equal(earth.earthlike.enabled, true);
  assert.equal(earth.moonCount, 1);
  assert.equal(scene.planets[3].moonCount, 2);
  assert.equal(scene.planets[4].moonCount, 4);
  assert.equal(scene.planets[5].ringCount, 1);
  assert.equal(scene.planets[6].spin.tilt, 97.8);
  for (const [i, planet] of scene.planets.entries()) {
    assert.ok(
      Math.hypot(
        ...scaleOrbitPoint(
          orbitPosition(planet.orbit, 0),
          scene.sun.position,
          factors.get(planet.id),
        ),
      ) >
        starRenderRadius(scene) + planetRenderRadius(scene, planet),
    );
    if (i) {
      assert.ok(
        orbitEllipse(planet.orbit).radiusX >
          orbitEllipse(scene.planets[i - 1].orbit).radiusX,
      );
      assert.ok(
        planet.orbit.periodDays > scene.planets[i - 1].orbit.periodDays,
      );
    }
  }
});
