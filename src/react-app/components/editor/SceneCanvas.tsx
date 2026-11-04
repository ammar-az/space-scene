import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { SceneRenderer } from "../../scene/rendering/SceneRenderer.ts";
import type { SceneModel } from "../../scene/model/schema.ts";
import type { SceneClock } from "../../scene/rendering/clock.ts";

type Props = {
  runtime: RefObject<(() => SceneModel["timeline"]) | null>;
  scene: SceneModel;
  selected: string | null;
  sunSelected: boolean;
  selectedMoon: string | null;
  clock: SceneClock;
  active: boolean;
  onSelect(id: string | null): void;
  onSelectSun(): void;
  onSelectMoon(parentId: string, moonId: string): void;
  onPan(dx: number, dy: number): void;
  onRotate(dx: number, dy: number): void;
  onZoom(factor: number): void;
  onError(message: string): void;
};
export default function SceneCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SceneRenderer | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!ref.current) return;
    try {
      const current = latest.current;
      const instance = new SceneRenderer(
        ref.current,
        current.scene,
        current.clock,
        {
          select: (id) => latest.current.onSelect(id),
          selectSun: () => latest.current.onSelectSun(),
          selectMoon: (parentId, moonId) =>
            latest.current.onSelectMoon(parentId, moonId),
          pan: (dx, dy) => latest.current.onPan(dx, dy),
          rotate: (dx, dy) => latest.current.onRotate(dx, dy),
          zoom: (factor) => latest.current.onZoom(factor),
          error: (message) => latest.current.onError(message),
        },
      );
      renderer.current = instance;
      current.runtime.current = () => instance.snapshotTimeline();
      instance.setModel(
        current.scene,
        current.selected,
        current.sunSelected,
        current.selectedMoon,
      );
      return () => {
        current.runtime.current = null;
        renderer.current = null;
        instance.dispose();
      };
    } catch (error) {
      latest.current.onError(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
    }
  }, []);
  useEffect(() => {
    renderer.current?.setModel(
      props.scene,
      props.selected,
      props.sunSelected,
      props.selectedMoon,
    );
    renderer.current?.setActive(props.active);
  }, [
    props.scene,
    props.selected,
    props.sunSelected,
    props.selectedMoon,
    props.active,
  ]);
  return (
    <canvas
      ref={ref}
      className="scene-canvas"
      aria-label="Interactive space scene. Click a planet, named moon or the Sun to select; left drag to pan; right drag to rotate; scroll to zoom."
      data-testid="scene-canvas"
    />
  );
}
