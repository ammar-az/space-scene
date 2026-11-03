const tileSize = 512;
// Brightness-weighted clusters average ~12.5 members: 161 sites still yield ~180 stars.
const sitesPerTile = 161;
const clusterReach = 64;
export const starfieldColors = [
  { name: "blue", rgb: [155, 197, 255], weight: 20 },
  { name: "white", rgb: [241, 245, 255], weight: 30 },
  { name: "yellow", rgb: [255, 232, 157], weight: 10 },
  { name: "orange", rgb: [255, 185, 129], weight: 15 },
  { name: "red", rgb: [255, 151, 137], weight: 15 },
  { name: "green", rgb: [150, 232, 173], weight: 2 },
  { name: "purple", rgb: [189, 155, 245], weight: 2 },
  { name: "brown", rgb: [199, 157, 123], weight: 2 },
  { name: "pink", rgb: [255, 169, 210], weight: 2 },
  { name: "cyan", rgb: [145, 232, 245], weight: 2 },
] as const;
export type TwinkleStar = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: number[];
  phase: number;
  frequency: number;
  strength: number;
};
type Cluster = {
  id: string;
  count: number;
  brightness: number;
  globular: boolean;
  x: number;
  y: number;
  radius: number;
};
type Star = TwinkleStar & {
  standout: boolean;
  twinkling: boolean;
  cluster?: Cluster;
};

