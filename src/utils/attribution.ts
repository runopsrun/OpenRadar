import { BASE_MAPS } from "@/config/basemaps";
import type { ResolvedDataSource } from "@/config/dataSources";
import type { BaseMapId } from "@/types/settings";

/** Compact attribution string used by the export footer and About dialog. */
export function attributionText(
  source: ResolvedDataSource,
  baseMapId: BaseMapId,
  alertsEnabled: boolean,
): string {
  const parts = [
    `Radar © ${source.attributionName}`,
    `Map © ${BASE_MAPS[baseMapId].attribution}`,
  ];
  if (alertsEnabled && source.supportsAlerts) {
    parts.push("Alerts © WMO CAP");
  }
  return parts.join(" · ");
}
