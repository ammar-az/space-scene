import { useEffect, useMemo, useRef, useState } from "react";
import AboutPage from "./components/AboutPage.tsx";
import { useImmersiveMode } from "./hooks/useImmersiveMode.ts";
import { viewFrame } from "./scene/model/geometry.ts";
import monogram from "./assets/az-shaded.svg";
import Starfield from "./components/editor/Starfield.tsx";
import SceneCanvas from "./components/editor/SceneCanvas.tsx";
import { Icon, RangeField, Slider } from "./components/editor/controls.tsx";
import {
  createPlanet,
  createScene,
  freshSeed,
  instantiatePlanet,
  objectId,
  rerollPlanet,
  rerollScene,
} from "./scene/model/scene.ts";
import {
  parsePreset,
  serializePlanet,
  serializeScene,
} from "./scene/model/schema.ts";
import type { Planet, SceneModel, ViewPreset } from "./scene/model/schema.ts";
import { scenePresets } from "./data/presets.ts";
import type { ScenePreset } from "./data/presets.ts";
import { SceneClock } from "./scene/rendering/clock.ts";

function download(source: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([source], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "space"
  }.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const views: { id: ViewPreset; title: string; description: string }[] = [
  {
    id: "overhead",
    title: "Bird’s-eye",
    description: "Look down on the orbital plane",
  },
  {
    id: "centered",
    title: "Centered",
    description: "Side view with the sun centered",
  },
  {
    id: "offset",
    title: "Sun at side",
    description: "Side view inspired by the portfolio",
  },
];

export default function App() {
  const [scene, setScene] = useState<SceneModel>(createScene);
  const deepSky = scene.background.deepSky ?? {
    visible: true,
    seed: scene.background.seed,
    density: 1,
    size: 1,
    brightness: 1,
  };
  function changeDeepSky(change: Partial<typeof deepSky>) {
    setScene((previous) => ({
      ...previous,
      background: {
        ...previous.background,
        deepSky: { ...deepSky, ...change },
      },
    }));
  }
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"planet" | "sun" | "background" | "scene">(
    "scene",
  );
  const [section, setSection] = useState<
    "appearance" | "motion" | "generation"
  >("appearance");
  const [page, setPage] = useState<"builder" | "about">("builder");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const presetRequest = useRef(0);
  const shell = useRef<HTMLDivElement>(null);
  const immersive = useImmersiveMode(shell, page === "builder");
  const showHeader =
    !immersive.active ||
    immersive.edges.header ||
    immersive.focused === "header";
  const showLeft =
    !immersive.active || immersive.edges.left || immersive.focused === "left";
  const showRight =
    !immersive.active ||
    immersive.edges.right ||
    immersive.focused === "right" ||
    selected !== null ||
    panel === "sun" ||
    panel === "background";
  const showBottom =
    !immersive.active ||
    immersive.edges.bottom ||
    immersive.focused === "bottom";
  const runtime = useRef<(() => SceneModel["timeline"]) | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => new SceneClock(), []);
  const planet = scene.planets.find((item) => item.id === selected);
  const family = planet?.families[planet.type];

  useEffect(() => {
    clock.configure(
      scene.motion.playing,
      scene.motion.speed,
      performance.now(),
    );
  }, [clock, scene.motion.playing, scene.motion.speed]);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => clock.reduce(preference.matches, performance.now());
    const visibility = () => clock.suspend(document.hidden, performance.now());
    preference.addEventListener("change", reduced);
    document.addEventListener("visibilitychange", visibility);
    reduced();
    visibility();
    return () => {
      preference.removeEventListener("change", reduced);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clock]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  function navigate(next: "builder" | "about") {
    if (next === "about") immersive.exit();
    setPage(next);
  }

  function select(id: string | null) {
    setSelected(id);
    setPanel(id ? "planet" : "scene");
  }
  function changePlanet(update: (planet: Planet) => Planet) {
    setScene((previous) => ({
      ...previous,
      planets: previous.planets.map((item) =>
        item.id === selected ? update(item) : item,
      ),
    }));
  }
  function changeFamily(patch: Partial<Planet["families"]["rocky"]>) {
    changePlanet((item) => ({
      ...item,
      families: {
        ...item.families,
        [item.type]: { ...item.families[item.type], ...patch },
      },
    }));
  }
  function addPlanet(type: Planet["type"] = "rocky") {
    if (scene.planets.length >= 64) {
      setNotice("This scene already has 64 planets.");
      return;
    }
    const id = objectId();
    setScene((previous) => ({
      ...previous,
      planets: [
        ...previous.planets,
        createPlanet(id, freshSeed(), previous.planets.length, type),
      ],
    }));
    select(id);
  }
  function duplicate() {
    if (!planet || scene.planets.length >= 64) return;
    const copy = instantiatePlanet(planet, objectId());
    copy.name = `${planet.name.slice(0, 72)} copy`;
    copy.orbit.phase = (copy.orbit.phase + 30) % 360;
    setScene((previous) => ({
      ...previous,
      planets: [...previous.planets, copy],
    }));
    select(copy.id);
  }
  function replaceScene(
    next: SceneModel,
    now: number,
    selectedId: string | null = null,
  ) {
    clock.seek(next.timeline.elapsed, now);
    setScene(next);
    select(selectedId);
    setSection("appearance");
    setError("");
  }
  async function loadPreset(preset: ScenePreset) {
    const request = ++presetRequest.current;
    setLoadingPreset(preset.id);
    try {
      const response = await fetch(preset.path);
      if (!response.ok)
        throw new Error("Could not load this scene preset. Please try again.");
      const parsed = parsePreset(await response.text());
      if (parsed.kind !== "space-scene")
        throw new Error("This preset does not contain a scene.");
      if (request !== presetRequest.current) return;
      replaceScene(parsed.scene, performance.now());
      setNotice(`${preset.name} loaded.`);
    } catch (cause) {
      if (request === presetRequest.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load this scene preset.",
        );
    } finally {
      if (request === presetRequest.current) setLoadingPreset(null);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    ++presetRequest.current;
    setLoadingPreset(null);
    try {
      if (file.size > 2_000_000)
        throw new Error("Preset must be smaller than 2 MB.");
      const preset = parsePreset(await file.text());
      if (preset.kind === "space-scene") {
        replaceScene(
          preset.scene,
          performance.now(),
          preset.scene.planets[0]?.id ?? null,
        );
        setNotice("Scene imported.");
      } else {
        if (scene.planets.length >= 64)
          throw new Error("Remove a planet before importing another.");
        const imported = instantiatePlanet(preset.planet, objectId());
        setScene((previous) => ({
          ...previous,
          planets: [...previous.planets, imported],
        }));
        select(imported.id);
        setNotice("Planet imported.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read this preset.",
      );
    }
  }
  function pan(dx: number, dy: number) {
    const height = canvasHost.current?.clientHeight || 700;
    setScene((previous) => {
      const scale = viewFrame(previous.view, 1).height / height,
        [x, y, z] = previous.view.pan;
      const overhead = previous.view.preset === "overhead";
      return {
        ...previous,
        view: {
          ...previous.view,
          pan: [
            Math.max(-2000, Math.min(2000, x - dx * scale)),
            Math.max(
              -2000,
              Math.min(2000, y + dy * scale * (overhead ? 0 : 0.956)),
            ),
            Math.max(
              -2000,
              Math.min(2000, z - dy * scale * (overhead ? 1 : 0.292)),
            ),
          ],
        },
      };
    });
  }
  function zoom(factor: number) {
    setScene((previous) => ({
      ...previous,
      view: {
        ...previous.view,
        zoom: Math.max(0.35, Math.min(4, previous.view.zoom * factor)),
      },
    }));
  }

  return (
    <div
      ref={shell}
      className={`app-shell ${immersive.active ? "focus-mode" : ""}`}
      onPointerMove={immersive.pointerMove}
      onPointerLeave={immersive.pointerLeave}
      onFocusCapture={immersive.focus}
      onBlurCapture={immersive.blur}
    >
      <Starfield settings={scene.background} clock={clock} />
      <header
        className={`app-header ${showHeader ? "ui-revealed" : ""}`}
        data-ui-region="header"
        inert={!showHeader}
      >
        <button
          className="brand"
          onClick={() => navigate("builder")}
          aria-label="Space builder"
        >
          <img src={monogram} alt="" width="34" height="34" />
          <span>AmmarZ</span>
        </button>
        <div className="header-divider" />
        <button className="project-link" onClick={() => navigate("builder")}>
          <Icon name="orbit" size={20} />
          Space
        </button>
        <input
          className="scene-name"
          aria-label="Scene name"
          value={scene.name}
          maxLength={80}
          onChange={(event) =>
            setScene({
              ...scene,
              name: event.target.value.trim()
                ? event.target.value
                : "Untitled space",
            })
          }
        />
        <nav className="header-actions" aria-label="Main navigation">
          <button
            className={`text-button ${page === "about" ? "active" : ""}`}
            onClick={() => navigate(page === "builder" ? "about" : "builder")}
          >
            <Icon name={page === "builder" ? "info" : "orbit"} size={17} />
            {page === "builder" ? "About" : "Back to builder"}
          </button>
          {page === "builder" && (
            <button
              className="button subtle fullscreen-button"
              aria-label={
                immersive.active ? "Exit full screen" : "Enter full screen"
              }
              aria-pressed={immersive.active}
              title="Full screen · F"
              onClick={immersive.toggle}
            >
              <Icon name={immersive.active ? "collapse" : "expand"} size={16} />
              Full screen
            </button>
          )}
          <button
            className="button subtle"
            onClick={() => importRef.current?.click()}
          >
            <Icon name="upload" size={15} />
            Import JSON
          </button>
          <button
            className="button primary"
            onClick={() => {
              download(
                serializeScene({
                  ...scene,
                  timeline: runtime.current?.() ?? {
                    ...scene.timeline,
                    elapsed: clock.elapsed,
                  },
                }),
                scene.name,
              );
              setNotice("Scene JSON exported.");
            }}
          >
            <Icon name="download" size={15} />
            Export scene
          </button>
        </nav>
        <input
          ref={importRef}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          aria-label="Import preset JSON"
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </header>
      <main className={`workspace ${page === "about" ? "show-about" : ""}`}>
        <aside
          className={`scene-panel ${showLeft ? "ui-revealed" : ""}`}
          aria-label="Scene objects"
          data-ui-region="left"
          inert={!showLeft}
        >
          <div className="panel-title">
            <span>YOUR UNIVERSE</span>
            <span className="muted">
              {scene.planets.length + Number(scene.sun.visible)} bodies
            </span>
          </div>
          <div className="scene-objects">
            <button
              className={`object-row ${panel === "scene" ? "selected" : ""}`}
              aria-label="Scene presets"
              onClick={() => select(null)}
            >
              <span className="object-icon stars">
                <Icon name="orbit" />
              </span>
              <span className="object-name">
                Scene presets<small>Portfolio &amp; Solar System</small>
              </span>
              <Icon name="chevron" size={13} />
            </button>
            <button
              className={`object-row ${panel === "background" ? "selected" : ""}`}
              onClick={() => {
                setSelected(null);
                setPanel("background");
              }}
            >
              <span className="object-icon stars">
                <Icon name="stars" />
              </span>
              <span className="object-name">
                Starfield<small>Background</small>
              </span>
              <Icon name="chevron" size={13} />
            </button>
            <button
              className={`object-row ${panel === "sun" ? "selected" : ""}`}
              onClick={() => {
                setSelected(null);
                setPanel("sun");
              }}
            >
              <span className="object-icon solar">
                <Icon name="sun" />
              </span>
              <span className="object-name">
                Sun<small>Stellar body</small>
              </span>
              <Icon name="chevron" size={13} />
            </button>
            <div className="list-label">
              PLANETS{" "}
              <span>{scene.planets.length.toString().padStart(2, "0")}</span>
            </div>
            {scene.planets.map((item, index) => (
              <div
                key={item.id}
                className={`planet-row ${selected === item.id ? "selected" : ""} ${!item.visible ? "is-hidden" : ""}`}
              >
                <button
                  className="planet-select"
                  onClick={() => select(item.id)}
                  aria-label={`Select ${item.name}`}
                >
                  <span
                    className={`planet-swatch ${item.type}`}
                    style={
                      {
                        "--planet-color": item.families[item.type].color,
                        "--planet-accent": item.families[item.type].accent,
                      } as React.CSSProperties
                    }
                  />
                  <span className="object-name">
                    {item.name}
                    <small>
                      {item.type === "rocky"
                        ? "Rocky planet"
                        : item.type === "gas"
                          ? "Gas giant"
                          : "Icy giant"}
                    </small>
                  </span>
                  <span className="body-index">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                </button>
                {item.locked && (
                  <span className="lock-indicator" title="Appearance locked">
                    <Icon name="lock" size={12} />
                  </span>
                )}
                <button
                  className="icon-button row-visibility"
                  aria-label={`${item.visible ? "Hide" : "Show"} ${item.name}`}
                  onClick={() =>
                    setScene((previous) => ({
                      ...previous,
                      planets: previous.planets.map((body) =>
                        body.id === item.id
                          ? { ...body, visible: !body.visible }
                          : body,
                      ),
                    }))
                  }
                >
                  <Icon name={item.visible ? "eye" : "hidden"} size={14} />
                </button>
              </div>
            ))}
            <button className="add-planet" onClick={() => addPlanet()}>
              <Icon name="plus" size={16} />
              Add a planet
            </button>
          </div>
          <div className="scene-panel-bottom">
            <div className="small-heading">A LITTLE RANDOMNESS</div>
            <p>
              Keep the worlds you love.
              <br />
              Discover the ones you haven’t met.
            </p>
            <button
              className="button full"
              onClick={() => {
                setScene((previous) => rerollScene(previous, freshSeed()));
                setNotice("Rerolled unlocked appearances. Orbits preserved.");
              }}
            >
              <Icon name="dice" size={16} />
              Reroll scene
            </button>
            <span className="microcopy">
              Locked planets stay just as they are.
            </span>
          </div>
          <a
            className="portfolio-link"
            href="https://ammarz.com"
            target="_blank"
            rel="noreferrer"
          >
            AMMARZ.COM<span>↗</span>
          </a>
        </aside>

        <section
          className="scene-stage"
          ref={canvasHost}
          aria-label="Scene viewport"
        >
          <div className="viewport-caption">
            <span className="status-dot" />
            LIVE SCENE
            <span className="caption-line" />
            <span>
              {views
                .find((view) => view.id === scene.view.preset)
                ?.title.toUpperCase()}{" "}
              VIEW
            </span>
          </div>
          <SceneCanvas
            runtime={runtime}
            scene={scene}
            selected={selected}
            clock={clock}
            active={page === "builder"}
            onSelect={select}
            onPan={pan}
            onZoom={zoom}
            onError={setError}
          />
          <div className="viewport-corner top-left" />
          <div className="viewport-corner bottom-right" />
          <div className="viewport-help">
            <span>CLICK TO SELECT</span>
            <span>DRAG TO PAN</span>
            <span>SCROLL TO ZOOM</span>
          </div>
          <div
            className={`view-controls ${showBottom ? "ui-revealed" : ""}`}
            data-ui-region="bottom"
            inert={!showBottom}
          >
            <button
              className={`icon-button play-button ${!scene.motion.playing ? "paused" : ""}`}
              aria-label={scene.motion.playing ? "Pause scene" : "Play scene"}
              onClick={() =>
                setScene({
                  ...scene,
                  motion: { ...scene.motion, playing: !scene.motion.playing },
                })
              }
            >
              <Icon name={scene.motion.playing ? "pause" : "play"} size={17} />
            </button>
            <div className="control-divider" />
            <div className="view-options" role="group" aria-label="Camera view">
              {views.map((view) => (
                <button
                  key={view.id}
                  title={view.description}
                  aria-pressed={scene.view.preset === view.id}
                  className={scene.view.preset === view.id ? "active" : ""}
                  onClick={() =>
                    setScene({
                      ...scene,
                      view: {
                        ...scene.view,
                        preset: view.id,
                        framing: "portfolio",
                        pan: [0, 0, 0],
                      },
                    })
                  }
                >
                  {view.title}
                </button>
              ))}
            </div>
            <div className="control-divider" />
            <button
              className={`orbit-toggle ${scene.motion.orbitLines ? "active" : ""}`}
              title="Toggle orbit lines"
              aria-label="Toggle orbit lines"
              aria-pressed={scene.motion.orbitLines}
              onClick={() =>
                setScene({
                  ...scene,
                  motion: {
                    ...scene.motion,
                    orbitLines: !scene.motion.orbitLines,
                  },
                })
              }
            >
              <Icon name="orbit" size={18} />
              <span>Orbits</span>
            </button>
            <button
              className="icon-button"
              aria-label="Reset orbital positions"
              title="Reset orbital positions"
              onClick={() =>
                setScene({
                  ...scene,
                  motion: { ...scene.motion, orbitEpoch: clock.elapsed },
                })
              }
            >
              <Icon name="reset" size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="Reset view"
              title="Reset view"
              onClick={() =>
                setScene({
                  ...scene,
                  view: { ...scene.view, zoom: 1, pan: [0, 0, 0] },
                })
              }
            >
              <Icon name="reset" size={17} />
            </button>
          </div>
          <div className="viewport-scale">
            {Math.round(scene.view.zoom * 100)}%<span>ARTISTIC SCALE</span>
          </div>
        </section>

        <aside
          className={`inspector ${showRight ? "ui-revealed" : ""}`}
          aria-label="Object inspector"
          data-ui-region="right"
          inert={!showRight}
        >
          <div className="panel-title">
            <span>INSPECTOR</span>
            <span className="inspector-dot" />
          </div>
          {panel === "planet" && planet && family ? (
            <>
              <div className="inspector-identity">
                <span
                  className={`planet-swatch large ${planet.type}`}
                  style={
                    {
                      "--planet-color": family.color,
                      "--planet-accent": family.accent,
                    } as React.CSSProperties
                  }
                />
                <div>
                  <span className="eyebrow">SELECTED PLANET</span>
                  <input
                    aria-label="Planet name"
                    value={planet.name}
                    maxLength={80}
                    onChange={(event) =>
                      changePlanet((item) => ({
                        ...item,
                        name: event.target.value.trim()
                          ? event.target.value
                          : "Planet",
                      }))
                    }
                  />
                </div>
              </div>
              <div
                className="inspector-tabs"
                role="group"
                aria-label="Planet settings sections"
              >
                {(
                  [
                    ["appearance", "Appearance"],
                    ["motion", "Motion"],
                    ["generation", "Reroll ranges"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={section === id ? "active" : ""}
                    onClick={() => setSection(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="inspector-scroll">
                {section === "appearance" && (
                  <>
                    <div className="field-heading">SURFACE FAMILY</div>
                    <div
                      className="type-options"
                      role="group"
                      aria-label="Planet type"
                    >
                      {(
                        [
                          ["rocky", "Rocky"],
                          ["gas", "Gas"],
                          ["icy", "Icy"],
                        ] as const
                      ).map(([type, label]) => (
                        <button
                          key={type}
                          aria-pressed={planet.type === type}
                          className={planet.type === type ? "active" : ""}
                          onClick={() =>
                            changePlanet((item) => ({ ...item, type }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="color-fields">
                      <label>
                        <input
                          aria-label="Primary color"
                          type="color"
                          value={family.color}
                          onChange={(event) =>
                            changeFamily({ color: event.target.value })
                          }
                        />
                        <span>
                          Primary<small>{family.color.toUpperCase()}</small>
                        </span>
                      </label>
                      <label>
                        <input
                          aria-label="Accent color"
                          type="color"
                          value={family.accent}
                          onChange={(event) =>
                            changeFamily({ accent: event.target.value })
                          }
                        />
                        <span>
                          Accent<small>{family.accent.toUpperCase()}</small>
                        </span>
                      </label>
                    </div>
                    <Slider
                      label="Planet size"
                      value={planet.radius}
                      min={1}
                      max={14}
                      step={0.1}
                      onChange={(radius) =>
                        changePlanet((item) => ({ ...item, radius }))
                      }
                    />
                    <Slider
                      label={
                        planet.type === "rocky"
                          ? "Cratering"
                          : planet.type === "gas"
                            ? "Storm activity"
                            : "Band variation"
                      }
                      value={family.detail}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(detail) => changeFamily({ detail })}
                    />
                    <div className="section-separator" />
                    <div className="field-heading">SATELLITES & RINGS</div>
                    <Slider
                      label="Moons"
                      value={planet.moonCount}
                      min={0}
                      max={12}
                      onChange={(moonCount) =>
                        changePlanet((item) => ({ ...item, moonCount }))
                      }
                    />
                    <Slider
                      label="Ring belts"
                      value={planet.ringCount}
                      min={0}
                      max={4}
                      onChange={(ringCount) =>
                        changePlanet((item) => ({ ...item, ringCount }))
                      }
                    />
                    <Slider
                      label="Axis tilt"
                      value={planet.spin.tilt}
                      min={-180}
                      max={180}
                      unit="°"
                      onChange={(tilt) =>
                        changePlanet((item) => ({
                          ...item,
                          spin: { ...item.spin, tilt },
                        }))
                      }
                    />
                    <p className="field-note">
                      Rings and bands follow the planet’s actual axis.
                    </p>
                  </>
                )}
                {section === "motion" && (
                  <>
                    <div className="field-heading">ORBIT</div>
                    <Slider
                      label="Orbit radius"
                      value={planet.orbit.radius}
                      min={30}
                      max={240}
                      onChange={(radius) =>
                        changePlanet((item) => ({
                          ...item,
                          orbit: { ...item.orbit, radius },
                        }))
                      }
                    />
                    <Slider
                      label="Eccentricity"
                      value={planet.orbit.eccentricity}
                      min={0}
                      max={0.65}
                      step={0.01}
                      onChange={(eccentricity) =>
                        changePlanet((item) => ({
                          ...item,
                          orbit: { ...item.orbit, eccentricity },
                        }))
                      }
                    />
                    <Slider
                      label="Orbit inclination"
                      value={planet.orbit.inclination}
                      min={-80}
                      max={80}
                      unit="°"
                      onChange={(inclination) =>
                        changePlanet((item) => ({
                          ...item,
                          orbit: { ...item.orbit, inclination },
                        }))
                      }
                    />
                    <Slider
                      label="Orbit speed"
                      value={planet.orbit.speed}
                      min={-20}
                      max={20}
                      step={0.1}
                      unit="°/s"
                      onChange={(speed) =>
                        changePlanet((item) => ({
                          ...item,
                          orbit: { ...item.orbit, speed },
                        }))
                      }
                    />
                    <Slider
                      label="Starting orbital phase"
                      value={planet.orbit.phase}
                      min={0}
                      max={360}
                      unit="°"
                      onChange={(phase) =>
                        changePlanet((item) => ({
                          ...item,
                          orbit: { ...item.orbit, phase },
                        }))
                      }
                    />
                    <div className="section-separator" />
                    <div className="field-heading">ROTATION</div>
                    <Slider
                      label="Spin speed"
                      value={planet.spin.speed}
                      min={-60}
                      max={60}
                      step={0.5}
                      unit="°/s"
                      onChange={(speed) =>
                        changePlanet((item) => ({
                          ...item,
                          spin: { ...item.spin, speed },
                        }))
                      }
                    />
                    <Slider
                      label="Axis orientation"
                      value={planet.spin.orientation}
                      min={-180}
                      max={180}
                      unit="°"
                      onChange={(orientation) =>
                        changePlanet((item) => ({
                          ...item,
                          spin: { ...item.spin, orientation },
                        }))
                      }
                    />
                    <p className="field-note">
                      Negative speeds reverse direction. Camera changes preserve
                      these settings.
                    </p>
                  </>
                )}
                {section === "generation" && (
                  <>
                    <div className="field-heading">
                      POSSIBILITIES FOR THE NEXT ROLL
                    </div>
                    <p className="field-note intro-note">
                      These ranges guide future rerolls. Your current planet
                      stays as it is until you roll.
                    </p>
                    <RangeField
                      label="Size range"
                      value={planet.ranges.radius}
                      min={1}
                      max={14}
                      step={0.1}
                      onChange={(radius) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: { ...item.ranges, radius },
                        }))
                      }
                    />
                    <RangeField
                      label="Moon count"
                      value={planet.ranges.moons}
                      min={0}
                      max={12}
                      onChange={(moons) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: { ...item.ranges, moons },
                        }))
                      }
                    />
                    <RangeField
                      label="Ring count"
                      value={planet.ranges.rings}
                      min={0}
                      max={4}
                      onChange={(rings) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: { ...item.ranges, rings },
                        }))
                      }
                    />
                    <RangeField
                      label="Surface detail"
                      value={planet.ranges.detail}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(detail) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: { ...item.ranges, detail },
                        }))
                      }
                    />
                    <div className="section-separator" />
                    <div className="field-heading">ROLL ONE PART</div>
                    <div className="partial-rolls">
                      {(
                        [
                          ["surface", "Surface"],
                          ["moons", "Moons"],
                          ["rings", "Rings"],
                        ] as const
                      ).map(([scope, label]) => (
                        <button
                          className="button"
                          key={scope}
                          disabled={planet.locked}
                          onClick={() =>
                            changePlanet((item) =>
                              rerollPlanet(item, freshSeed(), scope),
                            )
                          }
                        >
                          {label}
                          <Icon name="dice" size={13} />
                        </button>
                      ))}
                    </div>
                    <p className="field-note">
                      Each part has its own seed. Rerolling moons preserves the
                      surface.
                    </p>
                  </>
                )}
                <div className="seed-line">
                  SURFACE SEED<span>{planet.seeds.surface}</span>
                </div>
              </div>
              <div className="inspector-footer">
                <button
                  className={`lock-button ${planet.locked ? "locked" : ""}`}
                  aria-pressed={planet.locked}
                  onClick={() =>
                    changePlanet((item) => ({ ...item, locked: !item.locked }))
                  }
                >
                  <Icon name={planet.locked ? "lock" : "unlock"} size={16} />
                  <span>
                    {planet.locked ? "Appearance locked" : "Lock appearance"}
                    <small>Protect this planet from rerolls</small>
                  </span>
                  <span className="toggle">
                    <i />
                  </span>
                </button>
                <button
                  className="button primary full"
                  disabled={planet.locked}
                  onClick={() =>
                    changePlanet((item) => rerollPlanet(item, freshSeed()))
                  }
                >
                  <Icon name="dice" size={16} />
                  Reroll planet
                </button>
                <div className="planet-actions">
                  <button
                    title="Export planet JSON"
                    onClick={() =>
                      download(serializePlanet(planet), planet.name)
                    }
                  >
                    <Icon name="download" size={14} />
                    Save planet
                  </button>
                  <button
                    aria-label="Duplicate planet"
                    title="Duplicate planet"
                    disabled={scene.planets.length >= 64}
                    onClick={duplicate}
                  >
                    <Icon name="copy" size={15} />
                  </button>
                  <button
                    aria-label="Delete planet"
                    title="Delete planet"
                    onClick={() => {
                      setScene((previous) => ({
                        ...previous,
                        planets: previous.planets.filter(
                          (item) => item.id !== selected,
                        ),
                      }));
                      select(null);
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : panel === "background" ? (
            <div className="inspector-scroll settings-panel">
              <div className="settings-identity">
                <Icon name="stars" size={30} />
                <h2>Starfield</h2>
                <p>The same sky, wherever you go.</p>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={scene.background.visible}
                  onChange={(event) =>
                    setScene({
                      ...scene,
                      background: {
                        ...scene.background,
                        visible: event.target.checked,
                      },
                    })
                  }
                />
                Show starfield
              </label>
              <Slider
                label="Star density"
                value={scene.background.density}
                min={0.1}
                max={3}
                step={0.1}
                onChange={(density) =>
                  setScene({
                    ...scene,
                    background: { ...scene.background, density },
                  })
                }
              />
              <Slider
                label="Cluster frequency"
                value={scene.background.clusterFrequency ?? 1}
                min={0}
                max={5}
                step={0.1}
                unit="×"
                onChange={(clusterFrequency) =>
                  setScene({
                    ...scene,
                    background: { ...scene.background, clusterFrequency },
                  })
                }
              />
              <Slider
                label="Large-star frequency"
                value={scene.background.largeStarFrequency ?? 1}
                min={0}
                max={5}
                step={0.1}
                unit="×"
                onChange={(largeStarFrequency) =>
                  setScene({
                    ...scene,
                    background: { ...scene.background, largeStarFrequency },
                  })
                }
              />
              <Slider
                label="Star size"
                value={scene.background.size}
                min={0.3}
                max={2.5}
                step={0.1}
                onChange={(size) =>
                  setScene({
                    ...scene,
                    background: { ...scene.background, size },
                  })
                }
              />
              <Slider
                label="Brightness"
                value={scene.background.brightness}
                min={0.1}
                max={2}
                step={0.1}
                onChange={(brightness) =>
                  setScene({
                    ...scene,
                    background: { ...scene.background, brightness },
                  })
                }
              />
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={scene.background.twinkle}
                  onChange={(event) =>
                    setScene({
                      ...scene,
                      background: {
                        ...scene.background,
                        twinkle: event.target.checked,
                      },
                    })
                  }
                />
                Twinkling
              </label>
              <button
                className="button full"
                onClick={() =>
                  setScene({
                    ...scene,
                    background: {
                      ...scene.background,
                      deepSky,
                      seed: freshSeed(),
                    },
                  })
                }
              >
                <Icon name="dice" size={16} />
                Reroll stars
              </button>
              <h3>Deep-sky objects</h3>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={deepSky.visible}
                  onChange={(event) =>
                    changeDeepSky({ visible: event.target.checked })
                  }
                />
                Show deep-sky objects
              </label>
              <Slider
                label="Deep-sky density"
                value={deepSky.density}
                min={0}
                max={1.5}
                step={0.1}
                unit="×"
                onChange={(density) => changeDeepSky({ density })}
              />
              <Slider
                label="Deep-sky size"
                value={deepSky.size}
                min={0.3}
                max={3}
                step={0.1}
                unit="×"
                onChange={(size) => changeDeepSky({ size })}
              />
              <Slider
                label="Deep-sky brightness"
                value={deepSky.brightness}
                min={0.1}
                max={3}
                step={0.1}
                unit="×"
                onChange={(brightness) => changeDeepSky({ brightness })}
              />
              <button
                className="button full"
                onClick={() => changeDeepSky({ seed: freshSeed() })}
              >
                <Icon name="dice" size={16} /> Reroll deep sky
              </button>
              <p className="field-note">
                1× uses the portfolio sky. Frequencies control how often a star
                site becomes a cluster or large star. Photographs:{" "}
                <a
                  href="/space/deep-sky/CREDITS.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  image credits
                </a>
                .
              </p>
              <p className="field-note">
                This background continues on the about page without
                regenerating.
              </p>
            </div>
          ) : panel === "sun" ? (
            <div className="inspector-scroll settings-panel">
              <div className="settings-identity solar">
                <Icon name="sun" size={32} />
                <h2>Sun</h2>
                <p>The heart of this little system.</p>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={scene.sun.visible}
                  onChange={(event) =>
                    setScene({
                      ...scene,
                      sun: { ...scene.sun, visible: event.target.checked },
                    })
                  }
                />
                Show sun
              </label>
              <Slider
                label="Sun size"
                value={scene.sun.radius}
                min={5}
                max={80}
                step={0.5}
                onChange={(radius) =>
                  setScene({ ...scene, sun: { ...scene.sun, radius } })
                }
              />
              <div className="color-fields sun-colors">
                {(
                  [
                    ["color", "Primary"],
                    ["highlight", "Highlight"],
                    ["shadow", "Shadow"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="color"
                      aria-label={`Sun ${label.toLowerCase()} color`}
                      value={scene.sun[key]}
                      onChange={(event) =>
                        setScene({
                          ...scene,
                          sun: { ...scene.sun, [key]: event.target.value },
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={scene.sun.activity}
                  onChange={(event) =>
                    setScene({
                      ...scene,
                      sun: { ...scene.sun, activity: event.target.checked },
                    })
                  }
                />
                Solar activity
              </label>
              <button
                className="button full"
                onClick={() =>
                  setScene({
                    ...scene,
                    sun: { ...scene.sun, seed: freshSeed() },
                  })
                }
              >
                <Icon name="dice" size={16} />
                Reroll surface
              </button>
              <p className="field-note">
                Convection and sunspots can pause independently of the rest of
                the scene.
              </p>
            </div>
          ) : (
            <div className="inspector-scroll preset-inspector">
              <div className="settings-identity">
                <Icon name="orbit" size={38} />
                <h2>Start with a system.</h2>
                <p>Load a scene, then make it your own.</p>
              </div>
              <div
                className="preset-cards"
                aria-label="Built-in scene presets"
                aria-busy={loadingPreset !== null}
              >
                {scenePresets.map((preset) => (
                  <article className="preset-card" key={preset.id}>
                    <div className="preset-planets" aria-hidden="true">
                      {preset.colors.map((color, index) => (
                        <span key={index} style={{ background: color }} />
                      ))}
                    </div>
                    <h3>{preset.name}</h3>
                    <p>{preset.description}</p>
                    <button
                      className="button full"
                      disabled={loadingPreset !== null}
                      onClick={() => { void loadPreset(preset); }}
                      aria-label={`Load ${preset.name}`}
                    >
                      <Icon name="orbit" size={15} />
                      {loadingPreset === preset.id ? "Loading…" : "Load scene"}
                    </button>
                    <p className="field-note">{preset.note}</p>
                    {"source" in preset && (
                      <a
                        className="preset-source"
                        href={preset.source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {preset.source.label} ↗
                      </a>
                    )}
                  </article>
                ))}
              </div>
              <p className="field-note">
                Loading replaces this scene. Export JSON first to keep your
                current changes.
              </p>
              <button className="button full" onClick={() => addPlanet()}>
                <Icon name="plus" size={15} /> Add a planet
              </button>
            </div>
          )}
        </aside>
      </main>
      {page === "about" && <AboutPage onBack={() => navigate("builder")} />}
      {immersive.active && (
        <div className="focus-hint" aria-live="polite">
          Move to an edge for controls · Select a planet to edit · Esc to exit
        </div>
      )}
      <div className="toast-area" aria-live="polite">
        {notice && <div className="toast">{notice}</div>}
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
