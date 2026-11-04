import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  createScene,
  rerollScene,
} from "../src/react-app/scene/model/scene.ts";
import {
  serializeScene,
  parsePreset,
} from "../src/react-app/scene/model/schema.ts";
import { viewFrame } from "../src/react-app/scene/model/geometry.ts";
import {
  viewAngles,
  setViewAngles,
  panView,
  rotateView,
  snapView,
  clampZoom,
  zoomBounds,
  followPlanetView,
  resolveFollowView,
  fitSceneView,
} from "../src/react-app/scene/model/camera.ts";
import { orbitPosition } from "../src/react-app/scene/model/geometry.ts";
import {
  orbitLayoutFactors,
  scaleOrbitPoint,
} from "../src/react-app/scene/model/layout.ts";
const near = (a, b, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function camera(view, aspect = 1.6) {
  const frame = viewFrame(view, aspect),
    c = new THREE.OrthographicCamera(
      -frame.width / 2,
      frame.width / 2,
      frame.height / 2,
      -frame.height / 2,
      0.1,
      12000,
    );
  c.position.set(...frame.position);
  c.up.set(...frame.up);
  c.lookAt(...frame.target);
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}
test("entering free camera preserves every existing preset projection without a jump", () => {
  const source = createScene().view;
  for (const preset of ["overhead", "centered", "offset"])
    for (const framing of ["portfolio", "standard"])
      for (const aspect of [1.1, 1.6, 2.4]) {
        const view = {
          ...source,
          preset,
          framing,
          zoom: 1.7,
          pan: [13, -7, 21],
        };
        const free = setViewAngles(view, aspect, viewAngles(view));
        assert.deepEqual(
          viewFrame(free, aspect).target,
          viewFrame(view, aspect).target,
        );
        near(viewFrame(free, aspect).height, viewFrame(view, aspect).height);
        for (const point of [
          [0, 0, 0],
          [160, 8, 72],
          [-45, -12, -31],
        ]) {
          const old = new THREE.Vector3(...point).project(camera(view, aspect)),
            next = new THREE.Vector3(...point).project(camera(free, aspect));
          near(old.x, next.x);
          near(old.y, next.y);
        }
      }
});
test("free angles cover both poles, below-plane views, and a full turn with an orthonormal screen plane", () => {
  const source = createScene().view;
  for (const azimuth of [-180, -90, 0, 67, 180])
    for (const elevation of [-90, -60, 0, 45, 90]) {
      const view = setViewAngles(source, 1.6, { azimuth, elevation }),
        frame = viewFrame(view, 1.6),
        c = camera(view);
      const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0),
        up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1),
        normal = c.getWorldDirection(new THREE.Vector3());
      for (const v of [
        ...frame.position,
        ...frame.up,
        ...right,
        ...up,
        ...normal,
      ])
        assert.ok(Number.isFinite(v));
      near(right.length(), 1);
      near(up.length(), 1);
      near(right.dot(up), 0);
      near(up.dot(normal), 0);
      const target = new THREE.Vector3(...frame.target).project(c);
      near(target.x, 0);
      near(target.y, 0);
    }
  const a = camera(
    setViewAngles(source, 1.6, { azimuth: -180, elevation: 28 }),
  );
  const b = camera(setViewAngles(source, 1.6, { azimuth: 180, elevation: 28 }));
  const p = new THREE.Vector3(30, 20, 70);
  near(p.clone().project(a).x, p.clone().project(b).x);
  near(p.clone().project(a).y, p.clone().project(b).y);
});
test("panning follows screen coordinates at arbitrary angles and custom zoom/resize keeps the target fixed", () => {
  for (const elevation of [-90, -35, 0, 40, 90]) {
    const view = setViewAngles(createScene().view, 1.6, {
      azimuth: 73,
      elevation,
    });
    const point = new THREE.Vector3(100, 3, 0),
      before = point.clone().project(camera(view)),
      moved = panView(view, 1.6, 50, -30, 1000),
      after = point.clone().project(camera(moved));
    near(((after.x - before.x) / 2) * 1600, 50);
    near((-(after.y - before.y) / 2) * 1000, -30);
    assert.deepEqual(
      viewFrame({ ...moved, zoom: 3 }, 2.4).target,
      viewFrame(moved, 1.6).target,
    );
    assert.deepEqual(
      viewFrame(rotateView(moved, 1.6, 150, -80), 1.6).target,
      viewFrame(moved, 1.6).target,
    );
  }
});
test("snap/reset and JSON preserve saved custom views without moving scene objects", () => {
  const scene = createScene(),
    objects = structuredClone(scene.planets);
  scene.view = panView(rotateView(scene.view, 1.6, 100, 30), 1.6, 10, 20, 1000);
  assert.deepEqual(parsePreset(serializeScene(scene)).scene, scene);
  assert.deepEqual(rerollScene(scene, 75).view, scene.view);
  for (const preset of ["overhead", "centered", "offset"]) {
    const view = snapView(scene.view, preset);
    assert.equal(view.camera, undefined);
    assert.equal(view.zoom, 1);
    assert.deepEqual(view.pan, [0, 0, 0]);
    assert.equal(view.preset, preset);
  }
  assert.deepEqual(scene.planets, objects);
  const wrapped = rotateView(
    setViewAngles(scene.view, 1.6, { azimuth: 179, elevation: 89 }),
    1.6,
    -100,
    100,
  );
  assert.ok(wrapped.camera.azimuth >= -180 && wrapped.camera.azimuth <= 180);
  assert.equal(wrapped.camera.elevation, 90);
  scene.view.camera.elevation = 91;
  assert.throws(() => serializeScene(scene));
  assert.equal(
    parsePreset(serializeScene(createScene())).scene.view.camera,
    undefined,
  );
});

