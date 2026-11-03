import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { chooseDeepSky } from "../src/react-app/scene/data/deepSky.ts";
import { generateStarfield } from "../src/react-app/scene/utils/starfield.ts";
import { generatePlanetMap } from "../src/react-app/scene/utils/planetMaps.ts";
import { getSolarActivity } from "../src/react-app/scene/utils/solarActivity.ts";
import { getGiantStormActivity } from "../src/react-app/scene/utils/giantStorms.ts";
import { getPlanetSystem } from "../src/react-app/scene/utils/planetSystems.ts";
import { getPlanetRotation } from "../src/react-app/scene/utils/planetRotation.ts";
import { getPlanetLighting, getPlanetPhaseLighting } from "../src/react-app/scene/utils/planetLighting.ts";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Captured by running the original portfolio generators, before adapting their consumers.
test("seeded scene generators retain the portfolio output", async () => {
    const expected = JSON.parse(await readFile(new URL("./fixtures/portfolio-baselines.json", import.meta.url), "utf8"));
    const appearance = { color: "#528bea", accentColor: "#d8e7f2", type: "giant", intense: true, seed: "tasked" };
    const moon = await generatePlanetMap({
        color: "#aaa79d", accentColor: "#56534d", type: "terrestrial", intense: true, seed: "moon-rock-0", detail: "moon",
    });
    assert.deepEqual({
        stars: hash(generateStarfield(1024, 768, 1871)),
        moonPixels: hash(Array.from(moon.pixels)),
        solarActivity: hash(getSolarActivity(1871, 45123)),
        planetSystem: hash(getPlanetSystem(appearance)),
        rotation: hash(getPlanetRotation(appearance.seed, appearance)),
        stormActivity: hash(getGiantStormActivity("tasked", [{ u: 0.3, v: 0.4, radiusU: 0.1, radiusV: 0.05, rotation: 0.2 }], 45123)),
    }, expected);
});

test("lighting accepts scene distances and transit fill without project data", () => {
    const settings = {
        innerRadius: 10, outerRadius: 30,
        inner: { fill: 0.6, depth: 2, terminatorStart: -0.6 },
        outer: { fill: 0.2, depth: 1, terminatorStart: -0.4 },
        falloff: 1, transitFill: 0.1,
    };
    assert.equal(getPlanetLighting(0, settings).fill, 0.6);
    assert.ok(Math.abs(getPlanetLighting(20, settings).fill - 0.4) < 1e-12);
    assert.ok(Math.abs(getPlanetLighting(100, settings).fill - 0.2) < 1e-12);
    const profile = getPlanetLighting(20, settings);
    const shaded = getPlanetPhaseLighting(profile, { solarAngularRadius: 0.25, transit: 1 });
    assert.ok(Math.abs(shaded.fill - 0.1) < 1e-12);
    assert.equal(shaded.terminatorStart, -0.25);
    assert.ok(Math.abs(profile.fill - 0.4) < 1e-12);
});

test("every credited deep-sky object has its local WebP thumbnail", async () => {
    const root = new URL("../public/space/deep-sky/", import.meta.url);
    const catalogue = JSON.parse(await readFile(new URL("sources.json", root), "utf8"));
    const credits = await readFile(new URL("CREDITS.md", root), "utf8");
    const files = new Set(await readdir(new URL("thumbs/", root)));
    assert.equal(catalogue.length, 100);
    assert.equal(new Set(catalogue.map(asset => asset.id)).size, catalogue.length);
    for (const asset of catalogue) {
        assert.equal(asset.previewFile, `/space/deep-sky/thumbs/${asset.id}.webp`);
        assert.ok(files.has(`${asset.id}.webp`), asset.id);
        assert.ok(asset.credit && credits.includes(asset.page), asset.id);
        const bytes = await readFile(new URL(`thumbs/${asset.id}.webp`, root));
        assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
        assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    }
});

test("cluster and large-star frequencies are deterministic and independently disableable", () => {
    const sky = (clusters, large) => generateStarfield(2048, 1536, 1871, 36, clusters, large);
    const ordinary = sky(0, 0);
    assert.ok(ordinary.every(star => !star.cluster && !star.standout));
    const clusters = sky(5, 0);
    const large = sky(0, 5);
    assert.ok(clusters.some(star => star.cluster));
    assert.ok(clusters.every(star => !star.standout));
    assert.ok(large.some(star => star.standout));
    assert.ok(large.every(star => !star.cluster));
    assert.ok(clusters.filter(star => star.cluster).length > sky(1, 0).filter(star => star.cluster).length);
    assert.ok(large.filter(star => star.standout).length > sky(0, 1).filter(star => star.standout).length);
    assert.deepEqual(sky(2.5, 1.7), sky(2.5, 1.7));
    assert.deepEqual(generateStarfield(1024, 768, 1871), generateStarfield(1024, 768, 1871, 36, 1, 1));
});


test("deep-sky density preserves the portfolio selection and limits the available placement cells", async () => {
  const catalogue = JSON.parse(await readFile(new URL("../public/space/deep-sky/sources.json", import.meta.url), "utf8"));
  const original = chooseDeepSky(1871, true, catalogue);
  assert.ok(original.length >= 6 && original.length <= 10);
  assert.deepEqual(chooseDeepSky(1871, true, catalogue, 0), []);
  const fuller = chooseDeepSky(1871, true, catalogue, 1.5);
  assert.ok(fuller.length <= 12);
  assert.deepEqual(fuller.slice(0, original.length), original);
  assert.equal(new Set(fuller.map(asset => asset.id)).size, fuller.length);
  assert.deepEqual(chooseDeepSky(1871, true, catalogue, 1), original);
});
