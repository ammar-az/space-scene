export type MobilePanel = "objects" | "inspector" | "view" | "menu";
export type SheetExtent = "peek" | "half" | "full";
export type MobilePanelState = {
  panel: MobilePanel | null;
  extent: SheetExtent;
};
export type MobilePanelAction =
  | { type: "show" | "toggle"; panel: MobilePanel }
  | { type: "close" }
  | { type: "resize"; extent: SheetExtent };
export const initialMobilePanel: MobilePanelState = {
  panel: null,
  extent: "half",
};

export function mobilePanelReducer(
  state: MobilePanelState,
  action: MobilePanelAction,
): MobilePanelState {
  switch (action.type) {
    case "close":
      return { ...state, panel: null };
    case "resize":
      return { ...state, extent: action.extent };
    case "show":
      return state.panel === action.panel
        ? state
        : { panel: action.panel, extent: "half" };
    case "toggle":
      return state.panel === action.panel
        ? { ...state, panel: null }
        : { panel: action.panel, extent: "half" };
  }
}

/** Match the sheet's CSS snap heights, with enough room for the header and dock. */
export function nearestSheetExtent(
  height: number,
  available: number,
): SheetExtent {
  const half = Math.min(available, Math.max(200, available * 0.66));
  const stops: [SheetExtent, number][] = [
    ["peek", 82],
    ["half", half],
    ["full", available],
  ];
  return stops.reduce((best, stop) =>
    Math.abs(stop[1] - height) < Math.abs(best[1] - height) ? stop : best,
  )[0];
}
