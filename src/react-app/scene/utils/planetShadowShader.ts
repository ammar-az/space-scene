import { maxPlanetShadowCasters } from "./planetShadows.ts";

export const planetShadowFragment = `
uniform int u_shadowCount;
uniform vec4 u_shadowCasters[${maxPlanetShadowCasters}];
uniform float u_shadowFades[${maxPlanetShadowCasters}];
uniform vec4 u_shadowSun;
uniform float u_shadowRadius;

// Fraction of the apparent solar disc hidden by an apparent circular caster.
float solarCoverage(float sourceRadius, float casterRadius, float separation) {
    if (separation >= sourceRadius + casterRadius) return 0.0;
    float sourceArea = sourceRadius * sourceRadius;
    float casterArea = casterRadius * casterRadius;
    if (separation <= abs(sourceRadius - casterRadius)) return min(1.0, casterArea / sourceArea);
    float d2 = separation * separation;
    float a = acos(clamp((d2 + sourceArea - casterArea) / (2.0 * separation * sourceRadius), -1.0, 1.0));
    float b = acos(clamp((d2 + casterArea - sourceArea) / (2.0 * separation * casterRadius), -1.0, 1.0));
    float lens = sqrt(max(0.0, (-separation + sourceRadius + casterRadius)
        * (separation + sourceRadius - casterRadius) * (separation - sourceRadius + casterRadius)
        * (separation + sourceRadius + casterRadius)));
    return clamp((sourceArea * a + casterArea * b - lens * 0.5) / (PI * sourceArea), 0.0, 1.0);
}

float planetShadowVisibility(vec3 sphereNormal) {
    if (u_shadowCount == 0) return 1.0;
    vec3 point = sphereNormal * u_shadowRadius;
    vec3 toSun = u_shadowSun.xyz - point;
    float solarDistance = max(0.001, length(toSun));
    vec3 lightDirection = toSun / solarDistance;
    float solarRadius = asin(clamp(u_shadowSun.w / solarDistance, 0.00001, 0.9999));
    float blocked = 0.0;
    for (int i = 0; i < ${maxPlanetShadowCasters}; i++) {
        if (i >= u_shadowCount) break;
        vec4 caster = u_shadowCasters[i];
        vec3 toCaster = caster.xyz - point;
        float distance = length(toCaster);
        float along = dot(toCaster, lightDirection);
        if (along <= 0.0 || along >= solarDistance || distance <= caster.w) continue;
        float casterRadius = asin(clamp(caster.w / distance, 0.0, 0.9999));
        float angle = acos(clamp(along / distance, -1.0, 1.0));
        // Use the strongest caster, avoiding double-counting overlapping silhouettes on the sun.
        blocked = max(blocked, solarCoverage(solarRadius, casterRadius, angle) * u_shadowFades[i]);
    }
    return 1.0 - blocked;
}
`;
