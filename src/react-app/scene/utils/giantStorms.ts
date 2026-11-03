import type { PlanetTextureOptions } from "./planetTextures.ts";
import { seededRandom } from "./seededRandom.ts";

export const giantStormCount = 3;
export type GiantStormProfile = {
  u: number;
  v: number;
  radiusU: number;
  radiusV: number;
  rotation: number;
};
type Slot = {
  period: number;
  offset: number;
  epoch: number;
  duration: number;
  u: number;
  v: number;
  size: number;
  aspect: number;
  drift: number;
  spin: number;
  phase: number;
};
type StormActivity = {
  geometry: Float32Array<ArrayBuffer>;
  motion: Float32Array<ArrayBuffer>;
};
const cache = new Map<string | number, StormActivity & { slots: Slot[] }>();
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seeded cloud systems with visible circulation and slower travel relative to the atmosphere. */
export function getGiantStormActivity(
  seed: string | number,
  profiles: GiantStormProfile[],
  elapsedMs: number,
): StormActivity {
  let activity = cache.get(seed);
  if (!activity) {
    const random = seededRandom(`${seed}:storm-slots`);
    const slots = profiles.slice(0, giantStormCount).map((_, index): Slot => {
      const period = 120 + random() * 70;
      return {
        period,
        offset: (index / giantStormCount + random() * 0.12) * period,
        epoch: NaN,
        duration: 1,
        u: 0,
        v: 0,
        size: 1,
        aspect: 1,
        drift: 0,
        spin: 0,
        phase: 0,
      };
    });
    activity = {
      slots,
      geometry: new Float32Array(giantStormCount * 4),
      motion: new Float32Array(giantStormCount * 4),
    };
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(seed, activity);
  }
  activity.slots.forEach((slot, index) => {
    const profile = profiles[index];
    const time = Math.max(0, elapsedMs) / 1000 + slot.offset;
    const epoch = Math.floor(time / slot.period),
      eventTime = time - epoch * slot.period;
    if (slot.epoch !== epoch) {
      const random = seededRandom(`${seed}:storm:${index}:${epoch}`);
      slot.epoch = epoch;
      slot.u = epoch === 0 ? profile.u : random();
      slot.v = profile.v + (random() - 0.5) * 0.035;
      slot.duration = slot.period * (0.72 + random() * 0.08);
      slot.size = 1.15 + random() * 0.5;
      const drift = random() - 0.5;
      slot.drift = (drift < 0 ? -1 : 1) * (0.00035 + Math.abs(drift) * 0.0007);
      slot.spin =
        ((random() < 0.5 ? -1 : 1) * Math.PI * 2) / (24 + random() * 18);
      slot.phase = random() * Math.PI * 2;
      // At least one slot produces round storms; others vary between ovals and circles.
      // Separate randomness preserves event positions, lifetimes and circulation directions.
      const shape = seededRandom(`${seed}:storm-shape:${index}:${epoch}`);
      const roundSlot = Math.floor(
        seededRandom(`${seed}:round-storm`)() * activity!.slots.length,
      );
      slot.aspect =
        index === roundSlot || shape() < 0.3
          ? 0.9 + shape() * 0.15
          : 0.6 + shape() * 0.25;
    }
    const age = eventTime / slot.duration;
    const life = smooth(0, 0.25, age) * (1 - smooth(0.7, 1, age));
    const u = slot.u + eventTime * slot.drift;
    const radiusU = Math.max(
      0.014,
      Math.min(0.034, profile.radiusU * slot.size),
    );
    // Correct equal-area map scales so a round storm is round on the sphere, not a thin belt.
    const latitudeScaleSquared = Math.max(0.2, 1 - (1 - slot.v * 2) ** 2);
    const radiusV = radiusU * Math.PI * latitudeScaleSquared * slot.aspect;
    activity.geometry.set(
      [((u % 1) + 1) % 1, slot.v, radiusU, radiusV],
      index * 4,
    );
    activity.motion.set(
      [
        life,
        slot.phase + eventTime * slot.spin,
        profile.rotation,
        Math.sign(slot.spin),
      ],
      index * 4,
    );
  });
  return activity;
}

export function getGiantStormPalette(options: PlanetTextureOptions) {
  const rgb = (hex: string) => {
    const raw = hex.replace("#", "");
    const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  };
  const primary = rgb(options.color),
    accent = options.accentColor ? rgb(options.accentColor) : primary;
  const shadow = options.bandShadow
    ? rgb(options.bandShadow)
    : [7, 17, 34].map((c) => c / 255);
  return {
    pale: primary.map((c, i) => c * 0.25 + accent[i] * 0.55 + 0.2),
    dark: primary.map((c, i) => c * 0.45 + shadow[i] * 0.55),
  };
}

