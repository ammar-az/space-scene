import { seededRandom } from "./seededRandom.ts";
import { solarBaseSpotCount, solarSpotCount } from "./solarShader.ts";

export const defaultSunspots = { frequency: 1, size: 1 };

type Slot = {
  period: number;
  offset: number;
  epoch: number;
  longitude: number;
  latitude: number;
  radius: number;
  duration: number;
  drift: number;
};
type SolarActivity = {
  centers: Float32Array<ArrayBuffer>;
  frames: Float32Array<ArrayBuffer>;
};
const cache = new Map<number, SolarActivity & { slots: Slot[] }>();
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Independent events choose new hemisphere locations only while their previous spot is absent. */
export function getSolarActivity(
  seed: number,
  elapsedMs: number,
  settings: Partial<typeof defaultSunspots> = defaultSunspots,
): SolarActivity {
  let activity = cache.get(seed);
  if (!activity) {
    const random = seededRandom(`${seed}:solar-event-slots`);
    const slots = Array.from({ length: solarSpotCount }, (): Slot => {
      const period = 24 + random() * 20;
      return {
        period,
        offset: random() * period,
        epoch: NaN,
        longitude: 0,
        latitude: 0,
        radius: 0,
        duration: 1,
        drift: 0,
      };
    });
    activity = {
      slots,
      centers: new Float32Array(solarSpotCount * 4),
      frames: new Float32Array(solarSpotCount * 4),
    };
    if (cache.size >= 2) cache.delete(cache.keys().next().value!);
    cache.set(seed, activity);
  }
  const frequency = Math.max(0, Math.min(4, settings.frequency ?? 1));
  const size = Math.max(0.25, Math.min(3, settings.size ?? 1));
  const population = solarBaseSpotCount * frequency;
  const count = Math.ceil(population);
  for (let index = 0; index < count; index++) {
    const slot = activity.slots[index];
    const time = Math.max(0, elapsedMs) / 1000 + slot.offset;
    const epoch = Math.floor(time / slot.period);
    if (slot.epoch !== epoch) {
      const random = seededRandom(`${seed}:solar-event:${index}:${epoch}`);
      slot.epoch = epoch;
      slot.longitude = (random() - 0.5) * Math.PI;
      // Uniform surface-area distribution across the visible hemisphere, without reserved regions.
      slot.latitude = Math.asin(random() * 2 - 1);
      slot.radius = (0.007 + random() * 0.011) * Math.PI;
      slot.duration = slot.period * (0.4 + random() * 0.2);
      slot.drift =
        (0.008 + random() * 0.004) * (1 - 0.35 * Math.sin(slot.latitude) ** 2);
    }
    const age = (time - epoch * slot.period) / slot.duration;
    // More independent event slots raise frequency without speeding up existing events.
    // A fractional final slot deterministically accepts only some of its epochs.
    const accepted =
      index < Math.floor(population) ||
      seededRandom(`${seed}:solar-frequency:${index}:${epoch}`)() <
        population - Math.floor(population);
    const life = accepted
      ? smooth(0, 0.28, age) * (1 - smooth(0.58, 1, age))
      : 0;
    const longitude =
      slot.longitude + (time - epoch * slot.period) * slot.drift;
    const sin = Math.sin(longitude),
      cos = Math.cos(longitude),
      latitudeScale = Math.cos(slot.latitude);
    activity.centers.set(
      [sin * latitudeScale, Math.sin(slot.latitude), cos * latitudeScale, life],
      index * 4,
    );
    activity.frames.set([cos, -sin, slot.radius * size, 0], index * 4);
  }
  // Keep the original eight-slot output at 1×, including its deterministic artwork.
  const result = {
    slots: activity.slots.slice(0, count),
    centers: activity.centers.subarray(0, count * 4),
    frames: activity.frames.subarray(0, count * 4),
  };
  return result;
}
