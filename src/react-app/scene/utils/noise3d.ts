const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function hash(x: number, y: number, z: number, seed: number) {
  let n =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 2147483647) ^
    seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function noise(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const tx = fx * fx * (3 - 2 * fx),
    ty = fy * fy * (3 - 2 * fy),
    tz = fz * fz * (3 - 2 * fz);
  return mix(
    mix(
      mix(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), tx),
      mix(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), tx),
      ty,
    ),
    mix(
      mix(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), tx),
      mix(
        hash(ix, iy + 1, iz + 1, seed),
        hash(ix + 1, iy + 1, iz + 1, seed),
        tx,
      ),
      ty,
    ),
    tz,
  );
}

export function fractal(x: number, y: number, z: number, seed: number) {
  return (
    noise(x, y, z, seed) * 0.54 +
    noise(x * 2.1, y * 2.1, z * 2.1, seed + 1) * 0.27 +
    noise(x * 4.3, y * 4.3, z * 4.3, seed + 2) * 0.13 +
    noise(x * 8.7, y * 8.7, z * 8.7, seed + 3) * 0.06
  );
}
