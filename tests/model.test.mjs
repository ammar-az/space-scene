import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createScene,
  createPlanet,
  rerollPlanet,
  rerollScene,
  instantiatePlanet,
} from "../src/react-app/scene/model/scene.ts";
import {
  parsePreset,
  serializeScene,
  serializePlanet,
} from "../src/react-app/scene/model/schema.ts";
import {
  orbitPosition,
  viewFrame,
} from "../src/react-app/scene/model/geometry.ts";
import { SceneClock } from "../src/react-app/scene/rendering/clock.ts";

test("portable scene and planet JSON retain values, recipes, locks, and camera", () => {
  const scene = createScene();
  scene.planets[0].locked = true;
  scene.planets[0].ranges.moons = [5, 10];
  scene.view = { preset: "overhead", zoom: 1.5, pan: [12, 8, -20] };
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  const planet = parsePreset(serializePlanet(scene.planets[0])).planet;
  assert.deepEqual(planet, scene.planets[0]);
  assert.deepEqual(instantiatePlanet(planet, "new-identity"), {
    ...planet,
    id: "new-identity",
  });
  assert.equal(planet.id, "planet-1");
});

test("invalid or unsupported preset files are rejected before changing the scene", () => {
  assert.throws(() => parsePreset("not json"), /valid JSON/);
  const source = JSON.parse(serializeScene(createScene()));
  source.schemaVersion = 999;
  assert.throws(() => parsePreset(JSON.stringify(source)), /Supported schema/);
  source.schemaVersion = 1;
  source.scene.planets[0].ranges.moons = [10, 5];
  assert.throws(() => parsePreset(JSON.stringify(source)), /Minimum/);
  source.scene.planets[0].ranges.moons = [5, 10];
  source.scene.planets.push(source.scene.planets[0]);
  assert.throws(() => parsePreset(JSON.stringify(source)), /unique/);
  assert.throws(() => parsePreset(" ".repeat(2_000_001)), /2 MB/);
});

test("locked appearances survive individual and whole-scene rerolls", () => {
  const scene = createScene();
  scene.planets[0].locked = true;
  const before = structuredClone(scene);
  const result = rerollScene(scene, 82942);
  assert.deepEqual(result.planets[0], before.planets[0]);
  assert.deepEqual(rerollPlanet(scene.planets[0], 99), before.planets[0]);
  assert.notDeepEqual(result.planets[1].seeds, before.planets[1].seeds);
  assert.deepEqual(result.planets[1].orbit, before.planets[1].orbit);
  assert.deepEqual(result.planets[1].spin, before.planets[1].spin);
  assert.deepEqual(result.view, before.view);
  assert.deepEqual(scene, before, "generation must not mutate inputs");
});

test("ranged rolls stay within inclusive integer limits and preserve independent parts", () => {
  const planet = createScene().planets[1];
  planet.ranges.moons = [5, 10];
  planet.ranges.rings = [2, 2];
  planet.ranges.radius = [4, 5];
  const counts = new Set();
  for (let nonce = 0; nonce < 120; nonce++) {
    const next = rerollPlanet(planet, nonce);
    assert.ok(
      Number.isInteger(next.moonCount) &&
        next.moonCount >= 5 &&
        next.moonCount <= 10,
    );
    counts.add(next.moonCount);
    assert.equal(next.ringCount, 2);
    assert.ok(next.radius >= 4 && next.radius <= 5);
    assert.deepEqual(
      next,
      rerollPlanet(planet, nonce),
      "same seed must reproduce the same values",
    );
  }
  assert.ok(counts.has(5) && counts.has(10));
  const moons = rerollPlanet(planet, 87123, "moons");
  assert.deepEqual(moons.families, planet.families);
  assert.equal(moons.seeds.surface, planet.seeds.surface);
  assert.equal(moons.seeds.rings, planet.seeds.rings);
  assert.deepEqual(moons.orbit, planet.orbit);
  assert.deepEqual(moons.moonCount, rerollPlanet(planet, 87123).moonCount);
});

test("all camera presets operate on the same world coordinates", () => {
  const scene = createScene(),
    planet = scene.planets[0];
  const position = orbitPosition(planet.orbit, 10);
  const centered = viewFrame({ ...scene.view, preset: "centered" }, 1.5);
  const overhead = viewFrame({ ...scene.view, preset: "overhead" }, 1.5);
  const offset = viewFrame({ ...scene.view, preset: "offset" }, 1.5);
  assert.deepEqual(overhead.target, centered.target);
  assert.ok(offset.target[0] > centered.target[0]);
  assert.ok(overhead.position[1] > centered.position[1]);
  assert.deepEqual(orbitPosition(planet.orbit, 10), position);
  const faceOn = orbitPosition(
    { ...planet.orbit, phase: 90, inclination: 0 },
    0,
  );
  const inclined = orbitPosition(
    { ...planet.orbit, phase: 90, inclination: 60 },
    0,
  );
  assert.ok(Math.abs(faceOn[1]) < 1e-12 && inclined[1] > 0);
  assert.ok(Math.abs(Math.hypot(...faceOn) - Math.hypot(...inclined)) < 1e-8);
});

