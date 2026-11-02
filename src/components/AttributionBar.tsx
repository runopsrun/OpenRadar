import { useState } from "react";
import { ChevronUp, Info } from "lucide-react";
import { BASE_MAPS } from "@/config/basemaps";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import { useSettingsStore } from "@/store/settingsStore";
import { cx } from "@/utils/cx";
import { ExternalLink } from "@/components/ui";

/**
 * Always-available attribution. MapLibre's own attribution control is disabled
 * because the required notices are rendered here with links and full credit.
 */
export function AttributionBar() {
  const [open, setOpen] = useState(false);
  const source = useResolvedDataSource();
  const baseMapId = useSettingsStore((state) => state.baseMapId);
  const alertsEnabled = useSettingsStore((state) => state.alertsEnabled);
  const baseMap = BASE_MAPS[baseMapId];

  return (
    <div className={cx("attribution-bar", open && "is-open")}>
      {open && (
        <div className="attribution-bar__panel" role="region" aria-label="Data attribution">
          <p className="attribution-bar__heading">Map data & services</p>
          <dl className="attribution-bar__list">
            <div>
              <dt>Radar</dt>
              <dd>
                <ExternalLink href={source.attributionUrl}>
                  {source.attributionName}
                </ExternalLink>
                {source.id === "librewxr" && " · global radar and nowcast composites"}
                {source.id === "rainviewer" && " · radar only, no nowcast extensions"}
                {source.id === "custom" && " · self-hosted instance"}
              </dd>
            </div>
            <div>
              <dt>Base map</dt>
              <dd>
                <ExternalLink href={baseMap.attributionUrl}>
                  {baseMap.attribution}
                </ExternalLink>
              </dd>
            </div>
            {baseMapId !== "satellite" && (
              <div>
                <dt>Map data</dt>
                <dd>
                  <ExternalLink href="https://www.openstreetmap.org/copyright">
                    © OpenStreetMap contributors
                  </ExternalLink>{" "}
                  (ODbL)
                </dd>
              </div>
            )}
            <div>
              <dt>Place search</dt>
              <dd>
                <ExternalLink href="https://nominatim.openstreetmap.org/">
                  Nominatim
                </ExternalLink>{" "}
                · please be considerate with requests
              </dd>
            </div>
            {alertsEnabled && source.supportsAlerts && (
              <div>
                <dt>Alerts</dt>
                <dd>WMO Common Alerting Protocol via LibreWXR</dd>
              </div>
            )}
          </dl>
          <p className="attribution-bar__note">
            Radar imagery can lag observations and must not be used for
            life-safety decisions.
          </p>
        </div>
      )}

      <div className="attribution-bar__compact">
        <span className="attribution-bar__sources">
          Radar © {source.attributionName} ·{" "}
          {baseMapId === "satellite"
            ? "Imagery © Esri"
            : "Map © OpenStreetMap / OpenFreeMap"}
        </span>
        <button
          type="button"
          className="attribution-bar__toggle"
          aria-expanded={open}
          aria-label={open ? "Hide attribution details" : "Show attribution details"}
          title="Data sources and licenses"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronUp size={13} /> : <Info size={13} />}
          <span>{open ? "Hide" : "Data"}</span>
        </button>
      </div>
    </div>
  );
}
