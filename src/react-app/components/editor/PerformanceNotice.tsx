import type { PerformanceWarning } from "../../scene/rendering/performance.ts";

const messages: Record<PerformanceWarning, string> = {
  software:
    "Your browser appears to be using software rendering. Enabling hardware acceleration in your browser settings may improve performance.",
  caveat:
    "Your browser reports a slower graphics path for this scene. Check that hardware acceleration is enabled in your browser settings.",
  slow: "This scene is running slowly. If hardware acceleration is off, enabling it in your browser settings may help.",
};

export default function PerformanceNotice({
  warning,
  onDismiss,
}: {
  warning: PerformanceWarning;
  onDismiss(): void;
}) {
  return (
    <div className="performance-notice" role="status">
      <div>
        <strong>Graphics performance</strong>
        <p>{messages[warning]}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss performance notice"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
