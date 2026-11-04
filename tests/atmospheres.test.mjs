import {
  orbitLayoutFactors,
  scaleOrbitPoint,
} from "../src/react-app/scene/model/layout.ts";
import { rotationPhase } from "../src/react-app/scene/model/time.ts";
import { planetRenderRadius } from "../src/react-app/scene/model/sizes.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as THREE from "three";
import {
  createScene,
  rerollPlanet,
  instantiatePlanet,
} from "../src/react-app/scene/model/scene.ts";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
import {
  environmentSettings,
  defaultAtmosphere,
  defaultClouds,
  cloudSeedOffset,
  cloudRotation,
} from "../src/react-app/scene/model/atmospheres.ts";
import { createPlanetEnvironment } from "../src/react-app/scene/rendering/atmospheres.ts";
import {
  orbitPosition,
  orbitCenter,
  orbitEllipse,
} from "../src/react-app/scene/model/geometry.ts";
const solar = async () =>
  parsePreset(
    await readFile(
      new URL("../public/presets/solar-system.json", import.meta.url),
      "utf8",
    ),
  ).scene;

test("solar orbital envelopes and projected paths stay separate for every neighboring planet", async () => {
  const scene = await solar(),
    factors = orbitLayoutFactors(scene);
  let previous;
  for (const p of scene.planets.filter((p) => p.id !== "pluto")) {
    let min = Infinity,
      max = 0;
    for (let phase = 0; phase < 360; phase += 0.5) {
      const point = orbitPosition({ ...p.orbit, phase }, 0, scene.sun.position);
      const radius = Math.hypot(
        ...scaleOrbitPoint(point, scene.sun.position, factors.get(p.id)),
      );
      min = Math.min(min, radius);
      max = Math.max(max, radius);
    }
    const environment = environmentSettings(p),
      body =
        planetRenderRadius(scene, p) *
        (environment.hasAtmosphere
          ? environment.atmosphereScale
          : environment.hasClouds
            ? environment.cloudScale
            : 1);
    if (previous) {
      assert.ok(
        min - body > previous.max + previous.body,
        `${previous.planet.name}/${p.name} envelopes must not overlap`,
      );
      for (const [upY, upZ] of [
        [0, -1],
        [360 / Math.hypot(110, 360), -110 / Math.hypot(110, 360)],
      ]) {
        const outer = orbitEllipse(p.orbit),
          factor = factors.get(p.id),
          center = scaleOrbitPoint(
            orbitCenter(p.orbit, scene.sun.position),
            scene.sun.position,
            factor,
          ),
          tilt = (p.orbit.inclination * Math.PI) / 180;
        const minor =
          outer.radiusZ *
          factor *
          Math.abs(upY * Math.sin(tilt) + upZ * Math.cos(tilt));
        for (let phase = 0; phase < 360; phase += 0.5) {
          const point = orbitPosition(
            { ...previous.planet.orbit, phase },
            0,
            scene.sun.position,
          );
          const projected = scaleOrbitPoint(
            point,
            scene.sun.position,
            factors.get(previous.planet.id),
          );
          const q =
            ((projected[0] - center[0]) / (outer.radiusX * factor)) ** 2 +
            (((projected[1] - center[1]) * upY +
              (projected[2] - center[2]) * upZ) /
              minor) **
              2;
          assert.ok(
            q < 1,
            `${previous.planet.name}/${p.name} projected paths cross`,
          );
        }
      }
    }
    previous = { planet: p, min, max, body };
  }
});

test("Venus is overcast and Earth has partial clouds and a blue atmosphere, with no extra gas shell", async () => {
  const scene = await solar(),
    venus = scene.planets[1],
    earth = scene.planets[2];
  assert.equal(venus.clouds.visible, true);
  assert.equal(venus.clouds.coverage, 1);
  assert.equal(venus.clouds.opacity, 1);
  assert.ok(earth.clouds.coverage > 0 && earth.clouds.coverage < 1);
  assert.equal(earth.atmosphere.color, "#75b5ff");
  assert.ok(
    environmentSettings(venus).hasClouds &&
      environmentSettings(earth).hasAtmosphere,
  );
  const gas = { ...earth, type: "gas" };
  assert.equal(environmentSettings(gas).hasClouds, false);
  assert.equal(environmentSettings(gas).hasAtmosphere, false);
  const old = createScene().planets[0];
  assert.equal(environmentSettings(old).hasClouds, false);
  assert.equal(environmentSettings(old).hasAtmosphere, false);
  const high = {
    ...earth,
    atmosphere: { ...earth.atmosphere, height: 0.005 },
    clouds: { ...earth.clouds, altitude: 0.08 },
  };
  assert.ok(
    environmentSettings(high).atmosphereScale >
      environmentSettings(high).cloudScale,
  );
});

