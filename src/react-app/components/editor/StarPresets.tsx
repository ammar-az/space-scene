import type { CSSProperties } from "react";
import { matchingStarPreset, starPresets } from "../../data/starPresets.ts";
import type { StarPreset } from "../../data/starPresets.ts";
import type { SceneModel } from "../../scene/model/schema.ts";
import { Icon } from "./controls.tsx";

export default function StarPresets({
  star,
  onApply,
  onFrame,
}: {
  star: SceneModel["sun"];
  onApply(preset: StarPreset): void;
  onFrame(): void;
}) {
  const current = matchingStarPreset(star);
  return (
    <div className="star-presets">
      <label className="star-preset-control">
        <span className="field-heading">STAR PRESET</span>
        <select
          aria-label="Star preset"
          value={current?.id ?? "custom"}
          onChange={(event) => {
            const preset = starPresets.find((p) => p.id === event.target.value);
            if (preset) onApply(preset);
          }}
        >
          <option value="custom" disabled>
            Custom star
          </option>
          <optgroup label="Stellar starting points">
            {starPresets.slice(0, 3).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="More main-sequence colors">
            {starPresets.slice(3).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <div className="star-preset-preview">
        <span
          aria-hidden="true"
          className="star-preset-swatch"
          style={
            {
              "--star-color": star.color,
              "--star-highlight": star.highlight,
              "--star-shadow": star.shadow,
            } as CSSProperties
          }
        />
        <div>
          <strong>{current?.name ?? "Custom star"}</strong>
          <span>
            {(star.diameter * 10000).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}{" "}
            km diameter
          </span>
        </div>
      </div>
      <button
        className="button full"
        disabled={!star.visible}
        onClick={onFrame}
      >
        <Icon name="camera" size={15} />
        Frame star
      </button>
    </div>
  );
}
