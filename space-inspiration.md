# Space — an interactive scene builder

An idea for a standalone project at **space.ammarz.com**, inspired by the portfolio's Space Mode. Reuse the procedural surfaces, starfield and animation work to let visitors build their own space scenes.

This is a creative playground: visitors choose what exists, how it looks and how it moves. Start with a black canvas and a control panel, then let the scene grow from there. Planet and whole-scene presets use validated, versioned JSON files from the first editor milestone.

Implementation is underway in this standalone repository. Desktop is the current priority; mobile work follows desktop completion. The portfolio remains a separate project. Local progress and temporary verification assets are tracked in the Git-ignored `.work/todo.md` and `.work/verification/`.

## The experience

1. Open an empty black scene with a control panel.
2. Add a starfield, sun or planet.
3. Adjust its colors, procedural appearance and motion with sliders, color pickers and appropriate discrete controls.
4. Add more objects and adjust their placement, orbits and viewing angle.
5. Pause, reroll individual objects or start again.
6. Eventually save a configuration and return to it later.

The scene can show an entire sun at the center, with planets around it, instead of inheriting the portfolio's cropped side composition. A centered system should be an easy starting arrangement, not a restriction on positioning objects.

Objects do **not** represent projects. They need no scene labels, logos or project details. Clicking a planet selects it for editing; the control panel also provides an object list so obscured bodies remain accessible. Overlap and occlusion are part of the composition; the editor does not need the portfolio's collision avoidance, individual hover holds, off-screen focus recovery or accelerated hidden orbital travel.

## Adding and managing objects

The original add-menu idea is: **Add starfield, Add sun, Add rocky planet, Add gas giant, Add terrestrial planet**.

Rocky and terrestrial currently describe the same underlying family in the portfolio. Preserve this as a naming/design decision: if both entries are wanted, they should eventually mean distinct presets or appearances. An icy giant preset would also reuse an existing surface style. A practical initial menu could offer Rocky/terrestrial, Gas giant and Icy giant, with more presets later.

The panel should provide an object list, selection, visibility, deletion and per-object reset/reroll. Duplication would be useful for making related worlds. Panel names such as “Planet 1” identify editor objects without adding labels to the scene.

The first version can use one sun and one configurable starfield. Multiple suns or independently layered backgrounds can remain later possibilities rather than requirements.

## Controls to expose

The goal is broad control over the existing procedural parameters. Use sliders for continuous values, color pickers for colors, and toggles/selectors for discrete choices. Useful ranges and defaults matter more than putting every implementation constant on screen at once; advanced groups can keep the panel manageable.

### Starfield

| Group | Controls |
| --- | --- |
| Population | Density; average star size and brightness; size/brightness variation |
| Standouts | Proportion; size and brightness ranges; exclusion from clusters |
| Colors | Editable colors and distribution weights for blue, white, yellow, orange, red, green, purple, brown, pink and cyan |
| Clusters | Frequency; minimum/maximum population; brightness-to-population relationship; maximum extent; irregularity; member spacing |
| Globular clusters | Eligible population threshold; proportion of eligible clusters; central concentration |
| Twinkling | Participating fraction; period range; strength range; positional shimmer; brightness variation; stronger-twinkle bias for standouts |
| Glow | Static stellar halo size/intensity; optional animated twinkle halo size/intensity |
| Generation | Seed; reroll; reset to a useful preset, including the portfolio's current look |

Keep the portfolio's current halo-free twinkling available as a preset, while allowing visitors to experiment with the earlier glow-based style. Motion strength and halo strength should be independent.

Color weights should always form a valid distribution. Show percentages and provide normalization or linked adjustment rather than silently accepting totals that do not make sense. Increasing cluster membership should not unexpectedly inflate overall density: define whether the density control targets total stars or generation sites, preferably total stars.

Cluster limits should be expressed in scene units or a meaningful screen-relative measure. The portfolio's “half Word Wasp” limit is a useful reference preset, not a dependency for this app.

### Sun

- Position and size, including an uncropped centered view.
- Primary, highlight and shadow colors; palette presets, including the current stellar palettes.
- Surface detail, convection strength and timescale.
- Sunspot frequency, size, lifetime and travel speed; independent enable/disable controls where useful.
- Glow size/intensity and edge softness.
- Seed and independent reroll.
- A solar-performance control that can freeze convection and sunspot activity while other scene motion continues.

