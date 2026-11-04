import type { Planet } from "./schema.ts";
export type GasSurface = NonNullable<Planet["gas"]>;
export const defaultGasSurface: GasSurface = {
  turbulence: 1,
  softness: 0.5,
  detail: 1,
};
