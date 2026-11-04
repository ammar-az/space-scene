import { NumberField } from "./SizeControls.tsx";
export default function PhysicalValueControl({
  label,
  unit,
  value,
  min = 0.000001,
  max = 1e12,
  initialMax = 10000,
  km = false,
  kmMultiplier = 1000000,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  initialMax?: number;
  km?: boolean;
  kmMultiplier?: number;
  onChange(value: number): void;
}) {
  const low = Math.min(0.1, Math.pow(10, Math.floor(Math.log10(value))));
  const high = Math.min(
    max,
    Math.max(initialMax, Math.pow(10, Math.ceil(Math.log10(value)))),
  );
  const commit = (raw: number) => {
    const next = Math.max(min, Math.min(max, Math.round(raw * 1e6) / 1e6));
    onChange(next);
    return next;
  };
  return (
    <div className="size-control">
      <div className="size-heading">
        <span>{label}</span>
        <span>{unit}</span>
      </div>
      <input
        className="log-slider"
        type="range"
        aria-label={label}
        min={0}
        max={1000}
        step={1}
        value={(Math.log(value / low) / Math.log(high / low)) * 1000}
        onChange={(e) =>
          commit(low * Math.pow(high / low, Number(e.target.value) / 1000))
        }
      />
      <div className={km ? "size-inputs" : "physical-number"}>
        <label>
          <span>{unit}</span>
          <NumberField
            label={`${label} value`}
            value={value}
            min={min}
            max={max}
            step={0.000001}
            onCommit={commit}
          />
        </label>
        {km && (
          <label>
            <span>km</span>
            <NumberField
              label={`${label} kilometres`}
              value={value * kmMultiplier}
              min={min * kmMultiplier}
              max={max * kmMultiplier}
              step={1}
              onCommit={(raw) => commit(raw / kmMultiplier) * kmMultiplier}
            />
          </label>
        )}
      </div>
    </div>
  );
}
