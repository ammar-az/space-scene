import TimeControls from "./TimeControls.tsx";
import { scenePresets } from "../../data/presets.ts";
import type { ScenePreset } from "../../data/presets.ts";
import { Icon, Slider } from "./controls.tsx";
import type { SceneModel } from "../../scene/model/schema.ts";
import { defaultLayout } from "../../scene/model/layout.ts";
export default function ScenePresets({
  loadingPreset,
  onLoad,
  onAddPlanet,
  layout,
  onLayout,
  onFit,
  sizing,
  onSizing,
  motion,
  onMotion,
}: {
  loadingPreset: string | null;
  onLoad(preset: ScenePreset): void;
  onAddPlanet(): void;
  layout: SceneModel["layout"];
  onLayout(patch: Partial<NonNullable<SceneModel["layout"]>>): void;
  onFit(): void;
  sizing: SceneModel["sizing"];
  onSizing(patch: Partial<SceneModel["sizing"]>): void;
  motion: SceneModel["motion"];
  onMotion(patch: Partial<SceneModel["motion"]>): void;
}) {
  const settings = layout ?? defaultLayout;
  return (
    <div className="inspector-scroll preset-inspector">
      <div className="settings-identity">
        <Icon name="orbit" size={38} />
        <h2>Start with a system.</h2>
        <p>Generate a scene, then make it your own.</p>
      </div>
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
        Compression pulls distant orbits inward while preserving each ellipse. A
        baseline around the displayed star leaves room for the innermost system.
        Originally separate, centered paths retain small gaps.
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
        Scale and spacing are percentages; 100 leaves their compressed layout
        unchanged. Scale changes every orbit. Spacing keeps the innermost orbit
        fixed and stretches the gaps outward. Planet sizes, moons and timing
        stay the same.
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
        0% keeps physical planet ratios; 100% makes every planet as large as the
        largest. The star is independent. Saved physical diameters stay
        unchanged.
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
              {preset.id === "portfolio" && (
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
              <Icon name="orbit" size={15} />
              {loadingPreset === preset.id ? "Generating…" : "Generate scene"}
            </button>
            <p className="field-note">{preset.note}</p>
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
        Generating replaces this scene. Export JSON first to keep your current
        changes.
      </p>
      <button className="button full" onClick={onAddPlanet}>
        <Icon name="plus" size={15} /> Add a planet
      </button>
    </div>
  );
}
