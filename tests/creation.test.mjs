import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configurePlanet,
  configureSystem,
  newPlanetDraft,
  newSystemDraft,
} from "../src/react-app/scene/model/creation.ts";
import { createScene } from "../src/react-app/scene/model/scene.ts";
import {
  parsePreset,
  serializeScene,
  serializePlanet,
} from "../src/react-app/scene/model/schema.ts";

test("planet creation commits physical settings and parent-relative, tidally locked moons", () => {
  const draft = {
    ...newPlanetDraft(createScene()),
    name: "Test Earth",
    kind: "earthlike",
    moons: 3,
    rings: 0.2,
    atmosphere: true,
    clouds: true,
    diameterKm: 12760,
    radiusX: 220,
    radiusZ: 180,
    periodDays: 410,
    rotationHours: 30,
  };
  const planet = configurePlanet(draft, "new-planet", 12, 3, [10, 20, 30]);
  assert.equal(planet.diameter, 12.76);
  assert.equal(planet.earthlike.enabled, true);
  assert.equal(planet.clouds.visible, true);
  assert.deepEqual(planet.orbit.center, [10, 20, 30]);
  assert.equal(planet.orbit.ellipse.radiusZ, 180);
  assert.equal(planet.orbit.periodDays, 410);
  assert.equal(planet.spin.periodHours, 30);
  assert.equal(planet.rings.amount, 0.2);
  assert.equal(new Set(planet.notableMoons.map((m) => m.id)).size, 3);
  planet.notableMoons.forEach((moon) =>
    assert.equal(moon.spin.periodHours, moon.orbit.periodDays * 24),
  );
  assert.deepEqual(parsePreset(serializePlanet(planet)).planet, planet);
});

test("system creation respects family counts, settings and deterministic seeds", () => {
  const draft = {
    ...newSystemDraft(123),
    name: "Test system",
    moons: 2,
    ringChance: 1,
    asteroidBelt: true,
    starPreset: "white-dwarf",
    starDiameterKm: 12000,
    counts: { rocky: 2, earthlike: 1, gas: 1, icy: 1 },
  };
  const system = configureSystem(draft);
  assert.deepEqual(configureSystem(draft), system);
  assert.equal(system.planets.length, 5);
  assert.equal(system.planets.filter((p) => p.earthlike?.enabled).length, 1);
  assert.equal(system.sun.diameter, 1.2);
  assert.equal(system.asteroidBelt.visible, true);
  assert.equal(system.planets[0].orbit.ellipse.radiusX, draft.innerOrbit);
  assert.ok(
    Math.abs(system.planets.at(-1).orbit.ellipse.radiusX - draft.outerOrbit) <
      1e-8,
  );
  system.planets.forEach((p) => {
    assert.equal(p.notableMoons.length, 2);
    assert.ok(p.rings.amount > 0);
  });
  assert.deepEqual(parsePreset(serializeScene(system)).scene, system);
  assert.notDeepEqual(configureSystem({ ...draft, seed: 124 }), system);
});

test("new-planet defaults suggest an orbit outside existing planets without mutating the scene", () => {
  const scene = createScene(),
    before = structuredClone(scene);
  const draft = newPlanetDraft(scene);
  assert.ok(
    draft.radiusX >
      Math.max(...scene.planets.map((p) => p.orbit.ellipse.radiusX)),
  );
  assert.deepEqual(scene, before);
});

test("empty and single-planet systems and extreme allowed distance ranges remain valid", () => {
  const draft = newSystemDraft(42);
  assert.equal(
    configureSystem({
      ...draft,
      counts: { rocky: 0, earthlike: 0, gas: 0, icy: 0 },
    }).planets.length,
    0,
  );
  const one = configureSystem({
    ...draft,
    counts: { rocky: 1, earthlike: 0, gas: 0, icy: 0 },
    innerOrbit: 1e9,
    outerOrbit: 1e9,
    ringChance: 0,
  });
  assert.equal(one.planets[0].orbit.periodDays, 1e12);
  assert.equal(one.planets[0].rings.amount, 0);
  assert.doesNotThrow(() => parsePreset(serializeScene(one)));
});

test("invalid system counts and reversed distances are rejected", () => {
  const draft = newSystemDraft(1);
  assert.throws(
    () =>
      configureSystem({
        ...draft,
        counts: { rocky: 32, earthlike: 32, gas: 1, icy: 0 },
      }),
    /64 planets/,
  );
  assert.throws(
    () =>
      configureSystem({ ...draft, counts: { ...draft.counts, rocky: 1.5 } }),
    /whole numbers/,
  );
  assert.throws(
    () => configureSystem({ ...draft, outerOrbit: 1 }),
    /outer orbit/,
  );
});
