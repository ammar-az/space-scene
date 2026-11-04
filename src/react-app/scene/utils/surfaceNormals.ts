/** Tangent normals from floating-point spherical heights; optional alpha stores an ocean mask. */
export function buildSurfaceNormals(
  heights: Float32Array,
  width: number,
  height: number,
  strength = 0.085,
  water?: Float32Array,
): Uint8Array<ArrayBuffer> {
  const pi = Math.PI,
    tau = pi * 2,
    normals = new Uint8Array(width * height * 4);
  const at = (x: number, y: number) =>
    heights[
      Math.max(0, Math.min(height - 1, y)) * width + ((x + width) % width)
    ];
  for (let py = 0; py < height; py++) {
    const cosine = Math.max(
      tau / width,
      Math.cos(((py + 0.5) / height - 0.5) * pi),
    );
    for (let px = 0; px < width; px++) {
      const dx =
        (at(px + 1, py) - at(px - 1, py)) / (((2 * tau) / width) * cosine);
      const dy = (at(px, py + 1) - at(px, py - 1)) / ((2 * pi) / height);
      const nx = -dx * strength,
        ny = -dy * strength,
        length = Math.hypot(nx, ny, 1);
      const index = (py * width + px) * 4;
      normals[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      normals[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      normals[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normals[index + 3] = water
        ? Math.round(Math.max(0, Math.min(1, water[py * width + px])) * 255)
        : 255;
    }
  }
  return normals;
}