function tileRandom(column: number, row: number, seed: number) {
  let state =
    Math.imul(column + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded world-space points, including neighboring clusters that spill across tile boundaries. */
export function generateStarfield(
  width: number,
  height: number,
  seed: number,
  maxClusterDiameter = 36,
  clusterFrequency = 1,
  largeStarFrequency = 1,
): Star[] {
  const stars: Star[] = [];
  const clusters: Cluster[] = [];
  for (let row = -1; row <= Math.floor(height / tileSize) + 1; row++) {
    for (
      let column = -1;
      column <= Math.floor(width / tileSize) + 1;
      column++
    ) {
      const random = tileRandom(column, row, seed);
      for (let index = 0; index < sitesPerTile; index++) {
        const x = column * tileSize + random() * tileSize;
        const y = row * tileSize + random() * tileSize;
        if (
          x < -clusterReach ||
          y < -clusterReach ||
          x > width + clusterReach ||
          y > height + clusterReach
        )
          continue;
        // Per-site streams keep later points fixed regardless of cluster membership/culling.
        const detail = tileRandom(
          column,
          row,
          seed ^ Math.imul(index + 1, 83492791),
        );
        const clustered = detail() < 0.01 * clusterFrequency;
        const parentBrightness = detail() ** 2;
        // Bright parents produce 5–10 stars; dim parents produce 10–20, interpolated between.
        const minCount = Math.round(10 - 5 * parentBrightness),
          maxCount = Math.round(20 - 10 * parentBrightness);
        const count = clustered
          ? minCount + Math.floor(detail() * (maxCount - minCount + 1))
          : 1;
        // Account for cluster expansion/exclusions so ~3% of final stars stand out.
        const standout = !clustered && detail() < 0.034 * largeStarFrequency;
        const globular = clustered && count >= 10 && detail() < 0.2;
        // Reserve two pixels for stellar cores/subpixel shimmer inside the displayed limit.
        const extent =
          Math.max(1, maxClusterDiameter / 2 - 2) * (0.78 + detail() * 0.22);
        const cluster: Cluster | undefined = clustered
          ? {
              id: `${column}:${row}:${index}`,
              count,
              brightness: parentBrightness,
              globular,
              x,
              y,
              radius: extent,
            }
          : undefined;
        if (cluster) clusters.push(cluster);
        const aspect = globular ? 1 : 0.65 + detail() * 0.35;
        const rotation = detail() * Math.PI * 2,
          phase = detail() * Math.PI * 2;
        const positions: { x: number; y: number }[] = [];
        for (let member = 0; member < count; member++) {
          let sx = x,
            sy = y;
          if (clustered) {
            // Globular strata fill a circular envelope evenly in angle and densely at
            // the center; ordinary groups retain their irregular, unrendered envelope.
            for (let attempt = 0; attempt < 24; attempt++) {
              const angle = globular
                ? member * Math.PI * (3 - Math.sqrt(5)) +
                  (detail() - 0.5) * 0.45
                : detail() * Math.PI * 2;
              const boundary = globular
                ? 1
                : (1 +
                    0.18 * Math.sin(angle * 3 + phase) +
                    0.12 * Math.sin(angle * 5 - phase)) /
                  1.3;
              const radius =
                (globular
                  ? ((member + detail()) / count) ** 0.95
                  : Math.sqrt(detail())) *
                boundary *
                extent;
              const dx = Math.cos(angle) * radius,
                dy = Math.sin(angle) * radius * aspect;
              sx = x + dx * Math.cos(rotation) - dy * Math.sin(rotation);
              sy = y + dx * Math.sin(rotation) + dy * Math.cos(rotation);
              if (
                positions.every(
                  (p) => Math.hypot(p.x - sx, p.y - sy) >= (globular ? 1 : 1.6),
                )
              )
                break;
            }
            positions.push({ x: sx, y: sy });
          }
          // Cluster members inherit some parent brightness, making rich dim groups distinct
          // from sparse bright groups. They always use ordinary-star sizes and brightness.
          const memberBrightness = detail() ** 2;
          const radius = clustered
            ? 0.42 + 0.36 * (parentBrightness * 0.5 + detail() * 0.5)
            : (standout ? 1.05 + detail() * 0.6 : 0.25 + detail() ** 2 * 0.65) *
              1.05;
          const opacity = clustered
            ? 0.25 + 0.35 * (parentBrightness * 0.65 + memberBrightness * 0.35)
            : (standout
                ? 0.75 + detail() * 0.2
                : 0.15 + parentBrightness * 0.45) * 1.05;
          let tint = detail() * 100;
          const color =
            starfieldColors.find((color) => (tint -= color.weight) < 0) ??
            starfieldColors[9];
          const twinkling = standout || detail() < 0.06;
          // Independent randomness preserves all existing cluster geometry and timing.
          const scintillation = tileRandom(
            column,
            row,
            seed ^
              Math.imul(index + 1, 1597334677) ^
              Math.imul(member + 1, 3812015801),
          );
          const strength = standout
            ? scintillation() < 0.95
              ? 1.2 + scintillation() * 0.2
              : 0.95 + scintillation() * 0.25
            : 0.6 + scintillation() * 0.8;
          const star: Star = {
            x: sx,
            y: sy,
            radius,
            opacity,
            standout,
            twinkling,
            cluster,
            color: color.rgb.map((c) => c / 255),
            phase: detail() * Math.PI * 2,
            frequency: (Math.PI * 2) / (3.5 + detail() * 5.5),
            strength,
          };
          if (sx >= -12 && sy >= -12 && sx <= width + 12 && sy <= height + 12)
            stars.push(star);
        }
      }
    }
  }
  // Also keep independently generated standout stars (and their halos) outside cluster bounds.
  for (const star of stars) {
    if (
      star.standout &&
      clusters.some(
        (cluster) =>
          Math.hypot(star.x - cluster.x, star.y - cluster.y) <
          cluster.radius + star.radius * 4,
      )
    ) {
      star.standout = false;
      star.radius *= 0.45;
      star.opacity *= 0.6;
    }
  }
  return stars;
}

/** Cached base remains complete for paused/reduced-motion rendering and WebGL fallback. */
export function drawStarfield(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  maxClusterDiameter = 36,
  background?: () => void,
) {
  const twinkles: TwinkleStar[] = [];
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  background?.();
  for (const star of generateStarfield(
    width,
    height,
    seed,
    maxClusterDiameter,
  )) {
    const { x, y, radius, opacity } = star;
    const color = star.color.map((c) => Math.round(c * 255)).join(", ");
    if (star.twinkling) twinkles.push(star);
    if (star.standout) {
      const halo = context.createRadialGradient(x, y, 0, x, y, radius * 4);
      halo.addColorStop(0, `rgba(${color}, 0.16)`);
      halo.addColorStop(0.3, `rgba(${color}, 0.04)`);
      halo.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = halo;
      context.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
    }
    context.fillStyle = `rgba(${color}, ${opacity})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  return twinkles;
}
