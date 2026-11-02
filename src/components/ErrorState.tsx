import { RefreshCw, Settings2, TriangleAlert, WifiOff } from "lucide-react";
import { useRadarStore } from "@/store/radarStore";
import { useUiStore } from "@/store/uiStore";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import { isTimeoutError } from "@/utils/errors";
import { Spinner } from "@/components/ui";

/**
 * Full-area failure state, shown only when there is no usable catalog. Errors
 * during a later refresh are handled by StatusBanner so data stays visible.
 */
export function ErrorState() {
  const metadata = useRadarStore((state) => state.metadata);
  const status = useRadarStore((state) => state.status);
  const error = useRadarStore((state) => state.error);
  const refreshing = useRadarStore((state) => state.refreshing);
  const requestRefresh = useRadarStore((state) => state.requestRefresh);
  const setPanel = useUiStore((state) => state.setPanel);
  const source = useResolvedDataSource();

  if (metadata || status !== "error") return null;

  const message = error?.message ?? "The radar catalog could not be loaded.";
  const timeout = isTimeoutError(error);

  return (
    <div className="error-state">
      <div className="error-state__card" role="alert">
        <span className="error-state__icon" aria-hidden="true">
          {timeout ? <WifiOff size={26} /> : <TriangleAlert size={26} />}
        </span>
        <p className="error-state__eyebrow">Connection problem</p>
        <h1 className="error-state__title">Radar data is unavailable</h1>
        <p className="error-state__message">{message}</p>

        <div className="error-state__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={requestRefresh}
            disabled={refreshing}
          >
            {refreshing ? <Spinner size={15} /> : <RefreshCw size={15} />}
            Try again
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setPanel("settings")}
          >
            <Settings2 size={15} />
            Data source settings
          </button>
        </div>

        <p className="error-state__hint">
          Currently using <strong>{source.label}</strong>
          {source.baseUrl ? ` at ${source.baseUrl}` : " without a valid URL"}. Check
          your internet connection, or switch to the public LibreWXR source. The
          map and place search may still work while radar data is offline.
        </p>
      </div>
    </div>
  );
}
