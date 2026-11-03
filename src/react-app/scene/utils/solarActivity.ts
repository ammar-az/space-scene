import { seededRandom } from "./seededRandom.ts";
import { solarSpotCount } from "./solarShader.ts";

type Slot = {
    period: number; offset: number; epoch: number;
    longitude: number; latitude: number; radius: number; duration: number; drift: number;
};
type SolarActivity = { centers: Float32Array<ArrayBuffer>; frames: Float32Array<ArrayBuffer> };
const cache = new Map<number, SolarActivity & { slots: Slot[] }>();
const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/** Independent events choose new hemisphere locations only while their previous spot is absent. */
export function getSolarActivity(seed: number, elapsedMs: number): SolarActivity {
    let activity = cache.get(seed);
    if (!activity) {
        const random = seededRandom(`${seed}:solar-event-slots`);
        const slots = Array.from({ length: solarSpotCount }, (): Slot => {
            const period = 24 + random() * 20;
            return { period, offset: random() * period, epoch: NaN, longitude: 0, latitude: 0, radius: 0, duration: 1, drift: 0 };
        });
        activity = { slots, centers: new Float32Array(solarSpotCount * 4), frames: new Float32Array(solarSpotCount * 4) };
        if (cache.size >= 2) cache.delete(cache.keys().next().value!);
        cache.set(seed, activity);
    }
    activity.slots.forEach((slot, index) => {
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
            slot.drift = (0.008 + random() * 0.004) * (1 - 0.35 * Math.sin(slot.latitude) ** 2);
        }
        const age = (time - epoch * slot.period) / slot.duration;
        const life = smooth(0, 0.28, age) * (1 - smooth(0.58, 1, age));
        const longitude = slot.longitude + (time - epoch * slot.period) * slot.drift;
        const sin = Math.sin(longitude), cos = Math.cos(longitude), latitudeScale = Math.cos(slot.latitude);
        activity.centers.set([sin * latitudeScale, Math.sin(slot.latitude), cos * latitudeScale, life], index * 4);
        activity.frames.set([cos, -sin, slot.radius, 0], index * 4);
    });
    return activity;
}
