import type { Planet, NotableMoon } from "../../scene/model/schema.ts";
import { Icon, Slider } from "./controls.tsx";
export default function MoonSystemControls({
  planet,
  onSelect,
  onAdd,
  onChange,
  onSystem,
}: {
  planet: Planet;
  onSelect(moonId: string): void;
  onAdd(): void;
  onChange(patch: Partial<Planet>): void;
  onSystem(patch: Partial<Planet["moonSystem"]>): void;
}) {
  const moons: NotableMoon[] = planet.notableMoons;
  return (
    <>
      <div className="field-heading">NOTABLE MOONS</div>

      <div className="named-moon-list">
        {moons.map((moon) => (
          <button
            className="named-moon-row"
            key={moon.id}
            aria-label={`Edit ${moon.name}`}
            onClick={() => onSelect(moon.id)}
          >
            <span
              className="moon-dot"
              style={{ background: moon.surface.color }}
            />
            <span>
              {moon.name}
              <small>
                {moon.diameter} ×1,000 km{!moon.visible ? " · hidden" : ""}
              </small>
            </span>
            <Icon name="chevron" size={13} />
          </button>
        ))}
      </div>
      <button
        className="button full"
        onClick={onAdd}
        disabled={moons.length >= 64}
      >
        <Icon name="plus" size={15} />
        Add named moon
      </button>
      <div className="section-separator" />
      <div className="field-heading">MOON SYSTEM DISPLAY</div>
      <Slider
        label="Moon distance compression"
        value={planet.moonSystem.distanceCompression * 100}
        min={0}
        max={100}
        unit="%"
        onChange={(percent) => onSystem({ distanceCompression: percent / 100 })}
      />
      <Slider
        label="Moon orbit scale"
        value={planet.moonSystem.orbitScale * 100}
        min={50}
        max={500}
        step={1}
        unit="%"
        onChange={(percent) => onSystem({ orbitScale: percent / 100 })}
      />
      <Slider
        label="Moon size compression"
        value={planet.moonSystem.sizeCompression * 100}
        min={0}
        max={100}
        unit="%"
        onChange={(percent) => onSystem({ sizeCompression: percent / 100 })}
      />
      <Slider
        label="Moon size scale"
        value={planet.moonSystem.sizeScale * 100}
        min={25}
        max={500}
        step={1}
        unit="%"
        onChange={(percent) => onSystem({ sizeScale: percent / 100 })}
      />
      <p className="field-note">
        Compression brings moon sizes or distances closer together. Physical
        values stay unchanged.
      </p>
      <div className="section-separator" />
      <div className="field-heading">PROCEDURAL POPULATION</div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={planet.proceduralMoons}
          onChange={(e) => onChange({ proceduralMoons: e.target.checked })}
        />
        Show procedural moons
      </label>

      <Slider
        label="Procedural moon count"
        value={planet.moonCount}
        min={0}
        max={64}
        onChange={(moonCount) => onChange({ moonCount })}
      />
    </>
  );
}
