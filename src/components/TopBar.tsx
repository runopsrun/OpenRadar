import { useState } from "react";
import {
  Download,
  Layers3,
  SlidersHorizontal,
  SunMoon,
} from "lucide-react";
import { useMapContext } from "@/map/MapContext";
import { exportMapImage } from "@/services/exportView";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import { useNow } from "@/hooks/useNow";
import { toggleTheme } from "@/hooks/useTheme";
import { attributionText } from "@/utils/attribution";
import { cx } from "@/utils/cx";
import { formatAge } from "@/utils/time";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { Spinner } from "@/components/ui";

export function TopBar() {
  const { map } = useMapContext();
  const panel = useUiStore((state) => state.panel);
  const togglePanel = useUiStore((state) => state.togglePanel);
  const metadata = useRadarStore((state) => state.metadata);
  const status = useRadarStore((state) => state.status);
  const refreshing = useRadarStore((state) => state.refreshing);
  const error = useRadarStore((state) => state.error);
  const requestRefresh = useRadarStore((state) => state.requestRefresh);
  const baseMapId = useSettingsStore((state) => state.baseMapId);
  const alertsEnabled = useSettingsStore((state) => state.alertsEnabled);
  const source = useResolvedDataSource();
  const now = useNow(30_000);

  const [exporting, setExporting] = useState(false);

  const initialLoading = status === "loading" && !metadata;
  const stale = Boolean(error?.stale && metadata);
  const offline = Boolean(error && !metadata);
  const statusLabel = initialLoading
    ? "Loading"
    : refreshing
      ? "Updating"
      : offline
        ? "Offline"
        : stale
          ? "Stale"
          : "Live";
  const statusTone = offline
    ? "danger"
    : stale
      ? "warning"
      : initialLoading || refreshing
        ? "pending"
        : "live";

  const handleExport = async () => {
    if (!map || exporting) return;
    setExporting(true);
    try {
      await exportMapImage(
        map,
        attributionText(source, baseMapId, alertsEnabled),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar">
      <Logo />

      <button
        type="button"
        className={cx("status-pill", `status-pill--${statusTone}`)}
        onClick={requestRefresh}
        title={
          metadata
            ? `Radar catalog fetched ${formatAge(metadata.fetchedAt, now)}. Click to refresh.`
            : "Click to retry loading radar data."
        }
      >
        <span className="status-pill__dot" aria-hidden="true" />
        {initialLoading || refreshing ? (
          <Spinner size={12} />
        ) : (
          <span className="status-pill__label">{statusLabel}</span>
        )}
        {metadata && !initialLoading && !refreshing && (
          <span className="status-pill__age">
            {formatAge(metadata.fetchedAt, now)}
          </span>
        )}
      </button>

      <div className="topbar__search">
        <SearchBox />
      </div>

      <div className="topbar__actions">
        <button
          type="button"
          className={cx("topbar__button", panel === "layers" && "is-active")}
          onClick={() => togglePanel("layers")}
          aria-pressed={panel === "layers"}
          title="Layers (Layers panel)"
        >
          <Layers3 size={17} />
          <span>Layers</span>
        </button>
        <button
          type="button"
          className={cx("topbar__button", panel === "settings" && "is-active")}
          onClick={() => togglePanel("settings")}
          aria-pressed={panel === "settings"}
          title="Settings"
        >
          <SlidersHorizontal size={17} />
          <span>Settings</span>
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={toggleTheme}
          title="Toggle light/dark theme (T)"
          aria-label="Toggle light/dark theme"
        >
          <SunMoon size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => void handleExport()}
          disabled={!map || exporting}
          title="Export current map view as PNG"
          aria-label="Export map as PNG"
        >
          {exporting ? <Spinner size={17} /> : <Download size={17} />}
        </button>
      </div>
    </header>
  );
}
