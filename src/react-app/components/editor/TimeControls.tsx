import type { SceneModel } from "../../scene/model/schema.ts";
import {
  rotationHoursPerSecond,
  orbitDaysPerSecond,
} from "../../scene/model/time.ts";
import { Slider } from "./controls.tsx";
export default function TimeControls({
  motion,
  onChange,
}: {
  motion: SceneModel["motion"];
  onChange(patch: Partial<SceneModel["motion"]>): void;
}) {
  const hours = rotationHoursPerSecond(motion.rotationRate),
    days = orbitDaysPerSecond(motion.orbitRate);
  return (
    <>
      <div className="field-heading">RENDER TIME</div>
      <label className="rate-unit">
        <span>Free body rotation</span>
        <select
          aria-label="Rotation render units"
          value={motion.rotationRate.unit}
          onChange={(e) =>
            onChange({
              rotationRate: {
                ...motion.rotationRate,
                unit: e.target
                  .value as SceneModel["motion"]["rotationRate"]["unit"],
              },
            })
          }
        >
          <option value="hour/hour">hour / hour</option>
          <option value="hour/minute">hour / minute</option>
          <option value="hour/second">hour / second</option>
        </select>
      </label>
      <Slider
        label="Rotation rate multiplier"
        value={motion.rotationRate.multiplier}
        min={0.1}
        max={10}
        step={0.1}
        precise
        unit="×"
        onChange={(multiplier) =>
          onChange({ rotationRate: { ...motion.rotationRate, multiplier } })
        }
      />
      <p className="field-note">
        {Number(hours.toPrecision(4))} hours per second. A 24-hour rotation
        takes {Number((24 / hours).toPrecision(4))} seconds at 1× speed.
      </p>
      <label className="rate-unit">
        <span>Planet orbits</span>
        <select
          aria-label="Orbit render units"
          value={motion.orbitRate.unit}
          onChange={(e) =>
            onChange({
              orbitRate: {
                ...motion.orbitRate,
                unit: e.target
                  .value as SceneModel["motion"]["orbitRate"]["unit"],
              },
            })
          }
        >
          <option value="day/minute">day / minute</option>
          <option value="day/second">day / second</option>
        </select>
      </label>
      <Slider
        label="Orbit rate multiplier"
        value={motion.orbitRate.multiplier}
        min={1}
        max={100}
        step={1}
        precise
        unit="×"
        onChange={(multiplier) =>
          onChange({
            orbitRate: {
              ...motion.orbitRate,
              multiplier: Math.round(multiplier),
            },
          })
        }
      />
      <p className="field-note">
        {Number(days.toPrecision(4))} days per second.
      </p>
      <label className="rate-unit">
        <span>Named moon orbits</span>
        <select
          aria-label="Moon orbit render units"
          value={motion.moonRate.unit}
          onChange={(e) =>
            onChange({
              moonRate: {
                ...motion.moonRate,
                unit: e.target
                  .value as SceneModel["motion"]["moonRate"]["unit"],
              },
            })
          }
        >
          <option value="day/minute">day / minute</option>
          <option value="day/second">day / second</option>
        </select>
      </label>
      <Slider
        label="Moon orbit rate multiplier"
        value={motion.moonRate.multiplier}
        min={1}
        max={100}
        step={1}
        precise
        unit="×"
        onChange={(multiplier) =>
          onChange({
            moonRate: {
              ...motion.moonRate,
              multiplier: Math.round(multiplier),
            },
          })
        }
      />
      <p className="field-note">
        Tidally locked moons rotate with their orbit. Free rotation uses the
        body rotation rate.
      </p>
    </>
  );
}
