import { useEffect, useRef, useState } from "react";
import type {
  RockyTerrain,
  RockyTerrainRanges,
} from "../../scene/model/schema.ts";
import { RangeField, Slider, ColorInput } from "./controls.tsx";
import { defaultPlains } from "../../scene/model/rockySurfaces.ts";

const fields = [
  { key: "craterDensity", label: "Crater density", min: 0, max: 3 },
  { key: "craterSize", label: "Crater size", min: 0.25, max: 2.5 },
  { key: "roughness", label: "Terrain roughness", min: 0, max: 2 },
] as const;

/** Preview the numeric value while dragging; regenerate only on release/keyboard commit. */
export function SurfaceSlider({
  value,
  label,
  min,
  max,
  onCommit,
  step = 0.05,
  unit = "×",
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  onCommit(value: number): void;
  step?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState(value),
    latest = useRef(value);
  useEffect(() => {
    latest.current = value;
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (latest.current !== value) onCommit(latest.current);
  };
  return (
    <div
      onPointerUp={commit}
      onPointerCancel={commit}
      onKeyUp={commit}
      onBlur={commit}
    >
      <Slider
        label={label}
        value={draft}
        min={min}
        max={max}
        step={step}
        unit={unit}
        precise
        onChange={(next) => {
          latest.current = next;
          setDraft(next);
        }}
      />
    </div>
  );
}
export default function RockySurfaceControls({
  value,
  onChange,
  prefix = "",
}: {
  value: RockyTerrain;
  onChange(value: RockyTerrain): void;
  prefix?: string;
}) {
  const plains = value.plains ?? defaultPlains;
  return (
    <>
      {fields.map(({ key, label, min, max }) => (
        <SurfaceSlider
          key={key}
          label={`${prefix}${label}`}
          value={value[key]}
          min={min}
          max={max}
          onCommit={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
      <p className="field-note">
        Terrain changes apply on release. Density and size keep the same seeded
        impact locations; roughness controls the underlying terrain.
      </p>
      <div className="field-heading">SMOOTH PLAINS</div>
      <SurfaceSlider
        label={`${prefix}Plains coverage`}
        value={plains.coverage * 100}
        min={0}
        max={100}
        step={1}
        unit="%"
        onCommit={(percent) =>
          onChange({ ...value, plains: { ...plains, coverage: percent / 100 } })
        }
      />
      {plains.coverage > 0 && (
        <>
          <SurfaceSlider
            label={`${prefix}Plains scale`}
            value={plains.scale}
            min={0.5}
            max={4}
            onCommit={(scale) =>
              onChange({ ...value, plains: { ...plains, scale } })
            }
          />
          <label className="check-field">
            <ColorInput
              aria-label={`${prefix}Plains color`}
              value={plains.color}
              onCommit={(color) =>
                onChange({ ...value, plains: { ...plains, color } })
              }
            />
            Plains color
          </label>
          <p className="field-note">
            Smooth contrasting regions with fewer old impacts. Lower scale
            favors fewer, broader basins. Use dark volcanic colors or bright icy
            plains.
          </p>
        </>
      )}
    </>
  );
}
export function RockySurfaceRanges({
  value,
  onChange,
  terrain,
}: {
  value: RockyTerrainRanges;
  onChange(value: RockyTerrainRanges): void;
  terrain?: RockyTerrain;
}) {
  const plains = terrain?.plains ?? defaultPlains;
  const ranges = value.plains ?? {
    coverage: [plains.coverage, plains.coverage] as [number, number],
    scale: [plains.scale, plains.scale] as [number, number],
  };
  return (
    <>
      {fields.map(({ key, label, min, max }) => (
        <RangeField
          key={key}
          label={`${label} range`}
          value={value[key]}
          min={min}
          max={max}
          step={0.05}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
      <p className="field-note">
        These ranges apply to the next surface reroll.
      </p>
      <details className="procedural-details">
        <summary>Smooth plains ranges</summary>
        <RangeField
          label="Plains coverage range (%)"
          value={ranges.coverage.map((v) => v * 100) as [number, number]}
          min={0}
          max={100}
          step={1}
          onChange={(coverage) =>
            onChange({
              ...value,
              plains: {
                ...ranges,
                coverage: coverage.map((v) => v / 100) as [number, number],
              },
            })
          }
        />
        <RangeField
          label="Plains scale range"
          value={ranges.scale}
          min={0.5}
          max={4}
          step={0.05}
          onChange={(scale) =>
            onChange({ ...value, plains: { ...ranges, scale } })
          }
        />
      </details>
    </>
  );
}
