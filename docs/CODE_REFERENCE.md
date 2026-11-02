# Code reference

Module-by-module map of the OpenRadar frontend and Rust shell. Use it when you
know *what* a piece of behaviour does but not *where* it lives. For the design
rationale, read [Architecture](ARCHITECTURE.md) first.

- All frontend paths are relative to `src/`.
- Imports use the `@/` alias for `src/`.
- “Store” means a Zustand hook created with `create()`.
- “Command” means a `#[tauri::command]` invoked from the webview.

---

## 1. Entry points and shell

### `main.tsx`

Mounts React into `#root`, imports the global stylesheet, and renders `<App />`
in `StrictMode`. No data fetching happens here.

### `App.tsx`

| Export | Type | Responsibility |
| --- | --- | --- |
| `App` (default) | Component | Applies the theme, waits for settings hydration, wraps the shell in `ErrorBoundary` and `MapProvider`. |
| `AppShell` (internal) | Component | Runs the shared hooks and lays out top bar, map, overlays, panels, dialogs, and splash. |

Hook order inside `AppShell` is intentional:

```text
useRadarMetadata() → useTauriEvents() → useTimeline() → useAnimation() → useKeyboardShortcuts()
```

`initialLoading` is true when no metadata exists and the catalog status is
`idle` or `loading`; that drives the overlay splash.

### `vite-env.d.ts`

Vite client types. No runtime code.

---

## 2. Configuration modules

### `config/constants.ts`

| Export | Value / meaning |
| --- | --- |
| `APP_NAME` | `"OpenRadar"` |
| `APP_VERSION` | `"0.1.0"` |
| `MAX_RADAR_SOURCE_ZOOM` | `12` |
| `MAX_SATELLITE_SOURCE_ZOOM` | `6` |
| `TILE_SIZE` | `256` |
| `PRELOAD_RADIUS` | `2` frames |
| `TILE_CACHE_MAX_BYTES` | 64 MiB |
| `PRELOAD_TILES_PER_FRAME` | `32` |
| `METADATA_TIMEOUT_MS` | 20 s |
| `TILE_TIMEOUT_MS` | 25 s |
| `ALERT_REFRESH_MS` | 5 min |
| `NOMINATIM_DEBOUNCE_MS` | 550 ms |
| `ANIMATION_SPEED_OPTIONS` | `Slow 1100`, `Normal 650`, `Fast 350`, `Very fast 200` |
| `FALLBACK_COLOR_SCHEMES` | Palettes 0–14 used before metadata arrives |
| `GRAYSCALE_SCHEME` | `{ id: 255, name: "Grayscale (raw)" }` |
| `ALERT_SEVERITY_COLORS` | Severity → hex map (used by UI chips) |

### `config/dataSources.ts`

```ts
interface ResolvedDataSource {
  id: DataSourceId;              // "librewxr" | "rainviewer" | "custom"
  label: string;
  baseUrl: string;               // metadata API origin
  supportsExtensions: boolean;   // arrows / cells / lightning
  supportsAlerts: boolean;
  attributionName: string;
  attributionUrl: string;
}
```

| Export | Signature | Notes |
| --- | --- | --- |
| `DATA_SOURCE_PRESETS` | `DataSourcePreset[]` | UI list for Settings. |
| `normalizeBaseUrl(input)` | `(string) => string \| null` | Adds `http://` for loopback/private IPv4, `https://` otherwise; strips hash/query/trailing slash; rejects non-HTTP(S). |
| `resolveDataSource(settings)` | `({ dataSourceId, customHost }) => ResolvedDataSource` | Custom hosts with invalid URLs resolve to `baseUrl: ""`. |
| `dataSourceKey(source)` | `(ResolvedDataSource) => string` | `${id}:${baseUrl}`, used to detect source changes. |

### `config/basemaps.ts`

