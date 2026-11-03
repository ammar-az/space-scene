import type { Earthlike } from "../../scene/model/earthlike.ts";
import { ColorInput, Slider } from "./controls.tsx";
export default function EarthlikeControls({
  settings,
  onChange,
}: {
  settings: Earthlike;
  onChange(patch: Partial<Earthlike>): void;
}) {
  return (
    <>
      <div className="color-fields earth-colors">
        {(
          [
            ["oceanColor", "Ocean"],
            ["landColor", "Land"],
            ["desertColor", "Desert"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <ColorInput
              aria-label={`${label} color`}
              value={settings[key]}
              onCommit={(color) => onChange({ [key]: color })}
            />
            <span>
              {label}
              <small>{settings[key].toUpperCase()}</small>
            </span>
          </label>
        ))}
      </div>
      <Slider
        label="Land coverage"
        value={settings.landCoverage * 100}
        min={5}
        max={85}
        unit="%"
        onChange={(landCoverage) =>
          onChange({ landCoverage: landCoverage / 100 })
        }
      />
      <Slider
        label="Continent scale"
        value={settings.continentScale}
        min={1}
        max={5}
        step={0.1}
        precise
        onChange={(continentScale) => onChange({ continentScale })}
      />
      <p className="field-note">
        Surface rerolls generate new continents while keeping your ocean, land
        and desert colors. Clouds and haze have their own Atmosphere tab.
      </p>
    </>
  );
}
