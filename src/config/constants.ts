import type { ColorScheme } from "@/types/weather";

export const APP_NAME = "OpenRadar";
export const APP_VERSION = "0.1.0";

/** LibreWXR/RainViewer radar tiles are available up to zoom 12. */
export const MAX_RADAR_SOURCE_ZOOM = 12;
/** GMGSI satellite imagery is much coarser; overzoom the z6 tiles. */
export const MAX_SATELLITE_SOURCE_ZOOM = 6;
export const TILE_SIZE = 256;

/** Frames to warm on either side of the active frame. */
export const PRELOAD_RADIUS = 2;
/** Hard cap on the actual PNG byte cache used by the custom tile protocol. */
export const TILE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
/** Maximum tiles warmed per frame (center tiles are preferred). */
export const PRELOAD_TILES_PER_FRAME = 32;

export const METADATA_TIMEOUT_MS = 20_000;
export const TILE_TIMEOUT_MS = 25_000;
export const ALERT_REFRESH_MS = 5 * 60 * 1000;
export const NOMINATIM_DEBOUNCE_MS = 550;

export const ANIMATION_SPEED_OPTIONS = [
  { label: "Slow", value: 1100 },
  { label: "Normal", value: 650 },
  { label: "Fast", value: 350 },
  { label: "Very fast", value: 200 },
] as const;

/**
 * Fallback list for the brief moment before metadata arrives. The real list is
 * always taken from `radar.colorSchemes` in the API response.
 */
export const FALLBACK_COLOR_SCHEMES: ColorScheme[] = [
  { id: 0, name: "Black and White" },
  { id: 1, name: "RainViewer Original" },
  { id: 2, name: "Universal Blue" },
  { id: 3, name: "Titan" },
  { id: 4, name: "The Weather Channel" },
  { id: 5, name: "Meteored" },
  { id: 6, name: "NEXRAD Level III" },
  { id: 7, name: "Rainbow @ Selex SI" },
  { id: 8, name: "Dark Sky" },
  { id: 9, name: "Datameteo Valerio" },
  { id: 10, name: "Viper HD" },
  { id: 11, name: "MRMS CREF" },
  { id: 12, name: "33/40 Max Storm" },
  { id: 13, name: "MetService NZ (Dark)" },
  { id: 14, name: "Windy" },
];

/** LibreWXR supports raw grayscale as colour id 255. */
export const GRAYSCALE_SCHEME: ColorScheme = { id: 255, name: "Grayscale (raw)" };

export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  Extreme: "#ff4d4f",
  Severe: "#ff9f0a",
  Moderate: "#ffd60a",
  Minor: "#30d158",
  Unknown: "#94a3b8",
};
