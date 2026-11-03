import { useEffect, useRef } from "react";
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";

/** Native change commits a color; React's onChange also handles every picker preview. */
export function ColorInput({
  value,
  onCommit,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "onInput"
> & {
  value: string;
  onCommit(value: string): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.value = value;
  }, [value]);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const commit = () => {
      if (element.value.toLowerCase() !== value.toLowerCase())
        onCommit(element.value);
    };
    element.addEventListener("change", commit);
    return () => element.removeEventListener("change", commit);
  }, [onCommit, value]);
  return <input {...props} ref={input} type="color" defaultValue={value} />;
}

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
    camera: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <circle cx="12" cy="13" r="4" />
        <path d="m8 6 1-3h6l1 3" />
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
  precise = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precise?: boolean;
  onChange(value: number): void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        {precise ? (
          <input
            className="precise-value"
            type="number"
            aria-label={`${label} value`}
            key={value}
            defaultValue={Number(value.toFixed(4))}
            min={min}
            max={max}
            step={step}
            onBlur={(event) => {
              const next = event.currentTarget.valueAsNumber;
              if (Number.isFinite(next))
                onChange(Math.max(min, Math.min(max, next)));
              else event.currentTarget.value = String(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        ) : (
          <output>
            {Number(value.toFixed(2))}
            {unit}
          </output>
        )}
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
  logarithmic = false,
  onChange,
}: {
  label: string;
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  logarithmic?: boolean;
  onChange(value: [number, number]): void;
}) {
  const sliderMin = logarithmic ? 0 : min,
    sliderMax = logarithmic ? 1000 : max;
  const toSlider = (value: number) =>
    logarithmic ? (Math.log(value / min) / Math.log(max / min)) * 1000 : value;
  const fromSlider = (value: number) =>
    logarithmic
      ? Math.round(min * Math.pow(max / min, value / 1000) * 100) / 100
      : value;
  return (
    <div className="range-field">
      <span>{label}</span>
      <div
        className="range-track"
        style={
          {
            "--range-low": `${((toSlider(value[0]) - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
            "--range-high": `${((toSlider(value[1]) - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
          } as CSSProperties
        }
      >
        <input
          type="range"
          aria-label={`${label} minimum slider`}
          min={sliderMin}
          max={sliderMax}
          step={logarithmic ? 1 : step}
          value={toSlider(value[0])}
          onChange={(event) =>
            onChange([
              Math.min(value[1], fromSlider(Number(event.target.value))),
              value[1],
            ])
          }
        />
        <input
          type="range"
          aria-label={`${label} maximum slider`}
          min={sliderMin}
          max={sliderMax}
          step={logarithmic ? 1 : step}
          value={toSlider(value[1])}
          onChange={(event) =>
            onChange([
              value[0],
              Math.max(value[0], fromSlider(Number(event.target.value))),
            ])
          }
        />
      </div>
      <div className="range-numbers">
        <input
          type="number"
          aria-label={`${label} minimum`}
          key={`low-${value[0]}`}
          defaultValue={value[0]}
          min={min}
          max={value[1]}
          step={step}
          onBlur={(event) => {
            const parsed = event.currentTarget.valueAsNumber;
            const next = Number.isFinite(parsed)
              ? step === 1
                ? Math.round(parsed)
                : parsed
              : value[0];
            const canonical = logarithmic ? Math.round(next * 100) / 100 : next;
            const bounded = Math.max(min, Math.min(value[1], canonical));
            event.currentTarget.value = String(bounded);
            onChange([bounded, value[1]]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span>—</span>
        <input
          type="number"
          aria-label={`${label} maximum`}
          key={`high-${value[1]}`}
          defaultValue={value[1]}
          min={value[0]}
          max={max}
          step={step}
          onBlur={(event) => {
            const parsed = event.currentTarget.valueAsNumber;
            const next = Number.isFinite(parsed)
              ? step === 1
                ? Math.round(parsed)
                : parsed
              : value[1];
            const canonical = logarithmic ? Math.round(next * 100) / 100 : next;
            const bounded = Math.min(max, Math.max(value[0], canonical));
            event.currentTarget.value = String(bounded);
            onChange([value[0], bounded]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
