import type { FeatureCollection } from "geojson";
import type { ResolvedDataSource } from "@/config/dataSources";
import { fetchJson } from "@/utils/fetch";
import { clampLatitude } from "@/utils/geo";

export interface AlertBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Fetch active WMO CAP alerts for the current viewport (LibreWXR extension).
 * A bbox keeps the payload small; very zoomed-out views fall back to the
 * global feed with aggressive polygon simplification.
 */
export async function fetchAlerts(
  source: ResolvedDataSource,
  bounds: AlertBounds,
  zoom: number,
  signal?: AbortSignal,
): Promise<FeatureCollection> {
  if (!source.supportsAlerts) {
    throw new Error("Weather alerts are only available from LibreWXR sources.");
  }

  const simplify = zoom < 4 ? 5_000 : zoom < 6 ? 2_000 : 1_000;
  const params = new URLSearchParams({ simplify: String(simplify) });

  const west = Math.max(-180, Math.min(180, bounds.west));
  const east = Math.max(-180, Math.min(180, bounds.east));
  const south = clampLatitude(bounds.south);
  const north = clampLatitude(bounds.north);
  const spansAntimeridian = bounds.east < bounds.west || Math.abs(east - west) > 350;

  if (!spansAntimeridian && zoom >= 3) {
    params.set("bbox", [west, south, east, north].join(","));
  }

  const url = `${source.baseUrl}/v2/alerts?${params.toString()}`;
  const data = await fetchJson<FeatureCollection>(url, {
    signal,
    timeoutMs: 30_000,
  });

  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("The alerts endpoint returned an invalid GeoJSON payload.");
  }
  return data;
}
