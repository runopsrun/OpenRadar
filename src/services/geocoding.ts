import { fetchJson } from "@/utils/fetch";

export interface PlaceResult {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
  type?: string;
  boundingBox?: [south: number, north: number, west: number, east: number];
}

interface NominatimResult {
  place_id: number | string;
  display_name?: string;
  name?: string;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  boundingbox?: [string, string, string, string];
}

const searchCache = new Map<string, PlaceResult[]>();
const CACHE_LIMIT = 60;

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

function parseResult(raw: NominatimResult): PlaceResult | null {
  const latitude = Number.parseFloat(raw.lat);
  const longitude = Number.parseFloat(raw.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const displayName = raw.display_name ?? raw.name ?? "Unknown place";
  const name = raw.name ?? displayName.split(",")[0]?.trim() ?? displayName;
  const bbox = raw.boundingbox?.map(Number);
  const validBbox =
    bbox &&
    bbox.length === 4 &&
    bbox.every((value) => Number.isFinite(value)) &&
    bbox[0]! < bbox[1]! &&
    bbox[2]! < bbox[3]!;

  return {
    id: String(raw.place_id),
    name,
    displayName,
    latitude,
    longitude,
    category: raw.category,
    type: raw.type,
    boundingBox: validBbox
      ? [bbox[0]!, bbox[1]!, bbox[2]!, bbox[3]!]
      : undefined,
  };
}

/**
 * Forward geocoding through the public Nominatim service.
 *
 * Please respect the Nominatim usage policy: this client debounces requests
 * and caches results. For a production deployment, run your own Nominatim
 * instance or proxy requests through your backend.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const key = cacheKey(trimmed);
  const cached = searchCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "6",
    addressdetails: "1",
    "accept-language": "en",
  });

  const raw = await fetchJson<NominatimResult[]>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      signal,
      timeoutMs: 10_000,
      headers: { Accept: "application/json" },
    },
  );

  const results = Array.isArray(raw)
    ? raw
        .map(parseResult)
        .filter((place): place is PlaceResult => place !== null)
    : [];

  searchCache.set(key, results);
  if (searchCache.size > CACHE_LIMIT) {
    const oldest = searchCache.keys().next();
    if (!oldest.done) searchCache.delete(oldest.value);
  }
  return results;
}

export function clearSearchCache(): void {
  searchCache.clear();
}
