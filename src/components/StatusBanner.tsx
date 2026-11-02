import { CloudOff, RefreshCw } from "lucide-react";
import { useRadarStore } from "@/store/radarStore";
import { useNow } from "@/hooks/useNow";
import { formatAge } from "@/utils/time";
import { Spinner } from "@/components/ui";

/**
 * Non-blocking notice for background-refresh failures. The last good catalog
 * and its frames remain usable, so this is a banner rather than an error page.
 */
export function StatusBanner() {
  const metadata = useRadarStore((state) => state.metadata);
  const error = useRadarStore((state) => state.error);
  const refreshing = useRadarStore((state) => state.refreshing);
  const requestRefresh = useRadarStore((state) => state.requestRefresh);
  const now = useNow(30_000);

  if (!metadata || !error?.stale) return null;

  return (
    <div className="status-banner" role="status">
      <CloudOff size={16} className="status-banner__icon" aria-hidden="true" />
      <div className="status-banner__text">
        <strong>Live updates paused.</strong>{" "}
        <span>
          {error.message} Showing the catalog fetched{" "}
          {formatAge(metadata.fetchedAt, now)}. Playback still works.
        </span>
      </div>
      <button
        type="button"
        className="status-banner__retry"
        onClick={requestRefresh}
        disabled={refreshing}
      >
        {refreshing ? <Spinner size={13} /> : <RefreshCw size={13} />}
        Retry
      </button>
    </div>
  );
}
