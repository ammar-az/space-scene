import { useEffect } from "react";
import type { RefObject } from "react";

/** Keep fixed controls above software keyboards without disabling page magnification. */
export function useVisualViewport(
  shell: RefObject<HTMLDivElement | null>,
  compact: boolean,
) {
  useEffect(() => {
    const element = shell.current;
    if (!element || !compact) return;
    const viewport = window.visualViewport;
    const update = () => {
      if (viewport && viewport.scale !== 1) return;
      element.style.setProperty(
        "--visual-height",
        `${viewport?.height ?? innerHeight}px`,
      );
      element.style.setProperty(
        "--visual-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      element.style.removeProperty("--visual-height");
      element.style.removeProperty("--visual-top");
    };
  }, [compact, shell]);
}
