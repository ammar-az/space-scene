import * as THREE from "three";
import type { PlanetTextureOptions } from "../utils/planetTextures.ts";
import type { PlanetMap } from "../utils/planetMaps.ts";
import { generatePlanetMap } from "../utils/planetMaps.ts";
import { getSolarFields } from "../utils/solarMaps.ts";
import { solarFragment, solarSpotCount } from "../utils/solarShader.ts";
import {
  giantStormFragment,
  giantStormCount,
  getGiantStormPalette,
} from "../utils/giantStorms.ts";
import { planetShadowFragment } from "../utils/planetShadowShader.ts";
import { maxPlanetShadowCasters } from "../utils/planetShadows.ts";
import { ringPixels } from "../utils/planetSystems.ts";
import type { RingProfile } from "../utils/planetSystems.ts";
import type { SceneModel } from "../model/schema.ts";

export function dataTexture(
  map: Pick<PlanetMap, "width" | "height" | "pixels">,
) {
  const texture = new THREE.DataTexture(
    map.pixels,
    map.width,
    map.height,
    THREE.RGBAFormat,
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Reference-count pending work too, so stale async maps never leak GPU textures. */
export class TextureStore {
  private entries = new Map<
    string,
    {
      refs: number;
      promise: Promise<{ texture: THREE.DataTexture; map: PlanetMap }>;
      texture?: THREE.DataTexture;
    }
  >();
  acquire(options: PlanetTextureOptions) {
    const key = JSON.stringify(options);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { refs: 0, promise: Promise.resolve(null as never) };
      const current = entry;
      current.promise = Promise.resolve()
        .then(() => generatePlanetMap(options))
        .then((map) => {
          const texture = dataTexture(map);
          texture.wrapT = THREE.ClampToEdgeWrapping;
          current.texture = texture;
          if (current.refs === 0) texture.dispose();
          return { texture, map };
        });
      this.entries.set(key, entry);
    }
    entry.refs++;
    const current = entry;
    let released = false;
    return {
      ready: current.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--current.refs === 0) {
          current.texture?.dispose();
          if (this.entries.get(key) === current) this.entries.delete(key);
        }
      },
    };
  }
}

