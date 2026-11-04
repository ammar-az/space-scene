import type { Earthlike } from "../model/earthlike.ts";
import type { RockyTerrain } from "../model/schema.ts";
import type { GasSurface } from "../model/gas.ts";
import { seededRandom } from "./seededRandom.ts";

export type PlanetTextureOptions = {
  color: string;
  accentColor?: string;
  bandShadow?: string;
  earthlike?: Earthlike;
  type: "terrestrial" | "giant";
  intense: boolean;
  seed: string | number;
  detail?: "moon";
  cratering?: number;
  contrast?: number;
  terrain?: RockyTerrain;
  resolution?: 128 | 512 | 1024;
  gas?: GasSurface;
};

type Random = () => number;
type RGB = [number, number, number];

const textureCache = new Map<string, string>();
const textureCacheLimit = 64;

function parseColor(color: string): RGB {
  const hex = color.replace(/^#/, "");
  const expanded =
    hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
  if (!/^[\da-f]{6}$/i.test(expanded))
    throw new Error(`Expected a hex planet color, received ${color}`);
  return [0, 2, 4].map((index) =>
    parseInt(expanded.slice(index, index + 2), 16),
  ) as RGB;
}

function mix(a: RGB, b: RGB, amount: number): string {
  return `#${a
    .map((channel, index) =>
      Math.round(channel + (b[index] - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const n = (value: number) => value.toFixed(2);

function fieldPath(
  x: number,
  y: number,
  radius: number,
  random: Random,
): string {
  let points = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const distance = radius * (0.55 + random() * 0.6);
    return {
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
    };
  });
  // Subdivide with smaller offsets at each scale for irregular, fractured boundaries.
  for (let pass = 0; pass < 3; pass++) {
    points = points.flatMap((point, index) => {
      const next = points[(index + 1) % points.length];
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const offset = (random() - 0.5) * 0.5;
      return [
        point,
        {
          x: (point.x + next.x) / 2 - dy * offset,
          y: (point.y + next.y) / 2 + dx * offset,
        },
      ];
    });
  }
  return (
    points
      .map((point, index) => `${index ? "L" : "M"}${n(point.x)} ${n(point.y)}`)
      .join("") + "Z"
  );
}

function terrestrialSurface(primary: RGB, accent: RGB, random: Random): string {
  const fields = [
    [25, 35],
    [175, 25],
    [100, 135],
    [0, 245],
    [235, 230],
  ]
    .map(([x, y], index) => {
      const path = fieldPath(
        x + (random() - 0.5) * 70,
        y + (random() - 0.5) * 70,
        45 + random() * 40,
        random,
      );
      const color = mix(primary, accent, 0.18 + random() * 0.48);
      // Opaque regions avoid the layered color build-up of translucent patches.
      return `<path d="${path}" fill="${color}" filter="url(#${index % 3 === 0 ? "raised" : "recessed"})"/>`;
    })
    .join("");

  // Baseline cratering. Extreme crater density and irregular silhouettes are a later pass.
  const craters = Array.from({ length: 24 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 120;
    const x = 128 + Math.cos(angle) * distance;
    const y = 128 + Math.sin(angle) * distance;
    const radius = 2 + random() ** 2 * 11;
    const foreshortening = Math.max(0.3, Math.sqrt(1 - (distance / 128) ** 2));
    const dark = mix(primary, accent, 0.65 + random() * 0.35);
    const rim = mix(primary, [255, 180, 48], 0.12);
    const opacity = 0.18 + random() * 0.45;
    return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n((angle * 180) / Math.PI)}) scale(${n(foreshortening)} 1)">
            <circle r="${n(radius)}" fill="${dark}" opacity="${n(opacity)}"/>
            <circle r="${n(radius * 0.64)}" fill="${mix(accent, [0, 0, 0], 0.25)}" opacity="${n(opacity * 0.3)}"/>
            <path d="M${n(-radius)} 0A${n(radius)} ${n(radius)} 0 0 0 ${n(radius)} 0" fill="none" stroke="${rim}" stroke-width=".8" opacity="${n(opacity * 0.5)}"/>
        </g>`;
  }).join("");

  return `<g filter="url(#terrain)">${fields}</g>${craters}`;
}

function rockFilters(seed: number, azimuth: number): string {
  const relief = (
    id: string,
    scale: number,
  ) => `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" result="height"/>
        <feDiffuseLighting in="height" surfaceScale="${scale}" diffuseConstant="1.22" lighting-color="#fff" result="light">
            <feDistantLight azimuth="${azimuth}" elevation="55"/>
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="1.06" k2="0" k3="0" k4="0"/>
        <feComposite in2="SourceAlpha" operator="in"/>
        <feGaussianBlur stdDeviation=".35"/>
    </filter>`;
  return `${relief("raised", 2.2)}${relief("recessed", -2.2)}
    <filter id="rock-grit" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="3" seed="${seed}"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
            <feFuncR type="linear" slope="1.6" intercept="-.3"/>
            <feFuncG type="linear" slope="1.6" intercept="-.3"/>
            <feFuncB type="linear" slope="1.6" intercept="-.3"/>
            <feFuncA type="linear" slope="0" intercept="1"/>
        </feComponentTransfer>
    </filter>`;
}

