import { useMemo } from "react";
import { resolveDataSource, type ResolvedDataSource } from "@/config/dataSources";
import { useSettingsStore } from "@/store/settingsStore";

/** Memoized data-source configuration derived from settings. */
export function useResolvedDataSource(): ResolvedDataSource {
  const dataSourceId = useSettingsStore((state) => state.dataSourceId);
  const customHost = useSettingsStore((state) => state.customHost);

  return useMemo(
    () => resolveDataSource({ dataSourceId, customHost }),
    [dataSourceId, customHost],
  );
}
