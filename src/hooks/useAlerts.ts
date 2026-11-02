import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ALERT_REFRESH_MS } from "@/config/constants";
import { fetchAlerts } from "@/services/alerts";
import { useAlertsStore } from "@/store/alertsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getErrorMessage, isAbortError } from "@/utils/errors";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";

/**
 * Loads active alerts for the current viewport while the layer is enabled.
 * Refreshes after map moves (debounced) and every five minutes. Old polygons
 * stay on screen during a refresh so the map does not flash empty.
 */
export function useAlerts(map: MapLibreMap | null): void {
  const enabled = useSettingsStore((state) => state.alertsEnabled);
  const source = useResolvedDataSource();

  useEffect(() => {
    if (!map) return;
    const store = useAlertsStore.getState();

    if (!enabled || !source.supportsAlerts) {
      store.clear();
      return;
    }

    let disposed = false;
    let activeController: AbortController | null = null;
    let refreshTimer: number | undefined;
    let moveTimer: number | undefined;

    const load = async () => {
      if (disposed) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      useAlertsStore.getState().begin();

      try {
        const bounds = map.getBounds();
        const data = await fetchAlerts(
          source,
          {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          },
          map.getZoom(),
          controller.signal,
        );
        if (!disposed && !controller.signal.aborted) {
          useAlertsStore.getState().succeed(data);
        }
      } catch (error) {
        if (disposed || controller.signal.aborted || isAbortError(error)) return;
        useAlertsStore.getState().fail(getErrorMessage(error));
      }
    };

    const onMoveEnd = () => {
      if (moveTimer != null) window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => void load(), 700);
    };

    void load();
    map.on("moveend", onMoveEnd);
    refreshTimer = window.setInterval(() => void load(), ALERT_REFRESH_MS);

    return () => {
      disposed = true;
      activeController?.abort();
      map.off("moveend", onMoveEnd);
      if (moveTimer != null) window.clearTimeout(moveTimer);
      if (refreshTimer != null) window.clearInterval(refreshTimer);
    };
  }, [map, enabled, source]);
}
