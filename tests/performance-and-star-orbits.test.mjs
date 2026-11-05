import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  FramePerformanceMonitor,
  accelerationWarning,
} from "../src/react-app/scene/rendering/performance.ts";
import { updateStar } from "../src/react-app/scene/model/starOrbits.ts";
import { orbitPosition } from "../src/react-app/scene/model/geometry.ts";
import {
  parsePreset,
  serializeScene,
} from "../src/react-app/scene/model/schema.ts";
import {
  applyStarPreset,
  starPresets,
} from "../src/react-app/data/starPresets.ts";

const solar = parsePreset(
  await readFile(
    new URL("../public/presets/solar-system.json", import.meta.url),
    "utf8",
  ),
).scene;

function frames(monitor, start, duration, fps) {
  let warnings = 0;
  for (let i = 0; i <= duration * fps; i++)
    if (monitor.sample(start + (i * 1000) / fps)) warnings++;
  return warnings;
}

test("sustained slow frames warn once, with startup grace independent of simulation time", () => {
  const monitor = new FramePerformanceMonitor(0);
  assert.equal(frames(monitor, 0, 7, 10), 0);
  assert.equal(frames(monitor, 8000, 8, 20), 1);
  assert.equal(frames(monitor, 17000, 10, 10), 0);
});

test("normal frame rates and one transient stall do not warn", () => {
  for (const fps of [24, 30, 60, 144])
    assert.equal(frames(new FramePerformanceMonitor(0), 8000, 10, fps), 0);
  const monitor = new FramePerformanceMonitor(0);
  frames(monitor, 8000, 2, 10);
  assert.equal(frames(monitor, 10000, 10, 60), 0);
});

test("background/loading suspension clears windows and allows foreground grace", () => {
  const monitor = new FramePerformanceMonitor(0);
  assert.equal(frames(monitor, 8000, 4, 20), 0);
  monitor.suspend(60000);
  assert.equal(frames(monitor, 60000, 1, 10), 0);
  assert.equal(frames(monitor, 62000, 4, 20), 0);
  assert.equal(frames(monitor, 66050, 3, 20), 1);
});

test("acceleration hints tolerate withheld information and never equate a caveat with software", () => {
  const gl = (renderer) => ({
    getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 42 }),
    getParameter: () => renderer,
  });
  for (const renderer of [
    "ANGLE (SwiftShader Device)",
    "llvmpipe LLVM",
    "Microsoft Basic Render Driver",
  ])
    assert.equal(accelerationWarning(gl(renderer), false), "software");
  assert.equal(accelerationWarning(gl("ANGLE NVIDIA RTX"), false), null);
  assert.equal(accelerationWarning({ getExtension: () => null }, false), null);
  assert.equal(
    accelerationWarning(
      {
        getExtension() {
          throw new Error("private");
        },
      },
      true,
    ),
    "caveat",
  );
});

test("orbit coupling defaults off and its toggle preserves the current scene", () => {
  const resized = updateStar(solar, {
    ...solar.sun,
    diameter: solar.sun.diameter * 2,
  });
  assert.equal(resized.planets, solar.planets);
  assert.equal(resized.asteroidBelt, solar.asteroidBelt);
  const enabled = updateStar(solar, {
    ...solar.sun,
    scaleOrbitsWithSize: true,
  });
  assert.equal(enabled.planets, solar.planets);
  assert.equal(
    parsePreset(serializeScene(enabled)).scene.sun.scaleOrbitsWithSize,
    true,
  );
});

test("physical star resizing scales full translated and focus-anchored ellipses, including hidden/locked bodies", () => {
  const scene = structuredClone(solar);
  scene.sun.scaleOrbitsWithSize = true;
  scene.sun.position = [3, -4, 5];
  scene.planets[0].orbit.center = [10, 2, -5];
  scene.planets[0].locked = true;
  scene.planets[0].visible = false;
  scene.planets[1].orbit.ellipse.anchor = "sun";
  const baseline = structuredClone(scene);
  const grown = updateStar(scene, {
    ...scene.sun,
    diameter: scene.sun.diameter * 2,
  });
  for (let i = 0; i < scene.planets.length; i++) {
    const before = scene.planets[i],
      after = grown.planets[i];
    assert.equal(after.orbit.ellipse.radiusX, before.orbit.ellipse.radiusX * 2);
    assert.equal(after.orbit.ellipse.radiusZ, before.orbit.ellipse.radiusZ * 2);
    assert.equal(after.orbit.periodDays, before.orbit.periodDays);
    assert.equal(after.notableMoons, before.notableMoons);
    assert.equal(after.moons, before.moons);
    assert.equal(after.moonSystem, before.moonSystem);
    assert.equal(after.diameter, before.diameter);
    for (const days of [0, 100]) {
      const oldPosition = orbitPosition(before.orbit, days, scene.sun.position);
      const newPosition = orbitPosition(after.orbit, days, scene.sun.position);
      newPosition.forEach((value, axis) =>
        assert.ok(
          Math.abs(
            value -
              (scene.sun.position[axis] +
                (oldPosition[axis] - scene.sun.position[axis]) * 2),
          ) < 1e-8,
        ),
      );
    }
  }
  assert.deepEqual(
    grown.asteroidBelt.distance,
    scene.asteroidBelt.distance.map((v) => v * 2),
  );
  assert.deepEqual(grown.layout, scene.layout);
  assert.deepEqual(grown.sizing, scene.sizing);
  assert.deepEqual(grown.timeline, scene.timeline);
  assert.deepEqual(scene, baseline);
  assert.deepEqual(parsePreset(serializeScene(grown)).scene, grown);
  const shrunk = updateStar(grown, {
    ...grown.sun,
    diameter: scene.sun.diameter,
  });
  shrunk.planets.forEach((planet, i) =>
    assert.deepEqual(planet.orbit, scene.planets[i].orbit),
  );
});

test("star presets honor coupling; display scaling does not resize physical orbits", () => {
  const scene = { ...solar, sun: { ...solar.sun, scaleOrbitsWithSize: true } };
  const preset = starPresets.find((p) => p.id === "red-giant");
  const giant = updateStar(scene, applyStarPreset(scene.sun, preset));
  const ratio = preset.appearance.diameter / scene.sun.diameter;
  assert.equal(
    giant.planets[0].orbit.ellipse.radiusX,
    scene.planets[0].orbit.ellipse.radiusX * ratio,
  );
  const displayOnly = updateStar(
    { ...scene, sizing: { ...scene.sizing, starScale: 0.1 } },
    scene.sun,
  );
  assert.equal(displayOnly.planets, scene.planets);
  const colorsOnly = updateStar(scene, { ...scene.sun, color: "#ffffff" });
  assert.equal(colorsOnly.planets, scene.planets);
});

test("unsupported scaling fails before changing any source data", () => {
  const scene = { ...solar, sun: { ...solar.sun, scaleOrbitsWithSize: true } };
  const before = structuredClone(scene);
  assert.throws(
    () => updateStar(scene, { ...scene.sun, diameter: 1e9 }),
    /supported range/,
  );
  assert.deepEqual(scene, before);
});