test("cloud patterns have independent seeds, locked rerolls and stable snapshot/identity behavior", () => {
  const scene = createScene(),
    p = scene.planets[0];
  p.clouds = { ...defaultClouds, visible: true };
  p.atmosphere = { ...defaultAtmosphere, visible: true };
  p.seeds.clouds = "cloud-layer";
  const initial = structuredClone(p),
    clouds = rerollPlanet(p, 81, "clouds");
  assert.notEqual(clouds.seeds.clouds, p.seeds.clouds);
  assert.equal(clouds.seeds.surface, p.seeds.surface);
  assert.equal(clouds.seeds.moons, p.seeds.moons);
  assert.equal(clouds.seeds.rings, p.seeds.rings);
  assert.deepEqual(clouds.clouds, p.clouds);
  assert.deepEqual(clouds.atmosphere, p.atmosphere);
  assert.notDeepEqual(cloudSeedOffset(clouds), cloudSeedOffset(p));
  assert.deepEqual(
    cloudSeedOffset(rerollPlanet(p, 81, "surface")),
    cloudSeedOffset(p),
  );
  assert.deepEqual(
    cloudSeedOffset(rerollPlanet(p, 81, "moons")),
    cloudSeedOffset(p),
  );
  p.locked = true;
  assert.deepEqual(rerollPlanet(p, 1, "clouds"), p);
  p.locked = false;
  assert.deepEqual(instantiatePlanet(p, "copy").clouds, p.clouds);
  assert.deepEqual(
    cloudSeedOffset(instantiatePlanet(p, "copy")),
    cloudSeedOffset(p),
  );
  delete p.seeds.clouds;
  assert.deepEqual(
    cloudSeedOffset(rerollPlanet(p, 7, "surface")),
    cloudSeedOffset(p),
    "implicit cloud defaults also remain independent",
  );
  assert.deepEqual(
    cloudSeedOffset(instantiatePlanet(p, "new-id")),
    cloudSeedOffset(p),
  );
  scene.planets[0] = initial;
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  initial.clouds.coverage = 2;
  assert.throws(() => serializeScene(scene));
});

test("cloud drift follows the scene clock separately from surface rotation, and shells share lighting but own their materials", async () => {
  const p = (await solar()).planets[2],
    geometry = new THREE.SphereGeometry(1, 8, 6),
    surface = new THREE.ShaderMaterial({
      uniforms: {
        u_sun: { value: new THREE.Vector3(0, 0, 100) },
        u_fill: { value: 0.4 },
        u_terminatorStart: { value: -0.4 },
        u_shadowCount: { value: 0 },
        u_shadowCasters: { value: [] },
        u_shadowFades: { value: [] },
        u_shadowSun: { value: new THREE.Vector4(0, 0, 100, 70) },
      },
    });
  let geometryDisposed = 0,
    materialsDisposed = 0;
  geometry.addEventListener("dispose", () => geometryDisposed++);
  const environment = createPlanetEnvironment(geometry, p, surface);
  assert.ok(environment.clouds && environment.atmosphere);
  environment.clouds.material.addEventListener(
    "dispose",
    () => materialsDisposed++,
  );
  environment.atmosphere.material.addEventListener(
    "dispose",
    () => materialsDisposed++,
  );
  assert.equal(
    environment.clouds.material.uniforms.u_sun,
    surface.uniforms.u_sun,
  );
  const view = new THREE.Vector3(0, 0, 1);
  environment.update(10, 8, view, rotationPhase(p.spin, 10));
  const angle = environment.clouds.rotation.y;
  environment.update(10, 8, view, rotationPhase(p.spin, 10));
  assert.equal(environment.clouds.rotation.y, angle);
  assert.equal(angle, cloudRotation(p, 10, rotationPhase(p.spin, 10)));
  assert.ok(Math.abs(angle - (rotationPhase(p.spin, 10) * Math.PI) / 180) > 0);
  assert.ok(environment.atmosphere.scale.x > environment.clouds.scale.x);
  assert.equal(
    environment.clouds.material.uniforms.u_shadowRadius.value,
    8 * environment.clouds.scale.x,
  );
  const newSpin = { ...p.spin, phase: 90, periodHours: 40 };
  environment.update(10, 8, view, rotationPhase(newSpin, 10));
  assert.equal(
    environment.clouds.rotation.y,
    cloudRotation(p, 10, rotationPhase(newSpin, 10)),
    "live spin edits must update clouds without rebuilding the layer",
  );
  environment.dispose();
  assert.equal(materialsDisposed, 2);
  assert.equal(geometryDisposed, 0);
  geometry.dispose();
  surface.dispose();
});
