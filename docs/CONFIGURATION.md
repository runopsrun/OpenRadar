# Configuration reference

OpenRadar is configured through the in-app Settings and Layers panels. There is
no required environment file and no API key. This document lists every persisted
setting, its default, its valid range, where it is stored, and the operational
constants that control caching and refresh behaviour.

---

## 1. Where configuration lives

### 1.1 Settings file (desktop)

| Platform | Directory | File |
| --- | --- | --- |
| Linux | `~/.config/com.mumma.openradar/` | `settings.json` |
| Windows | `%APPDATA%\com.mumma.openradar\` | `settings.json` |
| macOS | `~/Library/Application Support/com.mumma.openradar/` | `settings.json` |

The bundle identifier is `com.mumma.openradar`. If you change `identifier` in
`src-tauri/tauri.conf.json`, the path changes accordingly.

Writes are:

- **debounced** in the frontend by ~250 ms;
- validated as JSON in Rust;
- size-limited to 2 MB;
- written atomically via `settings.json.tmp` and a rename;
- restricted to `0600` on Unix.

Reads fail over to `localStorage` if the native read fails; writes do the same
if the native write fails.

### 1.2 Browser settings

The browser build uses `localStorage` under the key:

```text
openradar-settings
```

### 1.3 Persisted shape

Zustand `persist` wraps the state:

```json
{
  "state": {
    "theme": "system",
    "baseMapId": "dark",
    "dataSourceId": "librewxr",
    "customHost": "http://localhost:8080",
    "radarEnabled": true,
    "satelliteEnabled": false,
    "alertsEnabled": false,
    "radarOpacity": 0.85,
    "satelliteOpacity": 0.6,
    "colorScheme": 2,
    "smooth": true,
    "snow": false,
    "lightning": "off",
    "stormCells": false,
    "motionArrows": false,
    "animationSpeedMs": 650,
    "loop": true,
    "includeNowcast": true,
    "autoRefreshMinutes": 3,
    "defaultView": {
      "longitude": -98.5795,
      "latitude": 39.8283,
      "zoom": 4.2
    },
    "recentPlaces": []
  },
  "version": 1
}
```

Hand-editing is supported but not recommended. Invalid values are sanitised or
discarded on load; the rest of the file is kept.

### 1.4 Other local data

| Data | Location |
| --- | --- |
| PNG exports | `Pictures/OpenRadar/openradar-<timestamp>.png` (or Downloads/home fallback) |
| Radar/satellite tile bytes | In-memory only; 64 MB LRU, not on disk |
| Alert GeoJSON | In-memory only |
| Search cache | In-memory only; 60 queries |
| Recent places | In settings, maximum five |

No analytics, telemetry, accounts, or cloud sync exist.

---

## 2. Complete settings reference

### 2.1 Appearance

| Key | Type | Default | Valid values / range | UI |
| --- | --- | --- | --- | --- |
| `theme` | string | `"system"` | `system`, `light`, `dark` | Settings → Appearance; `T` |
| `baseMapId` | string | `"dark"` | `dark`, `light`, `streets`, `satellite` | Layers → Base map |

The UI theme and base map are independent. Changing the theme does not change
`baseMapId`.

### 2.2 Data source

| Key | Type | Default | Valid values | UI |
| --- | --- | --- | --- | --- |
| `dataSourceId` | string | `"librewxr"` | `librewxr`, `rainviewer`, `custom` | Settings → Data source |
| `customHost` | string | `"http://localhost:8080"` | Normalised HTTP(S) origin | Settings → custom URL |

`customHost` is only used when `dataSourceId` is `custom`.

URL normalisation rules:

- `example.com` → `https://example.com`
- `localhost:8080` / `127.0.0.1:8080` / `10.x` / `192.168.x` / `172.16–31.x` →
  `http://…`
- existing `http://` or `https://` is preserved;
- query strings, fragments, and trailing slashes are removed;
- anything that is not HTTP(S) is rejected;
- an empty custom URL is rejected by the setup flow and produces a clear
  metadata error if reached.

### 2.3 Radar and overlays

| Key | Type | Default | Range / values | UI |
| --- | --- | --- | --- | --- |
| `radarEnabled` | boolean | `true` | — | Layers → Radar |
| `satelliteEnabled` | boolean | `false` | — | Layers → Satellite |
| `alertsEnabled` | boolean | `false` | — | Layers → Weather alerts |
| `radarOpacity` | number | `0.85` | 0.15–1.0 (persisted clamp 0.1–1.0) | Radar opacity |
| `satelliteOpacity` | number | `0.6` | 0.15–1.0 (persisted clamp 0.1–1.0) | Satellite opacity |
| `colorScheme` | number | `2` | 0–255; must exist in metadata or nearest fallback | Radar colour scheme |
| `smooth` | boolean | `true` | — | Smoothing |
| `snow` | boolean | `false` | — | Snow mask |
| `lightning` | string | `"off"` | `off`, `dots`, `bolts` | Lightning glyphs |
| `stormCells` | boolean | `false` | — | Storm cells |
| `motionArrows` | boolean | `false` | — | Storm motion arrows |