| Export | Signature | Notes |
| --- | --- | --- |
| `BASE_MAPS` | `Record<BaseMapId, BaseMapDefinition>` | `dark`, `light`, `streets`, `satellite`. |
| `BASE_MAP_LIST` | `BaseMapDefinition[]` | Iteration order for the panel. |
| `FALLBACK_RASTER_STYLE` | `StyleSpecification` | OSM raster style used after a 12 s style timeout. |
| `getBaseMapStyle(id)` | `(BaseMapId) => string \| StyleSpecification` | |
| `isDarkBaseMap(id)` | `(BaseMapId) => boolean` | Selects `light`/`dark` glyph colour for tile extras. |

`BaseMapDefinition` fields: `id`, `name`, `description`, `style`, `dark`,
`attribution`, `attributionUrl`, `swatchClass`.

---

## 3. Types

### `types/settings.ts`

```ts
type ThemePreference = "system" | "light" | "dark";
type DataSourceId = "librewxr" | "rainviewer" | "custom";
type BaseMapId = "dark" | "light" | "streets" | "satellite";
type LightningStyle = "off" | "dots" | "bolts";

interface MapViewState { longitude: number; latitude: number; zoom: number }
interface SavedPlace { id: string; name: string; latitude: number; longitude: number; localRadar?: boolean }

interface AppSettings {
  theme; baseMapId;
  dataSourceId; customHost;
  radarEnabled; satelliteEnabled; coverageEnabled; alertsEnabled;
  radarOpacity; satelliteOpacity; coverageOpacity; colorScheme; smooth; snow;
  lightning; stormCells; motionArrows;
  animationSpeedMs; loop; includeNowcast; autoRefreshMinutes;
  defaultView; recentPlaces; localRadarMiles; locationPromptDismissed;
}
```

### `types/weather.ts`

```ts
type FrameKind = "past" | "nowcast" | "satellite";

interface RadarFrame { time: number; path: string; kind: FrameKind }
interface ColorScheme { id: number; name: string }

interface RadarMetadata {
  sourceKey: string;
  host: string;
  generated: number;      // Unix seconds, server
  fetchedAt: number;      // Unix milliseconds, client
  frames: RadarFrame[];   // past + nowcast, ascending
  satelliteFrames: RadarFrame[];
  colorSchemes: ColorScheme[];
}

interface RawFrame { time: number; path?: string }
interface RawWeatherMaps { version?; generated?; host?; radar?; satellite? }

type MetadataStatus = "idle" | "loading" | "ready" | "error";
interface MetadataError { message: string; stale: boolean }
```

`RawWeatherMaps` mirrors the upstream `weather-maps.json` and is only used
inside `services/metadata.ts`.

---

## 4. Services

### `services/metadata.ts`

| Export | Signature | Behaviour |
| --- | --- | --- |
| `fetchRadarMetadata` | `(source: ResolvedDataSource, signal?: AbortSignal) => Promise<RadarMetadata>` | Fetches `${baseUrl}/public/weather-maps.json`, normalises frames and palettes, validates the catalog. Throws on empty/invalid responses. |
| `latestPastFrame` | `(metadata: RadarMetadata) => RadarFrame \| null` | Last frame with `kind === "past"`. |

Internal helpers:

- `normalizePath` — ensures a leading slash and strips trailing slashes.
- `normalizeFrames` — drops invalid times, dedupes by timestamp, attaches a
  fallback path, sorts ascending.
- `normalizeColorSchemes` — dedupes, falls back to the built-in list, appends
  grayscale for non-RainViewer sources.

The returned `host` is normalised with `normalizeBaseUrl`; if the server omits
`host`, the API origin is used.

### `services/tiles.ts`

Radar/satellite tile pipeline and the `openradar://` protocol.

