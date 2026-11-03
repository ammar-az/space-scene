import { useCallback, useEffect, useState } from "react";
import type { FocusEvent, PointerEvent, RefObject } from "react";

type Region = "header" | "left" | "right" | "bottom";
const hidden = { header: false, left: false, right: false, bottom: false };

/** Presentation state is separate from the saved scene; revealing controls never reframes it. */
export function useImmersiveMode(
  shell: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [active, setActive] = useState(false);
  const [edges, setEdges] = useState(hidden);
  const [focused, setFocused] = useState<Region | null>(null);
  const exit = useCallback(() => {
    setActive(false);
    setEdges(hidden);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    if (active) {
      exit();
      return;
    }
    if (!enabled) return;
    setActive(true);
    setEdges({ ...hidden, header: true });
    // Focus mode still works in the window if the browser denies native fullscreen.
    const request = shell.current?.requestFullscreen?.();
    if (request) void request.catch(() => {});
  }, [active, enabled, exit, shell]);

  useEffect(() => {
    const fullscreen = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && active) {
        exit();
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key.toLowerCase() === "f" && enabled) {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Tab" && active && !edges.header && !focused) {
        event.preventDefault();
        setEdges({ header: true, left: true, right: true, bottom: true });
        requestAnimationFrame(() =>
          shell.current
            ?.querySelector<HTMLButtonElement>(".app-header button")
            ?.focus(),
        );
      }
    };
    document.addEventListener("fullscreenchange", fullscreen);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("fullscreenchange", fullscreen);
      document.removeEventListener("keydown", keydown);
    };
  }, [active, edges.header, enabled, exit, focused, shell, toggle]);

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!active || !shell.current) return;
    const rect = shell.current.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    const leftWidth =
      shell.current.querySelector(".scene-panel")?.getBoundingClientRect()
        .width ?? 235;
    const rightWidth =
      shell.current.querySelector(".inspector")?.getBoundingClientRect()
        .width ?? 304;
    setEdges((previous) => {
      const next = {
        header: y < (previous.header ? 100 : 28),
        left: x < (previous.left ? leftWidth + 24 : 28),
        right: x > rect.width - (previous.right ? rightWidth + 24 : 28),
        bottom: y > rect.height - 110,
      };
      return Object.keys(next).every(
        (key) => next[key as Region] === previous[key as Region],
      )
        ? previous
        : next;
    });
  }
  function region(target: EventTarget | null): Region | null {
    const value =
      target instanceof HTMLElement
        ? target.closest<HTMLElement>("[data-ui-region]")?.dataset.uiRegion
        : undefined;
    return value === "header" ||
      value === "left" ||
      value === "right" ||
      value === "bottom"
      ? value
      : null;
  }
  return {
    active,
    edges,
    focused,
    toggle,
    exit,
    pointerMove,
    pointerLeave: () => setEdges(hidden),
    focus: (event: FocusEvent<HTMLDivElement>) =>
      setFocused(
        event.target instanceof HTMLElement &&
          event.target.matches(":focus-visible")
          ? region(event.target)
          : null,
      ),
    blur: (event: FocusEvent<HTMLDivElement>) =>
      setFocused(region(event.relatedTarget)),
  };
}