Notes:

- If the selected palette is not advertised by a newly selected server,
  OpenRadar switches to that server’s first palette.
- Switching to RainViewer clears lightning/storm-cells/motion-arrows and turns
  off alerts.
- If a source has no satellite frames, satellite is turned off after metadata
  load.
- LibreWXR adds raw grayscale as palette `255`; RainViewer does not.

### 2.4 Animation

| Key | Type | Default | Range / values | UI |
| --- | --- | --- | --- | --- |
| `animationSpeedMs` | number | `650` | 200–1500 in the UI, step 50; persisted clamp 100–3000 | Timeline speed / Settings |
| `loop` | boolean | `true` | — | Timeline loop / Settings / `L` |
| `includeNowcast` | boolean | `true` | — | Settings → Include nowcast |
| `autoRefreshMinutes` | number | `3` | `0`, `1`, `3`, `5`, `10` in the UI; persisted clamp 0–60 | Settings → Auto-refresh |

The timeline speed selector offers:

| Label | Value |
| --- | --- |
| Slow | 1100 ms |
| Normal | 650 ms |
| Fast | 350 ms |
| Very fast | 200 ms |

If a persisted value is not one of those four, the UI appends a custom option so
the setting is not lost.

`autoRefreshMinutes: 0` disables polling. Manual refresh remains available from
the status pill, timeline, Settings, `R`, and the tray.

### 2.5 Default view

| Key | Type | Default | Range |
| --- | --- | --- | --- |
| `defaultView.longitude` | number | `-98.5795` | −180…180 |
| `defaultView.latitude` | number | `39.8283` | −85…85 |
| `defaultView.zoom` | number | `4.2` | 1…16 |

Use **Settings → Default location → Use current view** to save the map’s current
centre and zoom. The default view is not overwritten by normal panning.

### 2.6 Recent places

| Key | Type | Default | Limit |
| --- | --- | --- | --- |
| `recentPlaces` | array | `[]` | 5 entries |

Each entry:

```json
{
  "id": "nominatim-place-id",
  "name": "Chicago",
  "latitude": 41.85,
  "longitude": -87.65
}
```

Entries are validated on load; malformed items are dropped. Selecting a recent
place flies to zoom 10.

---

## 3. Source presets

| ID | Label | Base URL | Extensions | Alerts | Satellite |
| --- | --- | --- | --- | --- | --- |
| `librewxr` | LibreWXR (public) | `https://api.librewxr.net` | Yes | Yes | If advertised |
| `rainviewer` | RainViewer | `https://api.rainviewer.com` | No | No | No |
| `custom` | Self-hosted / custom | user value | Yes | Yes | If advertised |

Capability flags live in `src/config/dataSources.ts`. The metadata payload’s
`host` is used for tiles and may differ from the API origin.

---

## 4. Base map definitions

Defined in `src/config/basemaps.ts`.

| ID | Name | Style | Dark labels | Attribution |
| --- | --- | --- | --- | --- |
| `dark` | Dark | `https://tiles.openfreemap.org/styles/dark` | yes | OpenFreeMap © OpenMapTiles · OSM |
| `light` | Light | `https://tiles.openfreemap.org/styles/positron` | no | OpenFreeMap © OpenMapTiles · OSM |
| `streets` | Streets | `https://tiles.openfreemap.org/styles/liberty` | no | OpenFreeMap © OpenMapTiles · OSM |
| `satellite` | Satellite | Inline Esri World Imagery raster style | yes | Esri / Maxar / Earthstar — not open data |

The `dark` flag controls whether LibreWXR motion-arrow and storm-cell glyphs are
requested in light or dark variants.

Fallback style: standard OpenStreetMap raster tiles
(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) after a 12 s style-load
timeout. This is degraded mode only.

---

## 5. Operational constants

These are compile-time constants in `src/config/constants.ts` and related
modules. Change them in source and rebuild.

