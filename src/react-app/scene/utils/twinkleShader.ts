export const twinkleVertex = `
attribute vec2 a_position;
attribute vec2 a_shape;
attribute vec3 a_color;
attribute vec3 a_cycle;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_time;
varying vec3 v_color;
varying float v_brightness;
varying vec2 v_shimmer;
void main() {
    float phase = a_cycle.x + u_time * a_cycle.y;
    // Subpixel scintillation only: the star remains a point, without a growing circular glow.
    vec2 shimmer = vec2(sin(phase * 1.31 + a_cycle.x), sin(phase * 1.73 - a_cycle.x)) * 0.18 * a_cycle.z;
    v_shimmer = shimmer / (a_shape.x * 3.0);
    gl_Position = vec4(a_position / u_resolution * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
    gl_PointSize = a_shape.x * 6.0 * u_pixelRatio;
    float pulse = 0.5 + 0.35 * sin(phase) + 0.15 * sin(phase * 1.7 + a_cycle.x);
    v_brightness = a_shape.y * pow(max(0.0, pulse), 1.4) * a_cycle.z;
    v_color = a_color;
}`;

export const twinkleFragment = `
precision mediump float;
varying vec3 v_color;
varying float v_brightness;
varying vec2 v_shimmer;
void main() {
    // Offset within the sprite, avoiding whole-pixel jumps from point-rasterization snapping.
    float radius = length(gl_PointCoord * 2.0 - 1.0 - v_shimmer);
    float core = 1.0 - smoothstep(0.2, 0.36, radius);
    float alpha = min(1.0, core * v_brightness);
    gl_FragColor = vec4(v_color * alpha, alpha);
}`;