| Export | Signature | Purpose |
| --- | --- | --- |
| `RadarTileOptions` | interface | `color`, `smooth`, `snow`, optional `arrows`, `cells`, `lightning`. |
| `RadarTileRequest` | interface | Adds `timestamp` and optional `path`. |
| `configureTileHost(host)` | `(string) => void` | Normalises the host; clears the cache and bumps the generation when it changes. |
| `getTileHost()` | `() => string` | Current tile origin. |
| `clearTileCache()` | `() => void` | Empties the byte cache and preload queue. |
| `getTileCacheStats()` | `() => { entries, bytes }` | Diagnostics. |
| `radarProtocolUrlTemplate(options)` | `(RadarTileRequest) => string` | `openradar://radar/...` template with styling baked into the path. |
| `satelliteProtocolUrlTemplate(timestamp)` | `(number) => string` | `openradar://satellite/{timestamp}/{z}/{x}/{y}`. |
| `remoteRadarTileUrl(options, tile)` | `(RadarTileRequest, {z,x,y}) => string` | Concrete upstream URL. |
| `remoteSatelliteTileUrl(timestamp, tile)` | `(number, {z,x,y}) => string` | Concrete upstream URL. |
| `resolveRemoteTileUrl(protocolUrl)` | `(string) => string \| null` | Parses a protocol URL into an upstream URL; strips the internal `path` parameter. |
| `enqueuePreload(urls)` | `(readonly string[]) => void` | Deduped, capped, concurrent cache warming. |
| `radarProtocolUrlsForTiles(options, tiles)` | `(RadarTileRequest, tiles) => string[]` | Substitutes `{z}/{x}/{y}`. |
| `satelliteProtocolUrlsForTiles(timestamp, tiles)` | `(number, tiles) => string[]` | Same for satellite. |
| `RADAR_SOURCE_MAX_ZOOM`, `SATELLITE_SOURCE_MAX_ZOOM` | constants | Re-exported limits. |

Key internals:

- `RADAR_PATH_PATTERN = /^\/v2\/radar\/[A-Za-z0-9_-]+$/` guards against path
  traversal. Invalid or missing paths fall back to `/v2/radar/<timestamp>`.
- `tileCache` is a `Map<string, { data, size }>` used as an LRU by deleting and
  re-inserting on read.
- `cacheGeneration` prevents late preloads from a previous source entering the
  new cache.
- `loadTile` returns `buffer.slice(0)` because MapLibre may detach the buffer.
- `addProtocol("openradar", ...)` registers once per module evaluation and is
  safe under Vite HMR.

### `services/alerts.ts`

```ts
interface AlertBounds { west; south; east; north }

fetchAlerts(
  source: ResolvedDataSource,
  bounds: AlertBounds,
  zoom: number,
  signal?: AbortSignal,
): Promise<FeatureCollection>
```

- Rejects immediately when `source.supportsAlerts` is false.
- Chooses `simplify` = 5000 m (zoom < 4), 2000 m (zoom < 6), else 1000 m.
- Adds `bbox` only when zoom ≥ 3 and the view does not span the antimeridian.
- Validates that the response is a `FeatureCollection` with a `features` array.
- 30 s timeout.

### `services/geocoding.ts`

| Export | Signature | Notes |
| --- | --- | --- |
| `PlaceResult` | interface | `id`, `name`, `displayName`, `latitude`, `longitude`, optional `category`, `type`, `boundingBox`. |
| `searchPlaces(query, signal?)` | `(string, AbortSignal?) => Promise<PlaceResult[]>` | Returns `[]` for queries shorter than 2 characters. 10 s timeout, 6 results, 60-entry cache. |
| `clearSearchCache()` | `() => void` | Test/debug helper. |

Nominatim request parameters: `q`, `format=jsonv2`, `limit=6`,
`addressdetails=1`, `accept-language=en`. Malformed coordinates are dropped.

### `services/storage.ts`

Zustand storage adapter plus Tauri detection.

| Export | Signature | Notes |
| --- | --- | --- |
| `SETTINGS_STORAGE_KEY` | `"openradar-settings"` | localStorage key. |
| `isTauri` | boolean | True when `__TAURI_INTERNALS__` exists. |
| `settingsStorage` | `StateStorage` | Async `getItem`, debounced `setItem` (250 ms), `removeItem`. |
| `flushSettings()` | `() => void` | Forces a pending write; also bound to `pagehide` and visibility changes. |