| Constant | Value | Meaning |
| --- | --- | --- |
| `MAX_RADAR_SOURCE_ZOOM` | 12 | Radar source max zoom |
| `MAX_SATELLITE_SOURCE_ZOOM` | 6 | Satellite source max zoom |
| `TILE_SIZE` | 256 | Requested tile size |
| `PRELOAD_RADIUS` | 2 | Frames warmed on either side |
| `PRELOAD_TILES_PER_FRAME` | 32 | Visible tiles warmed per frame, centre-first |
| `TILE_CACHE_MAX_BYTES` | 64 MiB | In-memory PNG LRU cap |
| `METADATA_TIMEOUT_MS` | 20 s | Catalog request timeout |
| `TILE_TIMEOUT_MS` | 25 s | Tile request timeout |
| `ALERT_REFRESH_MS` | 5 min | Alert polling interval |
| `NOMINATIM_DEBOUNCE_MS` | 550 ms | Search debounce |
| Preload concurrency | 6 | Parallel cache warm requests |
| Preload queue cap | 400 | Maximum queued URLs |
| Alert move debounce | 700 ms | Alert refetch after map movement |
| Alerts request timeout | 30 s | Alert endpoint timeout |
| Search request timeout | 10 s | Nominatim timeout |
| Search result limit | 6 | Results per query |
| Search cache | 60 queries | In-memory |
| Toast visible limit | 3 | Concurrent toasts |
| Toast duration | 5.5 s info / 9 s error | Auto-dismiss |
| Style fallback delay | 12 s | OSM raster fallback |
| Settings write debounce | 250 ms | Native/localStorage write delay |

---

## 6. Map and window configuration

### Map

- Initial centre/zoom: `defaultView`.
- Zoom range: 1–16.
- Max pitch: 0; drag/touch rotation disabled.
- Attribution control disabled in favour of the custom bar.
- Canvas: antialias, `preserveDrawingBuffer` (needed for PNG export),
  high-performance power preference.
- Raster fade: 0 for weather layers, to avoid frame ghosting.

### Native window

From `src-tauri/tauri.conf.json`:

| Property | Value |
| --- | --- |
| Label | `main` |
| Title | `OpenRadar` |
| Size | 1280×820 |
| Minimum size | 760×560 |
| Resizable | yes |
| Fullscreen | no (in-app control available) |
| Background | `#05080f` |
| Drag/drop | disabled |

### Dev server

- Port 1420, strict.
- `TAURI_DEV_HOST` exposes the server for remote/mobile development and uses
  HMR port 1421.
- `src-tauri` is excluded from Vite’s watcher.

---

## 7. Environment variables

OpenRadar does not require a `.env` file. The following variables are optional:

| Variable | Used by | Effect |
| --- | --- | --- |
| `TAURI_DEV_HOST` | Vite | Bind the dev server to a host and enable HMR on port 1421. |
| `TAURI_ENV_DEBUG` | Vite | Enable sourcemaps and disable minification. |
| `WEBKIT_DISABLE_DMABUF_RENDERER` | WebKitGTK | Workaround for blank maps on some Linux GPU/driver combinations. Set to `1`. |

Do not put secrets in `VITE_*` variables; anything with that prefix is exposed
to the webview.

---

## 8. Theme and CSS tokens

Design tokens live in `src/styles/tokens.css`. Light/dark values are selected by
`html[data-theme="light"]` / `html[data-theme="dark"]`. The theme hook also
updates `color-scheme` and the `<meta name="theme-color">` value.

CSS uses `color-mix()` and modern layout features. Current WebKitGTK and
WebView2 versions support them; very old webviews may render incorrect colours.

---

## 9. Caching and refresh behaviour

- **Catalog:** fetched on launch, on source change, on manual refresh, and every
  `autoRefreshMinutes`. Timeout 20 s.
- **Tiles:** custom `openradar://` protocol, 64 MiB LRU, keyed by upstream URL
  including frame path, palette, smoothing/snow, and extension parameters.
- **Preload:** current frame, two ahead, two behind; 32 centre-biased visible
  tiles per frame; six concurrent requests.
- **Alerts:** viewport request, refresh on move (700 ms) and every 5 min.
- **Search:** 550 ms debounce, 60-query cache.
- **Settings:** 250 ms debounced write.

Clearing the tile cache happens automatically when the tile host changes. There
is no user-facing “clear cache” button because the cache is memory-only and
bounded.

---

## 10. Resetting and migrating settings

- **Reset all settings** restores `DEFAULT_SETTINGS` and persists them.
- On load, `sanitizePersisted` validates enums, clamps numbers, drops invalid
  coordinates, limits recent places to five, and keeps unknown fields out.
- Persist version is `1`. Add a Zustand `migrate` function before bumping the
  version if a future change is not backward-compatible.
- Deleting `settings.json` (or the `openradar-settings` localStorage key) is a
  manual factory reset.

If settings appear not to persist in the desktop app, see
[troubleshooting](TROUBLESHOOTING.md#settings-do-not-persist).
