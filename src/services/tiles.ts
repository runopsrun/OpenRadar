import { addProtocol } from "maplibre-gl";
import {
  MAX_RADAR_SOURCE_ZOOM,
  MAX_SATELLITE_SOURCE_ZOOM,
  TILE_CACHE_MAX_BYTES,
  TILE_SIZE,
  TILE_TIMEOUT_MS,
} from "@/config/constants";
import type { LightningStyle } from "@/types/settings";
import { fetchArrayBuffer } from "@/utils/fetch";

/**
 * Radar tile pipeline
 * -------------------
 * MapLibre asks for `openradar://` tiles. A custom protocol handler translates
 * those URLs into LibreWXR/RainViewer HTTP URLs, fetches the PNG bytes, and
 * keeps an in-memory LRU cache. Frames can therefore be preloaded before the
 * user (or the animation timer) asks for them.
 *
 * The custom scheme is important: the animation changes the raster source's
 * tile template on every frame. With a warm byte cache the tiles are decoded
 * immediately instead of creating a visible blank frame while the network
 * request is in flight.
 */

type ArrowColor = "light" | "dark";

export interface RadarTileOptions {
  color: number;
  smooth: boolean;
  snow: boolean;
  /** LibreWXR extension: draw storm motion arrows onto tiles. */
  arrows?: ArrowColor | null;
  /** LibreWXR extension: draw storm-cell markers onto tiles. */
  cells?: ArrowColor | null;
  /** LibreWXR extension: draw lightning glyphs onto tiles. */
  lightning?: LightningStyle;
}

export interface RadarTileRequest extends RadarTileOptions {
  timestamp: number;
  /**
   * Frame path from the metadata payload. LibreWXR uses `/v2/radar/<timestamp>`,
   * but RainViewer now uses an opaque frame key such as `/v2/radar/f91b44fddba5`.
   * Always prefer this over reconstructing the path from the timestamp.
   */
  path?: string;
}

/** Only accept a plain radar path; never allow a frame field to escape the host. */
const RADAR_PATH_PATTERN = /^\/v2\/radar\/[A-Za-z0-9_-]+$/;

function radarPath(options: RadarTileRequest): string {
  if (options.path && RADAR_PATH_PATTERN.test(options.path)) {
    return options.path;
  }
  return `/v2/radar/${options.timestamp}`;
}

interface CacheEntry {
  data: ArrayBuffer;
  size: number;
}

const tileCache = new Map<string, CacheEntry>();
let cacheBytes = 0;
let tileHost = "";
let cacheGeneration = 0;

const preloadQueue: string[] = [];
const preloadQueued = new Set<string>();
const preloadInFlight = new Set<string>();
const PRELOAD_CONCURRENCY = 6;
const PRELOAD_QUEUE_LIMIT = 400;
let preloadActive = 0;

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

/** Must be called after metadata is fetched, before any tile URL is built. */
export function configureTileHost(host: string): void {
  const next = normalizeHost(host);
  if (next === tileHost) return;
  tileHost = next;
  cacheGeneration += 1;
  clearTileCache();
}

export function getTileHost(): string {
  return tileHost;
}

export function clearTileCache(): void {
  tileCache.clear();
  cacheBytes = 0;
  preloadQueue.length = 0;
  preloadQueued.clear();
}

export function getTileCacheStats(): { entries: number; bytes: number } {
  return { entries: tileCache.size, bytes: cacheBytes };
}

function queryParams(options: RadarTileOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (options.arrows) params.set("arrows", options.arrows);
  if (options.cells) params.set("cells", options.cells);
  if (options.lightning && options.lightning !== "off") {
    params.set("lightning", options.lightning);
  }
  return params;
}

function buildQuery(options: RadarTileOptions): string {
  const query = queryParams(options).toString();
  return query ? `?${query}` : "";
}

