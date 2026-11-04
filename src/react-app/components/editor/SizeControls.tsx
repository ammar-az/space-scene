import type { Planet, SceneModel } from "../../scene/model/schema.ts";
import {
  PLANET_DIAMETER_LIMITS,
  STAR_DIAMETER_LIMITS,
  roundDiameter,
  compressedPlanetDiameter,
  renderedPlanetDiameter,
  renderedStarDiameter,
} from "../../scene/model/sizes.ts";

const format = (value: number) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit(value: number): number | void;
}) {
  return (
    <input
      key={value}
      type="number"
      aria-label={label}
      defaultValue={Number(value.toFixed(8))}
      min={min}
      max={max}
      step={step}
      onBlur={(event) => {
        const parsed = event.currentTarget.valueAsNumber;
        const next = Number.isFinite(parsed)
          ? Math.min(max, Math.max(min, parsed))
          : value;
        const canonical = onCommit(next);
        event.currentTarget.value = String(canonical ?? next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
function DiameterControl({
  label,
  value,
  star = false,
  rendered,
  description,
  onChange,
}: {
  label: string;
  value: number;
  star?: boolean;
  rendered: number;
  description: string;
  onChange(diameter: number): void;
}) {
  const [min, max] = star ? STAR_DIAMETER_LIMITS : PLANET_DIAMETER_LIMITS;
  const multiplier = star ? 10000 : 1000;
  const low = Math.min(0.1, Math.pow(10, Math.floor(Math.log10(value))));
  const high = Math.min(
    max,
    Math.max(star ? 1000000 : 1000, Math.pow(10, Math.ceil(Math.log10(value)))),
  );
  const commit = (diameter: number) => {
    const next = roundDiameter(Math.max(min, Math.min(max, diameter)));
    onChange(next);
    return next;
  };
  return (
    <div className="size-control">
      <div className="size-heading">
        <span>{label}</span>
        <span>LOG SCALE</span>
      </div>
      <input
        className="log-slider"
        type="range"
        aria-label={label}
        min={0}
        max={1000}
        step={1}
        value={(Math.log(value / low) / Math.log(high / low)) * 1000}
        onChange={(event) =>
          commit(low * Math.pow(high / low, Number(event.target.value) / 1000))
        }
      />
      <div className="size-inputs">
        <label>
          <span>× {multiplier.toLocaleString("en-US")} km</span>
          <NumberField
            label={`${label} units`}
            value={value}
            min={min}
            max={max}
            step={0.01}
            onCommit={commit}
          />
        </label>
        <label>
          <span>Diameter in km</span>
          <NumberField
            label={`${label} kilometres`}
            value={value * multiplier}
            min={min * multiplier}
            max={max * multiplier}
            step={multiplier / 100}
            onCommit={(km) => commit(km / multiplier) * multiplier}
          />
        </label>
      </div>
      <div className="rendered-size" tabIndex={0} aria-label={description}>
        Rendered as <strong>{format(rendered)}</strong> ×{" "}
        {multiplier.toLocaleString("en-US")} km{" "}
        <span aria-hidden="true">ⓘ</span>
        <span role="tooltip" className="size-tooltip">
          {description}
        </span>
      </div>
    </div>
  );
}
export function PlanetDiameterControl({
  scene,
  planet,
  onChange,
}: {
  scene: SceneModel;
  planet: Planet;
  onChange(diameter: number): void;
}) {
  const compressed = compressedPlanetDiameter(scene, planet),
    rendered = renderedPlanetDiameter(scene, planet);
  return (
    <DiameterControl
      label="Planet diameter"
      value={planet.diameter}
      rendered={rendered}
      onChange={onChange}
      description={`${format(planet.diameter)} × 1,000 km physical diameter → ${format(compressed)} after ${format(scene.sizing.planetCompression * 100)}% size compression → ${format(rendered)} rendered at ${format(scene.sizing.planetScale * 100)}% planet display scale. The saved physical diameter stays unchanged.`}
    />
  );
}
export function StarDiameterControl({
  scene,
  onChange,
}: {
  scene: SceneModel;
  onChange(diameter: number): void;
}) {
  return (
    <DiameterControl
      label="Star diameter"
      value={scene.sun.diameter}
      star
      rendered={renderedStarDiameter(scene)}
      onChange={onChange}
      description={`${format(scene.sun.diameter)} × 10,000 km physical diameter, rendered as ${format(renderedStarDiameter(scene))} at ${format(scene.sizing.starScale * 100)}% star display scale. The star is excluded from planet size compression.`}
    />
  );
}
