import { seededRandom } from "./seededRandom.ts";

export type MoonShape = { axes: [number, number, number]; lobes: Float32Array; tilt: number };

/** A separate stream preserves existing moon counts, materials, orbits and rotation. */
export function getMoonShape(seed: string, size: number): MoonShape {
    const random = seededRandom(`${seed}:shape`);
    const larger = Math.max(0, Math.min(1, (size - .1) / .35));
    const irregularity = .55 + random() * .45 - larger * .30;
    const axes: MoonShape["axes"] = [1, 1 - irregularity * (.10 + random() * .22),
        1 - irregularity * (.08 + random() * .22)];
    const lobes = new Float32Array(16);
    let expansion = 0;
    for (let i = 0; i < 4; i++) {
        const y = random() * 2 - 1, longitude = random() * Math.PI * 2;
        const radius = Math.sqrt(1 - y * y);
        const amplitude = irregularity * (i < 2 ? .035 + random() * .065 : -(.07 + random() * .12));
        lobes.set([Math.sin(longitude) * radius, y, Math.cos(longitude) * radius, amplitude], i * 4);
        expansion += Math.max(0, amplitude);
    }
    // The complete rotating solid stays within the existing moon radius/clearance.
    return { axes: axes.map(a => a / (1 + expansion)) as MoonShape["axes"], lobes, tilt: random() * Math.PI * 2 };
}

/** One shared parametric grid, not a new geometry buffer for every moon. */
export function createMoonGrid() {
    const vertices: number[] = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 32; x++) {
        const a = x / 16 - 1, b = y / 10 - 1, c = (x + 1) / 16 - 1, d = (y + 1) / 10 - 1;
        vertices.push(a, b, c, b, a, d, a, d, c, b, c, d);
    }
    return new Float32Array(vertices);
}

export const moonVertexShape = `
uniform float u_moon;
uniform float u_phase;
uniform float u_axisTilt;
uniform vec3 u_moonAxes;
uniform vec4 u_moonLobes[4];
varying vec3 v_moonNormal;
varying vec3 v_moonMaterial;
varying vec3 v_moonPosition;
varying vec3 v_moonTangent;

vec3 turnMoon(vec3 v) {
    float c = cos(u_phase), s = sin(u_phase);
    v = vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
    c = cos(u_axisTilt); s = sin(u_axisTilt);
    return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}

void moonSurface(vec2 point) {
    float longitude = point.x * 3.141592653589793;
    float latitude = point.y * 1.570796326794897;
    vec3 direction = vec3(sin(longitude) * cos(latitude), sin(latitude), cos(longitude) * cos(latitude));
    float radius = 1.0;
    vec3 gradient = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        vec4 lobe = u_moonLobes[i];
        float t = 0.5 + 0.5 * dot(direction, lobe.xyz);
        radius += lobe.w * t * t * t * t;
        gradient += 2.0 * lobe.w * t * t * t * lobe.xyz;
    }
    // Analytic normal of the radial surface, then inverse-transpose for its unequal axes.
    vec3 normal = (direction - (gradient - direction * dot(direction, gradient)) / radius) / u_moonAxes;
    vec3 east = vec3(cos(longitude), 0.0, -sin(longitude));
    vec3 tangent = u_moonAxes * (radius * east + direction * dot(gradient, east));
    v_moonPosition = turnMoon(u_moonAxes * direction * radius);
    v_moonNormal = normalize(turnMoon(normal));
    v_moonMaterial = direction;
    v_moonTangent = normalize(turnMoon(tangent));
}
`;