Read path: native `load_settings` → localStorage fallback. Write path: native
`save_settings` → localStorage fallback. Failures log, never throw into the UI.

### `services/exportView.ts`

```ts
exportMapImage(map: MapLibreMap, attribution: string): Promise<void>
```

1. Waits for `idle` or 1.5 s.
2. Copies the WebGL canvas.
3. Draws a gradient footer with the attribution string and an `OpenRadar` mark.
4. In Tauri, invokes `save_export`; in the browser, triggers a download.
5. Emits a success or error toast. Never throws to the caller.

Filename: `openradar-YYYYMMDD-HHMMSS.png`.

---

## 5. Stores

### `store/settingsStore.ts`

| Export | Type | Notes |
| --- | --- | --- |
| `DEFAULT_SETTINGS` | `AppSettings` | Canonical defaults (see [Configuration](CONFIGURATION.md)). |
| `useSettingsStore` | Zustand hook | Persisted with `version: 1`. |
| `useSettingsHydrated()` | `() => boolean` | Resolves after async storage hydration. |

Store fields: every `AppSettings` key plus:

| Action | Signature | Behaviour |
| --- | --- | --- |
| `update` | `(patch: Partial<AppSettings>) => void` | Shallow merge. |
| `setDefaultView` | `(view: MapViewState) => void` | Replaces `defaultView`. |
| `addRecentPlace` | `(place: SavedPlace) => void` | Dedupes by `id`, newest first, max 5. |
| `reset` | `() => void` | Restores `DEFAULT_SETTINGS`. |

`sanitizePersisted` is applied in `merge`, not `partialize`, so invalid saved
values fall back to the current defaults. It validates enums, clamps opacity to
0.1–1, speed to 100–3000, auto-refresh to 0–60, colour to 0–255, view
coordinates, and recent places.

### `store/radarStore.ts`

| Field | Type | Meaning |
| --- | --- | --- |
| `metadata` | `RadarMetadata \| null` | Current catalog. |
| `status` | `MetadataStatus` | Catalog lifecycle. |
| `error` | `MetadataError \| null` | Includes `stale`. |
| `frameTime` | `number \| null` | Selected frame timestamp. |
| `playing` | boolean | Animation running. |
| `refreshing` | boolean | Background refresh in flight. |
| `refreshNonce` | number | Increment triggers `useRadarMetadata`. |

| Action | Behaviour |
| --- | --- |
| `beginLoad()` | Sets `loading` when there is no metadata, otherwise `refreshing: true` and clears the error. |
| `applyMetadata(metadata)` | Detects source changes, keeps or repairs `frameTime`, clears errors. |
| `markError(message)` | With metadata → `{ error: { stale: true } }`; without → `status: "error"`. |
| `setFrameTime(time)` | Ignores non-finite values. |
| `setPlaying(playing)` | |
| `requestRefresh()` | `refreshNonce += 1`. |
| `reset()` | Clears catalog and playback state. |

### `store/alertsStore.ts`

Fields: `status` (`idle | loading | ready | error`), `data`, `error`,
`lastUpdated`, `count`.

Actions: `begin()`, `succeed(collection)` (sets `count`), `fail(message)`,
`clear()`.

### `store/uiStore.ts`

```ts
type PanelId = "layers" | "settings";
type ToastTone = "info" | "success" | "warning" | "error";

interface ToastMessage { id: number; title: string; message?: string; tone: ToastTone }
```

Fields: `panel`, `aboutOpen`, `toasts`.

Actions: `setPanel`, `togglePanel`, `setAboutOpen`, `pushToast` (returns the
new id), `dismissToast`.

Module-level helper `toast(input)` in the same file is a convenience wrapper used
by services.

---

## 6. Hooks

