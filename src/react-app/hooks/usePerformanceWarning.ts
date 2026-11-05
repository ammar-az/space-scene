import { useCallback, useRef, useState } from "react";
import type { PerformanceWarning } from "../scene/rendering/performance.ts";

const sessionKey = "space-performance-notice-shown";
export function usePerformanceWarning() {
  const [warning, setWarning] = useState<PerformanceWarning | null>(null);
  const shown = useRef(false);
  const report = useCallback((next: PerformanceWarning) => {
    if (shown.current) return;
    shown.current = true;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      // A disabled session store still allows one notice per app visit.
    }
    setWarning(next);
  }, []);
  return { warning, report, dismiss: () => setWarning(null) };
}
