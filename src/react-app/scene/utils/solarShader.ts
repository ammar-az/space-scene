export const solarCycleSeconds = 32;
export const solarCellCount = 256;
export const solarSpotCount = 8;

/** Growing/cooling cells rebuild their contact lanes; no moving UVs or displaced artwork. */
export const solarFragment = `
uniform float u_solar;
uniform float u_solarPhase;
uniform sampler2D u_sites;
uniform vec4 u_sunspots[${solarSpotCount}];
uniform vec4 u_sunspotFrames[${solarSpotCount}];
uniform vec3 u_solarPrimary;
uniform vec3 u_solarHighlight;
uniform vec3 u_solarShadow;
uniform float u_solarLaneAccent;

vec3 solarSurface(vec3 normal) {
    vec2 uv = vec2(atan(normal.x, normal.z) / PI + 0.5, 0.5 - asin(normal.y) / PI);
    vec4 structure = texture2D(u_map, uv * 2.0);
    float pressure = 0.0;
    vec2 direction = vec2(0.0001);
    for (int i = 0; i < ${solarSpotCount}; i++) {
        vec4 spot = u_sunspots[i];
        if (spot.w <= 0.0) continue;
        if (dot(normal, spot.xyz) <= 0.0) continue;
        vec4 frame = u_sunspotFrames[i];
        vec3 east = vec3(frame.x, 0.0, frame.y);
        vec3 north = cross(spot.xyz, east);
        float radius = frame.z * (0.35 + 0.65 * sqrt(spot.w));
        // A travelling surface field naturally foreshortens and passes around the limb.
        vec2 offset = vec2(dot(normal, east), -dot(normal, north)) / radius;
        float distanceSquared = dot(offset, offset);
        if (distanceSquared >= 5.76) continue;
        float distance = sqrt(distanceSquared);
        float inhibition = (1.0 - smoothstep(0.15, 2.4, distance)) * spot.w * 1.15;
        pressure += inhibition * (0.78 + 0.44 * mix(structure.r, structure.g, spot.w));
        direction += offset / max(distance, 0.001) * inhibition;
    }
    pressure = min(pressure, 1.2);
    vec2 radial = normalize(direction);
    float penumbra = smoothstep(0.12, 0.65, pressure);
    // Fixed irregular coordinates roughen the cell walls without making them wiggle.
    vec2 shape = structure.rg * 0.7 + texture2D(u_map, uv * 5.0).gb * 0.3;
    vec2 p = uv * ${solarCellCount.toFixed(1)} + (shape - 0.5) * 1.6;
    vec2 tile = floor(p);
    float first = 100.0, second = 100.0, energy = 0.0, ageOfCell = 0.0, centerDistance = 0.0;
    float cycle = u_solarPhase / (2.0 * PI);
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        vec2 id = tile + vec2(float(x), float(y));
        vec4 site = texture2D(u_sites, (id + 0.5) / 256.0);
        // Independent 8–16 second lifetimes share a smooth 32 second repeat.
        float age = fract(cycle * (2.0 + floor(site.a * 2.999)) + site.b);
        float life = smoothstep(0.0, 0.28, age) * (1.0 - smoothstep(0.65, 1.0, age));
        vec2 d = id + 0.15 + site.rg * 0.7 - p;
        float across = dot(d, vec2(-radial.y, radial.x));
        // Suppressed, elongated granules grow into penumbral filaments around active regions.
        float metric = dot(d, d) + across * across * penumbra * 1.8;
        float distance = metric + (1.0 - life) * 2.25;
        if (distance < first) {
            second = first; first = distance; energy = life; ageOfCell = age; centerDistance = metric;
        } else second = min(second, distance);
    }
    float gap = max(0.0, second - first);
    float lanes = 1.0 - smoothstep(0.02, 0.65, gap);
    float interiors = smoothstep(0.025, 0.7, gap);
    float rising = exp(-centerDistance * 2.5 / max(0.3, energy));
    float emerging = smoothstep(0.0, 0.3, ageOfCell);
    // Detail changes in brightness over time; its coordinates never slide or distort.
    vec4 fine = texture2D(u_map, uv * 3.0);
    float flicker = mix(fine.r, fine.g, 0.5 + 0.5 * sin(u_solarPhase * 2.0));
    float thermal = 0.66 + interiors * (0.045 + rising * energy * 0.16 - (1.0 - emerging) * 0.04)
        - lanes * 0.065 + (flicker - 0.5) * 0.08;
    // The same thermal field determines a spot's boundary and its remaining umbral grains.
    float umbra = smoothstep(0.44, 0.88, pressure + (0.72 - thermal) * 0.85);
    thermal -= penumbra * 0.22 + umbra * (0.45 + interiors * 0.08);
    thermal += umbra * (energy - 0.5) * interiors * 0.055;
    vec3 color = mix(u_solarShadow, u_solarPrimary, smoothstep(0.12, 0.62, thermal));
    color = mix(color, u_solarHighlight, smoothstep(0.58, 1.0, thermal) * 0.65);
    color *= mix(0.14, 1.0, smoothstep(0.02, 0.28, thermal));
    color = mix(color, u_solarShadow, lanes * u_solarLaneAccent * (1.0 - umbra));
    float luminosity = 0.12 * (1.0 - smoothstep(0.0, 0.7, length(normal.xy - vec2(-0.12, 0.04)))) * (1.0 - umbra);
    return mix(color, u_solarHighlight, luminosity);
}
`;