| Hook | Signature | Responsibility |
| --- | --- | --- |
| `useRadarMetadata` | `() => void` | Catalog fetch, aborting, source-change reset, palette repair, satellite availability, polling. |
| `useTimeline` | `() => TimelineModel` | Visible frames, selection repair, play/pause/step/setFrame. |
| `useAnimation` | `(frames: RadarFrame[]) => void` | Timeout-driven playback; reads the store per tick. |
| `useKeyboardShortcuts` | `(timeline: TimelineModel) => void` | Global shortcuts; ignores inputs, buttons (for Space/Enter), and modifier keys. |
| `useAlerts` | `(map: MapLibreMap \| null) => void` | Viewport alerts, 700 ms move debounce, 5-minute polling, abort on cleanup. |
| `useRadarPreload` | `(options: PreloadOptions) => void` | Warms active/adjacent radar and current satellite tiles; skips hidden/offline. |
| `useResolvedDataSource` | `() => ResolvedDataSource` | Memoised source config from settings. |
| `useTauriEvents` | `() => void` | Subscribes to `openradar:refresh`; no-op in the browser. |
| `useTheme` | `() => void` | Resolves `system` via `matchMedia`, sets `data-theme`, `color-scheme`, and theme-color. |
| `useNow` | `(intervalMs?: number) => number` | Re-renders relative timestamps. |

`useTheme` also exports `toggleTheme()`.

### `TimelineModel`

```ts
interface TimelineModel {
  frames: RadarFrame[];
  index: number;                 // -1 when no selection
  currentFrame: RadarFrame | null;
  latestPast: RadarFrame | null;
  canPlay: boolean;              // frames.length > 1
  isPlaying: boolean;
  setFrame: (index: number) => void;  // clamps + pauses
  step: (delta: number) => void;
  togglePlay: () => void;        // restarts from frame 0 at the end
  pause: () => void;
}
```

Selection repair runs in an effect: if `frameTime` is not in the filtered list,
the last frame is selected.

### `PreloadOptions`

```ts
{
  map: MapLibreMap | null;
  enabled: boolean;
  frames: RadarFrame[];
  frameTime: number | null;
  tileOptions: RadarTileOptions;
  satelliteEnabled: boolean;
  satelliteFrameTime: number | null;
}
```

---

## 7. Map modules

### `map/MapContext.tsx`

| Export | Type | Notes |
| --- | --- | --- |
| `MapProvider` | Component | Holds the map instance and a single marker. |
| `useMapContext()` | `() => MapContextValue` | Throws outside the provider. |

`MapContextValue`:

| Member | Signature | Behaviour |
| --- | --- | --- |
| `map` | `MapLibreMap \| null` | Set after MapLibre `load`. |
| `setMap` | `(map) => void` | Called by `MapView`. |
| `flyTo` | `(lon, lat, zoom?) => void` | 1100 ms flight; default zoom is `max(current, 9)`. |
| `fitToRadius` | `(lon, lat, radiusMiles) => void` | Fits a mile-radius bounds around the point. |
| `showMarker` | `(lon, lat, label) => void` | Replaces the previous marker; opens a popup. |
| `clearMarker` | `() => void` | |
| `getView` | `() => MapViewState \| null` | Current centre and zoom. |

### `map/MapView.tsx`

Exports `MapView`. Owns the single MapLibre instance and synchronises overlays.

Responsibilities:

- Creates the map with the saved default view, zoom 1–16, no rotation/pitch,
  `preserveDrawingBuffer`, and `attributionControl: false`.
- Sets an explicit worker URL via `setWorkerUrl(...?url)` for Vite.
- Tracks `styleEpoch` to recreate sources after a base-style change.
- Implements the 12 s style fallback and one-time tile-error toast.
- Builds `RadarTileOptions` from settings and the basemap brightness.
- Selects the satellite frame with `satelliteFrameForTime`.
- Attaches the alert popup and hover cursor.
- Calls `useAlerts` and `useRadarPreload`.

