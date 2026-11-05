import TimeControls from "./TimeControls.tsx";
import { scenePresets } from "../../data/presets.ts";
import type { ScenePreset } from "../../data/presets.ts";
import { Icon, Slider } from "./controls.tsx";
import type { SceneModel } from "../../scene/model/schema.ts";
import { defaultLayout } from "../../scene/model/layout.ts";
import AsteroidBeltControls from "./AsteroidBeltControls.tsx";
import type { AsteroidBelt } from "../../scene/model/schema.ts";
import { defaultLighting } from "../../scene/model/lighting.ts";
export default function ScenePresets({
  loadingPreset,
  onLoad,
  onCreateSystem,
  layout,
  onLayout,
  onFit,
  sizing,
  onSizing,
  motion,
  onMotion,
  asteroidBelt,
  onAsteroidBelt,
  onRerollAsteroids,
  lighting,
  onLighting,
}: {
  loadingPreset: string | null;
  onLoad(preset: ScenePreset): void;
  onCreateSystem(): void;
  layout: SceneModel["layout"];
  onLayout(patch: Partial<NonNullable<SceneModel["layout"]>>): void;
  onFit(): void;
  sizing: SceneModel["sizing"];
  onSizing(patch: Partial<SceneModel["sizing"]>): void;
  motion: SceneModel["motion"];
  onMotion(patch: Partial<SceneModel["motion"]>): void;
  asteroidBelt?: AsteroidBelt;
  onAsteroidBelt(patch: Partial<AsteroidBelt>): void;
  onRerollAsteroids(): void;
  lighting: SceneModel["lighting"];
  onLighting(mode: NonNullable<SceneModel["lighting"]>): void;
}) {
  const settings = layout ?? defaultLayout;
  return (
    <div className="inspector-scroll preset-inspector">
      <div className="field-heading">SCENE LIGHTING</div>
      <label className="rate-unit">
        <span>Lighting mode</span>
        <select
          aria-label="Scene lighting"
          value={lighting ?? defaultLighting}
          onChange={(event) =>
            onLighting(
              event.target.value as NonNullable<SceneModel["lighting"]>,
            )
          }
        >
          <option value="realistic">Realistic lighting</option>
          <option value="fully-lit">Fully lit</option>
        </select>
      </label>
      <p className="field-note">
        Fully lit softens the night side. Both modes retain eclipses.
      </p>
      <div className="section-separator" />
      <div className="field-heading">SCENE LAYOUT</div>
      <Slider
        label="Orbit distance compression"
        value={settings.distanceCompression * 100}
        min={0}
        max={100}
        unit="%"
        precise
        onChange={(percent) => onLayout({ distanceCompression: percent / 100 })}
      />
      <p className="field-note">
        Higher compression brings distant orbits closer. Shapes and physical
        distances stay unchanged.
      </p>
      <Slider
        label="Orbit scale"
        value={settings.orbitScale * 100}
        min={50}
        max={500}
        step={5}
        precise
        unit="%"
        onChange={(value) => onLayout({ orbitScale: value / 100 })}
      />
      <Slider
        label="Orbit spacing"
        value={settings.orbitSpacing * 100}
        min={50}
        max={500}
        step={5}
        precise
        unit="%"
        onChange={(value) => onLayout({ orbitSpacing: value / 100 })}
      />
      <p className="field-note">
        Scale resizes all orbits. Spacing stretches gaps while keeping the
        innermost orbit fixed. 100% is unchanged.
      </p>
      <div className="layout-actions">
        <button className="button" onClick={onFit}>
          Fit scene
        </button>
        <button
          className="button"
          onClick={() => onLayout({ ...defaultLayout })}
        >
          Reset layout
        </button>
      </div>
      <div className="section-separator" />
      <div className="field-heading">BODY DISPLAY SIZES</div>
      <Slider
        label="Planet size compression"
        value={sizing.planetCompression * 100}
        min={0}
        max={100}
        unit="%"
        precise
        onChange={(percent) => onSizing({ planetCompression: percent / 100 })}
      />
      <p className="field-note">
        0% keeps physical size ratios. 100% makes all planets as large as the
        largest. Physical diameters and the star stay unchanged.
      </p>
      <Slider
        label="Planet display scale"
        value={sizing.planetScale * 100}
        min={100}
        max={500}
        step={1}
        unit="%"
        onChange={(percent) => onSizing({ planetScale: percent / 100 })}
      />
      <Slider
        label="Star display scale"
        value={sizing.starScale * 100}
        min={10}
        max={100}
        step={1}
        unit="%"
        onChange={(percent) => onSizing({ starScale: percent / 100 })}
      />
      <div className="section-separator" />
      <TimeControls motion={motion} onChange={onMotion} />
      <div className="section-separator" />
      <AsteroidBeltControls
        belt={asteroidBelt}
        onChange={onAsteroidBelt}
        onReroll={onRerollAsteroids}
      />
      <div className="section-separator" />
      <div className="field-heading">SCENE PRESETS</div>
      <div
        className="preset-cards"
        aria-label="Built-in scene presets"
        aria-busy={loadingPreset !== null}
      >
        {scenePresets.map((preset) => (
          <article className="preset-card" key={preset.id}>
            <div className="preset-planets" aria-hidden="true">
              {preset.colors.map((color, index) => (
                <span key={index} style={{ background: color }} />
              ))}
            </div>
            <h3>
              {preset.name}
              {preset.id === "solar-system" && (
                <small className="preset-default">DEFAULT</small>
              )}
            </h3>
            <p>{preset.description}</p>
            <button
              className="button full"
              disabled={loadingPreset !== null}
              onClick={() => {
                onLoad(preset);
              }}
              aria-label={`Generate ${preset.name}`}
            >
              <Icon name="planet" size={18} />
              {loadingPreset === preset.id ? "Generating…" : "Generate scene"}
            </button>
            {"source" in preset && (
              <a
                className="preset-source"
                href={preset.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {preset.source.label} ↗
              </a>
            )}
          </article>
        ))}
      </div>
      <p className="field-note">
        Loading a preset replaces this scene. Export JSON to keep it.
      </p>
      <button className="button full" onClick={onCreateSystem}>
        <Icon name="plus" size={18} /> Create a new solar system
      </button>
    </div>
  );
}
