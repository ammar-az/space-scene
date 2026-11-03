import type { DeepSkyImage } from "../data/deepSky.ts";
import { seededRandom } from "./seededRandom.ts";

const prepared = new Map<string, Promise<HTMLCanvasElement>>();
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Create a transparent cutout from a source photograph and its crop settings. */
export function processDeepSky(image: HTMLImageElement, asset: DeepSkyImage) {
  const [x, y, w, h] = asset.crop,
    aspect = (image.width * w) / (image.height * h);
  const canvas = document.createElement("canvas");
  canvas.width = aspect >= 1 ? 160 : Math.round(160 * aspect);
  canvas.height = aspect <= 1 ? 160 : Math.round(160 / aspect);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Background image preparation unavailable");
  context.drawImage(
    image,
    x * image.width,
    y * image.height,
    w * image.width,
    h * image.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height),
    data = pixels.data;
  const border: number[][] = [[], [], []];
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const edge = Math.min(
        px / canvas.width,
        1 - px / canvas.width,
        py / canvas.height,
        1 - py / canvas.height,
      );
      const i = (py * canvas.width + px) * 4;
      if (edge < 0.1) for (let c = 0; c < 3; c++) border[c].push(data[i + c]);
    }
  const black = border.map((channel) => {
    channel.sort((a, b) => a - b);
    return channel[Math.floor(channel.length * 0.45)] ?? 0;
  });
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const i = (py * canvas.width + px) * 4;
      for (let c = 0; c < 3; c++)
        data[i + c] = Math.max(0, data[i + c] - black[c] - 3);
      const luminance =
        (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
      const edge = Math.min(
        (px + 0.5) / canvas.width,
        1 - (px + 0.5) / canvas.width,
        (py + 0.5) / canvas.height,
        1 - (py + 0.5) / canvas.height,
      );
      data[i + 3] = Math.round(
        255 * smooth(0.012, 0.36, luminance) * smooth(0, 0.19, edge),
      );
    }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function prepareDeepSky(asset: DeepSkyImage) {
  const cached = prepared.get(asset.id);
  if (cached) return cached;
  const pending = (async () => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    try {
      image.src = `/space/deep-sky/thumbs/${asset.id}.webp`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Background canvas unavailable");
      context.drawImage(image, 0, 0);
      return canvas;
    } finally {
      image.removeAttribute("src");
    }
  })();
  if (prepared.size >= 16) prepared.delete(prepared.keys().next().value!);
  prepared.set(asset.id, pending);
  void pending.catch(() => {
    if (prepared.get(asset.id) === pending) prepared.delete(asset.id);
  });
  return pending;
}

export function paintDeepSky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  images: HTMLCanvasElement[],
  desktop: boolean,
  sizeMultiplier = 1,
  brightness = 1,
) {
  const random = seededRandom(`${seed}:deep-sky-placement`);
  // Distinct jittered cells spread a fuller sky without piling objects onto the same four positions.
  const cells = desktop
    ? Array.from({ length: 12 }, (_, i) => [
        0.33 + (i % 4) * 0.19,
        0.2 + Math.floor(i / 4) * 0.29,
      ])
    : Array.from({ length: 9 }, (_, i) => [
        0.18 + (i % 3) * 0.32,
        0.25 + Math.floor(i / 3) * 0.21,
      ]);
  context.save();
  context.globalCompositeOperation = "screen";
  images.slice(0, cells.length).forEach((image) => {
    const cell = cells.splice(Math.floor(random() * cells.length), 1)[0];
    const x = width * (cell[0] + (random() - 0.5) * 0.09);
    const y = height * (cell[1] + (random() - 0.5) * 0.1);
    const size = Math.min(width * 0.065, 24 + random() * 30) * sizeMultiplier;
    const scale = size / Math.max(image.width, image.height);
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI * 2);
    context.globalAlpha = Math.min(1, (0.3 + random() * 0.18) * brightness);
    context.drawImage(
      image,
      (-image.width * scale) / 2,
      (-image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
    context.restore();
  });
  context.restore();
}