const vertex = `
varying vec3 v_localNormal;
varying vec3 v_worldNormal;
varying vec3 v_worldPosition;
varying vec3 v_tangent;
void main() {
    v_localNormal = normalize(normal);
    v_worldNormal = normalize(mat3(modelMatrix) * normal);
    v_tangent = normalize(mat3(modelMatrix) * vec3(normal.z + 0.00001, 0.0, -normal.x));
    vec4 world = modelMatrix * vec4(position, 1.0);
    v_worldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;
const planetFragment = `
precision highp float;
const float PI = 3.141592653589793;
uniform sampler2D u_map;
uniform float u_equalArea;
uniform float u_relief;
uniform float u_fill;
uniform float u_terminatorStart;
uniform vec3 u_sun;
uniform vec3 u_tint;
varying vec3 v_localNormal;
varying vec3 v_worldNormal;
varying vec3 v_worldPosition;
varying vec3 v_tangent;
${giantStormFragment}
${planetShadowFragment}
// atan crosses 0/1 at longitude: correct its derivatives before mip selection.
vec4 sampleSurface(vec2 uv) {
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    dx.x -= floor(dx.x + 0.5);
    dy.x -= floor(dy.x + 0.5);
    return textureGrad(u_map, uv, dx, dy);
}
void main() {
    vec3 local = normalize(v_localNormal);
    float v = u_equalArea > 0.5 ? 0.5 - local.y * 0.5 : asin(clamp(local.y, -1.0, 1.0)) / PI + 0.5;
    vec2 uv = vec2(atan(local.x, local.z) / (2.0 * PI) + 0.5, v);
    vec2 flow = giantFlow(uv);
    vec3 albedo = giantWeather(sampleSurface(flow).rgb, uv) * u_tint;
    vec3 normal = normalize(v_worldNormal);
    if (u_relief > 0.0) {
        float dx = sampleSurface(uv + vec2(1.0/512.0,0.0)).a - sampleSurface(uv - vec2(1.0/512.0,0.0)).a;
        float dy = sampleSurface(uv + vec2(0.0,1.0/256.0)).a - sampleSurface(uv - vec2(0.0,1.0/256.0)).a;
        vec3 tangent = normalize(v_tangent - normal * dot(normal, v_tangent));
        normal = normalize(normal - u_relief * (tangent * dx * 40.0 + cross(normal, tangent) * dy * 40.0));
    }
    vec3 light = normalize(u_sun - v_worldPosition);
    float diffuse = smoothstep(u_terminatorStart, 0.92, dot(normal, light));
    float shadow = planetShadowVisibility(normalize(v_worldNormal));
    float brightness = u_fill + (1.0 - u_fill) * diffuse * shadow;
    vec3 color = albedo * brightness;
    gl_FragColor = vec4(color, 1.0);
}`;

export type PlanetSurface = {
  material: THREE.ShaderMaterial;
  map?: PlanetMap;
  dispose(): void;
};
export function createPlanetSurface(
  store: TextureStore,
  options: PlanetTextureOptions,
  onError: (message: string) => void,
): PlanetSurface {
  const lease = store.acquire(options);
  const palette = getGiantStormPalette(options);
  const placeholder = dataTexture({
    width: 1,
    height: 1,
    pixels: new Uint8Array([
      ...new THREE.Color(options.color)
        .toArray()
        .map((c) => Math.round(c * 255)),
      128,
    ]),
  });
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: planetFragment,
    uniforms: {
      u_map: { value: placeholder },
      u_equalArea: { value: options.type === "giant" ? 1 : 0 },
      u_relief: {
        value: options.earthlike?.enabled
          ? 0.035
          : options.type === "terrestrial"
            ? 0.07
            : 0,
      },
      u_fill: { value: options.detail === "moon" ? 0.28 : 0.4 },
      u_terminatorStart: { value: -0.4 },
      u_sun: { value: new THREE.Vector3() },
      u_tint: { value: new THREE.Vector3(1, 1, 1) },
      u_stormsEnabled: { value: 0 },
      u_storms: {
        value: Array.from(
          { length: giantStormCount },
          () => new THREE.Vector4(),
        ),
      },
      u_stormMotion: {
        value: Array.from(
          { length: giantStormCount },
          () => new THREE.Vector4(),
        ),
      },
      u_stormPale: { value: new THREE.Vector3(...palette.pale) },
      u_stormDark: { value: new THREE.Vector3(...palette.dark) },
      u_shadowCount: { value: 0 },
      u_shadowCasters: {
        value: Array.from(
          { length: maxPlanetShadowCasters },
          () => new THREE.Vector4(),
        ),
      },
      u_shadowFades: { value: new Float32Array(maxPlanetShadowCasters) },
      u_shadowSun: { value: new THREE.Vector4() },
      u_shadowRadius: { value: 1 },
    },
  });
  let alive = true;
  const surface: PlanetSurface = {
    material,
    dispose() {
      alive = false;
      material.dispose();
      placeholder.dispose();
      lease.release();
    },
  };
  void lease.ready
    .then(({ texture, map }) => {
      if (!alive) return;
      surface.map = map;
      material.uniforms.u_map.value = texture;
      placeholder.dispose();
    })
    .catch((error) => {
      if (alive)
        onError(
          error instanceof Error
            ? error.message
            : "Could not prepare a planet surface.",
        );
    });
  return surface;
}

const sunFragment = `
precision highp float;
const float PI = 3.141592653589793;
uniform sampler2D u_map;
varying vec3 v_localNormal;
${solarFragment}
void main() { gl_FragColor = vec4(solarSurface(normalize(v_localNormal)), 1.0); }
`;
export function createSunSurface(sun: SceneModel["sun"]) {
  const fields = getSolarFields(sun.seed);
  const detail = dataTexture(fields.detail),
    sites = dataTexture(fields.sites);
  const rgb = (hex: string) =>
    new THREE.Vector3(
      ...[1, 3, 5].map(
        (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
      ),
    );
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: sunFragment,
    uniforms: {
      u_map: { value: detail },
      u_sites: { value: sites },
      u_solar: { value: 1 },
      u_solarPhase: { value: 0 },
      u_sunspots: {
        value: Array.from(
          { length: solarSpotCount },
          () => new THREE.Vector4(),
        ),
      },
      u_sunspotFrames: {
        value: Array.from(
          { length: solarSpotCount },
          () => new THREE.Vector4(),
        ),
      },
      u_solarPrimary: { value: rgb(sun.color) },
      u_solarHighlight: { value: rgb(sun.highlight) },
      u_solarShadow: { value: rgb(sun.shadow) },
      u_solarLaneAccent: { value: 0 },
    },
  });
  return {
    material,
    dispose() {
      material.dispose();
      detail.dispose();
      sites.dispose();
    },
  };
}

export function createGlow(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { u_color: { value: new THREE.Color(color) } },
    vertexShader:
      "varying vec2 v_uv; void main(){v_uv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec2 v_uv; uniform vec3 u_color; void main(){float d=length(v_uv-0.5)*2.0;float glow=exp(-d*5.8)*0.5*(1.0-smoothstep(0.7,1.0,d));gl_FragColor=vec4(u_color,glow);}",
  });
}
export function createRingMaterial(
  profile: RingProfile & { complexity?: number },
) {
  const { inner, outer } = profile;
  const texture = dataTexture({
    width: 512,
    height: 1,
    pixels: ringPixels(profile, profile.complexity ?? 1),
  });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      u_profile: { value: texture },
      u_color: { value: new THREE.Vector3(...profile.tint) },
      u_opacity: { value: profile.opacity },
      u_inner: { value: inner },
      u_outer: { value: outer },
      u_sun: { value: new THREE.Vector3() },
    },
    vertexShader: `varying vec3 v_position; varying vec3 v_worldPosition; varying vec3 v_normal;
      void main() { v_position=position; vec4 world=modelMatrix*vec4(position,1.0);
        v_worldPosition=world.xyz; v_normal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `varying vec3 v_position; varying vec3 v_worldPosition; varying vec3 v_normal;
      uniform sampler2D u_profile; uniform vec3 u_color; uniform vec3 u_sun;
      uniform float u_opacity; uniform float u_inner; uniform float u_outer;
      void main() {
        float r=(length(v_position.xy)-u_inner)/(u_outer-u_inner);
        float density=texture2D(u_profile,vec2(r,0.5)).r;
        float light=0.55+0.45*sqrt(abs(dot(normalize(v_normal),normalize(u_sun-v_worldPosition))));
        gl_FragColor=vec4(u_color*light,density*u_opacity);
      }`,
  });
  material.addEventListener("dispose", () => texture.dispose());
  return material;
}
