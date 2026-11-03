import { giantArtwork } from "./planetTextures.ts";
import type { PlanetTextureOptions } from "./planetTextures.ts";
import { seededRandom } from "./seededRandom.ts";
import { getPlanetRotation } from "./planetRotation.ts";
import type { PlanetMap } from "./planetMaps.ts";
import type { GiantStormProfile } from "./giantStorms.ts";

type RGB = [number, number, number];
const worldWidth = 1024;
const icyGradientOpacity = 0.2;
const tau = Math.PI * 2;
const n = (value: number) => value.toFixed(3);
const rgb = (hex: string): RGB => {
    const raw = hex.replace("#", "");
    const full = raw.length === 3 ? [...raw].map(c => c + c).join("") : raw;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as RGB;
};

/** Latitude belts stay parallel; the original SVG flow filter supplies local cloud detail. */
function belt(y: number, reverse = false) {
    const start = reverse ? worldWidth * 2 : -worldWidth;
    const end = reverse ? -worldWidth : worldWidth * 2;
    return `${reverse ? "L" : "M"}${n(start)} ${n(y)}L${n(end)} ${n(y)}`;
}

export function generateGiantMapSource(options: PlanetTextureOptions, includeStorms = true) {
    const primary = rgb(options.color);
    const accent = options.accentColor ? rgb(options.accentColor) : primary.map((c, i) => Math.round(c + ([10, 15, 24][i] - c) * 0.6)) as RGB;
    // Exactly the same random stream, colors, widths, opacity and storm rings as the original SVG.
    const random = seededRandom(options.seed);
    const noiseSeed = Math.floor(random() * 100000);
    const artwork = giantArtwork(primary, accent, options.intense, random);
    const phase = getPlanetRotation(options.seed).phase;
    // A separate stream adds broad icy color drift without changing belts, tilt or other families.
    const gradientRandom = seededRandom(`${options.seed}:icy-gradients`);
    const gradientDefs: string[] = [];
    const gradientPaths: string[] = [];
    const bands = artwork.bands.map(({ y, thickness, color, opacity, rim }, index) => {
        const path = belt(y) + belt(y + thickness, true) + "Z";
        if (!options.intense) {
            const phaseA = gradientRandom() * tau, phaseB = gradientRandom() * tau;
            const stops = Array.from({ length: 33 }, (_, i) => {
                const angle = i / 32 * tau;
                const gray = (0.5 + 0.32 * Math.sin(angle + phaseA) + 0.1 * Math.sin(angle * 2 + phaseB)) * 100;
                return `<stop offset="${i / 32}" stop-color="rgb(${n(gray)}% ${n(gray)}% ${n(gray)}%)"/>`;
            }).join("");
            // Longitude is horizontal in the map: color varies along a band, not across its height.
            gradientDefs.push(`<linearGradient id="ice-${index}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1024" y2="0" spreadMethod="repeat">${stops}</linearGradient>`);
            gradientPaths.push(`<path d="${path}" fill="url(#ice-${index})"/>`);
        }
        return `<path d="${path}" fill="${color}" opacity="${opacity * (options.contrast ?? 1)}"/>` + (rim
            ? `<path d="${belt(y + thickness)}" fill="none" stroke="${rim.color}" stroke-width="${rim.width}" opacity=".55"/>` : "");
    }).join("");
    const stormProfiles: GiantStormProfile[] = [];
    const storms = artwork.storms.flatMap(storm => {
        const latitudeScale = Math.sqrt(1 - ((128 - storm.y) / 128) ** 2);
        const longitude = Math.asin((storm.x - 128) / (128 * latitudeScale));
        const center = ((0.5 + (longitude + phase) / tau) % 1) * worldWidth;
        const scaleX = worldWidth / (tau * 128 * latitudeScale * Math.cos(longitude));
        const radius = storm.rings[0].radius;
        stormProfiles.push({ u: center / worldWidth, v: storm.y / 256,
            radiusU: radius * scaleX / worldWidth, radiusV: radius * 0.36 / 256, rotation: storm.rotation * Math.PI / 180 });
        // Repeat the same material around the back without shrinking/distorting the visible storm rings.
        return [-2, -1, 0, 1, 2, 3].map(copy => `<g transform="translate(${n(center + copy * worldWidth / 2)} ${n(storm.y)}) scale(${n(scaleX)} 1) rotate(${n(storm.rotation)})">
            ${storm.rings.map(({ radius, color }) => `<ellipse rx="${n(radius)}" ry="${n(radius * 0.36)}" fill="${color}" opacity=".65"/>`).join("")}
        </g>`);
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 256" preserveAspectRatio="none">
        <defs>
            ${gradientDefs.join("")}
            <filter id="flow" filterUnits="userSpaceOnUse" x="-1024" y="-40" width="3072" height="336">
                <feTurbulence x="0" y="0" width="1024" height="256" type="fractalNoise" baseFrequency=".012 .07" numOctaves="3" seed="${noiseSeed}" stitchTiles="stitch" result="tile"/>
                <feTile in="tile" x="-1024" y="-40" width="3072" height="336" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="${options.intense ? 9 : 5}" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="256">
                <feTurbulence type="fractalNoise" baseFrequency=".035 .18" numOctaves="3" seed="${noiseSeed + 1}" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0"/>
            </filter>
        </defs>
        <rect width="1024" height="256" fill="${options.color}"/>
        <g filter="url(#flow)">${bands}${includeStorms ? storms : ""}</g>
        ${gradientPaths.length ? `<g filter="url(#flow)" opacity="${icyGradientOpacity * (options.contrast ?? 1)}" style="mix-blend-mode:soft-light">${gradientPaths.join("")}</g>` : ""}
        <rect width="1024" height="256" filter="url(#grain)" opacity="${options.intense ? ".16" : ".24"}" style="mix-blend-mode:soft-light"/>
    </svg>`;
    return { svg, axisTilt: artwork.rotation * Math.PI / 180, stormProfiles };
}

export async function generateGiantMap(options: PlanetTextureOptions): Promise<PlanetMap> {
    const { svg, axisTilt, stormProfiles } = generateGiantMapSource(options, false);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    try {
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 1024; canvas.height = 512;
        try {
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Giant material rasterization unavailable");
            context.drawImage(image, 0, 0);
            const pixels = new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data);
            // Alpha is terrain height in our material format, not image opacity.
            for (let i = 3; i < pixels.length; i += 4) pixels[i] = 128;
            return { width: canvas.width, height: canvas.height, pixels, equalArea: true, axisTilt, storms: stormProfiles };
        } finally { canvas.width = 0; canvas.height = 0; }
    } finally { image.removeAttribute("src"); URL.revokeObjectURL(url); }
}
