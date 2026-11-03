import { astrophotography } from "../data/about.ts";

export default function AboutPage({ onBack }: { onBack(): void }) {
  return (
    <section className="about-page" aria-labelledby="about-title">
      <div className="about-layout">
        {(["left", "right"] as const).map((side) => (
          <aside
            key={side}
            className={`about-photos photos-${side}`}
            aria-label={`${side === "left" ? "Left" : "Right"} astrophotography collection`}
            aria-hidden={!astrophotography.some((photo) => photo.side === side)}
          >
            {astrophotography
              .filter((photo) => photo.side === side)
              .map((photo) => (
                <figure key={photo.src}>
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                  <figcaption>
                    {photo.caption}
                    {photo.details && <small>{photo.details}</small>}
                  </figcaption>
                </figure>
              ))}
          </aside>
        ))}
        <article className="about-copy">
          <div className="eyebrow">ABOUT</div>
          <h1 id="about-title">My Space</h1>
          <p className="about-byline">Ammar Zaghloul</p>
          <p>
            Space grew out of the interactive solar system on{" "}
            <a href="https://ammarz.com" target="_blank" rel="noreferrer">
              my portfolio ↗
            </a>
            . This standalone project turns those procedural stars and planets
            into a scene builder.
          </p>
          <p>
            Add worlds, change their appearance and motion, and keep the
            combinations you like as JSON presets. The starfield behind this
            page is the same one currently running in the builder.
          </p>
          <div className="about-divider" />
          <button className="button subtle" onClick={onBack}>
            Back to the scene<span aria-hidden="true">→</span>
          </button>
        </article>
      </div>
    </section>
  );
}
