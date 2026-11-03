import * as THREE from "three";
import type { Planet } from "../model/schema.ts";
import {
  cloudRotation,
  cloudEvolution,
  cloudSeedOffset,
  environmentSettings,
} from "../model/atmospheres.ts";
import { planetShadowFragment } from "../utils/planetShadowShader.ts";
const vertex = `varying vec3 v_localNormal; varying vec3 v_normal; varying vec3 v_worldPosition;
void main(){v_localNormal=normal;v_normal=normalize(mat3(modelMatrix)*normal);
vec4 world=modelMatrix*vec4(position,1.0);v_worldPosition=world.xyz;
gl_Position=projectionMatrix*viewMatrix*world;}`;
const cloudFragment = `
precision highp float;
const float PI=3.141592653589793;
varying vec3 v_localNormal; varying vec3 v_normal; varying vec3 v_worldPosition;
uniform vec3 u_evolution; uniform vec3 u_seed; uniform vec3 u_color; uniform vec3 u_sun; uniform vec3 u_view;
uniform float u_coverage; uniform float u_opacity; uniform float u_scale;
uniform float u_fill; uniform float u_terminatorStart;
${planetShadowFragment}
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float field(vec3 p){float value=0.0, amplitude=0.55;for(int i=0;i<5;i++){
value+=amplitude*noise(p);p=mat3(0.8,0.0,-0.6,0.0,1.0,0.0,0.6,0.0,0.8)*p*2.03+vec3(7.1,3.7,13.2);amplitude*=0.5;}return value;}
void main(){
vec3 p=normalize(v_localNormal)*u_scale;
vec3 flow=vec3(noise(p*0.65+u_seed+u_evolution),noise(p*0.65+u_seed+vec3(29,11,7)+u_evolution.zxy),noise(p*0.65+u_seed+vec3(7,31,19)+u_evolution.yzx))-0.5;
float weather=field((p+flow*1.6)*vec3(1.0,1.7,1.0)+u_seed+u_evolution*0.45);
float threshold=mix(0.83,0.20,u_coverage);
float feather=max(0.045,fwidth(weather)*1.5);
float cover=smoothstep(threshold-feather,threshold+feather,weather);
cover=mix(cover,1.0,smoothstep(0.88,1.0,u_coverage));
vec3 normal=normalize(v_normal);float edge=smoothstep(0.0,0.10,dot(normal,u_view));
float alpha=cover*u_opacity*edge;if(alpha<0.002)discard;
float diffuse=smoothstep(u_terminatorStart,0.92,dot(normal,normalize(u_sun-v_worldPosition)));
float light=u_fill+(1.0-u_fill)*diffuse*planetShadowVisibility(normal);
float volume=0.73+0.33*weather;
gl_FragColor=vec4(u_color*volume*light,alpha);
}`;
const atmosphereFragment = `precision highp float;
varying vec3 v_localNormal;varying vec3 v_normal;varying vec3 v_worldPosition;
uniform vec3 u_color;uniform vec3 u_view;uniform vec3 u_sun;uniform float u_density;uniform float u_outer;
void main(){vec3 normal=normalize(v_normal);float facing=max(0.0,dot(normal,u_view));
float impact=u_outer*sqrt(max(0.0,1.0-facing*facing));
float edge=1.0-smoothstep(1.0,u_outer,impact);
float rim=pow(1.0-facing,2.8);
float daylight=smoothstep(-0.35,0.25,dot(normal,normalize(u_sun-v_worldPosition)));
float alpha=rim*edge*u_density*(0.18+0.82*daylight);
gl_FragColor=vec4(u_color*1.15,alpha);
}`;
const rgb = (hex: string) =>
  new THREE.Vector3(
    ...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
  );
export type PlanetEnvironment = {
  clouds?: THREE.Mesh;
  atmosphere?: THREE.Mesh;
  update(
    time: number,
    radius: number,
    view: THREE.Vector3,
    spin: Planet["spin"],
  ): void;
  dispose(): void;
};
/** Actual shells keep weather separate from the underlying surface and its random stream. */
export function createPlanetEnvironment(
  geometry: THREE.SphereGeometry,
  planet: Planet,
  surface: THREE.ShaderMaterial,
): PlanetEnvironment | undefined {
  const settings = environmentSettings(planet);
  if (!settings.hasClouds && !settings.hasAtmosphere) return;
  const materials: THREE.ShaderMaterial[] = [];
  let clouds: THREE.Mesh | undefined, atmosphere: THREE.Mesh | undefined;
  if (settings.hasClouds) {
    const shared = Object.fromEntries(
      [
        "u_sun",
        "u_fill",
        "u_terminatorStart",
        "u_shadowCount",
        "u_shadowCasters",
        "u_shadowFades",
        "u_shadowSun",
      ].map((key) => [key, surface.uniforms[key]]),
    );
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...shared,
        u_shadowRadius: { value: 1 },
        u_view: { value: new THREE.Vector3() },
        u_evolution: { value: new THREE.Vector3() },
        u_seed: { value: new THREE.Vector3(...cloudSeedOffset(planet)) },
        u_color: { value: rgb(settings.clouds.color) },
        u_coverage: { value: settings.clouds.coverage },
        u_opacity: { value: settings.clouds.opacity },
        u_scale: { value: settings.clouds.scale },
      },
    });
    materials.push(material);
    clouds = new THREE.Mesh(geometry, material);
    clouds.scale.setScalar(settings.cloudScale);
    clouds.userData.planetId = planet.id;
    clouds.renderOrder = -1;
  }
  if (settings.hasAtmosphere) {
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_sun: surface.uniforms.u_sun,
        u_view: { value: new THREE.Vector3() },
        u_color: { value: rgb(settings.atmosphere.color) },
        u_density: { value: settings.atmosphere.density },
        u_outer: { value: settings.atmosphereScale },
      },
    });
    materials.push(material);
    atmosphere = new THREE.Mesh(geometry, material);
    atmosphere.scale.setScalar(settings.atmosphereScale);
    atmosphere.renderOrder = 1;
    atmosphere.raycast = () => {};
  }
  return {
    clouds,
    atmosphere,
    update(time, radius, view, spin) {
      if (clouds) {
        clouds.rotation.y = cloudRotation(planet, time, spin);
        const uniforms = (clouds.material as THREE.ShaderMaterial).uniforms;
        uniforms.u_view.value.copy(view);
        uniforms.u_evolution.value.fromArray(cloudEvolution(planet, time));
        uniforms.u_shadowRadius.value = radius * settings.cloudScale;
      }
      if (atmosphere)
        (
          atmosphere.material as THREE.ShaderMaterial
        ).uniforms.u_view.value.copy(view);
    },
    dispose() {
      for (const material of materials) material.dispose();
    },
  };
}
