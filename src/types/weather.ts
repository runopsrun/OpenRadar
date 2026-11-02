/**
 * Normalized weather data types.
 *
 * The raw LibreWXR/RainViewer `weather-maps.json` payload is intentionally
 * converted into these types at the service boundary. Everything above the
 * service layer can therefore rely on consistent field names, sorted frames,
 * and an explicit `kind` for each frame.
 */

export type FrameKind = "past" | "nowcast" | "satellite";

export interface RadarFrame {
  /** Unix epoch seconds, as delivered by the API. */
  time: number;
  /** Tile path prefix, e.g. `/v2/radar/1700000000`. */
  path: string;
  kind: FrameKind;
}

export interface ColorScheme {
  id: number;
  name: string;
}

export interface RadarMetadata {
  /** Identifies the configured source, used to reset state when it changes. */
  sourceKey: string;
  /** Tile host advertised by the metadata payload (not necessarily the API host). */
  host: string;
  /** When the server generated this catalog (Unix seconds). */
  generated: number;
  /** When this client fetched the catalog (Unix milliseconds). */
  fetchedAt: number;
  /** Past + nowcast radar frames, sorted oldest to newest. */
  frames: RadarFrame[];
  /** Satellite frames, sorted oldest to newest. May be empty. */
  satelliteFrames: RadarFrame[];
  colorSchemes: ColorScheme[];
}

export interface RawFrame {
  time: number;
  path?: string;
}

export interface RawWeatherMaps {
  version?: string;
  generated?: number;
  host?: string;
  radar?: {
    past?: RawFrame[];
    nowcast?: RawFrame[];
    colorSchemes?: ColorScheme[];
  };
  satellite?: {
    infrared?: RawFrame[];
  };
}

export type MetadataStatus = "idle" | "loading" | "ready" | "error";

export interface MetadataError {
  message: string;
  /** Whether old data is still being displayed. */
  stale: boolean;
}
