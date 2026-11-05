import assert from "node:assert/strict";
import { test } from "node:test";
import { CanvasGestures } from "../src/react-app/scene/rendering/gestures.ts";
import {
  initialMobilePanel,
  mobilePanelReducer,
  nearestSheetExtent,
} from "../src/react-app/hooks/mobilePanels.ts";

const point = (id, x, y, touch = true, button = 0) => ({
  id,
  x,
  y,
  touch,
  button,
});
function harness() {
  const events = [];
  const gestures = new CanvasGestures(
    Object.fromEntries(
      ["pan", "rotate", "zoom", "select"].map((name) => [
        name,
        (...values) => events.push([name, ...values]),
      ]),
    ),
  );
  return { gestures, events };
}

test("a touch tap selects once and small touch jitter does not pan", () => {
  const { gestures, events } = harness();
  gestures.down(point(1, 50, 50));
  gestures.move(point(1, 53, 51));
  gestures.up(point(1, 53, 51));
  assert.deepEqual(events, [["select", 53, 51]]);
});
test("touch dragging pans without selecting and release uses the original drag threshold", () => {
  const { gestures, events } = harness();
  gestures.down(point(1, 50, 50));
  gestures.move(point(1, 70, 60));
  gestures.move(point(1, 80, 70));
  gestures.up(point(1, 80, 70));
  assert.deepEqual(events, [
    ["pan", 20, 10],
    ["pan", 10, 10],
  ]);
  gestures.down(point(2, 50, 50));
  gestures.up(point(2, 70, 60));
  assert.equal(events.length, 2);
});
test("pinches change zoom by distance ratio without panning or selecting", () => {
  const { gestures, events } = harness();
  gestures.down(point(1, 50, 50));
  gestures.down(point(2, 150, 50));
  gestures.move(point(2, 200, 50));
  gestures.move(point(2, 150, 50));
  gestures.up(point(2, 150, 50));
  gestures.up(point(1, 50, 50));
  assert.deepEqual(events, [
    ["zoom", 1.5],
    ["zoom", 2 / 3],
  ]);
});
test("the remaining finger can pan after a pinch and cannot become an accidental tap", () => {
  const { gestures, events } = harness();
  gestures.down(point(1, 10, 10));
  gestures.down(point(2, 110, 10));
  gestures.up(point(2, 110, 10));
  gestures.move(point(1, 20, 20));
  gestures.up(point(1, 20, 20));
  assert.deepEqual(events, [["pan", 10, 10]]);
});
test("cancelling contacts, close pinches and a third finger do not emit invalid zooms or taps", () => {
  const { gestures, events } = harness();
  gestures.down(point(1, 0, 0));
  gestures.down(point(2, 1, 0));
  gestures.move(point(2, 2, 0));
  gestures.down(point(3, 200, 0));
  gestures.move(point(3, 220, 0));
  gestures.cancel(3);
  gestures.cancel(2);
  gestures.up(point(1, 0, 0));
  assert.deepEqual(events, []);
  gestures.down(point(4, 20, 20));
  gestures.clear();
  gestures.up(point(4, 20, 20));
  assert.deepEqual(events, []);
});
test("desktop mouse pan, rotate and click semantics remain separate from touch", () => {
  const { gestures, events } = harness();
  assert.equal(gestures.down(point(1, 0, 0, false, 1)), false);
  gestures.down(point(1, 0, 0, false, 2));
  assert.equal(gestures.down(point(2, 0, 0)), false);
  gestures.move(point(1, 20, 10, false, 2));
  gestures.up(point(1, 20, 10, false, 2));
  gestures.down(point(1, 0, 0, false));
  gestures.move(point(1, 10, 5, false));
  gestures.up(point(1, 10, 5, false));
  gestures.down(point(1, 0, 0, false));
  gestures.up(point(1, 0, 0, false));
  assert.deepEqual(events, [
    ["rotate", 20, 10],
    ["pan", 10, 5],
    ["select", 0, 0],
  ]);
});
test("mobile panels are exclusive and switching tools resets their extent without scene state", () => {
  let state = mobilePanelReducer(initialMobilePanel, {
    type: "show",
    panel: "objects",
  });
  state = mobilePanelReducer(state, { type: "resize", extent: "full" });
  assert.equal(
    mobilePanelReducer(state, { type: "show", panel: "objects" }),
    state,
  );
  state = mobilePanelReducer(state, { type: "show", panel: "inspector" });
  assert.deepEqual(state, { panel: "inspector", extent: "half" });
  state = mobilePanelReducer(state, { type: "toggle", panel: "inspector" });
  assert.equal(state.panel, null);
  assert.deepEqual(initialMobilePanel, { panel: null, extent: "half" });
});
test("sheet resizing snaps to readable collapsed, partial and full heights", () => {
  assert.equal(nearestSheetExtent(70, 700), "peek");
  assert.equal(nearestSheetExtent(450, 700), "half");
  assert.equal(nearestSheetExtent(680, 700), "full");
  assert.equal(nearestSheetExtent(175, 180), "half");
});