/** Protocol query: tile styling plus the upstream frame path (if it is safe). */
function buildProtocolQuery(options: RadarTileRequest): string {
  const params = queryParams(options);
  if (options.path && RADAR_PATH_PATTERN.test(options.path)) {
    params.set("path", options.path);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Protocol URL handed to a MapLibre raster source. `{z}/{x}/{y}` placeholders
 * are substituted by MapLibre; all styling options are baked into the path so
 * that changing a colour scheme naturally produces new cache entries.
 */
export function radarProtocolUrlTemplate(
  options: RadarTileRequest,
): string {
  const smooth = options.smooth ? 1 : 0;
  const snow = options.snow ? 1 : 0;
  return `openradar://radar/${options.timestamp}/{z}/{x}/{y}/${options.color}/${smooth}_${snow}.png${buildProtocolQuery(options)}`;
}

export function satelliteProtocolUrlTemplate(timestamp: number): string {
  return `openradar://satellite/${timestamp}/{z}/{x}/{y}`;
}

/** Remote LibreWXR/RainViewer URL for a concrete tile. */
export function remoteRadarTileUrl(
  options: RadarTileRequest,
  tile: { z: number; x: number; y: number },
): string {
  const smooth = options.smooth ? 1 : 0;
  const snow = options.snow ? 1 : 0;
  return `${tileHost}${radarPath(options)}/${TILE_SIZE}/${tile.z}/${tile.x}/${tile.y}/${options.color}/${smooth}_${snow}.png${buildQuery(options)}`;
}

export function remoteSatelliteTileUrl(
  timestamp: number,
  tile: { z: number; x: number; y: number },
): string {
  return `${tileHost}/v2/satellite/${timestamp}/${TILE_SIZE}/${tile.z}/${tile.x}/${tile.y}/0/0_0.png`;
}

/**
 * Convert an `openradar://` tile URL into the upstream HTTP URL. Returns null
 * when the URL is malformed or no tile host has been configured yet.
 */
export function resolveRemoteTileUrl(protocolUrl: string): string | null {
  if (!tileHost) return null;

  let url: URL;
  try {
    url = new URL(protocolUrl);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (url.host === "radar") {
    const [timestamp, z, x, y, color, smoothSnow] = segments;
    if (!timestamp || !z || !x || !y || !color || !smoothSnow) return null;
    const pathParam = url.searchParams.get("path");
    const path =
      pathParam && RADAR_PATH_PATTERN.test(pathParam)
        ? pathParam
        : `/v2/radar/${timestamp}`;
    // `path` is an OpenRadar-internal routing hint; upstream only sees the
    // styling extensions (arrows/cells/lightning).
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    return `${tileHost}${path}/${TILE_SIZE}/${z}/${x}/${y}/${color}/${smoothSnow}${query ? `?${query}` : ""}`;
  }

  if (url.host === "satellite") {
    const [timestamp, z, x, y] = segments;
    if (!timestamp || !z || !x || !y) return null;
    return `${tileHost}/v2/satellite/${timestamp}/${TILE_SIZE}/${z}/${x}/${y}/0/0_0.png`;
  }

  return null;
}

function cacheGet(key: string): ArrayBuffer | null {
  const entry = tileCache.get(key);
  if (!entry) return null;
  // Refresh LRU position.
  tileCache.delete(key);
  tileCache.set(key, entry);
  return entry.data;
}

function cacheSet(key: string, data: ArrayBuffer): void {
  const existing = tileCache.get(key);
  if (existing) {
    cacheBytes -= existing.size;
    tileCache.delete(key);
  }
  const size = data.byteLength;
  tileCache.set(key, { data, size });
  cacheBytes += size;

  while (cacheBytes > TILE_CACHE_MAX_BYTES) {
    const oldest = tileCache.keys().next();
    if (oldest.done) break;
    const entry = tileCache.get(oldest.value);
    if (entry) cacheBytes -= entry.size;
    tileCache.delete(oldest.value);
  }
}

function cacheHas(key: string): boolean {
  return tileCache.has(key);
}

/**
 * Load a tile for MapLibre. Returns a copy of the cached ArrayBuffer because
 * MapLibre may transfer the returned buffer to its worker, which detaches it.
 */
async function loadTile(
  protocolUrl: string,
  abortController: AbortController,
): Promise<ArrayBuffer> {
  const remoteUrl = resolveRemoteTileUrl(protocolUrl);
  if (!remoteUrl) {
    throw new Error("OpenRadar tile requested before a tile host was configured.");
  }

  const cached = cacheGet(remoteUrl);
  if (cached) return cached.slice(0);

  const buffer = await fetchArrayBuffer(
    remoteUrl,
    TILE_TIMEOUT_MS,
    abortController.signal,
  );
  cacheSet(remoteUrl, buffer);
  return buffer.slice(0);
}

function pumpPreloadQueue(): void {
  while (preloadActive < PRELOAD_CONCURRENCY && preloadQueue.length > 0) {
    const protocolUrl = preloadQueue.shift();
    if (!protocolUrl) break;
    const remoteUrl = resolveRemoteTileUrl(protocolUrl);
    if (!remoteUrl) continue;

    if (cacheHas(remoteUrl) || preloadInFlight.has(remoteUrl)) {
      preloadQueued.delete(remoteUrl);
      continue;
    }

    const generation = cacheGeneration;
    preloadActive += 1;
    preloadInFlight.add(remoteUrl);
    preloadQueued.delete(remoteUrl);

    void fetchArrayBuffer(remoteUrl, TILE_TIMEOUT_MS)
      .then((buffer) => {
        // Ignore results fetched for a previous data source.
        if (generation === cacheGeneration && !cacheHas(remoteUrl)) {
          cacheSet(remoteUrl, buffer);
        }
      })
      .catch(() => {
        // A missing tile is normal outside radar coverage; let MapLibre show
        // its own transparent/error tile rather than spamming the console.
      })
      .finally(() => {
        preloadInFlight.delete(remoteUrl);
        preloadActive -= 1;
        pumpPreloadQueue();
      });
  }
}

/**
 * Warm a set of tiles. URLs should be ordered by priority (current frame
 * first, then adjacent frames). Duplicate and already-cached URLs are skipped.
 */
export function enqueuePreload(protocolUrls: readonly string[]): void {
  if (!tileHost) return;
  for (const protocolUrl of protocolUrls) {
    const remoteUrl = resolveRemoteTileUrl(protocolUrl);
    if (!remoteUrl) continue;
    if (cacheHas(remoteUrl) || preloadQueued.has(remoteUrl) || preloadInFlight.has(remoteUrl)) {
      continue;
    }
    if (preloadQueue.length >= PRELOAD_QUEUE_LIMIT) break;
    preloadQueue.push(protocolUrl);
    preloadQueued.add(remoteUrl);
  }
  pumpPreloadQueue();
}

/** Build the full protocol URL list for one frame at a set of tile positions. */
export function radarProtocolUrlsForTiles(
  options: RadarTileRequest,
  tiles: ReadonlyArray<{ z: number; x: number; y: number }>,
): string[] {
  const base = radarProtocolUrlTemplate(options);
  return tiles.map((tile) =>
    base
      .replace("{z}", String(tile.z))
      .replace("{x}", String(tile.x))
      .replace("{y}", String(tile.y)),
  );
}

export function satelliteProtocolUrlsForTiles(
  timestamp: number,
  tiles: ReadonlyArray<{ z: number; x: number; y: number }>,
): string[] {
  const base = satelliteProtocolUrlTemplate(timestamp);
  return tiles.map((tile) =>
    base
      .replace("{z}", String(tile.z))
      .replace("{x}", String(tile.x))
      .replace("{y}", String(tile.y)),
  );
}

// Register the protocol exactly once per module evaluation. Re-registering on
// Vite HMR is supported and simply replaces the handler.
addProtocol("openradar", async (request, abortController) => {
  const data = await loadTile(request.url, abortController);
  return { data };
});

export const RADAR_SOURCE_MAX_ZOOM = MAX_RADAR_SOURCE_ZOOM;
export const SATELLITE_SOURCE_MAX_ZOOM = MAX_SATELLITE_SOURCE_ZOOM;
