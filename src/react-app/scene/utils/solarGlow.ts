/** Match the CSS solar halo over surfaces behind the sun, in CSS-pixel coordinates. */
export const solarGlowFragment = `
uniform vec4 u_solarGlow;
float glowCoverage(float distance, float spread, float blur) {
    return 1.0 - smoothstep(spread - blur, spread + blur, distance);
}
vec3 solarGlowOver(vec3 surface, vec2 pixel) {
    if (u_solarGlow.w < 0.5 || u_sunRect.z <= 0.0) return surface;
    vec2 radii = u_sunRect.zw * 0.5;
    vec2 delta = pixel - u_sunRect.xy;
    float radius = length(delta / radii);
    // Distance along the ellipse's normal keeps the halo's width uniform at its limb.
    float distance = (radius - 1.0) * radius / max(0.0001, length(delta / (radii * radii)));
    float focused = step(1.5, u_solarGlow.w);
    float near = mix(0.82, 0.95, focused) * glowCoverage(distance, 3.0, 20.0);
    float inner = mix(0.38, 0.55, focused) * glowCoverage(distance, mix(6.0, 12.0, focused), mix(24.0, 34.0, focused));
    float outer = mix(0.14, 0.22, focused) * glowCoverage(distance, mix(10.0, 22.0, focused), mix(65.0, 90.0, focused));
    float opacity = 1.0 - (1.0 - near) * (1.0 - inner) * (1.0 - outer);
    return mix(surface, u_solarGlow.rgb, opacity);
}`;