export function giantArtwork(
  primary: RGB,
  accent: RGB,
  intense: boolean,
  random: Random,
  shadow: RGB = [6, 15, 32],
) {
  const bands: {
    y: number;
    thickness: number;
    curve: number;
    wave: number;
    color: string;
    opacity: number;
    rim?: { color: string; width: number };
  }[] = [];
  let y = -40;
  while (y < 300) {
    const thickness = intense ? 3 + random() * 12 : 10 + random() * 25;
    const curve = (y - 128) * 0.16;
    const wave = (random() - 0.5) * (intense ? 18 : 8);
    const palette = random();
    const color =
      palette < 0.3
        ? mix(primary, shadow, intense ? 0.68 : 0.16)
        : mix(primary, accent, 0.25 + random() * 0.75);
    const band: (typeof bands)[number] = {
      y,
      thickness,
      curve,
      wave,
      color,
      opacity: intense ? 0.5 + random() * 0.4 : 0.15 + random() * 0.22,
    };
    if (intense && random() > 0.4) {
      band.rim = {
        color: mix(accent, [255, 255, 255], 0.18),
        width: 0.5 + random(),
      };
    }
    bands.push(band);
    y += thickness;
  }

  const storms = intense
    ? Array.from({ length: 3 }, () => {
        const x = 60 + random() * 140;
        const y = 60 + random() * 140;
        const radius = 10 + random() * 14;
        const rings = Array.from({ length: 5 }, (_, index) => {
          const scale = 1 - index * 0.17;
          const color =
            index % 2
              ? mix(primary, [7, 17, 34], 0.6)
              : mix(primary, accent, 0.55);
          return { radius: radius * scale, color };
        });
        return { x, y, rings, rotation: (random() - 0.5) * 24 };
      })
    : [];

  const rotation = (random() - 0.5) * 18;
  return { bands, storms, rotation };
}

function giantSurface(
  primary: RGB,
  accent: RGB,
  intense: boolean,
  random: Random,
  shadow?: RGB,
): string {
  const artwork = giantArtwork(primary, accent, intense, random, shadow);
  const bands = artwork.bands
    .map(({ y, thickness, curve, wave, color, opacity, rim }) => {
      const path = `M-40 ${n(y)}Q64 ${n(y + curve + wave)} 128 ${n(y + curve)}T296 ${n(y)}L296 ${n(y + thickness)}Q192 ${n(y + curve + thickness)} 128 ${n(y + curve + thickness)}T-40 ${n(y + thickness)}Z`;
      return (
        `<path d="${path}" fill="${color}" opacity="${n(opacity)}"/>` +
        (rim
          ? `<path d="M-40 ${n(y + thickness)}Q96 ${n(y + curve + thickness + wave)} 160 ${n(y + curve + thickness)}T296 ${n(y + thickness)}" fill="none" stroke="${rim.color}" stroke-width="${n(rim.width)}" opacity=".55"/>`
          : "")
      );
    })
    .join("");
  const storms = artwork.storms
    .map(
      ({ x, y, rotation, rings }) =>
        `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotation)})">${rings
          .map(
            ({ radius, color }) =>
              `<ellipse rx="${n(radius)}" ry="${n(radius * 0.36)}" fill="${color}" opacity=".65"/>`,
          )
          .join("")}</g>`,
    )
    .join("");
  return `<g transform="rotate(${n(artwork.rotation)} 128 128)" filter="url(#flow)">${bands}${storms}</g>`;
}

/** Cached SVG source. PlanetSurface owns its image URL and applies lighting separately. */
export function generatePlanet(
  options: PlanetTextureOptions,
  lightRotation = 0,
): string {
  const primary = parseColor(options.color);
  const accent = options.accentColor
    ? parseColor(options.accentColor)
    : parseColor(mix(primary, [10, 15, 24], 0.6));
  // Small angle steps keep relief sun-facing without creating a new image on every resize pixel.
  const azimuth =
    (((Math.round((180 + lightRotation) / 5) * 5) % 360) + 360) % 360;
  const key = JSON.stringify([
    primary,
    accent,
    options.type,
    options.intense,
    options.seed,
    options.bandShadow,
    ...(options.type === "terrestrial" ? [azimuth] : []),
  ]);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const random = seededRandom(options.seed);
  const noiseSeed = Math.floor(random() * 100000);
  const surface =
    options.type === "terrestrial"
      ? terrestrialSurface(primary, accent, random)
      : giantSurface(
          primary,
          accent,
          options.intense,
          random,
          options.bandShadow ? parseColor(options.bandShadow) : undefined,
        );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <defs>${options.type === "terrestrial" ? `\n            ${rockFilters(noiseSeed + 2, azimuth)}` : ""}
            <filter id="terrain" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="3" seed="${noiseSeed}" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="flow" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency=".012 .07" numOctaves="3" seed="${noiseSeed}" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="${options.intense ? 9 : 5}" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="${options.type === "terrestrial" ? ".16" : ".035 .18"}" numOctaves="3" seed="${noiseSeed + 1}"/>
                <feColorMatrix type="saturate" values="0"/>
            </filter>
        </defs>
        <rect width="256" height="256" fill="${mix(primary, primary, 0)}"/>
        ${surface}${options.type === "terrestrial" ? '\n        <rect width="256" height="256" filter="url(#rock-grit)" opacity=".35" style="mix-blend-mode:soft-light"/>' : ""}
        <rect width="256" height="256" filter="url(#grain)" opacity="${options.type === "terrestrial" ? ".14" : options.intense ? ".16" : ".24"}" style="mix-blend-mode:soft-light"/>
    </svg>`;
  if (textureCache.size >= textureCacheLimit) {
    const oldest = textureCache.keys().next().value;
    if (oldest !== undefined) textureCache.delete(oldest);
  }
  textureCache.set(key, svg);
  return svg;
}
