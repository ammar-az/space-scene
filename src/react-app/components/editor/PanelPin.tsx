import { Icon } from "./controls.tsx";

export default function PanelPin({
  pinned,
  label,
  onToggle,
}: {
  pinned: boolean;
  label: string;
  onToggle(): void;
}) {
  return (
    <button
      type="button"
      className={`icon-button panel-pin ${pinned ? "active" : ""}`}
      aria-label={`${pinned ? "Unpin" : "Pin"} ${label}`}
      aria-pressed={pinned}
      title={pinned ? "Unpin to auto-hide" : "Keep panel open"}
      onClick={(event) => {
        onToggle();
        event.currentTarget.blur();
      }}
    >
      <Icon name={pinned ? "pin" : "unpin"} size={19} />
    </button>
  );
}
