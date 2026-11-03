# Space

A desktop space-scene editor at [space.ammarz.com](https://space.ammarz.com), built with React, TypeScript, Three.js, Vite, and Cloudflare Workers. Its typography, blue glass surfaces, translucent header identity, and starter palettes follow [the portfolio](https://ammarz.com).

The app opens a starter system with a larger sun and portfolio-style side framing. The sun is cropped at the left edge; custom orbits can naturally extend outside the frame. Select a planet in the scene or object list to edit it. The broader direction is captured in [space-inspiration.md](space-inspiration.md).

## Development

Use Node.js **26.13.0 LTS**, pinned in `.node-version` for local development and Cloudflare Workers Builds.

```bash
npm ci
npm run dev
```

```bash
npm run check
```

The full check runs TypeScript, ESLint, regression/model tests, the production build, and a Cloudflare deployment dry run. `npm test`, `npm run build`, and `npm run preview` are also available. Pushing to `main` triggers the existing Cloudflare build/deployment integration.

`.work/` is intentionally ignored by Git. Keep progress in `.work/todo.md`, rendering decisions in `.work/notes/`, temporary presets/assets in `.work/assets/`, and verification images/results in `.work/verification/`. The local browser tooling and comparison copies of the old renderer also live there.

The minimal Worker returns 404 for requests not handled by Cloudflare's static asset layer. There is no application API. Regenerate runtime types with `npm run cf-typegen` after changing Worker bindings or compatibility settings.

## Current editor

- Add, select, duplicate, hide, and delete planets.
- Rocky, gas, and icy families retain separate colors and surface settings when switching between them.
- Adjust size, cratering, storm activity, icy band variation, moons, ring belts, and actual spin-axis tilt.
- Adjust orbital radius, eccentricity, inclination, speed, starting phase, spin speed, and axis orientation.
- Configure minimum/maximum ranges for the next reroll, with independent surface, moon, and ring seeds.
- Lock a planet's appearance to exclude it from individual and scene rerolls. Locks protect randomization; deliberate manual edits still work.
- Switch between bird's-eye, centered side, and offset-sun side views of the same world. Drag to pan, scroll to zoom, toggle orbit lines, or reset framing.
- Pause the shared clock or reset orbital positions independently of starfield, spin, and solar activity.
- Use the visible **Orbits** toggle to show/hide orbit lines. **Full screen** (or `F`) expands the scene and reveals controls at the edges. Selecting an object keeps its inspector open. Escape returns to the editor. Revealed panels fill the full viewport height while their content stays below the header. A windowed focus mode is used if native fullscreen is unavailable.
- Edit star density, cluster frequency, large-star frequency, size, brightness, twinkling, and seed. Deep-sky photographs have independent visibility, density, size, brightness, and rerolling. The 1× defaults preserve the portfolio sky. Edit sun size, colors, seed, visibility, and independent solar activity.
- Export/import planet and whole-scene JSON presets. Import validates the entire file before applying it; imported planets receive fresh object IDs.
- **About** opens Ammar’s personal page, titled **My Space**, with one central reading column and room for his own astrophotography on either side. It retains the same starfield canvas. Photo metadata belongs in `src/react-app/data/about.ts`; no stock substitutes or invented personal photographs are included.

The current editor state is in memory. Export JSON to keep a preset before refreshing or closing the page. Mobile work is intentionally deferred until the desktop experience is complete.

## Scene model and presets

`src/react-app/scene/model/schema.ts` defines strict, versioned JSON documents with a `kind` of `space-scene` or `space-planet`, `schemaVersion`, and `generatorVersion`. Unsupported versions, invalid values/ranges, duplicate scene IDs, and oversized files are rejected.

A planet records its explicit appearance, family settings, randomization ranges, seeds, lock, orbit, and spin separately. Ranges describe the next roll; changing them does not modify the current value. A scene contains complete object configurations, background, sun, camera, motion settings, and a snapshot of shared/solar time, with no external preset dependencies or GPU resources.

`model/scene.ts` supplies pure creation and reroll operations. Each randomized part has its own stream; rerolling moons preserves the surface and rings. `model/geometry.ts` defines focus-centered ellipses and camera framing in common world units. Camera presets do not rewrite object positions, orbital planes, or spin axes. New scenes use the `portfolio` framing profile; existing JSON without a profile retains the earlier `standard` camera behavior. The side framing matches the portfolio’s 112% sun height and visible limb position while preserving a spherical 3D sun.

## Rendering

`scene/rendering/SceneRenderer.ts` owns one Three.js world, orthographic camera, sphere/ring geometry, ray picking, resource lifecycle, and animation. `rendering/materials.ts` adapts the portfolio's procedural maps and solar/storm/shadow shader functions to actual 3D meshes. Giant maps use equal-area coordinates; rocky maps use latitude coordinates. Material alpha is terrain height, not transparency. The legacy procedural shader color convention is retained explicitly rather than treating these maps as ordinary transparent image textures. Wrapped longitude derivatives prevent mipmap seams; planet maps clamp at the poles. Rings reuse the portfolio’s seeded radial opacity profile in a filtered, mipmapped texture instead of analytic fine stripes. Visible-sun lighting uses a softer terminator and 40% planet / 28% moon fill, with eclipses affecting direct light.

`rendering/clock.ts` supplies shared pause, speed, visibility suspension, reduced-motion behavior, and snapshot restoration. Orbital reset uses its own epoch; solar activity has an independently pausable time. The starfield remains mounted above page-specific content and samples the same clock. Its deep-sky cutouts use the portfolio’s original selection, placement, screen blending, rotation, size, and opacity at default settings. Stars and deep-sky objects use independent seeds; missing new background fields in older JSON use portfolio defaults. Cluster and large-star frequencies multiply the original per-site probabilities (0 disables that feature). Overall star density controls site density, so richer clusters add their member stars.

The old renderer projected DOM rectangles directly and allocated artificial depth bands to each planetary system. It was replaced because a common 3D world better supports the requested camera views, independent axes, ring planes, occlusion, and picking. Reference copies are in ignored `.work/reference/`; reusable generators remain under `scene/utils/` and palette data under `scene/data/`.

Further crater/storm shaping, ring appearance controls, manual object placement, and camera refinements can build on the current model. Generator changes must preserve existing version behavior or provide explicit migration/compatibility handling for saved presets.

## Background assets

`public/space/deep-sky/` contains 100 small transparent WebP thumbnails, their catalogue, and the original [credits](public/space/deep-sky/CREDITS.md). These render behind the procedural stars using the portfolio’s cutout treatment and are configurable in the Starfield inspector. Full-size photographs remain publisher links.

The same files are public at `https://ammarz.com/space/deep-sky/`, but the catalogue and sample thumbnail checked on November 2, 2026 lacked CORS permission for `https://space.ammarz.com`. Local copies avoid cross-origin fetch/canvas restrictions. The header logo and favicon are copied from the portfolio as local assets too.

## Verification

Node tests cover compatibility with the original seeded generators, strict JSON validation and round trips, lock behavior, independent ranged rerolls, world-space orbit/view behavior, timeline snapshots, orbital resets, and clock suspension. Browser checks exercise the real WebGL renderer, selection, editing, import/export, view switching, and persistent starfield; screenshots and results belong in `.work/verification/`.

Current browser verification uses desktop Chromium with software WebGL. Hardware/browser diversity and mobile testing are separate follow-up work.
