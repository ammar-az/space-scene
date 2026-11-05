import type { MobilePanel } from "../../hooks/mobilePanels.ts";
import { Icon } from "./controls.tsx";

export function MobileDock({
  panel,
  playing,
  onToggle,
  onPlay,
}: {
  panel: MobilePanel | null;
  playing: boolean;
  onToggle(panel: MobilePanel): void;
  onPlay(): void;
}) {
  return (
    <nav className="mobile-dock" aria-label="Scene tools">
      {(
        [
          ["objects", "Objects", "planet"],
          ["inspector", "Inspector", "sliders"],
          ["view", "View", "camera"],
        ] as const
      ).map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          className={panel === id ? "active" : ""}
          aria-expanded={panel === id}
          aria-controls={`${id}-panel`}
          onClick={() => onToggle(id)}
        >
          <Icon name={icon} size={22} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className={!playing ? "active" : ""}
        aria-label={playing ? "Pause scene" : "Play scene"}
        aria-pressed={!playing}
        onClick={onPlay}
      >
        <Icon name={playing ? "pause" : "play"} size={22} />
        <span>{playing ? "Pause" : "Play"}</span>
      </button>
    </nav>
  );
}

export function MobileMenu({
  about,
  fullscreen,
  onAbout,
  onFullscreen,
  onImport,
  onExport,
  onCreate,
}: {
  about: boolean;
  fullscreen: boolean;
  onAbout(): void;
  onFullscreen(): void;
  onImport(): void;
  onExport(): void;
  onCreate(): void;
}) {
  return (
    <nav className="mobile-menu-actions" aria-label="Main navigation">
      <button className="button" onClick={onCreate}>
        <Icon name="plus" />
        New solar system
      </button>
      <button className="button" onClick={onImport}>
        <Icon name="upload" />
        Import JSON
      </button>
      <button className="button" onClick={onExport}>
        <Icon name="download" />
        Export scene
      </button>
      {!about && (
        <button className="button" onClick={onFullscreen}>
          <Icon name={fullscreen ? "collapse" : "expand"} />
          {fullscreen ? "Exit full screen" : "Full screen"}
        </button>
      )}
      <button className="button" onClick={onAbout}>
        <Icon name={about ? "planet" : "info"} />
        {about ? "Back to builder" : "About"}
      </button>
    </nav>
  );
}
