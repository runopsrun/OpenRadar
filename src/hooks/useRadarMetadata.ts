import { useEffect } from "react";
import { dataSourceKey } from "@/config/dataSources";
import { fetchRadarMetadata } from "@/services/metadata";
import { clearTileCache, configureTileHost } from "@/services/tiles";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getErrorMessage, isAbortError } from "@/utils/errors";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";

/**
 * Owns the metadata lifecycle:
 *  - fetch on mount / source change / manual refresh
 *  - keep old frames visible during background refreshes
 *  - poll every `autoRefreshMinutes`
 *  - validate colour schemes against the newly advertised list
 */
export function useRadarMetadata(): void {
  const source = useResolvedDataSource();
  const autoRefreshMinutes = useSettingsStore((state) => state.autoRefreshMinutes);
  const refreshNonce = useRadarStore((state) => state.refreshNonce);

  useEffect(() => {
    const store = useRadarStore.getState();
    const sourceKey = dataSourceKey(source);

    if (store.metadata && store.metadata.sourceKey !== sourceKey) {
      store.reset();
      clearTileCache();
    }

    // If the user switches to a source without LibreWXR extensions, clear
    // extension toggles so they don't silently linger enabled in the UI.
    if (!source.supportsExtensions) {
      const settings = useSettingsStore.getState();
      if (
        settings.lightning !== "off" ||
        settings.stormCells ||
        settings.motionArrows
      ) {
        settings.update({ lightning: "off", stormCells: false, motionArrows: false });
      }
    }
    if (!source.supportsAlerts && useSettingsStore.getState().alertsEnabled) {
      useSettingsStore.getState().update({ alertsEnabled: false });
    }

    let disposed = false;
    let activeController: AbortController | null = null;

    const load = async (): Promise<void> => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      useRadarStore.getState().beginLoad();

      try {
        const metadata = await fetchRadarMetadata(source, controller.signal);
        if (disposed || controller.signal.aborted) return;

        configureTileHost(metadata.host);
        useRadarStore.getState().applyMetadata(metadata);

        // The selected palette may not exist on the newly selected server.
        const currentColor = useSettingsStore.getState().colorScheme;
        if (!metadata.colorSchemes.some((scheme) => scheme.id === currentColor)) {
          const first = metadata.colorSchemes[0];
          if (first) useSettingsStore.getState().update({ colorScheme: first.id });
        }

        // Avoid leaving satellite enabled when the source has no frames.
        if (
          useSettingsStore.getState().satelliteEnabled &&
          metadata.satelliteFrames.length === 0
        ) {
          useSettingsStore.getState().update({ satelliteEnabled: false });
        }
      } catch (error) {
        if (disposed || controller.signal.aborted || isAbortError(error)) return;
        useRadarStore.getState().markError(getErrorMessage(error));
      }
    };

    void load();

    let interval: number | undefined;
    if (autoRefreshMinutes > 0) {
      interval = window.setInterval(
        () => void load(),
        autoRefreshMinutes * 60_000,
      );
    }

    return () => {
      disposed = true;
      activeController?.abort();
      if (interval != null) window.clearInterval(interval);
    };
  }, [source, autoRefreshMinutes, refreshNonce]);
}