export const giantStormFragment = `
uniform float u_stormsEnabled;
uniform vec4 u_storms[${giantStormCount}];
uniform vec4 u_stormMotion[${giantStormCount}];
uniform vec3 u_stormPale;
uniform vec3 u_stormDark;

vec2 stormPoint(vec2 uv, vec4 storm, vec4 motion) {
    float growth = 0.65 + 0.35 * sqrt(motion.x);
    vec2 delta = vec2(fract(uv.x - storm.x + 0.5) - 0.5, uv.y - storm.y);
    float c = cos(motion.z), s = sin(motion.z);
    return mat2(c, -s, s, c) * (delta / (storm.zw * growth));
}

vec2 giantFlow(vec2 uv) {
    if (u_stormsEnabled < 0.5) return uv;
    vec2 result = uv;
    for (int i = 0; i < ${giantStormCount}; i++) {
        vec4 storm = u_storms[i], motion = u_stormMotion[i];
        if (motion.x <= 0.0) continue;
        vec2 q = stormPoint(uv, storm, motion);
        float radius = length(q);
        if (radius >= 2.5) continue;
        // Use the same growing, tilted circulation region as the visible cloud system.
        // Nearby belts curve around its body; the rest of the original material stays untouched.
        float envelope = 1.0 - smoothstep(0.35, 2.5, radius);
        float bend = motion.w * motion.x * 0.23 * envelope;
        float c = cos(bend), s = sin(bend);
        vec2 flow = mat2(c, -s, s, c) * q;
        flow *= 1.0 + 0.04 * motion.x * (1.0 - smoothstep(0.35, 1.6, radius));
        c = cos(motion.z); s = sin(motion.z);
        result += mat2(c, s, -s, c) * (flow - q) * storm.zw * (0.65 + 0.35 * sqrt(motion.x));
    }
    return result;
}

vec3 giantWeather(vec3 color, vec2 uv) {
    if (u_stormsEnabled < 0.5) return color;
    for (int i = 0; i < ${giantStormCount}; i++) {
        vec4 storm = u_storms[i], motion = u_stormMotion[i];
        float life = motion.x;
        if (life <= 0.0) continue;
        vec2 q = stormPoint(uv, storm, motion);
        float radius = length(q);
        if (radius >= 3.4) continue;
        float angle = atan(q.y, q.x + 0.00001);
        float circulation = angle - motion.y;
        float eddies = 0.30 * sin(circulation * 3.0 + radius * 2.2)
            + 0.12 * sin(circulation * 5.0 - radius * 1.6 + motion.z * 7.0);
        float spiral = circulation + radius * 4.5 + eddies;
        float cloud = smoothstep(0.20, 0.85, 0.5 + 0.5 * sin(spiral));
        float crest = smoothstep(0.84, 0.99, 0.5 + 0.5 * sin(spiral + 0.16));

        // Borrow adjoining belt colors to tie the storm into its local atmosphere.
        vec3 atmosphere = 0.5 * (texture2D(u_map, vec2(storm.x, storm.y - storm.w * 0.9)).rgb
            + texture2D(u_map, vec2(storm.x, storm.y + storm.w * 0.9)).rgb);
        vec3 pale = mix(atmosphere, u_stormPale, 0.72);
        vec3 dark = mix(atmosphere, u_stormDark, 0.68);
        float body = 1.0 - smoothstep(0.72, 1.20, radius);
        float interior = 0.20 + 0.12 * (1.0 - smoothstep(0.12, 0.95, radius))
            + 0.22 * cloud * smoothstep(0.12, 0.55, radius);
        color = mix(color, mix(dark, pale, interior), body * life * 0.90);

        // A broad, softly layered arm feeds out of the oval, with a restrained bright crest.
        float tail = smoothstep(0.32, 0.75, radius) * (1.0 - smoothstep(1.25, 2.5, radius));
        float density = 0.72 + 0.28 * sin(circulation + radius * 0.45 + motion.z * 7.0);
        float wallRadius = radius + eddies * 0.15;
        float wall = smoothstep(0.42, 0.68, wallRadius) * (1.0 - smoothstep(0.98, 1.30, wallRadius));
        float clouds = (tail * (cloud * 0.38 + crest * 0.15) + wall * (0.12 + cloud * 0.23)) * density;
        color = mix(color, pale + vec3(0.045), clouds * life * smoothstep(0.08, 0.65, life));

        // Faint opposite-side streamers follow the belts, joining the storm to its atmosphere.
        float x = abs(q.x);
        float wakeY = motion.w * sign(q.x) * (0.58 + 0.10 * sin(x * 1.4 - motion.y * 0.35));
        float wake = (1.0 - smoothstep(0.08, 0.36, abs(q.y - wakeY)))
            * smoothstep(0.95, 1.6, x) * (1.0 - smoothstep(2.0, 3.2, x));
        color = mix(color, pale, wake * life * 0.13);
    }
    return color;
}`;
