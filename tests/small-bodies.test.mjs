import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
import {
  asteroidBeltDays,
  asteroidDistanceMapper,
  asteroidProfiles,
  asteroidPosition,
  asteroidBeltBounds,
} from "../src/react-app/scene/model/asteroidBelt.ts";
import { orbitPosition } from "../src/react-app/scene/model/geometry.ts";
import { notableMoonPosition } from "../src/react-app/scene/model/notableMoons.ts";
import {
  moonPosition,
  smallBodyAppearance,
} from "../src/react-app/scene/model/systems.ts";
import {
  orbitLayoutFactors,
  sceneFitSamples,
} from "../src/react-app/scene/model/layout.ts";
import { createScene } from "../src/react-app/scene/model/scene.ts";

const load = async (id) =>
  parsePreset(
    await readFile(
      new URL(`../public/presets/${id}.json`, import.meta.url),
      "utf8",
    ),
  ).scene;
const momentum = (a, b) =>
  new THREE.Vector3(...a).cross(
    new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),
  );
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("forward planet and procedural moon orbits agree with positive-Y surface rotation", () => {
  const orbit = {
    ...createScene().planets[0].orbit,
    phase: 0,
    inclination: 0,
    orientation: 0,
  };
  assert.ok(momentum(orbitPosition(orbit, 0), orbitPosition(orbit, 1)).y > 0);
  const backwards = { ...orbit, reverse: true };
  assert.ok(
    momentum(orbitPosition(backwards, 0), orbitPosition(backwards, 1)).y < 0,
  );
  const moon = {
    distance: 3,
    phase: 0,
    speed: 10,
    inclination: 0,
    orientation: 0,
  };
  assert.ok(momentum(moonPosition(moon, 0), moonPosition(moon, 0.1)).y > 0);
  assert.deepEqual(smallBodyAppearance("same", ["#abcdef"]), {
    color: "#abcdef",
    accent: "#4d5c6c",
  });
});

test("regular solar moons orbit prograde relative to the parent spin, with Triton retrograde", async () => {
  const scene = await load("solar-system");
  for (const planet of scene.planets)
    for (const moon of planet.notableMoons) {
      const plane = new THREE.Euler(
        (-moon.orbit.inclination * Math.PI) / 180,
        (-moon.orbit.orientation * Math.PI) / 180,
        0,
        "YXZ",
      );
      const a = new THREE.Vector3(
        ...notableMoonPosition(moon, 0, 1),
      ).applyEuler(plane);
      const b = new THREE.Vector3(
        ...notableMoonPosition(moon, moon.orbit.periodDays / 10000, 1),
      ).applyEuler(plane);
      const normal = a.clone().cross(b.sub(a));
      assert.equal(
        normal.y > 0,
        moon.name !== "Triton",
        `${planet.name}: ${moon.name}`,
      );
    }
});

test("seeded belt orbits stay within their physical and compressed annulus and scale with the scene", async () => {
  const scene = await load("solar-system"),
    belt = scene.asteroidBelt;
  assert.equal(belt.visible, true);
  assert.equal((await load("portfolio")).asteroidBelt.visible, false);
  const bodies = asteroidProfiles(belt);
  assert.equal(bodies.length, belt.count);
  assert.deepEqual(asteroidProfiles(belt), bodies);
  assert.deepEqual(
    asteroidProfiles({ ...belt, count: 20 }),
    bodies.slice(0, 20),
  );
  const factors = orbitLayoutFactors(scene),
    map = asteroidDistanceMapper(scene, factors);
  const bounds = asteroidBeltBounds(scene, factors);
  for (const p of bodies) {
    assert.ok(p.major * (1 - p.eccentricity) >= belt.distance[0] - 1e-7);
    assert.ok(p.major * (1 + p.eccentricity) <= belt.distance[1] + 1e-7);
    for (const days of [0, 100, 10000]) {
      const point = asteroidPosition(p, days, map),
        distance = Math.hypot(...point);
      assert.ok(point.every(Number.isFinite));
      assert.ok(
        distance >= map(belt.distance[0]) - 1e-7 &&
          distance <= bounds.radius + 1e-7,
      );
      assert.ok(Math.abs(point[1]) <= bounds.height + 1e-7);
    }
  }
  const mars = scene.planets.find((p) => p.id === "mars"),
    jupiter = scene.planets.find((p) => p.id === "jupiter");
  assert.ok(
    map(belt.distance[0]) > mars.orbit.ellipse.radiusX * factors.get(mars.id),
  );
  assert.ok(
    map(belt.distance[1]) <
      jupiter.orbit.ellipse.radiusX * factors.get(jupiter.id),
  );
  const scaled = {
    ...scene,
    layout: { ...scene.layout, orbitScale: scene.layout.orbitScale * 2 },
  };
  near(
    asteroidDistanceMapper(scaled, orbitLayoutFactors(scaled))(400),
    map(400) * 2,
  );
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  assert.ok(
    sceneFitSamples(scene).length >
      sceneFitSamples({ ...scene, asteroidBelt: { ...belt, visible: false } })
        .length,
  );
});

test("pausing or reversing a belt can preserve accumulated physical days", () => {
  const belt = createScene().asteroidBelt;
  const now = 1234,
    offsetDays = asteroidBeltDays(belt, now);
  const paused = { ...belt, playing: false, epochDays: now, offsetDays };
  near(asteroidBeltDays(paused, now + 100), offsetDays);
  const reverse = { ...belt, reverse: true, epochDays: now, offsetDays };
  near(asteroidBeltDays(reverse, now), offsetDays);
  near(asteroidBeltDays(reverse, now + 100), offsetDays - 100);
});
