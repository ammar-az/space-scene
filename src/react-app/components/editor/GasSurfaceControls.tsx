import type { GasSurface } from "../../scene/model/gas.ts";
import { SurfaceSlider } from "./RockySurfaceControls.tsx";
export default function GasSurfaceControls({
  settings,
  onChange,
}: {
  settings: GasSurface;
  onChange(settings: GasSurface): void;
}) {
  return (
    <>
      <SurfaceSlider
        label="Band turbulence"
        value={settings.turbulence}
        min={0}
        max={2}
        onCommit={(turbulence) => onChange({ ...settings, turbulence })}
      />
      <SurfaceSlider
        label="Band softness"
        value={settings.softness * 100}
        min={0}
        max={100}
        step={1}
        unit="%"
        onCommit={(percent) =>
          onChange({ ...settings, softness: percent / 100 })
        }
      />
      <SurfaceSlider
        label="Fine cloud detail"
        value={settings.detail}
        min={0}
        max={2}
        onCommit={(detail) => onChange({ ...settings, detail })}
      />
    </>
  );
}
