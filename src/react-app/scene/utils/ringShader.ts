/** Shared by parent and moon shading. Ring opacity is sampled along five rays across the extended sun. */
export const ringShadowFragment = `
uniform float u_ringEnabled;
uniform sampler2D u_ringMap;
uniform vec4 u_ringParent;
uniform vec3 u_ringMajor;
uniform vec3 u_ringMinor;
uniform vec3 u_ringLimits;

float ringRayOpacity(vec3 point, vec3 direction, float sunDistance) {
    vec3 normal = cross(u_ringMajor, u_ringMinor);
    float denominator = dot(normal, direction);
    if (abs(denominator) < 0.0001) return 0.0;
    vec3 offset = point - u_ringParent.xyz;
    float along = -dot(normal, offset) / denominator;
    if (along <= 0.002 || along >= sunDistance) return 0.0;
    vec3 hit = offset + direction * along;
    float radius = length(vec2(dot(hit, u_ringMajor), dot(hit, u_ringMinor))) / u_ringParent.w;
    if (radius <= u_ringLimits.x || radius >= u_ringLimits.y) return 0.0;
    float u = (radius - u_ringLimits.x) / (u_ringLimits.y - u_ringLimits.x);
    return texture2D(u_ringMap, vec2(u, 0.5)).r * u_ringLimits.z;
}
float ringShadowVisibility(vec3 normal) {
    if (u_ringEnabled < 0.5) return 1.0;
    vec3 point = normal * u_shadowRadius;
    vec3 toSun = u_shadowSun.xyz - point;
    float distance = max(1.0, length(toSun));
    vec3 forward = toSun / distance;
    vec3 right = normalize(cross(forward, abs(forward.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
    vec3 up = cross(forward, right);
    float spread = min(0.7, u_shadowSun.w / distance) * 0.65;
    float opacity = ringRayOpacity(point, forward, distance) * 0.28;
    opacity += ringRayOpacity(point, normalize(forward + right * spread), distance) * 0.18;
    opacity += ringRayOpacity(point, normalize(forward - right * spread), distance) * 0.18;
    opacity += ringRayOpacity(point, normalize(forward + up * spread), distance) * 0.18;
    opacity += ringRayOpacity(point, normalize(forward - up * spread), distance) * 0.18;
    return 1.0 - opacity;
}
`;