The first version can reuse the current solar process. Flares, prominences and other larger solar effects are future experiments.

### Planets

- Surface family/preset: rocky/terrestrial, banded gas giant or subdued icy giant.
- Primary and accent colors, size, position and procedural seed.
- Surface intensity and family-specific detail: terrain relief/cratering, band contrast/variation, icy gradients and storm properties.
- Rotation speed, direction, starting phase and spin-axis tilt/orientation.
- Lighting direction, fill/shadow strength and optionally distance-based lighting from the sun.
- Storm size/shape, frequency, lifetime, circulation and drift for applicable families.
- Independent appearance reroll and motion reset.
- Appearance locking that excludes a planet from scene and individual rerolls while motion continues; deliberate manual edits remain available.
- Separate current values and next-roll minimum/maximum ranges for size, surface detail, moon count and ring-belt count. For example, a planet may currently have seven moons while the next roll is constrained to five through ten.
- Independent random streams for surfaces, weather, moons and rings; rerolling one part must preserve the others.
- Remember family-specific settings when switching rocky/gas/icy types and back.
- Export and import complete planet presets as JSON files.

Axis editing should rotate the actual sampled surface and its bands together. A sideways planet such as Uranus should have corresponding sideways banding; simply rotating a highlight or moving a flat texture would not achieve that. The existing seeded inclination is a starting point, not a complete arbitrary spin-axis editor.

### System, orbits and view

- Centered full-sun composition, with adjustable positions and framing.
- Orbit size, eccentricity, inclination, direction, speed and initial phase.
- Camera/view angle, zoom and pan, including more face-on and more edge-on systems.
- Optional orbit-line visibility, color, opacity and thickness.
- Global play/pause, orbit-position reset and separate motion controls where helpful.

Prefer projecting a simple common system of orbital planes into the view so changing the viewing angle remains coherent. Spin axes, orbital inclinations and camera orientation are separate settings. Elliptical paths and front/back depth ordering should follow the chosen view. A planet can naturally pass behind the sun or leave the frame; there is no portfolio navigation reason to skip or accelerate that part of its orbit.

The first view prototype uses Three.js with a shared 3D world and orthographic camera. The imported renderer projected DOM rectangles into screen space and needed replacement at the orchestration layer. Procedural maps and solar/storm/shadow work remain reusable. Initial presets are bird’s-eye, centered side view, and side view with the sun framed at the edge.

## Reusing the portfolio work

Reusable code now lives in `src/react-app/scene/utils/` and `scene/data/`. Current orchestration lives in `scene/rendering/`; the scene model and JSON schema live in `scene/model/`. Original portfolio starting points were:

- `src/react-app/utils/starfield.ts` and `twinkleShader.ts`: seeded colors, ordinary/standout populations, cluster generation and scintillation.
- `planetTextures.ts`, `planetMaps.ts` and `giantMaps.ts`: procedural materials and existing static fallbacks.
- `giantStorms.ts`: seeded evolving weather with local cloud circulation and band bending.
- `solarMaps.ts`, `solarActivity.ts` and `solarShader.ts`: convection, seeded sunspot events and spherical travel.
- `planetRenderer.ts`: shared WebGL rendering, spherical projection, lighting, animation clocks and solar caching.
- `planetRotation.ts`, `planetLighting.ts`, `spaceGeometry.ts` and `orbitalMotion.ts`: motion/lighting defaults and reusable geometric ideas.

Some of these utilities currently contain portfolio-specific assumptions, measured DOM geometry or fixed parameters. Reuse them behind scene-model adapters, and parameterize what the editor needs. Keep the portfolio's present appearance as a tested default rather than requiring a broad rewrite before the builder can exist.

## Configuration and responsiveness

Define a serializable scene model from the start, even before adding a Save button. It should contain stable object IDs, seeds, appearance parameters, initial motion phases, lighting, orbit definitions, view settings and a schema version. Include generator-version information if later algorithm changes could otherwise alter saved scenes.

Store the inputs needed to recreate a scene, not generated texture blobs, DOM measurements or WebGL resources. Use consistent units, and distinguish a planet's rotation axis from its orbit plane and the camera angle. Resetting orbital positions should not reroll materials or reset unrelated activity.

