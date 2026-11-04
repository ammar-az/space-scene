import type { Earthlike } from "../../scene/model/earthlike.ts";
import { ColorInput } from "./controls.tsx";
import { SurfaceSlider } from "./RockySurfaceControls.tsx";
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
      <SurfaceSlider
        label="Land coverage"
        value={settings.landCoverage * 100}
        min={5}
        max={85}
        unit="%"
        step={1}
        onCommit={(landCoverage) =>
          onChange({ landCoverage: landCoverage / 100 })
        }
      />
      <SurfaceSlider
        label="Continent scale"
        value={settings.continentScale}
        min={1}
        max={5}
        step={0.1}
        onCommit={(continentScale) => onChange({ continentScale })}
      />
      <SurfaceSlider
        label="Mountain height"
        value={settings.mountainHeight ?? 1}
        min={0}
        max={2}
        onCommit={(mountainHeight) => onChange({ mountainHeight })}
      />
      <SurfaceSlider
        label="Polar ice coverage"
        value={(settings.iceCoverage ?? 0.08) * 100}
        min={0}
        max={50}
        step={1}
        unit="%"
        onCommit={(percent) => onChange({ iceCoverage: percent / 100 })}
      />
      <SurfaceSlider
        label="Ocean reflectivity"
        value={(settings.oceanReflectivity ?? 0.5) * 100}
        min={0}
        max={100}
        step={1}
        unit="%"
        onCommit={(percent) => onChange({ oceanReflectivity: percent / 100 })}
      />
      <p className="field-note">
        Surface rerolls generate new continents while keeping your ocean, land
        and desert colors. Clouds and haze have their own Atmosphere tab.
      </p>
    </>
  );
}
