import { fetchJson } from "@/utils/fetch";

export interface ApproximateLocation {
  latitude: number;
  longitude: number;
  /** Marker text. Never includes the IP address. */
  label: string;
  /** City and region, when the provider returned them. */
  place: string | null;
}

interface GeoJsResponse {
  latitude?: string;
  longitude?: string;
  city?: string;
  region?: string;
}

/**
 * City-scale location from the network address. Used only when the webview
 * refuses device geolocation. The request is a plain GET; the provider sees
 * the IP address and user agent.
 */
export async function approximateNetworkLocation(
  signal?: AbortSignal,
): Promise<ApproximateLocation> {
  const raw = await fetchJson<GeoJsResponse>(
    "https://get.geojs.io/v1/ip/geo.json",
    { signal, timeoutMs: 8_000 },
  );

  const latitude = Number.parseFloat(raw.latitude ?? "");
  const longitude = Number.parseFloat(raw.longitude ?? "");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Approximate location was not available.");
  }
  if (latitude < -85 || latitude > 85 || longitude < -180 || longitude > 180) {
    throw new Error("Approximate location was not available.");
  }

  const place = [raw.city, raw.region]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return {
    latitude,
    longitude,
    place: place || null,
    label: place ? `Approximate location · ${place}` : "Approximate location",
  };
}
