import { useEffect, useRef } from "react";
import type { Background } from "../../scene/model/schema.ts";
import {
  loadDeepSkyCatalogue,
  chooseDeepSky,
} from "../../scene/data/deepSky.ts";
import { prepareDeepSky, paintDeepSky } from "../../scene/utils/deepSky.ts";
import { generateStarfield } from "../../scene/utils/starfield.ts";
import type { SceneClock } from "../../scene/rendering/clock.ts";

/** Stays mounted while pages change, retaining the same stars and shared animation time. */
export default function Starfield({
  settings,
  clock,
}: {
  settings: Background;
  clock: SceneClock;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current,
      context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    const base = document.createElement("canvas"),
      paint = base.getContext("2d", { alpha: false })!;
    const deepSky = settings.deepSky ?? {
      visible: true,
      seed: settings.seed,
      density: 1,
      size: 1,
      brightness: 1,
    };
    let alive = true;
    let images: HTMLCanvasElement[] = [];
    let width = 0,
      height = 0,
      frame = 0;
    let stars: ReturnType<typeof generateStarfield> = [];
    function rebuild() {
      if (!canvas || !context) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = base.width = Math.max(1, Math.round(width * ratio));
      canvas.height = base.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint.fillStyle = "#020307";
      paint.fillRect(0, 0, width, height);
      if (settings.visible && deepSky.visible)
        paintDeepSky(
          paint,
          width,
          height,
          deepSky.seed,
          images,
          true,
          deepSky.size,
          deepSky.brightness,
        );
      const scale = Math.sqrt(settings.density);
      stars = settings.visible
        ? generateStarfield(
            width * scale,
            height * scale,
            settings.seed,
            36,
            settings.clusterFrequency ?? 1,
            settings.largeStarFrequency ?? 1,
          ).map((star) => ({
            ...star,
            x: star.x / scale,
            y: star.y / scale,
            radius: star.radius * settings.size,
          }))
        : [];
      for (const star of stars) {
        const color = star.color
          .map((value) => Math.round(value * 255))
          .join(",");
        if (star.standout) {
          const halo = paint.createRadialGradient(
            star.x,
            star.y,
            0,
            star.x,
            star.y,
            star.radius * 4,
          );
          halo.addColorStop(
            0,
            `rgba(${color},${Math.min(1, 0.16 * settings.brightness)})`,
          );
          halo.addColorStop(
            0.3,
            `rgba(${color},${Math.min(1, 0.04 * settings.brightness)})`,
          );
          halo.addColorStop(1, `rgba(${color},0)`);
          paint.fillStyle = halo;
          paint.fillRect(
            star.x - star.radius * 4,
            star.y - star.radius * 4,
            star.radius * 8,
            star.radius * 8,
          );
        }
        paint.fillStyle = `rgba(${color},${Math.min(1, star.opacity * settings.brightness)})`;
        paint.beginPath();
        paint.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        paint.fill();
      }
      context.drawImage(base, 0, 0, width, height);
    }
    function draw(now: number) {
      if (!canvas || !context) return;
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const time = clock.sample(now);
      context.drawImage(base, 0, 0, width, height);
      if (!settings.twinkle) return;
      for (const star of stars)
        if (star.twinkling) {
          const phase = star.phase + time * star.frequency;
          const pulse = Math.max(
            0,
            0.5 +
              0.35 * Math.sin(phase) +
              0.15 * Math.sin(phase * 1.7 + star.phase),
          );
          context.fillStyle = `rgba(${star.color.map((value) => Math.round(value * 255)).join(",")},${Math.min(1, pulse ** 1.4 * star.opacity * star.strength * settings.brightness)})`;
          context.beginPath();
          context.arc(
            star.x + Math.sin(phase * 1.31) * 0.18 * star.strength,
            star.y + Math.sin(phase * 1.73) * 0.18 * star.strength,
            star.radius * 1.08,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
    }
    if (settings.visible && deepSky.visible && deepSky.density > 0) {
      void loadDeepSkyCatalogue()
        .then((catalogue) =>
          Promise.allSettled(
            chooseDeepSky(deepSky.seed, true, catalogue, deepSky.density).map(
              prepareDeepSky,
            ),
          ),
        )
        .then((results) => {
          if (!alive) return;
          images = results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          );
          rebuild();
        })
        .catch(() => {
          /* A missing photograph should never prevent stars from rendering. */
        });
    }
    const observer = new ResizeObserver(rebuild);
    observer.observe(canvas);
    rebuild();
    frame = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.width = 0;
      canvas.height = 0;
      base.width = 0;
      base.height = 0;
    };
  }, [settings, clock]);
  return (
    <canvas
      ref={ref}
      className="starfield"
      aria-hidden="true"
      data-testid="starfield"
    />
  );
}
