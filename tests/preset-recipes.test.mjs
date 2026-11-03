import {
  planetRenderRadius,
  starRenderRadius,
} from "../src/react-app/scene/model/sizes.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  createDefaultScene,
  generateScenePreset,
} from "../src/react-app/scene/model/presetRecipes.ts";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
import { orbitPosition } from "../src/react-app/scene/model/geometry.ts";
import {
  moonProfiles,
  planetRing,
} from "../src/react-app/scene/model/systems.ts";
import { giantArtwork } from "../src/react-app/scene/utils/planetTextures.ts";
import { seededRandom } from "../src/react-app/scene/utils/seededRandom.ts";
const template = async (id) =>
  parsePreset(
    await readFile(
      new URL(`../public/presets/${id}.json`, import.meta.url),
      "utf8",
    ),
  ).scene;

test("portfolio is the immediate generated default and bundled JSON matches public recipes", async () => {
  const source = await template("portfolio");
  assert.deepEqual(createDefaultScene(91), generateScenePreset(source, 91));
  assert.equal(createDefaultScene().planets.length, 6);
  for (const id of ["portfolio", "solar-system"])
    assert.equal(
      await readFile(
        new URL(`../public/presets/${id}.json`, import.meta.url),
        "utf8",
      ),
      await readFile(
        new URL(`../src/react-app/scene/presets/${id}.json`, import.meta.url),
        "utf8",
      ),
    );
  const changed = createDefaultScene(10);
  changed.planets[0].diameter = 14;
  changed.sun.position[0] = 150;
  assert.notEqual(createDefaultScene(10).planets[0].diameter, 14);
  assert.equal(createDefaultScene(10).sun.position[0], 0);
});

test("portfolio recipes vary within allowed bounds while preserving project identity and layout", async () => {
  const source = await template("portfolio"),
    before = structuredClone(source),
    first = generateScenePreset(source, 1);
  const radii = new Set(),
    rings = new Set(),
    moonCounts = new Set();
  for (let seed = 0; seed < 120; seed++) {
    const scene = generateScenePreset(source, seed);
    for (const [i, p] of scene.planets.entries()) {
      const rule = source.planets[i],
        family = p.families[p.type];
      assert.ok(
        p.diameter >= rule.ranges.diameter[0] &&
          p.diameter <= rule.ranges.diameter[1],
      );
      assert.ok(
        p.moonCount >= rule.ranges.moons[0] &&
          p.moonCount <= rule.ranges.moons[1],
      );
      assert.equal(family.color, rule.families[rule.type].color);
      assert.equal(family.intense, rule.families[rule.type].intense);
      assert.deepEqual(p.orbit, rule.orbit);
      if (p.type === "rocky") assert.equal(p.rings.amount, 0);
      else
        assert.ok(
          p.rings.amount === 0 ||
            (p.rings.amount >= rule.ranges.ringAmount[0] &&
              p.rings.amount <= rule.ranges.ringAmount[1]),
        );
    }
    radii.add(scene.planets[0].diameter);
    moonCounts.add(scene.planets[0].moonCount);
    rings.add(scene.planets[2].rings.amount > 0);
  }
  assert.ok(radii.size > 2 && moonCounts.size > 2 && rings.size === 2);
  assert.deepEqual(generateScenePreset(source, 1), first);
  assert.deepEqual(source, before);
  assert.deepEqual(
    parsePreset(serializeScene(first)).scene,
    first,
    "file imports retain the generated snapshot exactly",
  );
});

test("Project X has a closed Sun-centered orbit that clears the solar surface throughout its period", async () => {
  const source = await template("portfolio"),
    x = source.planets.find((p) => p.id === "project-x");
  const expected = [165.8250000027727, 28.475414399639337, 0.7651079401634588];
  orbitPosition(x.orbit, 0, source.sun.position).forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) < 1e-6),
  );
  for (let phase = 0; phase < 360; phase += 0.25) {
    const point = orbitPosition({ ...x.orbit, phase }, 0, source.sun.position);
    assert.ok(
      Math.hypot(...point) >
        starRenderRadius(source) + x.ranges.diameter[1] * 0.08,
    );
  }
  const start = orbitPosition(x.orbit, 0),
    end = orbitPosition(x.orbit, 360 / Math.abs(x.orbit.speed));
  start.forEach((v, i) => assert.ok(Math.abs(v - end[i]) < 1e-7));
  const reference = JSON.parse(
    await readFile(
      new URL("./fixtures/portfolio-preset-layout.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    reference.planets[0].x > 650,
    "Word Wasp starts before its old position near the Sun",
  );
});

test("solar recipes keep warm Jupiter, icy-style Saturn, narrow Uranus rings and compact moons", async () => {
  const source = await template("solar-system");
  assert.equal(source.sun.diameter, 139.14);
  for (let seed = 0; seed < 40; seed++) {
    const scene = generateScenePreset(source, seed),
      jupiter = scene.planets[4],
      saturn = scene.planets[5],
      uranus = scene.planets[6];
    assert.ok(
      jupiter.families.gas.palette.some(
        (p) => p.color === jupiter.families.gas.color,
      ),
    );
    assert.equal(jupiter.families.gas.bandShadow, "#a76947");
    assert.equal(saturn.type, "icy");
    assert.ok(
      uranus.rings.amount > 0 && uranus.rings.amount < saturn.rings.amount,
    );
    for (const p of scene.planets) {
      for (let phase = 0; phase < 360; phase += 2) {
        const point = orbitPosition(
          { ...p.orbit, phase },
          0,
          scene.sun.position,
        );
        assert.ok(
          Math.hypot(...point) >
            starRenderRadius(scene) + planetRenderRadius(scene, p),
          `${p.name} must clear the configured rendered Sun`,
        );
      }
      for (const moon of moonProfiles(p)) {
        assert.ok(moon.distance <= 2.8);
        assert.ok(moon.distance >= 1 + moon.size);
        const ring = planetRing(p);
        if (ring) assert.ok(moon.distance >= ring.outer + moon.size);
      }
    }
  }
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const j = source.planets[4].families.gas;
  const random = seededRandom(3004);
  random();
  const artwork = giantArtwork(
    rgb(j.color),
    rgb(j.accent),
    true,
    random,
    rgb(j.bandShadow),
  );
  assert.ok(
    artwork.bands.every((b) => rgb(b.color)[0] >= rgb(b.color)[2]),
    "Jupiter belts stay cream/tan/brown rather than blue",
  );
});
