import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createScene,
  rerollPlanet,
} from "../src/react-app/scene/model/scene.ts";
import {
  editOrbit,
  orbitPosition,
  orbitCenter,
} from "../src/react-app/scene/model/geometry.ts";
import {
  planetRing,
  ringSettings,
  moonProfiles,
  moonPosition,
  defaultMoons,
} from "../src/react-app/scene/model/systems.ts";
import {
  createRingProfile,
  ringPixels,
} from "../src/react-app/scene/utils/planetSystems.ts";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
const near = (a, b) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8, `${a} vs ${b}`));

test("explicit physical ellipses retain their center through shape and orientation edits", () => {
  const orbit = {
    ...createScene().planets[0].orbit,
    ellipse: { radiusX: 100, radiusZ: 80, rotation: 0, anchor: "center" },
    inclination: 24,
    orientation: -37,
    center: [20, 8, 30],
  };
  const sun = [10, 2, -30],
    upgraded = editOrbit(orbit, {}, sun);
  for (let phase = 0; phase < 360; phase += 15)
    near(
      orbitPosition({ ...orbit, phase }, 0),
      orbitPosition({ ...upgraded, phase }, 0),
    );
  const edited = editOrbit(
    upgraded,
    { radiusX: 40, radiusZ: 130, rotation: 73 },
    sun,
  );
  near(orbitCenter(edited), orbitCenter(orbit));
  for (let phase = 0; phase < 180; phase += 15) {
    const a = orbitPosition({ ...edited, phase }, 0),
      b = orbitPosition({ ...edited, phase: phase + 180 }, 0);
    near(
      a.map((v, i) => (v + b[i]) / 2),
      orbitCenter(orbit),
    );
  }
  const turned = { ...edited, inclination: -38, orientation: 142 };
  near(orbitCenter(turned), orbitCenter(orbit));
});

test("solar anchoring keeps the Sun at a focus on either ellipse axis and follows a moved Sun", () => {
  const sun = [30, -10, 50];
  for (const [radiusX, radiusZ] of [
    [100, 60],
    [60, 100],
  ]) {
    const orbit = editOrbit(
      createScene().planets[0].orbit,
      { radiusX, radiusZ, rotation: 40, anchor: "sun" },
      sun,
    );
    const center = orbitCenter(orbit, sun),
      other = center.map((v, i) => 2 * v - sun[i]);
    for (let phase = 0; phase < 360; phase += 15) {
      const point = orbitPosition({ ...orbit, phase }, 0, sun);
      const distance = (target) =>
        Math.hypot(...point.map((v, i) => v - target[i]));
      assert.ok(Math.abs(distance(sun) + distance(other) - 200) < 1e-8);
    }
    const moved = orbitPosition(orbit, 7, [40, 10, 80]);
    near(
      moved,
      orbitPosition(orbit, 7, sun).map((v, i) => v + [10, 20, 30][i]),
    );
    const fixed = editOrbit(orbit, { anchor: "center" }, sun);
    for (let phase = 0; phase < 360; phase += 30)
      near(
        orbitPosition({ ...orbit, phase }, 0, sun),
        orbitPosition({ ...fixed, phase }, 0),
      );
  }
});

test("rings vary from a single narrow band to one bounded intricate system", () => {
  const p = createScene().planets[1];
  p.proceduralMoons = true;
  delete p.rings;
  p.ringCount = 1;
  const full = planetRing(p),
    original = createRingProfile(p.seeds.rings, p.families.gas.color);
  assert.ok(
    Math.abs(full.outer - full.inner - (original.outer - original.inner)) <
      1e-10,
  );
  p.ringCount = 4;
  assert.deepEqual(
    planetRing(p),
    full,
    "legacy stacked belts cannot exceed one full system",
  );
  p.rings = { ...ringSettings(p), amount: 0.1 };
  const sparse = planetRing(p);
  assert.ok(sparse.outer - sparse.inner < (full.outer - full.inner) * 0.2);
  const sparsePixels = ringPixels(sparse, sparse.complexity),
    fullPixels = ringPixels(full, full.complexity);
  assert.ok(
    Array.from({ length: 470 }, (_, i) => sparsePixels[(i + 15) * 4]).every(
      (v) => v > 0,
    ),
    "sparse band has no internal Saturn-like gaps",
  );
  assert.ok(
    Array.from({ length: 470 }, (_, i) => fullPixels[(i + 15) * 4]).some(
      (v) => v === 0,
    ),
  );
  p.rings.amount = 0;
  assert.equal(planetRing(p), undefined);
});

test("moon recipes are deterministic, independent and constrained by rings", () => {
  const p = createScene().planets[1];
  p.proceduralMoons = true;
  p.moonCount = 8;
  p.moons = {
    ...structuredClone(defaultMoons),
    radius: [4, 6],
    speed: [-8, -2],
    size: [0.1, 0.18],
  };
  const original = moonProfiles(p);
  assert.deepEqual(original, moonProfiles(p));
  for (const moon of original) {
    assert.ok(moon.distance >= 4 && moon.distance <= 6);
    assert.ok(moon.speed >= -8 && moon.speed <= -2);
    assert.ok(moon.size >= 0.1 && moon.size <= 0.18);
    assert.ok(p.moons.colors.includes(moon.color));
    assert.ok(
      Math.abs(Math.hypot(...moonPosition(moon, 500)) - moon.distance) < 1e-10,
    );
  }
  p.moons.colors = ["#5479be"];
  const recolored = moonProfiles(p);
  for (let i = 0; i < 8; i++) {
    const { color, accent, ...before } = original[i];
    const { color: afterColor, accent: afterAccent, ...after } = recolored[i];
    assert.ok(color && accent && afterAccent);
    assert.equal(afterColor, "#5479be");
    assert.deepEqual(after, before);
  }
  p.moonCount = 10;
  assert.deepEqual(moonProfiles(p).slice(0, 8), recolored);
  const rolled = rerollPlanet(p, 8391, "moons");
  assert.notDeepEqual(moonProfiles(rolled), moonProfiles(p));
  assert.deepEqual(rolled.rings, p.rings);
  assert.deepEqual(rolled.orbit, p.orbit);
  assert.deepEqual(rolled.families, p.families);
  p.moons.radius = [1.2, 1.2];
  for (const m of moonProfiles(p))
    assert.ok(m.distance >= planetRing(p).outer + m.size);
});

test("new geometry and satellite settings survive JSON and reject malformed palettes or ranges", () => {
  const scene = createScene(),
    p = scene.planets[0];
  p.moons = structuredClone(defaultMoons);
  p.orbit = editOrbit(
    p.orbit,
    { radiusX: 42.123, radiusZ: 67.321, rotation: -60, anchor: "sun" },
    scene.sun.position,
  );
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  p.moons.colors = [];
  assert.throws(() => serializeScene(scene));
  p.moons.colors = ["#789abc"];
  p.moons.speed = [3, -3];
  assert.throws(() => serializeScene(scene));
});