test("shared clock pauses, suspends hidden time, and advances only once per frame", () => {
  const clock = new SceneClock();
  clock.sample(1000);
  clock.sample(2000);
  clock.sample(2000);
  assert.equal(clock.elapsed, 1);
  clock.configure(false, 1, 2000);
  clock.sample(5000);
  assert.equal(clock.elapsed, 1);
  clock.configure(true, 2, 5000);
  clock.sample(6000);
  assert.equal(clock.elapsed, 3);
  clock.suspend(true, 6000);
  clock.suspend(false, 100000);
  assert.equal(clock.elapsed, 3);
  clock.sample(101000);
  assert.equal(clock.elapsed, 5);
  clock.reduce(true, 101000);
  clock.sample(102000);
  assert.equal(clock.elapsed, 5);
});

test("scene snapshots retain separate orbital and solar time, and reset only orbit positions", () => {
  const scene = createScene();
  scene.timeline = { elapsed: 120, solar: 48 };
  const loaded = parsePreset(serializeScene(scene)).scene;
  assert.deepEqual(loaded.timeline, { elapsed: 120, solar: 48 });
  const initial = orbitPosition(loaded.planets[0].orbit, 0);
  loaded.motion.orbitEpoch = 120;
  assert.deepEqual(
    orbitPosition(
      loaded.planets[0].orbit,
      loaded.timeline.elapsed - loaded.motion.orbitEpoch,
    ),
    initial,
  );
  assert.equal(loaded.timeline.solar, 48);
  const clock = new SceneClock();
  clock.seek(120, 1000);
  clock.sample(2000);
  assert.equal(clock.elapsed, 121);
});

test("all supported default planet slots produce valid portable scenes", () => {
  const scene = createScene();
  scene.planets = Array.from({ length: 64 }, (_, index) =>
    createPlanet(`slot-${index}`, index, index),
  );
  assert.equal(parsePreset(serializeScene(scene)).scene.planets.length, 64);
});

test("portfolio side framing matches the initial sun height and visible limb", () => {
  const scene = createScene();
  assert.equal(scene.view.preset, "offset");
  assert.equal(scene.sun.radius, 55);
  for (const aspect of [1.06, 1.6, 1.92]) {
    const frame = viewFrame(scene.view, aspect);
    assert.ok(Math.abs((scene.sun.radius * 2) / frame.height - 1.12) < 1e-10);
    const centerRatio = (0.5 - frame.target[0] / frame.width) * aspect;
    const limbRatio = centerRatio + scene.sun.radius / frame.height;
    assert.ok(Math.abs(limbRatio - ((1.12 * 0.86) / 2 - 0.11)) < 1e-10);
  }
  for (const planet of scene.planets)
    assert.ok(
      planet.orbit.radius * (1 - planet.orbit.eccentricity) >
        scene.sun.radius + planet.radius,
    );
});

test("existing JSON without a framing profile retains the earlier side camera", () => {
  const scene = createScene();
  delete scene.view.framing;
  scene.sun.radius = 19;
  const loaded = parsePreset(serializeScene(scene)).scene;
  const frame = viewFrame(loaded.view, 1.6);
  assert.equal(frame.height, 325);
  assert.equal(frame.target[0], frame.width * 0.43);
  assert.equal(loaded.sun.radius, 19);
});

test("sky controls survive JSON and independent rerolls without invalidating earlier presets", () => {
  const scene = createScene();
  scene.background.clusterFrequency = 0;
  scene.background.largeStarFrequency = 3.5;
  scene.background.deepSky = { visible: true, seed: 923, density: 1.4, size: 2, brightness: 1.6 };
  assert.deepEqual(parsePreset(serializeScene(scene)).scene.background, scene.background);
  const rolled = rerollScene(scene, 54321).background;
  assert.notEqual(rolled.deepSky.seed, scene.background.deepSky.seed);
  assert.equal(rolled.deepSky.size, 2);
  assert.equal(rolled.clusterFrequency, 0);
  delete scene.background.deepSky;
  delete scene.background.clusterFrequency;
  delete scene.background.largeStarFrequency;
  assert.deepEqual(parsePreset(serializeScene(scene)).scene.background, scene.background);
  scene.background.clusterFrequency = 6;
  assert.throws(() => serializeScene(scene));
});
