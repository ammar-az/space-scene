import {
  PlanetDiameterControl,
  StarDiameterControl,
} from "./components/editor/SizeControls.tsx";
import { roundDiameter } from "./scene/model/sizes.ts";
import { defaultLayout } from "./scene/model/layout.ts";
import CameraControls from "./components/editor/CameraControls.tsx";
import {
  fitSceneView,
  panView,
  rotateView,
  setViewAngles,
  snapView,
  viewAngles,
} from "./scene/model/camera.ts";
import EarthlikeControls from "./components/editor/EarthlikeControls.tsx";
import { setEarthlike } from "./scene/model/earthlike.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import AtmosphereControls from "./components/editor/AtmosphereControls.tsx";
import {
  DEFAULT_CLOUD_SEED,
  defaultAtmosphere,
  defaultClouds,
} from "./scene/model/atmospheres.ts";
import type { Atmosphere, Clouds } from "./scene/model/atmospheres.ts";
import AboutPage from "./components/AboutPage.tsx";
import { useImmersiveMode } from "./hooks/useImmersiveMode.ts";
import {
  orbitEllipse,
  orbitCenter,
  editOrbit,
} from "./scene/model/geometry.ts";
import monogram from "./assets/az-shaded.svg";
import Starfield from "./components/editor/Starfield.tsx";
import SceneCanvas from "./components/editor/SceneCanvas.tsx";
import {
  ColorInput,
  Icon,
  RangeField,
  Slider,
} from "./components/editor/controls.tsx";
import {
  createPlanet,
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
import ScenePresets from "./components/editor/ScenePresets.tsx";
import type { ScenePreset } from "./data/presets.ts";
import { ringSettings, defaultMoons } from "./scene/model/systems.ts";
import {
  createDefaultScene,
  generateScenePreset,
} from "./scene/model/presetRecipes.ts";
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
  const [scene, setScene] = useState<SceneModel>(() =>
    createDefaultScene(freshSeed()),
  );
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"planet" | "sun" | "background" | "scene">(
    "scene",
  );
  const [section, setSection] = useState<
    "appearance" | "environment" | "motion" | "generation"
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
    cameraOpen ||
    !immersive.active ||
    immersive.edges.bottom ||
    immersive.focused === "bottom";
  const runtime = useRef<(() => SceneModel["timeline"]) | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => new SceneClock(), []);
  const planet = scene.planets.find((item) => item.id === selected);
  const family = planet?.families[planet.type];
  const ellipse = planet ? orbitEllipse(planet.orbit) : null;
  const ring = planet ? ringSettings(planet) : null;
  const moons = planet?.moons ?? defaultMoons;

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

  useEffect(() => {
    if (!cameraOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".view-controls")
      )
        setCameraOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCameraOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [cameraOpen]);

  function navigate(next: "builder" | "about") {
    if (next === "about") immersive.exit();
    setPage(next);
  }

  function select(id: string | null) {
    setSelected(id);
    setPanel(id ? "planet" : "scene");
    if (
      section === "environment" &&
      scene.planets.find((item) => item.id === id)?.type !== "rocky"
    )
      setSection("appearance");
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
  function changeAtmosphere(patch: Partial<Atmosphere>) {
    changePlanet((item) => ({
      ...item,
      atmosphere: { ...(item.atmosphere ?? defaultAtmosphere), ...patch },
    }));
  }
  function changeClouds(patch: Partial<Clouds>) {
    const seed = freshSeed();
    changePlanet((item) => ({
      ...item,
      seeds: {
        ...item.seeds,
        clouds: item.seeds.clouds ?? (item.clouds ? DEFAULT_CLOUD_SEED : seed),
      },
      clouds: { ...(item.clouds ?? defaultClouds), ...patch },
    }));
  }
  function changeRings(patch: Partial<NonNullable<Planet["rings"]>>) {
    changePlanet((item) => {
      const rings = { ...ringSettings(item), ...patch };
      return { ...item, rings, ringCount: rings.amount > 0 ? 1 : 0 };
    });
  }
  function changeMoons(patch: Partial<NonNullable<Planet["moons"]>>) {
    changePlanet((item) => ({
      ...item,
      moons: { ...(item.moons ?? defaultMoons), ...patch },
    }));
  }
  function changeOrbit(patch: Partial<Planet["orbit"]>) {
    changePlanet((item) => ({
      ...item,
      orbit: { ...editOrbit(item.orbit, {}, scene.sun.position), ...patch },
    }));
  }
  function changeEllipse(
    patch: Partial<NonNullable<Planet["orbit"]["ellipse"]>>,
  ) {
    changePlanet((item) => ({
      ...item,
      orbit: editOrbit(item.orbit, patch, scene.sun.position),
    }));
  }
  function selectSun() {
    setSelected(null);
    setPanel("sun");
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
      replaceScene(
        generateScenePreset(parsed.scene, freshSeed()),
        performance.now(),
      );
      setNotice(`${preset.name} generated.`);
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
  function cameraViewport() {
    const height = canvasHost.current?.clientHeight || 700;
    return {
      height,
      aspect: (canvasHost.current?.clientWidth || 1100) / height,
    };
  }
  function pan(dx: number, dy: number) {
    const { height, aspect } = cameraViewport();
    setScene((previous) => ({
      ...previous,
      view: panView(previous.view, aspect, dx, dy, height),
    }));
  }
  function rotate(dx: number, dy: number) {
    const { aspect } = cameraViewport();
    setScene((previous) => ({
      ...previous,
      view: rotateView(previous.view, aspect, dx, dy),
    }));
  }
  function cameraAngle(patch: Partial<ReturnType<typeof viewAngles>>) {
    const { aspect } = cameraViewport();
    setScene((previous) => ({
      ...previous,
      view: setViewAngles(previous.view, aspect, patch),
    }));
  }
  function fitScene() {
    const { aspect } = cameraViewport();
    setScene((previous) => ({
      ...previous,
      view: fitSceneView(previous, aspect),
    }));
  }
  function changeSizing(patch: Partial<SceneModel["sizing"]>) {
    setScene((previous) => ({
      ...previous,
      sizing: { ...previous.sizing, ...patch },
    }));
  }
  function changeLayout(patch: Partial<NonNullable<SceneModel["layout"]>>) {
    setScene((previous) => ({
      ...previous,
      layout: { ...(previous.layout ?? defaultLayout), ...patch },
    }));
  }
  function zoom(factor: number) {
    setScene((previous) => ({
      ...previous,
      view: {
        ...previous.view,
        zoom: Math.max(0.01, Math.min(4, previous.view.zoom * factor)),
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
              onClick={selectSun}
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
                        "--planet-color":
                          item.type === "rocky" && item.earthlike?.enabled
                            ? item.earthlike.oceanColor
                            : item.families[item.type].color,
                        "--planet-accent":
                          item.type === "rocky" && item.earthlike?.enabled
                            ? item.earthlike.landColor
                            : item.families[item.type].accent,
                      } as React.CSSProperties
                    }
                  />
                  <span className="object-name">
                    {item.name}
                    <small>
                      {item.type === "rocky"
                        ? item.earthlike?.enabled
                          ? "Earth-like planet"
                          : "Rocky planet"
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
              {scene.view.camera
                ? "CUSTOM"
                : views
                    .find((view) => view.id === scene.view.preset)
                    ?.title.toUpperCase()}{" "}
              VIEW
            </span>
          </div>
          <SceneCanvas
            runtime={runtime}
            scene={scene}
            selected={selected}
            sunSelected={panel === "sun"}
            clock={clock}
            active={page === "builder"}
            onSelect={select}
            onSelectSun={selectSun}
            onPan={pan}
            onRotate={rotate}
            onZoom={zoom}
            onError={setError}
          />
          <div className="viewport-corner top-left" />
          <div className="viewport-corner bottom-right" />
          <div className="viewport-help">
            <span>CLICK TO SELECT</span>
            <span>LEFT DRAG TO PAN</span>
            <span>RIGHT DRAG TO ROTATE</span>
            <span>SCROLL TO ZOOM</span>
          </div>
          <div
            className={`view-controls ${showBottom ? "ui-revealed" : ""}`}
            data-ui-region="bottom"
            inert={!showBottom}
          >
            {cameraOpen && (
              <CameraControls
                view={scene.view}
                onAngle={cameraAngle}
                onZoom={(zoom) =>
                  setScene((previous) => ({
                    ...previous,
                    view: { ...previous.view, zoom },
                  }))
                }
                onFit={fitScene}
                onClose={() => setCameraOpen(false)}
              />
            )}
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
                  aria-pressed={
                    !scene.view.camera && scene.view.preset === view.id
                  }
                  className={
                    !scene.view.camera && scene.view.preset === view.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setScene({
                      ...scene,
                      view: snapView(scene.view, view.id),
                    })
                  }
                >
                  {view.title}
                </button>
              ))}
            </div>
            <div className="control-divider" />
            <button
              className={`camera-toggle ${cameraOpen ? "active" : ""}`}
              aria-label="Camera angles and zoom"
              aria-expanded={cameraOpen}
              aria-controls="camera-controls"
              onClick={() => setCameraOpen((open) => !open)}
            >
              <Icon name="camera" size={17} />
              <span>Camera</span>
            </button>
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
                  view: snapView(scene.view),
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
                      "--planet-color":
                        planet.type === "rocky" && planet.earthlike?.enabled
                          ? planet.earthlike.oceanColor
                          : family.color,
                      "--planet-accent":
                        planet.type === "rocky" && planet.earthlike?.enabled
                          ? planet.earthlike.landColor
                          : family.accent,
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
                    ["environment", "Atmosphere"],
                    ["motion", "Motion"],
                    ["generation", "Reroll ranges"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={section === id ? "active" : ""}
                    disabled={id === "environment" && planet.type !== "rocky"}
                    title={
                      id === "environment" && planet.type !== "rocky"
                        ? "Gas and icy planets already render their cloud surfaces."
                        : undefined
                    }
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
                    {planet.type === "rocky" && (
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={planet.earthlike?.enabled ?? false}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            changePlanet((item) => setEarthlike(item, enabled));
                          }}
                        />
                        Earth-like surface
                      </label>
                    )}
                    {planet.type === "rocky" && planet.earthlike?.enabled ? (
                      <EarthlikeControls
                        settings={planet.earthlike}
                        onChange={(patch) =>
                          changePlanet((item) => ({
                            ...item,
                            earthlike: { ...item.earthlike!, ...patch },
                          }))
                        }
                      />
                    ) : (
                      <div className="color-fields">
                        <label>
                          <ColorInput
                            aria-label="Primary color"
                            value={family.color}
                            onCommit={(color) => changeFamily({ color })}
                          />
                          <span>
                            Primary<small>{family.color.toUpperCase()}</small>
                          </span>
                        </label>
                        <label>
                          <ColorInput
                            aria-label="Accent color"
                            value={family.accent}
                            onCommit={(accent) => changeFamily({ accent })}
                          />
                          <span>
                            Accent<small>{family.accent.toUpperCase()}</small>
                          </span>
                        </label>
                      </div>
                    )}
                    <PlanetDiameterControl
                      scene={scene}
                      planet={planet}
                      onChange={(diameter) =>
                        changePlanet((item) => ({ ...item, diameter }))
                      }
                    />
                    {!(
                      planet.type === "rocky" && planet.earthlike?.enabled
                    ) && (
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
                    )}
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
                    {ring && (
                      <>
                        <Slider
                          label="Ring amount"
                          value={ring.amount}
                          min={0}
                          max={1}
                          step={0.01}
                          precise
                          onChange={(amount) => changeRings({ amount })}
                        />
                        <Slider
                          label="Ring width"
                          value={ring.width}
                          min={0.05}
                          max={1}
                          step={0.01}
                          precise
                          onChange={(width) => changeRings({ width })}
                        />
                        <Slider
                          label="Ring opacity"
                          value={ring.opacity}
                          min={0}
                          max={1}
                          step={0.01}
                          precise
                          onChange={(opacity) => changeRings({ opacity })}
                        />
                        <Slider
                          label="Ring inner edge"
                          value={ring.innerRadius}
                          min={1.05}
                          max={2.5}
                          step={0.01}
                          precise
                          onChange={(innerRadius) =>
                            changeRings({ innerRadius })
                          }
                        />
                        <p className="field-note">
                          From a sparse narrow ring to a full Saturn-like system
                          at 1. Distances use planet radii.
                        </p>
                      </>
                    )}
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
                    <div className="section-separator" />
                    <div className="field-heading">MOON VARIATION</div>
                    <div className="moon-colors">
                      {moons.colors.map((color, index) => (
                        <div key={index}>
                          <ColorInput
                            aria-label={`Moon color ${index + 1}`}
                            value={color}
                            onCommit={(color) =>
                              changeMoons({
                                colors: moons.colors.map((old, i) =>
                                  i === index ? color : old,
                                ),
                              })
                            }
                          />
                          <button
                            className="icon-button"
                            aria-label={`Remove moon color ${index + 1}`}
                            disabled={moons.colors.length <= 1}
                            onClick={() =>
                              changeMoons({
                                colors: moons.colors.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        className="button"
                        disabled={moons.colors.length >= 8}
                        onClick={() =>
                          changeMoons({ colors: [...moons.colors, "#b9b2a2"] })
                        }
                        aria-label="Add moon color"
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                    <RangeField
                      label="Moon orbit radius"
                      value={moons.radius}
                      min={1.2}
                      max={12}
                      step={0.05}
                      onChange={(radius) => changeMoons({ radius })}
                    />
                    <RangeField
                      label="Moon orbit speed"
                      value={moons.speed}
                      min={-60}
                      max={60}
                      step={0.1}
                      onChange={(speed) => changeMoons({ speed })}
                    />
                    <RangeField
                      label="Moon size"
                      value={moons.size}
                      min={0.03}
                      max={0.4}
                      step={0.01}
                      onChange={(size) => changeMoons({ size })}
                    />
                    <RangeField
                      label="Moon inclination"
                      value={moons.inclination}
                      min={-80}
                      max={80}
                      step={0.1}
                      onChange={(inclination) => changeMoons({ inclination })}
                    />
                    <button
                      className="button full"
                      disabled={planet.locked}
                      onClick={() =>
                        changePlanet((item) =>
                          rerollPlanet(item, freshSeed(), "moons"),
                        )
                      }
                    >
                      <Icon name="dice" size={15} />
                      Reroll moons
                    </button>
                    <p className="field-note">
                      Distances and sizes use planet radii; speeds use degrees
                      per second. Short orbits expand to clear the planet and
                      rings. Colors leave orbital rolls fixed.
                    </p>
                  </>
                )}
                {section === "environment" && planet.type === "rocky" && (
                  <AtmosphereControls
                    planet={planet}
                    onAtmosphere={changeAtmosphere}
                    onClouds={changeClouds}
                    onReroll={() =>
                      changePlanet((item) =>
                        rerollPlanet(item, freshSeed(), "clouds"),
                      )
                    }
                  />
                )}
                {section === "motion" && (
                  <>
                    <div className="field-heading">ORBIT</div>
                    {ellipse && (
                      <>
                        <div className="segmented" aria-label="Orbit anchor">
                          <button
                            aria-pressed={ellipse.anchor === "center"}
                            onClick={() => changeEllipse({ anchor: "center" })}
                          >
                            Fixed center
                          </button>
                          <button
                            aria-pressed={ellipse.anchor === "sun"}
                            onClick={() => changeEllipse({ anchor: "sun" })}
                          >
                            Sun at focus
                          </button>
                        </div>
                        <Slider
                          label="Orbit X radius"
                          value={ellipse.radiusX}
                          min={1}
                          max={500}
                          step={0.01}
                          precise
                          onChange={(radiusX) => changeEllipse({ radiusX })}
                        />
                        <Slider
                          label="Orbit Z radius"
                          value={ellipse.radiusZ}
                          min={1}
                          max={500}
                          step={0.01}
                          precise
                          onChange={(radiusZ) => changeEllipse({ radiusZ })}
                        />
                        <Slider
                          label="Ellipse rotation"
                          value={ellipse.rotation}
                          min={-180}
                          max={180}
                          step={0.1}
                          precise
                          unit="°"
                          onChange={(rotation) => changeEllipse({ rotation })}
                        />
                        <div className="field-heading">
                          {ellipse.anchor === "center"
                            ? "ORBIT CENTER"
                            : "CENTER FROM SOLAR FOCUS"}
                        </div>
                        {(["X", "Y", "Z"] as const).map((axis, index) => (
                          <label className="number-field" key={axis}>
                            {axis}
                            <input
                              type="number"
                              aria-label={`Orbit center ${axis}`}
                              key={
                                orbitCenter(planet.orbit, scene.sun.position)[
                                  index
                                ]
                              }
                              defaultValue={Number(
                                orbitCenter(planet.orbit, scene.sun.position)[
                                  index
                                ].toFixed(4),
                              )}
                              disabled={ellipse.anchor === "sun"}
                              min={-2000}
                              max={2000}
                              step={0.01}
                              onBlur={(event) => {
                                const value = event.currentTarget.valueAsNumber;
                                if (!Number.isFinite(value)) {
                                  event.currentTarget.value = String(
                                    orbitCenter(
                                      planet.orbit,
                                      scene.sun.position,
                                    )[index],
                                  );
                                  return;
                                }
                                const center = orbitCenter(
                                  planet.orbit,
                                  scene.sun.position,
                                );
                                center[index] = Math.max(
                                  -2000,
                                  Math.min(2000, value),
                                );
                                changeOrbit({ center });
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter")
                                  event.currentTarget.blur();
                              }}
                            />
                          </label>
                        ))}
                        <p className="field-note">
                          Shape and orientation preserve the center. Sun-focus
                          mode keeps one focus on the Sun.
                        </p>
                      </>
                    )}
                    <Slider
                      label="Orbit inclination"
                      value={planet.orbit.inclination}
                      min={-80}
                      max={80}
                      step={0.1}
                      precise
                      unit="°"
                      onChange={(inclination) => changeOrbit({ inclination })}
                    />
                    <Slider
                      label="Orbit plane orientation"
                      value={planet.orbit.orientation}
                      min={-180}
                      max={180}
                      step={0.1}
                      precise
                      unit="°"
                      onChange={(orientation) => changeOrbit({ orientation })}
                    />
                    <Slider
                      label="Orbit speed"
                      value={planet.orbit.speed}
                      min={-20}
                      max={20}
                      step={0.01}
                      precise
                      unit="°/s"
                      onChange={(speed) => changeOrbit({ speed })}
                    />
                    <Slider
                      label="Starting orbital phase"
                      value={planet.orbit.phase}
                      min={0}
                      max={360}
                      step={0.1}
                      precise
                      unit="°"
                      onChange={(phase) => changeOrbit({ phase })}
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
                      label="Diameter range (× 1,000 km)"
                      value={planet.ranges.diameter}
                      min={0.01}
                      max={1000000}
                      step={0.01}
                      logarithmic
                      onChange={(diameter) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: {
                            ...item.ranges,
                            diameter: diameter.map(roundDiameter) as [
                              number,
                              number,
                            ],
                          },
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
                    <Slider
                      label="Ring chance"
                      value={(planet.ranges.ringProbability ?? 1) * 100}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(percent) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: {
                            ...item.ranges,
                            ringProbability: percent / 100,
                          },
                        }))
                      }
                    />
                    <RangeField
                      label="Ring amount range"
                      value={planet.ranges.ringAmount ?? [0, 1]}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(ringAmount) =>
                        changePlanet((item) => ({
                          ...item,
                          ranges: { ...item.ranges, ringAmount },
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
              <StarDiameterControl
                scene={scene}
                onChange={(diameter) =>
                  setScene((current) => ({
                    ...current,
                    sun: { ...current.sun, diameter },
                  }))
                }
              />
              <Slider
                label="Star display scale"
                value={scene.sizing.starScale * 100}
                min={10}
                max={100}
                step={1}
                unit="%"
                onChange={(percent) =>
                  changeSizing({ starScale: percent / 100 })
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
                    <ColorInput
                      aria-label={`Sun ${label.toLowerCase()} color`}
                      value={scene.sun[key]}
                      onCommit={(color) =>
                        setScene((current) => ({
                          ...current,
                          sun: { ...current.sun, [key]: color },
                        }))
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
            <ScenePresets
              layout={scene.layout}
              sizing={scene.sizing}
              onSizing={changeSizing}
              onLayout={changeLayout}
              onFit={fitScene}
              loadingPreset={loadingPreset}
              onLoad={loadPreset}
              onAddPlanet={() => addPlanet()}
            />
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