test("every composed and fitted view reaches the same close-up scale", () => {
  const scene = createScene();
  const views = [
    ...["overhead", "centered", "offset"].map((preset) =>
      snapView(scene.view, preset),
    ),
    fitSceneView(scene, 1.6),
  ];
  for (const view of views) {
    const zoom = clampZoom(view, 1e12);
    assert.equal(zoom, zoomBounds(view).max);
    near(viewFrame({ ...view, zoom }, 1.6).height, 1);
    assert.ok(zoom > 4);
    assert.equal(clampZoom(view, 0), 0.01);
  }
});

test("follow tracks the rendered planet with editable framing and releases without a jump", () => {
  const scene = createScene();
  const planet = scene.planets[0];
  const before = structuredClone(scene.planets);
  const fixedHeight = viewFrame(scene.view, 1.6).height;
  scene.view = followPlanetView(scene, planet.id, 1.6);
  near(viewFrame(scene.view, 1.6).height, fixedHeight);
  assert.equal(scene.view.camera.followPlanetId, planet.id);
  assert.deepEqual(scene.view.camera.target, [0, 0, 0]);
  const factors = orbitLayoutFactors(scene);
  const position = (days) =>
    scaleOrbitPoint(
      orbitPosition(
        planet.orbit,
        days - scene.motion.orbitEpochDays,
        scene.sun.position,
      ),
      scene.sun.position,
      factors.get(planet.id),
    );
  for (const days of [0, 10, 1000]) {
    const frame = resolveFollowView(scene, days, factors);
    assert.deepEqual(frame.camera.target, position(days));
    const point = new THREE.Vector3(...position(days)).project(camera(frame));
    near(point.x, 0);
    near(point.y, 0);
  }
  scene.view = panView(rotateView(scene.view, 1.6, 20, 30), 1.6, 50, -30, 1000);
  const p1 = new THREE.Vector3(...position(10)).project(
    camera(resolveFollowView(scene, 10, factors)),
  );
  const p2 = new THREE.Vector3(...position(1000)).project(
    camera(resolveFollowView(scene, 1000, factors)),
  );
  near(p1.x, p2.x);
  near(p1.y, p2.y);
  assert.deepEqual(parsePreset(serializeScene(scene)).scene.view, scene.view);
  const released = resolveFollowView(scene, 1000, factors);
  assert.equal(released.camera.followPlanetId, undefined);
  assert.deepEqual(
    released.camera.target,
    scene.view.camera.target.map((v, i) => v + position(1000)[i]),
  );
  assert.equal(snapView(scene.view).camera, undefined);
  assert.equal(fitSceneView(scene, 1.6).camera.followPlanetId, undefined);
  assert.deepEqual(scene.planets, before);
});

test("orbital multipliers accept only whole numbers from one through one hundred", () => {
  for (const key of ["orbitRate", "moonRate"]) {
    for (const value of [1, 10, 100]) {
      const scene = createScene();
      scene.motion[key].multiplier = value;
      assert.equal(
        parsePreset(serializeScene(scene)).scene.motion[key].multiplier,
        value,
      );
    }
    for (const value of [0.1, 1.5, 101]) {
      const scene = createScene();
      scene.motion[key].multiplier = value;
      assert.throws(() => serializeScene(scene));
    }
  }
});
