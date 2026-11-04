import type { AsteroidBelt } from "../../scene/model/schema.ts";
import { defaultAsteroidBelt } from "../../scene/model/asteroidBelt.ts";
import { ColorInput, Icon, RangeField, Slider } from "./controls.tsx";

export default function AsteroidBeltControls({
  belt,
  onChange,
  onReroll,
}: {
  belt?: AsteroidBelt;
  onChange(patch: Partial<AsteroidBelt>): void;
  onReroll(): void;
}) {
  const settings = belt ?? defaultAsteroidBelt;
  return (
    <>
      <div className="field-heading">ASTEROID BELT</div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={settings.visible}
          onChange={(e) => onChange({ visible: e.target.checked })}
        />
        Show asteroid belt
      </label>
      {settings.visible && (
        <>
          <p className="field-note intro-note">
            A procedural population around the Sun. Its physical distances
            follow the scene's compressed orbital layout; its bodies are
            independent of planet moons.
          </p>
          <Slider
            label="Asteroid count"
            value={settings.count}
            min={0}
            max={3000}
            step={1}
            precise
            onChange={(count) => onChange({ count: Math.round(count) })}
          />
          <RangeField
            label="Belt distances (million km)"
            value={settings.distance}
            min={0.01}
            max={1e9}
            step={0.01}
            logarithmic
            onChange={(distance) => onChange({ distance })}
          />
          <RangeField
            label="Asteroid diameters (km)"
            value={settings.diameter.map((v) => v * 1000) as [number, number]}
            min={1}
            max={1000}
            step={0.01}
            logarithmic
            onChange={(diameter) =>
              onChange({
                diameter: diameter.map((v) => v / 1000) as [number, number],
              })
            }
          />
          <Slider
            label="Asteroid size boost"
            value={settings.sizeScale}
            min={1}
            max={300}
            unit="×"
            precise
            onChange={(sizeScale) => onChange({ sizeScale })}
          />
          <p className="field-note">
            Size boost makes small rocks visible without changing their saved
            physical diameters. The belt follows planet-orbit render time and
            the shared pause/speed.
          </p>
          <div className="color-fields belt-colors">
            {settings.colors.map((color, index) => (
              <label key={index}>
                <ColorInput
                  aria-label={`Asteroid color ${index + 1}`}
                  value={color}
                  onCommit={(color) =>
                    onChange({
                      colors: settings.colors.map((v, i) =>
                        i === index ? color : v,
                      ),
                    })
                  }
                />
                <span>{index + 1}</span>
              </label>
            ))}
          </div>
          <details className="belt-details">
            <summary>Orbit and rotation ranges</summary>
            <RangeField
              label="Asteroid inclination (°)"
              value={settings.inclination}
              min={-180}
              max={180}
              step={0.1}
              onChange={(inclination) => onChange({ inclination })}
            />
            <RangeField
              label="Asteroid eccentricity"
              value={settings.eccentricity}
              min={0}
              max={0.6}
              step={0.01}
              onChange={(eccentricity) => onChange({ eccentricity })}
            />
            <p className="field-note">
              Eccentricity is limited when needed to keep each complete orbit
              inside the belt's distance range. Outer members get longer periods
              within the allowed range.
            </p>
            <RangeField
              label="Asteroid orbital periods (days)"
              value={settings.periodDays}
              min={0.01}
              max={1e9}
              step={0.01}
              logarithmic
              onChange={(periodDays) => onChange({ periodDays })}
            />
            <RangeField
              label="Asteroid rotation periods (hours)"
              value={settings.spinHours}
              min={0.01}
              max={1e6}
              step={0.01}
              logarithmic
              onChange={(spinHours) => onChange({ spinHours })}
            />
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.playing}
                onChange={(e) => onChange({ playing: e.target.checked })}
              />
              Animate belt orbits
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.reverse}
                onChange={(e) => onChange({ reverse: e.target.checked })}
              />
              Reverse belt orbits
            </label>
          </details>
          <button className="button full" onClick={onReroll}>
            <Icon name="dice" size={15} />
            Reroll asteroids
          </button>
        </>
      )}
    </>
  );
}
