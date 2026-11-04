import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createScene,
  rerollPlanet,
} from "../src/react-app/scene/model/scene.ts";
import {
  defaultEarthlike,
  setEarthlike,
} from "../src/react-app/scene/model/earthlike.ts";
import {
  cloudEvolution,
  cloudRotation,
} from "../src/react-app/scene/model/atmospheres.ts";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
import { generatePlanetMap } from "../src/react-app/scene/utils/planetMaps.ts";

const options = (earthlike, seed = 1871) => ({
  type: "terrestrial",
  color: "#b75330",
  accentColor: "#743a2b",
  intense: true,
  earthlike,
  seed,
});
function landFraction(map) {
  let total = 0,
    land = 0;
  for (let y = 0; y < map.height; y++) {
    const weight = Math.cos(((y + 0.5) / map.height - 0.5) * Math.PI);
    for (let x = 0; x < map.width; x++) {
      total += weight;
      if (map.pixels[(y * map.width + x) * 4 + 3] > 128) land += weight;
    }
  }
  return land / total;
}

test("Earth-like initialization preserves mechanics, remembered settings, and exact optional JSON", () => {
  const scene = createScene(),
    rocky = scene.planets[0];
  const earth = setEarthlike(rocky, true);
  assert.equal(earth.type, "rocky");
  for (const key of ["orbit", "spin", "families", "moons", "rings", "diameter"])
    assert.deepEqual(earth[key], rocky[key]);
  assert.equal(earth.atmosphere.visible, true);
  assert.equal(earth.clouds.visible, true);
  assert.ok(earth.clouds.coverage > 0.3 && earth.clouds.coverage < 0.6);
  const edited = {
    ...earth,
    earthlike: {
      ...earth.earthlike,
      desertColor: "#cfba82",
      landCoverage: 0.42,
    },
    clouds: { ...earth.clouds, coverage: 0.2 },
  };
  const toggled = setEarthlike(setEarthlike(edited, false), true);
  assert.deepEqual(toggled, edited);
  const rerolled = rerollPlanet(edited, 81, "surface");
  assert.notEqual(rerolled.seeds.surface, edited.seeds.surface);
  assert.deepEqual(rerolled.earthlike, edited.earthlike);
  assert.deepEqual(rerolled.clouds, edited.clouds);
  assert.equal(rerolled.seeds.clouds, edited.seeds.clouds);
  scene.planets[0] = edited;
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  edited.earthlike.landCoverage = 1.1;
  assert.throws(() => serializeScene(scene));
  assert.equal(
    parsePreset(serializeScene(createScene())).scene.planets[0].earthlike,
    undefined,
  );
});

test("seeded Earth maps generate mostly ocean, obey land coverage, and keep shapes when recolored", async () => {
  const normal = await generatePlanetMap(options(defaultEarthlike));
  assert.ok(Math.abs(landFraction(normal) - 0.3) < 0.04, landFraction(normal));
  const recolored = await generatePlanetMap(
    options({
      ...defaultEarthlike,
      oceanColor: "#3976ba",
      desertColor: "#e8cb82",
    }),
  );
  assert.notDeepEqual(normal.pixels, recolored.pixels);
  for (let i = 3; i < normal.pixels.length; i += 4)
    assert.equal(normal.pixels[i], recolored.pixels[i]);
  const other = await generatePlanetMap(options(defaultEarthlike, 7124));
  assert.notDeepEqual(normal.pixels, other.pixels);
  assert.ok(Math.abs(landFraction(other) - 0.3) < 0.04, landFraction(other));
  const wetter = await generatePlanetMap(
    options({ ...defaultEarthlike, landCoverage: 0.12 }),
  );
  const drier = await generatePlanetMap(
    options({ ...defaultEarthlike, landCoverage: 0.65 }),
  );
  assert.ok(landFraction(wetter) < 0.16);
  assert.ok(landFraction(drier) > 0.6);
  assert.equal(await generatePlanetMap(options(defaultEarthlike)), normal);
  // Continuous spherical fields should have adjacent values at the longitude seam.
  let seam = 0,
    adjacent = 0;
  for (let y = 0; y < normal.height; y++)
    for (let c = 0; c < 3; c++) {
      const i = y * normal.width * 4 + c;
      seam += Math.abs(
        normal.pixels[i] - normal.pixels[i + (normal.width - 1) * 4],
      );
      adjacent += Math.abs(normal.pixels[i] - normal.pixels[i + 4]);
    }
  assert.ok(seam / normal.height / 3 < 8);
  assert.ok(seam < adjacent * 2.5);
});

test("cloud evolution changes a stationary shell, loops smoothly, and can be disabled independently of drift", () => {
  const p = setEarthlike(createScene().planets[0], true);
  p.spin.playing = false;
  p.clouds.speed = 0;
  p.spin.phase = 0;
  assert.equal(cloudRotation(p, 0), cloudRotation(p, 12));
  assert.notDeepEqual(cloudEvolution(p, 0), cloudEvolution(p, 12));
  assert.deepEqual(cloudEvolution(p, 12), cloudEvolution(p, 12));
  for (const value of cloudEvolution(p, 200))
    assert.ok(Math.abs(value) < 1e-10);
  p.clouds.evolution = 0;
  assert.deepEqual(cloudEvolution(p, 12), [0, 0, 0]);
  p.clouds.speed = 2;
  assert.notEqual(cloudRotation(p, 0), cloudRotation(p, 12));
  assert.deepEqual(cloudEvolution(p, 1e12), [0, 0, 0]);
});
