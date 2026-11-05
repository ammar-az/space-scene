import type { SceneModel } from "../../scene/model/schema.ts";
import { viewAngles, zoomBounds } from "../../scene/model/camera.ts";
import { Slider } from "./controls.tsx";
export default function CameraControls({
  view,
  onAngle,
  onZoom,
  onClose,
  onFit,
  embedded = false,
}: {
  view: SceneModel["view"];
  onAngle(patch: Partial<ReturnType<typeof viewAngles>>): void;
  onZoom(zoom: number): void;
  onClose(): void;
  onFit(): void;
  embedded?: boolean;
}) {
  const angles = viewAngles(view);
  const zoom = zoomBounds(view);
  return (
    <section
      className={`camera-controls ${embedded ? "embedded" : ""}`}
      id="camera-controls"
      aria-label="Camera controls"
    >
      {!embedded && (
        <div className="camera-heading">
          <span>CAMERA</span>
          <button
            className="icon-button"
            aria-label="Close camera controls"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      )}
      <Slider
        label="Camera horizontal angle"
        value={angles.azimuth}
        min={-180}
        max={180}
        step={0.1}
        unit="°"
        precise
        onChange={(azimuth) => onAngle({ azimuth })}
      />
      <Slider
        label="Camera vertical angle"
        value={angles.elevation}
        min={-90}
        max={90}
        step={0.1}
        unit="°"
        precise
        onChange={(elevation) => onAngle({ elevation })}
      />
      <Slider
        label="Camera zoom"
        value={view.zoom}
        min={zoom.min}
        max={zoom.max}
        step={0.01}
        precise
        logarithmic
        onChange={onZoom}
      />
      <button className="button full camera-fit" onClick={onFit}>
        Fit scene
      </button>
    </section>
  );
}
