export type ScenePointer = {
  id: number;
  x: number;
  y: number;
  touch: boolean;
  button: number;
};
type Point = ScenePointer & {
  originX: number;
  originY: number;
  moved: boolean;
};
type Callbacks = {
  pan(dx: number, dy: number): void;
  rotate(dx: number, dy: number): void;
  zoom(factor: number): void;
  select(x: number, y: number): void;
};

/** Pointer capture is owned by the canvas; gesture state is independent of DOM and clocks. */
export class CanvasGestures {
  private points = new Map<number, Point>();
  private callbacks: Callbacks;
  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks;
  }

  down(pointer: ScenePointer): boolean {
    if (
      (!pointer.touch && pointer.button !== 0 && pointer.button !== 2) ||
      this.points.has(pointer.id)
    )
      return false;
    if (
      this.points.size &&
      (!pointer.touch || [...this.points.values()].some((p) => !p.touch))
    )
      return false;
    this.points.set(pointer.id, {
      ...pointer,
      originX: pointer.x,
      originY: pointer.y,
      moved: false,
    });
    if (this.points.size > 1)
      for (const point of this.points.values()) point.moved = true;
    return true;
  }

  move(pointer: ScenePointer) {
    const point = this.points.get(pointer.id);
    if (!point) return;
    if (this.points.size === 2) {
      const other = [...this.points.values()].find((p) => p.id !== point.id)!;
      const before = Math.hypot(point.x - other.x, point.y - other.y);
      const after = Math.hypot(pointer.x - other.x, pointer.y - other.y);
      point.x = pointer.x;
      point.y = pointer.y;
      if (before > 8 && after > 8) this.callbacks.zoom(after / before);
      return;
    }
    if (this.points.size > 2) {
      point.x = pointer.x;
      point.y = pointer.y;
      return;
    }
    if (
      !point.moved &&
      Math.hypot(pointer.x - point.originX, pointer.y - point.originY) <
        (point.touch ? 7 : 4)
    )
      return;
    const dx = pointer.x - point.x,
      dy = pointer.y - point.y;
    point.x = pointer.x;
    point.y = pointer.y;
    point.moved = true;
    if (!point.touch && point.button === 2) this.callbacks.rotate(dx, dy);
    else this.callbacks.pan(dx, dy);
  }

  up(pointer: ScenePointer) {
    const point = this.points.get(pointer.id);
    if (!point) return;
    this.points.delete(pointer.id);
    const distance = Math.hypot(
      pointer.x - point.originX,
      pointer.y - point.originY,
    );
    if (!point.moved && point.button !== 2 && distance < (point.touch ? 7 : 4))
      this.callbacks.select(pointer.x, pointer.y);
    for (const remaining of this.points.values()) remaining.moved = true;
  }
  cancel(id: number) {
    this.points.delete(id);
    for (const point of this.points.values()) point.moved = true;
  }
  clear() {
    this.points.clear();
  }
}
