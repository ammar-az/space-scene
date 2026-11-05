import { useSyncExternalStore } from "react";

const query = "(max-width: 1199px), (max-width: 1399px) and (pointer: coarse)";
const subscribe = (notify: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/** Layout follows available CSS space; browser zoom and tablet pointers are respected. */
export function useCompactLayout() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}
