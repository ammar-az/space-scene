import { useCallback } from "react";

/** Keep Blob URLs owned by mounted images, rather than by the SVG source cache. */
export default function useSvgTexture(svg: string) {
    return useCallback((image: HTMLImageElement | null) => {
        if (!image) return;

        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        image.src = url;

        // React also runs ref cleanup when the source changes and in Strict Mode.
        return () => {
            image.removeAttribute("src");
            URL.revokeObjectURL(url);
        };
    }, [svg]);
}