### `map/layers.ts`

Layer IDs:

```text
openradar-radar / openradar-radar-layer
openradar-satellite / openradar-satellite-layer
openradar-alerts / openradar-alerts-fill / openradar-alerts-line
```

| Export | Signature | Notes |
| --- | --- | --- |
| `firstSymbolLayerId(map)` | `(MapLibreMap) => string \| undefined` | First `symbol` layer, used as insertion point. |
| `enforceOverlayOrder(map)` | `(MapLibreMap) => void` | Moves satellite → radar → alert fill → alert line below labels. |
| `syncRadarLayer(map, input)` | `(MapLibreMap, RadarLayerInput) => void` | Creates/updates/removes the raster source and layer. |
| `syncSatelliteLayer(map, input)` | `(MapLibreMap, SatelliteLayerInput) => void` | Same for satellite. |
| `setRadarOpacity(map, opacity)` | `(MapLibreMap, number) => void` | In-place paint update. |
| `setSatelliteOpacity(map, opacity)` | `(MapLibreMap, number) => void` | |
| `syncAlertsLayer(map, input)` | `(MapLibreMap, AlertsLayerInput) => void` | GeoJSON source + fill/line layers. |
| `currentView(map)` | `(MapLibreMap) => MapViewState` | Centre + zoom snapshot. |

Input shapes: `{ enabled, timestamp, tileUrlTemplate, opacity }` for rasters;
`{ enabled, data }` for alerts.

Paint details:

- Radar/satellite: `raster-fade-duration: 0`, `raster-resampling: "linear"`.
- Radar source `maxzoom: 12`; satellite `maxzoom: 6`.
- Alerts fill: `fill-opacity: 0.17`, severity match expression.
- Alerts line: zoom-interpolated width 0.7 → 1.6, opacity 0.9.

### `map/alertPopup.ts`

```ts
createAlertPopupContent(feature: MapGeoJSONFeature): HTMLElement
```

Builds DOM nodes with `textContent` (never `innerHTML`) from alert properties:
`severity`, `title`, `regions`, `description`, `uri`, `time`, `expires`.
Links are restricted to `http(s)` and opened through `openExternal`.

---

## 8. Components

| Component | Inputs | Responsibility |
| --- | --- | --- |
| `TopBar` | — | Logo, status pill, search, Layers/Settings, theme toggle, export. |
| `SearchBox` | — | Debounced Nominatim search, recent places, focus event listener. |
| `MapControls` | — | Zoom, geolocation, fullscreen. |
| `Timeline` | `{ timeline: TimelineModel }` | Transport, readout, track, speed/loop/refresh. |
| `SidePanel` | — | Scrim, header, tabs, hosts `LayerPanel`/`SettingsPanel`. |
| `LayerPanel` | — | Radar, satellite, alerts, LibreWXR extras, basemap picker. |
| `SettingsPanel` | — | Appearance, source, animation, default location, reset/About. |
| `AttributionBar` | — | Compact credit line and expandable data panel. |
| `StatusBanner` | — | Non-blocking stale-refresh notice. |
| `ErrorState` | — | Full failure card when no catalog exists. |
| `ErrorBoundary` | `{ children }` | Last-resort render boundary with reload. |
| `SplashScreen` | `{ overlay?, message? }` | Hydration and first-load surface. |
| `AboutDialog` | — | Sources, licences, shortcuts, version. |
| `ToastViewport` | — | Renders up to three toasts and auto-dismisses. |
| `Logo` / `LogoMark` | `{ className? }` | Brand marks. |
| `ui.tsx` | — | `ExternalLink`, `Toggle`, `SegmentedControl`, `SelectField`, `Spinner`, `Chip`. |

`ui.tsx` exports the shared control primitives; prefer them over new one-off
markup so focus, disabled, and ARIA behaviour stay consistent.

---

## 9. Utilities

