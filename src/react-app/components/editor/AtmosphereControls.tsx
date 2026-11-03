import type { Planet } from "../../scene/model/schema.ts";
import { environmentSettings } from "../../scene/model/atmospheres.ts";
import type { Atmosphere, Clouds } from "../../scene/model/atmospheres.ts";
import { ColorInput, Icon, Slider } from "./controls.tsx";
export default function AtmosphereControls({
  planet,
  onAtmosphere,
  onClouds,
  onReroll,
}: {
  planet: Planet;
  onAtmosphere(patch: Partial<Atmosphere>): void;
  onClouds(patch: Partial<Clouds>): void;
  onReroll(): void;
}) {
  const { atmosphere, clouds } = environmentSettings(planet);
  return (
    <>
      <div className="field-heading">ATMOSPHERIC HAZE</div>
      <p className="field-note intro-note">
        A separate sunlit rim around the rocky surface. Height and cloud
        altitude use fractions of the planet radius.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={atmosphere.visible}
          onChange={(event) => onAtmosphere({ visible: event.target.checked })}
        />
        Show atmosphere
      </label>
      <label className="layer-color">
        <ColorInput
          aria-label="Atmosphere color"
          value={atmosphere.color}
          onCommit={(color) => onAtmosphere({ color })}
        />
        Haze color
      </label>
      <Slider
        label="Atmosphere density"
        value={atmosphere.density * 100}
        min={0}
        max={100}
        unit="%"
        onChange={(density) => onAtmosphere({ density: density / 100 })}
      />
      <Slider
        label="Atmosphere height"
        value={atmosphere.height}
        min={0.005}
        max={0.2}
        step={0.005}
        precise
        onChange={(height) => onAtmosphere({ height })}
      />
      <div className="section-separator" />
      <div className="field-heading">CLOUD LAYER</div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={clouds.visible}
          onChange={(event) => onClouds({ visible: event.target.checked })}
        />
        Show clouds
      </label>
      <label className="layer-color">
        <ColorInput
          aria-label="Cloud color"
          value={clouds.color}
          onCommit={(color) => onClouds({ color })}
        />
        Cloud color
      </label>
      <Slider
        label="Cloud coverage"
        value={clouds.coverage * 100}
        min={0}
        max={100}
        unit="%"
        onChange={(coverage) => onClouds({ coverage: coverage / 100 })}
      />
      <Slider
        label="Cloud opacity"
        value={clouds.opacity * 100}
        min={0}
        max={100}
        unit="%"
        onChange={(opacity) => onClouds({ opacity: opacity / 100 })}
      />
      <Slider
        label="Cloud scale"
        value={clouds.scale}
        min={1}
        max={12}
        step={0.1}
        precise
        onChange={(scale) => onClouds({ scale })}
      />
      <Slider
        label="Cloud altitude"
        value={clouds.altitude}
        min={0.005}
        max={0.08}
        step={0.001}
        precise
        onChange={(altitude) => onClouds({ altitude })}
      />
      <Slider
        label="Cloud drift"
        value={clouds.speed}
        min={-10}
        max={10}
        step={0.01}
        precise
        unit="°/s"
        onChange={(speed) => onClouds({ speed })}
      />
      <Slider
        label="Cloud evolution"
        value={clouds.evolution ?? 0.6}
        min={0}
        max={2}
        step={0.05}
        precise
        onChange={(evolution) => onClouds({ evolution })}
      />
      <button
        className="button full"
        disabled={planet.locked || !clouds.visible}
        onClick={onReroll}
      >
        <Icon name="dice" size={15} />
        Reroll clouds
      </button>
      <p className="field-note">
        Cloud drift adds to surface spin, in degrees per second. Evolution
        gently reshapes the clouds independently; set it to 0 to keep their
        pattern fixed. Rerolling clouds leaves terrain, moons and rings
        unchanged. Haze expands when needed to stay above the cloud layer.
      </p>
    </>
  );
}
