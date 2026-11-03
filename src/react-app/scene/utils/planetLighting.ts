export type LightingProfile = { fill: number; depth: number; terminatorStart: number };
export type LightingSettings = {
    innerRadius: number;
    outerRadius: number;
    inner: LightingProfile;
    outer: LightingProfile;
    falloff: number;
    transitFill: number;
};

/** The portfolio's appearance as a preset, independent of its project objects. */
export const portfolioLighting: LightingSettings = {
    innerRadius: 510,
    outerRadius: 1480,
    inner: { fill: 0.55, depth: 1.7, terminatorStart: -0.6 },
    outer: { fill: 0.25, depth: 0.85, terminatorStart: -0.4 },
    falloff: 0.8,
    transitFill: 0.18,
};

/** Orbital distance sets stable fill and static-fallback lighting; moving phases are applied separately. */
export function getPlanetLighting(orbitRadius = portfolioLighting.innerRadius, settings: LightingSettings = portfolioLighting) {
    const { innerRadius, outerRadius, inner, outer, falloff, transitFill } = settings;
    const distance = Math.max(0, Math.min(1, (orbitRadius - innerRadius) / Math.max(1, outerRadius - innerRadius)));
    const strength = distance ** falloff;
    const mix = (a: number, b: number) => a + (b - a) * strength;
    return {
        transitFill,
        fill: mix(inner.fill, outer.fill),
        depth: mix(inner.depth, outer.depth),
        terminatorStart: mix(inner.terminatorStart, outer.terminatorStart),
    };
}

/** Phase changes the direct light; existing distance-based fill keeps the artwork readable. */
export function getPlanetPhaseLighting(profile: ReturnType<typeof getPlanetLighting>, phase?: {
    solarAngularRadius: number; transit: number;
}) {
    if (!phase) return profile;
    return {
        fill: profile.fill + (Math.min(profile.fill, profile.transitFill) - profile.fill) * phase.transit,
        // An extended sun illuminates beyond a point source's terminator.
        terminatorStart: -Math.max(0.08, Math.min(0.65, phase.solarAngularRadius)),
    };
}
