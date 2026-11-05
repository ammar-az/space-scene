import type { CSSProperties } from "react";
import type {
  SceneModel,
  Planet,
  NotableMoon,
} from "../../scene/model/schema.ts";
import { renderedPlanetDiameter } from "../../scene/model/sizes.ts";
import {
  notableMoonSize,
  notableMoonLayout,
} from "../../scene/model/notableMoons.ts";
import {
  formatDuration,
  orbitDaysPerSecond,
  rotationHoursPerSecond,
} from "../../scene/model/time.ts";
import { ColorInput, Icon, Slider } from "./controls.tsx";
import PhysicalValueControl from "./PhysicalValueControl.tsx";
import RockySurfaceControls, {
  RockySurfaceRanges,
} from "./RockySurfaceControls.tsx";
import { rockyTerrain, rockyRanges } from "../../scene/model/rockySurfaces.ts";
export default function NotableMoonInspector({
  scene,
  planet,
  moon,
  onChange,
  onOrbit,
  onSpin,
  onBack,
  onDelete,
  onDuplicate,
  onReroll,
}: {
  scene: SceneModel;
  planet: Planet;
  moon: NotableMoon;
  onChange(patch: Partial<NotableMoon>): void;
  onOrbit(patch: Partial<NotableMoon["orbit"]>): void;
  onSpin(patch: Partial<NotableMoon["spin"]>): void;
  onBack(): void;
  onDelete(): void;
  onDuplicate(): void;
  onReroll(): void;
}) {
  const physicalHours = moon.orbit.periodDays * 24;
  const layout = notableMoonLayout(planet).get(moon.id)!;
  const parentDiameter = renderedPlanetDiameter(scene, planet);
  const orbitDuration =
    moon.orbit.periodDays /
    (orbitDaysPerSecond(scene.motion.moonRate) * scene.motion.speed);
  const rotationDuration = moon.spin.tidallyLocked
    ? orbitDuration
    : moon.spin.periodHours /
      (rotationHoursPerSecond(scene.motion.rotationRate) * scene.motion.speed);
  const rendered =
    renderedPlanetDiameter(scene, planet) * notableMoonSize(planet, moon);
  return (
    <>
      <div className="inspector-identity">
        <span
          className="planet-swatch large rocky"
          style={
            {
              "--planet-color": moon.surface.color,
              "--planet-accent": moon.surface.accent,
            } as CSSProperties
          }
        />
        <div>
          <span className="eyebrow">MOON OF {planet.name.toUpperCase()}</span>
          <input
            aria-label="Moon name"
            value={moon.name}
            maxLength={80}
            onChange={(e) =>
              onChange({
                name: e.target.value.trim() ? e.target.value : "Moon",
              })
            }
          />
        </div>
      </div>
      <div className="inspector-scroll">
        <button className="button full moon-back" onClick={onBack}>
          ← {planet.name} moons
        </button>
        <label className="check-field">
          <input
            type="checkbox"
            checked={moon.visible}
            onChange={(e) => onChange({ visible: e.target.checked })}
          />
          Show moon
        </label>
        <PhysicalValueControl
          label="Moon diameter"
          unit="× 1,000 km"
          value={moon.diameter}
          max={1e6}
          initialMax={20}
          km
          kmMultiplier={1000}
          onChange={(diameter) => onChange({ diameter })}
        />
        <div className="rendered-size" tabIndex={0}>
          Rendered as <strong>{rendered.toFixed(4)}</strong> ×1,000 km ⓘ
          <span role="tooltip" className="size-tooltip">
            Physical diameter {moon.diameter} ×1,000 km. Moon size compression
            and scale are relative to {planet.name}; changing the planet's solar
            orbit never detaches its moons.
          </span>
        </div>
        <div className="color-fields">
          {(
            [
              ["color", "Primary"],
              ["accent", "Accent"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <ColorInput
                aria-label={`Moon ${label.toLowerCase()} color`}
                value={moon.surface[key]}
                onCommit={(color) =>
                  onChange({ surface: { ...moon.surface, [key]: color } })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <RockySurfaceControls
          value={rockyTerrain(moon.surface.terrain, moon.surface.detail)}
          onChange={(terrain) =>
            onChange({ surface: { ...moon.surface, terrain } })
          }
          prefix="Moon "
        />
        <details className="procedural-details">
          <summary>Surface reroll ranges</summary>
          <RockySurfaceRanges
            terrain={moon.surface.terrain}
            value={rockyRanges(moon.surface.ranges, [
              moon.surface.detail,
              moon.surface.detail,
            ])}
            onChange={(ranges) =>
              onChange({ surface: { ...moon.surface, ranges } })
            }
          />
        </details>
        <div className="section-separator" />
        <div className="field-heading">
          ORBIT AROUND {planet.name.toUpperCase()}
        </div>
        <p className="field-note">
          Inclination and orientation are relative to the parent’s equatorial
          plane.
        </p>
        <PhysicalValueControl
          label="Moon orbit X radius"
          unit="× 1,000 km"
          value={moon.orbit.radiusX}
          max={1e9}
          initialMax={10000}
          km
          kmMultiplier={1000}
          onChange={(radiusX) => onOrbit({ radiusX })}
        />
        <PhysicalValueControl
          label="Moon orbit Z radius"
          unit="× 1,000 km"
          value={moon.orbit.radiusZ}
          max={1e9}
          initialMax={10000}
          km
          kmMultiplier={1000}
          onChange={(radiusZ) => onOrbit({ radiusZ })}
        />
        <p className="field-note">
          Rendered orbit radii:{" "}
          {Number(
            ((moon.orbit.radiusX * layout.factor * parentDiameter) / 2).toFixed(
              3,
            ),
          )}{" "}
          ×{" "}
          {Number(
            ((moon.orbit.radiusZ * layout.factor * parentDiameter) / 2).toFixed(
              3,
            ),
          )}{" "}
          ×1,000 km.
        </p>
        <PhysicalValueControl
          label="Moon orbital period"
          unit="days"
          value={moon.orbit.periodDays}
          max={1e9}
          initialMax={1000}
          onChange={(periodDays) => onOrbit({ periodDays })}
        />
        <p className="field-note">
          One rendered orbit:{" "}
          {formatDuration(
            moon.orbit.periodDays /
              (orbitDaysPerSecond(scene.motion.moonRate) * scene.motion.speed),
          )}{" "}
          at the moon render rate.
        </p>
        <Slider
          label="Moon orbit inclination"
          value={moon.orbit.inclination}
          min={-180}
          max={180}
          step={0.1}
          unit="°"
          precise
          onChange={(inclination) => onOrbit({ inclination })}
        />
        <Slider
          label="Moon orbit orientation"
          value={moon.orbit.orientation}
          min={-180}
          max={180}
          step={0.1}
          unit="°"
          precise
          onChange={(orientation) => onOrbit({ orientation })}
        />
        <Slider
          label="Moon ellipse rotation"
          value={moon.orbit.rotation}
          min={-180}
          max={180}
          step={0.1}
          unit="°"
          precise
          onChange={(rotation) => onOrbit({ rotation })}
        />
        <Slider
          label="Moon orbital phase"
          value={moon.orbit.phase}
          min={0}
          max={360}
          step={0.1}
          unit="°"
          precise
          onChange={(phase) => onOrbit({ phase })}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={moon.orbit.reverse}
            onChange={(e) => onOrbit({ reverse: e.target.checked })}
          />
          Reverse moon orbit
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={moon.orbit.playing}
            onChange={(e) => onOrbit({ playing: e.target.checked })}
          />
          Animate moon orbit
        </label>
        <div className="section-separator" />
        <div className="field-heading">ROTATION</div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={moon.spin.tidallyLocked}
            onChange={(e) => onSpin({ tidallyLocked: e.target.checked })}
          />
          Tidally locked
        </label>
        {moon.spin.tidallyLocked && (
          <p className="field-note">
            Rotation period is locked to {Number(physicalHours.toFixed(6))}{" "}
            hours ({moon.orbit.periodDays} days). The same face follows{" "}
            {planet.name}, including when render rates change.
          </p>
        )}
        <fieldset className="moon-free-spin" disabled={moon.spin.tidallyLocked}>
          <PhysicalValueControl
            label="Moon rotation period"
            unit="hours"
            value={
              moon.spin.tidallyLocked ? physicalHours : moon.spin.periodHours
            }
            initialMax={10000}
            onChange={(periodHours) => onSpin({ periodHours })}
          />
          <Slider
            label="Moon axis tilt"
            value={moon.spin.tilt}
            min={-180}
            max={180}
            step={0.1}
            unit="°"
            precise
            onChange={(tilt) => onSpin({ tilt })}
          />
          <Slider
            label="Moon axis orientation"
            value={moon.spin.orientation}
            min={-180}
            max={180}
            step={0.1}
            unit="°"
            precise
            onChange={(orientation) => onSpin({ orientation })}
          />
          <label className="check-field">
            <input
              type="checkbox"
              checked={moon.spin.reverse}
              onChange={(e) => onSpin({ reverse: e.target.checked })}
            />
            Reverse moon rotation
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={moon.spin.playing}
              onChange={(e) => onSpin({ playing: e.target.checked })}
            />
            Rotate moon
          </label>
        </fieldset>
        <p className="field-note">
          One rendered rotation: {formatDuration(rotationDuration)}.
        </p>
        <Slider
          label={
            moon.spin.tidallyLocked ? "Facing longitude" : "Moon rotation phase"
          }
          value={moon.spin.phase}
          min={0}
          max={360}
          step={0.1}
          precise
          unit="°"
          onChange={(phase) => onSpin({ phase })}
        />
        <div className="section-separator" />
        <label className="check-field">
          <input
            type="checkbox"
            checked={moon.locked}
            onChange={(e) => onChange({ locked: e.target.checked })}
          />
          Lock moon appearance
        </label>
        <button
          className="button full"
          disabled={moon.locked || planet.locked}
          onClick={onReroll}
        >
          <Icon name="dice" size={15} />
          Reroll moon surface
        </button>
        <div className="layout-actions moon-actions">
          <button
            className="button"
            onClick={onDuplicate}
            disabled={planet.notableMoons.length >= 64}
          >
            Duplicate moon
          </button>
          <button className="button" onClick={onDelete}>
            Delete moon
          </button>
        </div>
      </div>
    </>
  );
}