Cheap controls should update immediately. Cache procedural materials and debounce expensive regeneration while dragging detail controls. Preserve the shared animation clock, pause behavior, reduced-motion support, visibility suspension and bounded rendering resolution. Avoid rebuilding textures for motion-only edits.

A mobile editor can use a drawer or bottom sheet so its panel does not consume the whole scene. The portfolio's current project-detail layout is not a requirement for this separate app.

## Preset files and later persistence

Planet presets and whole-scene presets are JSON files. Save explicit current parameters together with seeds, lock state, reroll ranges, family-specific settings, and version information. Scene presets embed all object configurations and capture camera and timeline settings. Loading a scene must not depend on external planet preset files. Imports validate before replacing state; imported individual planets receive fresh IDs.

Local browser autosave, shareable links, hosted saves, accounts and galleries remain optional later work. No backend is needed for JSON preset files. Image/video export is separate from saving an editable scene.

## “My Space”

Add a personal **About** page titled **My Space**—“my” means Ammar specifically, not a visitor-owned space or saved scene. The name is part of the idea :^)

Use a single central reading column, with space beside it for Ammar’s actual astrophotography and captions. Personal page content and photographs are site-level assets, separate from editable scene/preset data. Keep the header translucent like the portfolio.

It can explain why I made the site, how it grew out of the portfolio's Space Mode, and what interests me about space and procedural scenes. Include some of my personal astrophotography, with captions and any equipment/exposure details I want to share. The photos should feel like a personal part of the project rather than stock decoration.

Keep the playful builder as the main destination, with My Space providing the personal background and a link back to ammarz.com. Its background is the exact currently rendered starfield, kept mounted at app level with the same settings, seed, and clock across navigation.

## Build order

- [x] Clean the template and import reusable generators and attributed assets.
- [x] Define a versioned scene/planet model and validated JSON preset format.
- [x] Evaluate renderer constraints and prototype all three views in common 3D coordinates.
- [x] Build the first desktop editor with starfield, sun, clickable planets, object list, basic appearance controls and locks.
- [x] Add independent rerolls, next-roll ranges, and planet/scene JSON import/export.
- [x] Preserve scene timelines and separate orbital reset from other activity.
- [ ] Review the first desktop milestone and expand family-specific surface/weather/ring controls.
- [ ] Refine camera/view editing and manual composition after prototype review.
- [ ] Expand My Space with selected personal astrophotography while preserving its shared starfield.
- [ ] Complete desktop behavior and polish before considering mobile.
- [ ] Decide whether browser autosave, sharing or hosted persistence are useful later.

Keep UI colors, typography, and the header close to the portfolio’s blue glass styling and AmmarZ identity. Implementation progress and verification notes are maintained in `.work/todo.md`; this document records the longer-term direction.

## Desktop site basics — clarified November 3, 2026

- About navigation leads to the personal My Space page described above.
- Preserve a readable, translucent navy header over bright solar content; scene rendering can continue behind it.
- Start with a larger sun and portfolio-like cropped side composition. Preserve the requested full-sun centered and bird’s-eye alternatives. Custom orbits need not be forced into the frame.
- Provide an explicit, labeled orbit-line toggle.
- Full-screen/focus mode expands the scene and hides chrome away from the edges. Header, object list, inspector and playback/camera controls reveal near their respective edges. A selected object keeps its inspector visible.
- Revealed full-screen side panels fill the entire height; leave their text and controls at their existing vertical positions using top padding. This fill applies only in full-screen mode.
- Preserve keyboard access, Escape to exit, and a focus-mode fallback when native fullscreen is unavailable.


## Background and rendering review

- Deep-sky objects retain the portfolio’s photograph cutouts, default selection, placement, and blending. Expose visibility, density, size, brightness, and a separate reroll seed in Starfield settings and scene JSON.
- Configure cluster and large-star frequencies independently, from zero through five times the portfolio defaults. Density controls star sites; clusters contribute additional members.
- Planet longitude wraps must remain seamless during spin; ring bands should use the portfolio’s filtered opacity texture. Preserve gentle ambient fill and soft planetary terminators with the sun visible.