| Module | Exports | Notes |
| --- | --- | --- |
| `utils/attribution.ts` | `attributionText(source, baseMapId, alertsEnabled)` | Compact export/About string. |
| `utils/cx.ts` | `cx(...classes)` | Joins truthy class names. |
| `utils/errors.ts` | `HttpError`, `isAbortError`, `isTimeoutError`, `getErrorMessage` | Maps HTTP 503/404/429/5xx and network failures to readable copy. |
| `utils/fetch.ts` | `fetchJson<T>`, `fetchArrayBuffer` | Timeouts, abort forwarding, `HttpError`, `credentials: "omit"`. |
| `utils/geo.ts` | `clampLatitude`, `lonToTileX`, `latToTileY`, `visibleTiles`, `nearestFrame`, `satelliteFrameForTime`, `WORLD_TILES` | Web-Mercator maths and frame matching. |
| `utils/openExternal.ts` | `openExternal(url)` | Tauri opener with `window.open` fallback; HTTP(S) only. |
| `utils/time.ts` | `formatClock`, `formatFullTime`, `formatDate`, `formatFrameOffset`, `formatAge`, `formatCoordinates`, `parseTimestampToMs` | Local-time formatting and relative ages. |

`visibleTiles(bounds, zoom, limit)` rounds zoom, wraps X across the
antimeridian, and returns centre-first unique tiles. It is a preload heuristic,
not a renderer.

---

## 10. Rust shell (`src-tauri/src`)

### `main.rs`

Calls `openradar_lib::run()`.

### `lib.rs`

Constants:

| Constant | Value |
| --- | --- |
| `SETTINGS_FILE` | `settings.json` |
| `MAX_SETTINGS_BYTES` | 2 MiB |
| `MAX_EXPORT_BYTES` | 64 MiB (base64 payload) |

| Command | Signature | Behaviour |
| --- | --- | --- |
| `load_settings` | `(app) => Result<Option<String>, String>` | Reads the settings file; `None` when missing. |
| `save_settings` | `(app, contents: String) => Result<(), String>` | Size check, JSON validation, atomic write, `0600` on Unix. |
| `save_export` | `(app, data_url: String, file_name: String) => Result<String, String>` | Validates PNG data URL and signature, writes under `Pictures/OpenRadar` (or Downloads/home/temp fallback), returns the absolute path. |

Internal functions:

- `settings_path` — `app_config_dir()/settings.json`.
- `write_atomic` — writes `settings.json.tmp`, restricts permissions, renames;
  removes the destination first on Windows.
- `sanitized_file_name` — strips path separators, allows only
  alphanumerics/`-`/`_`/`.`, caps at 96 chars, forces `.png`.
- `export_directory` — `picture_dir` → `download_dir` → `home_dir` →
  `temp_dir`, then `/OpenRadar`.
- `build_tray` — menu items `show`, `refresh`, `quit`; left-click shows the
  window; refresh emits `openradar:refresh`.
- `reveal_main_window` — show, unminimize, focus.

Setup registers `tauri_plugin_opener` and the three commands. The tray is
created in `setup`; closing the last window exits because no close handler is
installed.

### Events

| Event | Emitted by | Consumed by |
| --- | --- | --- |
| `openradar:refresh` | Tray menu | `useTauriEvents` → `radarStore.requestRefresh()` |

---

## 11. Adding code: quick checklist

1. **New setting** — add to `AppSettings`, `DEFAULT_SETTINGS`, `partialize`,
   `sanitizePersisted`, then the UI and docs.
2. **New source** — preset + `resolveDataSource` + `DataSourceId`; normalise in
   `services/metadata.ts` if the contract differs.
3. **New overlay** — setting + control, then either a tile query parameter
   (`services/tiles.ts`) or a GeoJSON source/layer pair (`map/layers.ts`).
4. **New native capability** — add a `#[tauri::command]`, register it in
   `generate_handler!`, and call it through a service with a browser fallback.
5. **New network call** — accept `AbortSignal`, set a timeout, and map failures
   through `getErrorMessage`.
