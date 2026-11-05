import { useEffect, useRef } from "react";
import { nearestSheetExtent } from "../../hooks/mobilePanels.ts";
import type { SheetExtent } from "../../hooks/mobilePanels.ts";
import { Icon } from "./controls.tsx";

export default function MobileSheetHeader({
  title,
  label,
  open,
  extent,
  onResize,
  onClose,
}: {
  title: string;
  label: string;
  open: boolean;
  extent: SheetExtent;
  onResize(extent: SheetExtent): void;
  onClose(): void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{
    id: number;
    y: number;
    height: number;
    max: number;
    panel: HTMLElement;
  } | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
    return () => {
      drag.current?.panel.style.removeProperty("height");
      drag.current = null;
    };
  }, [open]);
  return (
    <div className="mobile-sheet-header">
      <button
        type="button"
        className="sheet-grab"
        aria-label={`Resize ${label} panel`}
        title="Drag to resize"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const panel =
            event.currentTarget.closest<HTMLElement>(".mobile-sheet");
          const shell = panel?.closest<HTMLElement>(".app-shell");
          const header = shell?.querySelector(".app-header");
          const dock = shell?.querySelector(".mobile-dock");
          if (!panel || !shell) return;
          drag.current = {
            id: event.pointerId,
            y: event.clientY,
            height: panel.getBoundingClientRect().height,
            max:
              shell.getBoundingClientRect().height -
              (header?.getBoundingClientRect().height ?? 56) -
              (dock?.getBoundingClientRect().height ?? 70) -
              16,
            panel,
          };
          dragged.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const distance = event.clientY - current.y;
          if (Math.abs(distance) < 5 && !dragged.current) return;
          dragged.current = true;
          current.panel.style.height = `${Math.max(60, Math.min(current.max, current.height - distance))}px`;
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          drag.current = null;
          const height = current.height + current.y - event.clientY;
          current.panel.style.removeProperty("height");
          if (dragged.current) {
            if (height < 60) onClose();
            else onResize(nearestSheetExtent(height, current.max));
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current?.panel.style.removeProperty("height");
          drag.current = null;
          dragged.current = true;
        }}
        onLostPointerCapture={() => {
          drag.current?.panel.style.removeProperty("height");
          drag.current = null;
        }}
        onClick={(event) => {
          if (!dragged.current || event.detail === 0)
            onResize(extent === "full" ? "half" : "full");
          dragged.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onResize(event.key === "ArrowUp" ? "full" : "peek");
          }
        }}
      >
        <span />
      </button>
      <div className="sheet-heading">
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="icon-button sheet-resize"
          aria-label={`${extent === "full" ? "Collapse" : "Expand"} ${label} panel`}
          onClick={() => onResize(extent === "full" ? "half" : "full")}
        >
          <Icon name={extent === "full" ? "collapse" : "expand"} size={19} />
        </button>
        {extent !== "peek" && (
          <button
            type="button"
            className="icon-button sheet-minimize"
            aria-label={`Minimize ${label} panel`}
            onClick={() => onResize("peek")}
          >
            <Icon name="minus" size={20} />
          </button>
        )}
        <button
          type="button"
          className="icon-button sheet-close"
          aria-label={`Close ${label} panel`}
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  );
}
