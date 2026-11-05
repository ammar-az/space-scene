import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { starPresets } from "../../data/starPresets.ts";
import { freshSeed, objectId } from "../../scene/model/scene.ts";
import {
  configurePlanet,
  configureSystem,
  newPlanetDraft,
  newSystemDraft,
  planetKindNames,
} from "../../scene/model/creation.ts";
import type { PlanetDraft, PlanetKind } from "../../scene/model/creation.ts";
import type { Planet, SceneModel } from "../../scene/model/schema.ts";
import { Icon, Slider } from "./controls.tsx";

function Dialog({
  title,
  action,
  children,
  onClose,
  onSubmit,
  summary,
}: {
  title: string;
  action: string;
  children: ReactNode;
  summary: string;
  onClose(): void;
  onSubmit(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="creation-dialog"
      aria-labelledby="creation-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, a[href], [tabindex]",
          ),
        ].filter(
          (control) =>
            !control.matches(":disabled, [tabindex='-1']") &&
            control.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSubmit();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Check the settings and try again.",
            );
          }
        }}
      >
        <header className="creation-header">
          <div>
            <Icon name="planet" size={30} />
            <h2 id="creation-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close creation dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="creation-content">{children}</div>
        <footer className="creation-footer">
          <div>
            <span>{summary}</span>
            {error && (
              <p role="alert" className="creation-error">
                {error}
              </p>
            )}
          </div>
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            {action}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
}: {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  return (
    <label className="creation-field">
      <span>{label}</span>
      <input
        required
        type="number"
        value={Number.isNaN(value) ? "" : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  return (
    <label className="check-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function PlanetCreationDialog({
  scene,
  onClose,
  onCreate,
}: {
  scene: SceneModel;
  onClose(): void;
  onCreate(planet: Planet): void;
}) {
  const [draft, setDraft] = useState(() => newPlanetDraft(scene));
  const change = (patch: Partial<PlanetDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const rocky = draft.kind === "rocky" || draft.kind === "earthlike";
  return (
    <Dialog
      title="New planet"
      action="Create planet"
      summary="Added to the current system"
      onClose={onClose}
      onSubmit={() =>
        onCreate(
          configurePlanet(
            draft,
            objectId(),
            freshSeed(),
            scene.planets.length,
            scene.sun.position,
          ),
        )
      }
    >
      <div className="creation-grid">
        <fieldset>
          <legend>Planet</legend>
          <label className="creation-field">
            <span>Name</span>
            <input
              autoFocus
              required
              maxLength={80}
              value={draft.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label className="creation-field">
            <span>Type</span>
            <select
              aria-label="Type"
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as PlanetKind;
                change({
                  kind,
                  diameterKm:
                    kind === "gas" ? 120000 : kind === "icy" ? 50000 : 12760,
                  rotationHours: kind === "gas" ? 10 : 24,
                  rings: kind === "gas" ? 0.35 : 0,
                  atmosphere: kind === "earthlike",
                  clouds: kind === "earthlike",
                });
              }}
            >
              {Object.entries(planetKindNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <NumberInput
            label="Diameter (km)"
            value={draft.diameterKm}
            min={10}
            max={1e9}
            step={10}
            onChange={(diameterKm) => change({ diameterKm })}
          />
          <div className="creation-row">
            <NumberInput
              label="Rotation (hours)"
              value={draft.rotationHours}
              min={0.000001}
              max={1e12}
              onChange={(rotationHours) => change({ rotationHours })}
            />
            <NumberInput
              label="Axial tilt (°)"
              value={draft.tilt}
              min={-180}
              max={180}
              onChange={(tilt) => change({ tilt })}
            />
          </div>
          <div className="creation-row">
            <Check
              label="Atmosphere"
              checked={draft.atmosphere}
              disabled={!rocky}
              onChange={(atmosphere) => change({ atmosphere })}
            />
            <Check
              label="Clouds"
              checked={draft.clouds}
              disabled={!rocky}
              onChange={(clouds) => change({ clouds })}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>Orbit & satellites</legend>
          <div className="creation-row">
            <NumberInput
              label="Orbit X (million km)"
              value={draft.radiusX}
              min={0.000001}
              max={1e9}
              onChange={(radiusX) => change({ radiusX })}
            />
            <NumberInput
              label="Orbit Z (million km)"
              value={draft.radiusZ}
              min={0.000001}
              max={1e9}
              onChange={(radiusZ) => change({ radiusZ })}
            />
          </div>
          <p className="field-note">
            Equal axes make a circle. The orbit starts centered on the star.
          </p>
          <div className="creation-row">
            <NumberInput
              label="Orbital period (days)"
              value={draft.periodDays}
              min={0.000001}
              max={1e12}
              onChange={(periodDays) => change({ periodDays })}
            />
            <NumberInput
              label="Inclination (°)"
              value={draft.inclination}
              min={-80}
              max={80}
              onChange={(inclination) => change({ inclination })}
            />
          </div>
          <NumberInput
            label="Named moons"
            value={draft.moons}
            max={16}
            step={1}
            onChange={(moons) => change({ moons })}
          />
          <Slider
            label="Ring amount"
            value={draft.rings * 100}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => change({ rings: value / 100 })}
          />
        </fieldset>
      </div>
    </Dialog>
  );
}

export function SystemCreationDialog({
  onClose,
  onCreate,
}: {
  onClose(): void;
  onCreate(scene: SceneModel): void;
}) {
  const [draft, setDraft] = useState(() => newSystemDraft(freshSeed()));
  const count = Object.values(draft.counts).reduce((sum, n) => sum + n, 0);
  return (
    <Dialog
      title="New solar system"
      action="Create system"
      summary="Replaces the current scene. Export JSON to keep it."
      onClose={onClose}
      onSubmit={() => onCreate(configureSystem(draft))}
    >
      <div className="creation-grid">
        <fieldset>
          <legend>System & star</legend>
          <label className="creation-field">
            <span>System name</span>
            <input
              autoFocus
              required
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="creation-field">
            <span>Star type</span>
            <select
              aria-label="Star type"
              value={draft.starPreset}
              onChange={(e) => {
                const preset = starPresets.find(
                  (p) => p.id === e.target.value,
                )!;
                setDraft({
                  ...draft,
                  starPreset: preset.id,
                  starDiameterKm: preset.appearance.diameter * 10000,
                });
              }}
            >
              {starPresets.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <NumberInput
            label="Star diameter (km)"
            value={draft.starDiameterKm}
            min={100}
            max={1e13}
            step={100}
            onChange={(starDiameterKm) =>
              setDraft({ ...draft, starDiameterKm })
            }
          />
          <NumberInput
            label="Generation seed"
            value={draft.seed}
            max={2 ** 32 - 1}
            step={1}
            onChange={(seed) => setDraft({ ...draft, seed })}
          />
          <label className="creation-field">
            <span>Starting view</span>
            <select
              aria-label="Starting view"
              value={draft.view}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  view: e.target.value as SceneModel["view"]["preset"],
                })
              }
            >
              <option value="centered">Sun centered</option>
              <option value="overhead">Bird’s-eye</option>
              <option value="offset">Sun at side</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>
            Planets <small>{Number.isFinite(count) ? count : 0} / 64</small>
          </legend>
          <div className="creation-row">
            {(["rocky", "earthlike"] as const).map((kind) => (
              <NumberInput
                key={kind}
                label={planetKindNames[kind]}
                value={draft.counts[kind]}
                max={32}
                step={1}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    counts: { ...draft.counts, [kind]: value },
                  })
                }
              />
            ))}
          </div>
          <div className="creation-row">
            {(["gas", "icy"] as const).map((kind) => (
              <NumberInput
                key={kind}
                label={planetKindNames[kind]}
                value={draft.counts[kind]}
                max={32}
                step={1}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    counts: { ...draft.counts, [kind]: value },
                  })
                }
              />
            ))}
          </div>
          <NumberInput
            label="Named moons per planet"
            value={draft.moons}
            max={16}
            step={1}
            onChange={(moons) => setDraft({ ...draft, moons })}
          />
          <Slider
            label="Ring probability"
            value={draft.ringChance * 100}
            min={0}
            max={100}
            unit="%"
            onChange={(value) =>
              setDraft({ ...draft, ringChance: value / 100 })
            }
          />
          <Check
            label="Asteroid belt"
            checked={draft.asteroidBelt}
            onChange={(asteroidBelt) => setDraft({ ...draft, asteroidBelt })}
          />
        </fieldset>
        <fieldset>
          <legend>Orbit range</legend>
          <div className="creation-row">
            <NumberInput
              label="Innermost (million km)"
              value={draft.innerOrbit}
              min={0.000001}
              max={1e9}
              onChange={(innerOrbit) => setDraft({ ...draft, innerOrbit })}
            />
            <NumberInput
              label="Outermost (million km)"
              value={draft.outerOrbit}
              min={draft.innerOrbit}
              max={1e9}
              onChange={(outerOrbit) => setDraft({ ...draft, outerOrbit })}
            />
          </div>
          <p className="field-note">
            Planets are spread across this physical distance range.
          </p>
        </fieldset>
        <fieldset>
          <legend>Display scaling</legend>
          <Slider
            label="Planet size compression"
            value={draft.sizeCompression * 100}
            min={0}
            max={100}
            unit="%"
            onChange={(value) =>
              setDraft({ ...draft, sizeCompression: value / 100 })
            }
          />
          <p className="field-note">
            0% keeps size ratios. 100% makes planets equal in size.
          </p>
          <Slider
            label="Orbit distance compression"
            value={draft.distanceCompression * 100}
            min={0}
            max={100}
            unit="%"
            onChange={(value) =>
              setDraft({ ...draft, distanceCompression: value / 100 })
            }
          />
          <p className="field-note">
            Higher values bring distant orbits closer. Physical values are
            preserved.
          </p>
        </fieldset>
      </div>
    </Dialog>
  );
}
