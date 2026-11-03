import type { CSSProperties, ReactNode } from "react";

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    expand: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />,
    collapse: <path d="M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    dice: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="8" cy="8" r=".7" fill="currentColor" />
        <circle cx="16" cy="8" r=".7" fill="currentColor" />
        <circle cx="12" cy="12" r=".7" fill="currentColor" />
        <circle cx="8" cy="16" r=".7" fill="currentColor" />
        <circle cx="16" cy="16" r=".7" fill="currentColor" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    hidden: (
      <>
        <path d="m3 3 18 18M10.5 5.1c6.4-1 11.5 6.9 11.5 6.9a18 18 0 0 1-4 4M6.1 6.1A18 18 0 0 0 2 12s3.5 7 10 7c1.7 0 3.3-.5 4.7-1.2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    unlock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 7.5-2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 15V3m-4 4 4-4 4 4M4 16v5h16v-5" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
    orbit: (
      <>
        <ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l1.5 1.5M18.5 18.5 20 20M20 4l-1.5 1.5M5.5 18.5 4 20" />
      </>
    ),
    stars: (
      <>
        <path d="m9 3 1.8 5.2L16 10l-5.2 1.8L9 17l-1.8-5.2L2 10l5.2-1.8L9 3ZM18 13l1.2 3.8L23 18l-3.8 1.2L18 23l-1.2-3.8L13 18l3.8-1.2L18 13Z" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.orbit}
    </svg>
  );
}
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  onChange(value: [number, number]): void;
}) {
  return (
    <div className="range-field">
      <span>{label}</span>
      <div
        className="range-track"
        style={
          {
            "--range-low": `${((value[0] - min) / (max - min)) * 100}%`,
            "--range-high": `${((value[1] - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      >
        <input
          type="range"
          aria-label={`${label} minimum slider`}
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(event) =>
            onChange([Math.min(value[1], Number(event.target.value)), value[1]])
          }
        />
        <input
          type="range"
          aria-label={`${label} maximum slider`}
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(event) =>
            onChange([value[0], Math.max(value[0], Number(event.target.value))])
          }
        />
      </div>
      <div className="range-numbers">
        <input
          type="number"
          aria-label={`${label} minimum`}
          min={min}
          max={value[1]}
          step={step}
          value={value[0]}
          onChange={(event) => {
            const next =
              step === 1
                ? Math.round(Number(event.target.value))
                : Number(event.target.value);
            if (Number.isFinite(next))
              onChange([Math.max(min, Math.min(value[1], next)), value[1]]);
          }}
        />
        <span>—</span>
        <input
          type="number"
          aria-label={`${label} maximum`}
          min={value[0]}
          max={max}
          step={step}
          value={value[1]}
          onChange={(event) => {
            const next =
              step === 1
                ? Math.round(Number(event.target.value))
                : Number(event.target.value);
            if (Number.isFinite(next))
              onChange([value[0], Math.min(max, Math.max(value[0], next))]);
          }}
        />
      </div>
    </div>
  );
}
