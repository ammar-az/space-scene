import type { SceneModel } from "./schema.ts";

/** Scale physical solar orbits about the star; moon systems and periods stay local. */
export function updateStar(
  scene: SceneModel,
  sun: SceneModel["sun"],
): SceneModel {
  const ratio = sun.diameter / scene.sun.diameter;
  if (!scene.sun.scaleOrbitsWithSize || ratio === 1) return { ...scene, sun };

  const distance = (value: number) => {
    const scaled = value * ratio;
    if (!Number.isFinite(scaled) || scaled < 0.000001 || scaled > 1e9)
      throw new Error(
        "This star size would move orbit distances outside their supported range. Choose a closer size or turn off orbit scaling first.",
      );
    return scaled;
  };
  const planets = scene.planets.map((planet) => ({
    ...planet,
    orbit: {
      ...planet.orbit,
      center: planet.orbit.center.map((value, axis) => {
        const scaled =
          scene.sun.position[axis] + (value - scene.sun.position[axis]) * ratio;
        if (!Number.isFinite(scaled) || Math.abs(scaled) > 1e6)
          throw new Error(
            "This star size would move an orbit center outside its supported range. Choose a closer size or turn off orbit scaling first.",
          );
        return scaled;
      }) as [number, number, number],
      ellipse: {
        ...planet.orbit.ellipse,
        radiusX: distance(planet.orbit.ellipse.radiusX),
        radiusZ: distance(planet.orbit.ellipse.radiusZ),
      },
    },
  }));
  return {
    ...scene,
    sun,
    planets,
    ...(scene.asteroidBelt
      ? {
          asteroidBelt: {
            ...scene.asteroidBelt,
            distance: scene.asteroidBelt.distance.map(distance) as [
              number,
              number,
            ],
          },
        }
      : {}),
  };
}
