import type { StarPalette } from "../data/starAppearance.ts";

const cache = new Map<string, string>();
const channels = (hex: string) => [1, 3, 5].map(index => (parseInt(hex.slice(index, index + 2), 16) / 255).toFixed(3));

/** Static granulation while the GPU initializes or is unavailable; no painted spots or filaments. */
export function generateStarTexture(palette: StarPalette, seed = 1871): string {
    const key = JSON.stringify([palette.color, palette.highlight, palette.shadow, seed]);
    const cached = cache.get(key);
    if (cached) return cached;
    const primary = channels(palette.color), bright = channels(palette.highlight), dark = channels(palette.shadow);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 512 512" preserveAspectRatio="none">
        <defs><filter id="granulation" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feTurbulence type="turbulence" baseFrequency=".3" numOctaves="3" seed="${seed}"/>
            <feColorMatrix type="saturate" values="0"/>
            <feComponentTransfer>
                <feFuncR type="table" tableValues="${dark[0]} ${primary[0]} ${bright[0]}"/>
                <feFuncG type="table" tableValues="${dark[1]} ${primary[1]} ${bright[1]}"/>
                <feFuncB type="table" tableValues="${dark[2]} ${primary[2]} ${bright[2]}"/>
                <feFuncA type="linear" slope="0" intercept="1"/>
            </feComponentTransfer>
        </filter></defs>
        <rect width="512" height="512" fill="${palette.color}"/>
        <rect width="512" height="512" filter="url(#granulation)" opacity=".8"/>
    </svg>`;
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, svg);
    return svg;
}
