import { Crosshair, X } from "lucide-react";
import { LOCAL_RADAR_RADIUS_OPTIONS } from "@/config/constants";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { cx } from "@/utils/cx";
import { Spinner } from "@/components/ui";

function RadiusChoices({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (miles: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="local-radar__radii" role="radiogroup" aria-label="Local radar radius">
      {LOCAL_RADAR_RADIUS_OPTIONS.map((miles) => (
        <button
          key={miles}
          type="button"
          role="radio"
          aria-checked={value === miles}
          className={cx("local-radar__radius", value === miles && "is-active")}
          disabled={disabled}
          onClick={() => onChange(miles)}
        >
          {miles} mi
        </button>
      ))}
    </div>
  );
}

/**
 * Asks for a device location, then frames the radar around that point.
 * After a view is active, the card shrinks to a radius control for the ring.
 */
export function LocationPrompt() {
  const dismissed = useSettingsStore((state) => state.locationPromptDismissed);
  const dismiss = useSettingsStore((state) => state.update);
  const localArea = useUiStore((state) => state.localArea);
  const {
    locate,
    locating,
    setRadiusMiles,
    clearLocalRadar,
    radiusMiles,
    ready,
  } = useDeviceLocation();

  if (dismissed && !localArea) return null;

  if (localArea) {
    return (
      <section className="local-radar local-radar--compact" aria-label="Local radar area">
        <p className="local-radar__summary">
          <strong>{localArea.radiusMiles} mi radar</strong>
          <span>{localArea.label}</span>
        </p>
        <RadiusChoices
          value={localArea.radiusMiles}
          onChange={setRadiusMiles}
          disabled={!ready}
        />
        <button
          type="button"
          className="local-radar__icon"
          onClick={clearLocalRadar}
          aria-label="Clear local radar area"
          title="Clear local radar area"
        >
          <X size={14} />
        </button>
      </section>
    );
  }

  return (
    <section className="local-radar" aria-label="Use location for local radar">
      <div className="local-radar__header">
        <span className="local-radar__mark" aria-hidden="true">
          <Crosshair size={16} />
        </span>
        <h2>Local radar</h2>
        <button
          type="button"
          className="local-radar__icon"
          onClick={() => dismiss({ locationPromptDismissed: true })}
          aria-label="Dismiss local radar prompt"
          title="Not now"
        >
          <X size={14} />
        </button>
      </div>
      <p>
        Use your location to zoom into the radar around you. The map frames a{" "}
        {radiusMiles}-mile radius and draws that area on the map.
      </p>
      <RadiusChoices
        value={radiusMiles}
        onChange={setRadiusMiles}
        disabled={locating || !ready}
      />
      <div className="local-radar__actions">
        <button
          type="button"
          className="button button--primary button--small"
          onClick={locate}
          disabled={locating || !ready}
        >
          {locating ? <Spinner size={14} /> : <Crosshair size={14} />}
          Use my location
        </button>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => dismiss({ locationPromptDismissed: true })}
          disabled={locating}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
