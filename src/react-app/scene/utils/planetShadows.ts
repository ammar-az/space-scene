export const maxPlanetShadowCasters = 5;

export type ShadowSphere = {
    id: string;
    center: [number, number, number];
    radius: number;
    opacity: number;
};
export type ShadowSun = { center: [number, number, number]; radius: number };
export type PlanetShadowCaster = { sphere: ShadowSphere; opacity: number };

/** Conservative light-space culling; angular-disc coverage is evaluated on the receiving sphere in the shader. */
export function getPlanetShadowCasters(receiver: ShadowSphere, spheres: readonly ShadowSphere[], sun: ShadowSun) {
    const light = sun.center.map((v, i) => v - receiver.center[i]);
    const distance = Math.max(1, Math.hypot(...light));
    const solarAngle = Math.asin(Math.min(1, (sun.radius + receiver.radius) / distance));
    const result: PlanetShadowCaster[] = [];
    for (const caster of spheres) {
        if (caster.id === receiver.id || caster.opacity <= 0) continue;
        const offset = caster.center.map((v, i) => v - receiver.center[i]);
        const separation = Math.hypot(...offset), radii = receiver.radius + caster.radius;
        // The artistic paths can intersect in space. Fade those nonphysical cases instead of popping.
        const clearance = Math.max(0, Math.min(1, (separation - radii) / Math.max(1, Math.min(receiver.radius, caster.radius) * 0.5)));
        const opacity = caster.opacity * clearance * clearance * (3 - 2 * clearance);
        if (opacity <= 0) continue;
        const along = offset.reduce((sum, v, i) => sum + v * light[i], 0) / distance;
        if (along + caster.radius < -receiver.radius || along - caster.radius > distance + receiver.radius) continue;
        const angle = Math.acos(Math.max(-1, Math.min(1, along / separation)));
        const casterAngle = Math.asin(Math.min(1, radii / separation));
        if (angle > solarAngle + casterAngle) continue;
        result.push({ sphere: caster, opacity });
    }
    // Additional moons must not displace a larger/nearer caster just because of registration order.
    const influence = ({ sphere, opacity }: PlanetShadowCaster) => opacity * sphere.radius ** 2
        / Math.max(1, sphere.center.reduce((sum, v, i) => sum + (v - receiver.center[i]) ** 2, 0));
    return result.sort((a, b) => influence(b) - influence(a)).slice(0, maxPlanetShadowCasters);
}
