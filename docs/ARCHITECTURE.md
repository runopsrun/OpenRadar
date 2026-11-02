# OpenRadar architecture

This document explains how the app is assembled, how radar frames are modelled,
how tiles are loaded and cached, and where to add features. It is the companion
to [`DATA_SOURCES.md`](DATA_SOURCES.md), [`CODE_REFERENCE.md`](CODE_REFERENCE.md),
and [`DEVELOPMENT.md`](DEVELOPMENT.md).

---

## 1. Design goals

- **Map-first and fast.** The map is the primary surface. Chrome stays out of the
  way, and playback must not flicker or reset.
- **One data contract.** All upstream JSON is normalised at the service boundary
  so UI code never depends on RainViewer/LibreWXR response quirks.
- **Cheap to extend.** Data source, basemap, palette, overlays, and live-update
  transport are separate, narrow extension points.
- **Desktop-native where it matters.** A small Rust layer owns the window, tray,
  settings file, and PNG writes; the UI is ordinary web code.
- **Degrade visibly but gracefully.** Stale data is preferable to a blank map; a
  failed style should not brick the app.

No server-side component is required. The webview talks directly to public HTTP
APIs, subject to CORS.

---

## 2. Runtime topology

```text
┌────────────────────────────────────────────────────────────────────┐
│ Tauri process                                                      │
│                                                                    │
│  ┌──────────────────────────┐        ┌───────────────────────────┐ │
│  │ Rust shell               │  IPC   │ Webview                   │ │
│  │                          │◄──────►│                           │ │
│  │ • window + tray          │        │ React app                 │ │
│  │ • load/save settings     │        │   ├─ Zustand stores       │ │
│  │ • save PNG export        │        │   ├─ hooks                │ │
│  │ • emit refresh event     │        │   └─ MapLibre GL          │ │
│  └──────────────────────────┘        └─────────────┬─────────────┘ │
│                                                    │ HTTP/CORS     │
└────────────────────────────────────────────────────┼───────────────┘
                                                     ▼
              LibreWXR / RainViewer / OpenFreeMap / Esri / Nominatim
```

In the browser development build (`npm run dev`), the Rust box is absent. The
same React app runs with `localStorage` persistence and browser downloads.

---

## 3. Startup sequence

1. `main.tsx` mounts `<App />`.
2. `useTheme()` applies the saved theme as early as possible.
3. `useSettingsHydrated()` gates rendering until Zustand has read the native
   settings file (or localStorage). While waiting, a splash screen is shown.
4. `<MapProvider>` creates the map-instance context.
5. `AppShell` starts the shared data/playback hooks:
   - `useRadarMetadata()` — catalog fetch + polling.
   - `useTauriEvents()` — tray refresh event.
   - `useTimeline()` — derived visible frame list and selection.
   - `useAnimation(frames)` — playback timer.
   - `useKeyboardShortcuts(timeline)` — global shortcuts.
6. `<MapView>` creates the MapLibre instance. The first successful `load` publishes
   the instance through context; every `style.load` increments `styleEpoch`,
   which causes the overlay effects to reattach.
7. `<TopBar>`, `<Timeline>`, `<SidePanel>`, and the toast/dialog layers render
   from the stores.

The ordering matters: the shell and the map both consume the same timeline
model, so the UI never has a second source of truth for “current frame”.

---

## 4. Data flow

```text
settings (dataSourceId, customHost)
        │
        ▼
useResolvedDataSource ──► ResolvedDataSource { baseUrl, capabilities }
        │
        ▼
useRadarMetadata ──► fetchRadarMetadata()
        │               • GET /public/weather-maps.json
        │               • normalise frames + colour schemes
        │               • configureTileHost(metadata.host)
        ▼
radarStore { metadata, status, frameTime, playing, error }
        │
        ├──► useTimeline ──► Timeline UI / useAnimation / MapView
        │
        └──► MapView ──► radarProtocolUrlTemplate()
                         │
                         ▼
                 MapLibre raster source
                         │ openradar://…
                         ▼
                 custom protocol handler
                         │ resolve to HTTP
                         ▼
                 fetch + 64 MB LRU cache
```

Alerts have an independent flow (`useAlerts` → `alertsStore` → GeoJSON layer)
because they refresh on viewport movement rather than on the radar timer.

---

## 5. Frame model

### 5.1 Catalog normalisation

`src/services/metadata.ts` is the only place that understands the upstream
payload. It:

- validates each `time` (finite, positive Unix seconds);
- drops duplicates by timestamp;
- derives a fallback path (`/v2/radar/<time>` or `/v2/satellite/<time>`) when
  the server omits `path`;
- tags frames `past`, `nowcast`, or `satellite`;
- merges past + nowcast, sorts ascending, and removes cross-list duplicates;
- normalises colour schemes and appends raw grayscale (`id: 255`) for LibreWXR;
- trusts the payload's `host` for tile URLs (it may differ from the API host);
- records `sourceKey` so a source switch can reset state;
- rejects an empty radar catalog instead of rendering a broken UI.

The resulting `RadarMetadata` is the only shape consumed by React.

### 5.2 Identity and selection

The selected frame is `frameTime` — a Unix timestamp, not an array index.

Invariants:

- If there is no previous selection, or the source changed, select the latest
  **observed** frame (`latestPastFrame`).
- On a catalog refresh, keep `frameTime` if it still exists.
- If it disappeared, select the nearest remaining frame.
- The timeline effect performs a final repair after filtering (e.g. when the
  user turns off nowcast while a forecast frame is selected).

This makes refreshes non-destructive: new frames can appear at either end
without moving the playhead.

### 5.3 Visible timeline

`useTimeline()` filters the merged list:

```ts
frame.kind === "past" || (includeNowcast && frame.kind === "nowcast")
```

`latestPast` remains the anchor for relative labels. Frames after it are drawn
as forecast frames and the `NOW` marker is placed at the boundary. `setFrame`
clamps the index and pauses playback, so scrubbing never fights the animation
timer.

### 5.4 Playback

`useAnimation` runs a single `setTimeout` chain while `playing` is true:

- read the current `frameTime` from the store at each tick (not from a stale
  closure);
- advance one frame;
- wrap to frame 0 when `loop` is on, otherwise stop at the end;
- restart from the first frame if the user presses play while on the last frame.

Speed (200–1500 ms/frame) and loop are persisted settings.

### 5.5 Satellite sync

Satellite frames are hourly and much sparser than radar frames.
`satelliteFrameForTime` chooses the latest satellite frame at or before the
active radar timestamp, falling back to the nearest frame when the radar history
starts before the satellite history. That keeps the clouds plausibly aligned
with the precipitation when scrubbing.

---

## 6. Tile pipeline

### 6.1 URLs

Radar (upstream):

```text
{host}/v2/radar/{timestamp}/256/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
```

Satellite (upstream):

```text
{host}/v2/satellite/{timestamp}/256/{z}/{x}/{y}/0/0_0.png
```

The radar path is taken from `frame.path`, not reconstructed from the timestamp.
LibreWXR paths look like `/v2/radar/1700000000`; RainViewer paths use opaque
frame keys such as `/v2/radar/f91b44fddba5`. The path is carried through the
custom protocol as a validated query parameter and stripped before the upstream
request.

LibreWXR tile extensions are query parameters:

```text
?arrows=light|dark&cells=light|dark&lightning=dots|bolts
```

The protocol URL embeds every styling option:

```text
openradar://radar/{timestamp}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png?…
openradar://satellite/{timestamp}/{z}/{x}/{y}
```

This is deliberate: a palette or extension change produces a different cache
key and a different raster template, so no manual invalidation is needed.

### 6.2 Custom protocol and cache

`src/services/tiles.ts` registers the `openradar` protocol once. The handler:

1. Parses the protocol URL into a concrete upstream URL.
2. Looks up the upstream URL in an in-memory LRU map.
3. On a miss, fetches the PNG bytes with a 25 s timeout and stores them.
4. Returns a **copy** of the `ArrayBuffer`, because MapLibre may transfer the
   buffer to its worker and detach it.

Cache properties:

- 64 MB byte cap, evicted oldest-first;
- keyed by full upstream URL (timestamp, zoom, palette, flags);
- cleared when the data source or tile host changes;
- shared by MapLibre requests and the preloader.

A generation counter prevents an in-flight preload from a previous source from
polluting the new cache.

### 6.3 Preloading

`useRadarPreload` warms visible tiles for the active frame and nearby frames:

- `PRELOAD_RADIUS = 2` → current, +1, +2, −1, −2 (priority order);
- `PRELOAD_TILES_PER_FRAME = 32` tiles, nearest the viewport centre;
- queue cap 400 URLs, concurrency 6;
- skips when the document is hidden or the browser reports offline;
- re-runs 350 ms after `moveend`;
- also warms the current satellite frame when the overlay is enabled.

MapLibre requests the same URLs, so warming turns network latency into a cache
hit at the next animation tick. Missing tiles outside radar coverage are ignored
by the preloader rather than logged as errors.

### 6.4 Zoom behaviour

Radar sources declare `maxzoom: 12`; satellite declares `maxzoom: 6`. MapLibre
overzooms the last available level beyond that, which is expected for these
products.

---

## 7. Map lifecycle and overlays

`src/map/MapView.tsx` owns one MapLibre instance for the app lifetime.

### 7.1 Style switching

Switching basemaps calls `map.setStyle(...)`, which destroys all sources and
layers. The component handles this with `styleEpoch`:

- `style.load` increments `styleEpoch`;
- overlay effects depend on `map`, `styleEpoch`, and the relevant store values;
- radar, satellite, and alerts are recreated on the new style;
- `enforceOverlayOrder` moves them beneath the first symbol (label) layer so
  place labels remain readable.

A 12 s timer arms a one-time fallback to the OSM raster style if `style.load`
never fires. That fallback also shows a warning toast.

### 7.2 Layers

| Layer | Type | Source | Notes |
| --- | --- | --- | --- |
| Satellite | raster | `openradar://satellite/...` | below radar |
| Radar | raster | `openradar://radar/...` | `raster-fade-duration: 0` |
| Alerts fill | fill | GeoJSON | severity colour, 17 % opacity |
| Alerts outline | line | GeoJSON | zoom-scaled width |

`raster-fade-duration: 0` avoids cross-fade ghosting while frames change.
Opacity is updated in place without recreating the layer.

### 7.3 Alerts

`useAlerts` runs only while alerts are enabled and the source supports them.

- Fetches `/v2/alerts` with a `bbox` when zoom ≥ 3 and the view does not span the
  antimeridian; otherwise fetches the global feed with stronger simplification.
- Refreshes 700 ms after `moveend` and every 5 minutes.
- Aborts the previous request on movement.
- Keeps the previous polygons on screen during a refresh to avoid flashing.
- Clicking a fill/line opens a DOM popup built in `alertPopup.ts` with escaped
  text (no `innerHTML`).

### 7.4 Markers

`MapContext` owns a single search/location marker and popup, so a new search
replaces the old marker instead of accumulating them.

---

## 8. State model

| Store | Lifetime | Responsibility |
| --- | --- | --- |
| `settingsStore` | Persisted | Theme, basemap, source, overlays, palette, animation, default view, recent places. |
| `radarStore` | Session | Metadata, load status, error, current frame, playing, refresh nonce. |
| `alertsStore` | Session | Alert GeoJSON, loading/error status, timestamp. |
| `uiStore` | Session | Active side panel, About dialog, toast queue. |

`settingsStore` uses Zustand `persist` with a custom storage adapter:

- Tauri: `invoke("load_settings")` / `invoke("save_settings")`, debounced 250 ms.
- Browser: `localStorage` under `openradar-settings`.
- Persisted values pass through `sanitizePersisted`, which validates enums,
  clamps numbers, drops bad coordinates, and limits recent places to five.
- A failed native write logs a warning and falls back to localStorage; it never
  interrupts the interaction.

`radarStore` is intentionally ephemeral. Nothing about the network catalog is
persisted; rebuilding it on launch is cheap and avoids stale frame lists.

---

## 9. Native layer (`src-tauri`)

### Commands

| Command | Purpose |
| --- | --- |
| `load_settings` | Returns the raw JSON string, or `null` on first launch. |
| `save_settings` | Validates JSON and size (2 MB), writes atomically with `0600` on Unix. |
| `save_export` | Validates a PNG data URL, decodes base64, writes to `Pictures/OpenRadar`. |

`write_atomic` writes a `.json.tmp` file, restricts permissions, then renames.

### Tray

Built in `setup` with **Show OpenRadar**, **Refresh radar data**, **Quit**.
Refresh emits `openradar:refresh`, which `useTauriEvents` maps to
`radarStore.requestRefresh()`.

### Security configuration

- CSP allows only the app origin for scripts, HTTPS/HTTP for images and
  connections, `blob:`/`data:` where the map and export need them, and disables
  frames/objects.
- No remote code is loaded; map styles are data, not scripts.
- Data source URLs are normalised and restricted to HTTP(S).
- Exported filenames are sanitised in Rust before writing.
- Settings JSON is parsed before saving.

---

## 10. Error handling and resilience

| Failure | Behaviour |
| --- | --- |
| Catalog fetch fails on first load | Full error state with retry. |
| Catalog refresh fails with data visible | Status pill becomes **Stale**; existing frames stay. |
| Tile fetch fails | One warning toast per session; map shows missing tiles. |
| Vector style never loads | One-time OSM raster fallback after 12 s. |
| Source lacks extensions | Extension toggles are cleared automatically. |
| Source lacks alerts | Alerts toggle is cleared. |
| Source has no satellite frames | Satellite is turned off after metadata load. |
| Palette missing on new server | Falls back to the first advertised palette. |
| Invalid custom URL | Inline validation message; no request is made. |
| Native settings write fails | localStorage fallback. |
| Native PNG save fails | Error toast with the reason. |

All network helpers accept an `AbortSignal` and enforce timeouts. Components
never throw on network failure; errors are mapped to store state or toasts.

---

## 11. Extension points

### 11.1 Live updates over WebSocket (planned)

LibreWXR exposes `/v2/ws` with topics such as `weather-maps`, `alerts`,
`lightning`, and `storm-cells`; messages are `hello`, `snapshot`, `update`, and
`error`.

Recommended integration:

1. Add `src/services/liveUpdates.ts` with a reconnecting client (exponential
   backoff, jitter, clean close on unmount).
2. On `weather-maps` update, normalise the payload with the same helpers in
   `metadata.ts` and call `radarStore.applyMetadata()`.
3. On `alerts` update, write into `alertsStore` (the layer already reacts).
4. For `lightning`/`storm-cells`, add GeoJSON sources/layers in `map/layers.ts`
   rather than relying only on the server-rendered tile extras.
5. Keep polling as a fallback; suspend it while the socket is healthy.
6. Respect `LIBREWXR_CORS_ORIGINS` for the handshake origin.

The current architecture is ready for this: stores are updated through narrow
actions (`applyMetadata`, `succeed`), and MapView re-syncs from store changes.

### 11.2 New data source

1. Add a preset and capability flags in `src/config/dataSources.ts`.
2. Extend `resolveDataSource` (and `DataSourceId` in `types/settings.ts`).
3. If the upstream contract differs, add a normaliser in `services/metadata.ts`;
   keep `RadarMetadata` unchanged.
4. If the source is LibreWXR-compatible, no other code changes are required.

### 11.3 New base map

Add a `BaseMapDefinition` to `src/config/basemaps.ts` with a style URL or inline
`StyleSpecification`, attribution, and whether labels are dark. The Layers panel
and attribution pick it up from `BASE_MAP_LIST`.

### 11.4 New overlay

- Server-rendered tile extra: add a query parameter in `services/tiles.ts`, a
  setting, and a control in `LayerPanel.tsx`.
- Client-side GeoJSON overlay: add a source/layer pair in `map/layers.ts`, a
  fetch hook, and a toggle. Follow the alerts implementation for ordering,
  visibility, and popup handling.

### 11.5 PWA

The browser build is already standalone. Add `vite-plugin-pwa`, a manifest, and
a service worker that caches the shell and the last N radar frames. Keep the
Tauri build free of the service worker, or register it conditionally on
`!isTauri`.

### 11.6 Settings migration

Zustand persists `version: 1`. To migrate, add a `migrate` function and bump the
version; `sanitizePersisted` already tolerates unknown/missing fields.

---

## 12. Performance notes

- **Largest chunk is MapLibre** (~1.4 MB minified, ~390 kB gzip). It is needed
  for first paint, so the Vite chunk warning threshold is set to 1.5 MB rather
  than adding a waterfall; the worker is emitted as a separate asset and passed
  to `setWorkerUrl`.
- **Frame changes do not recreate the source.** `source.setTiles([...])` swaps
  the template; the cache makes the new frame immediate.
- **Cache copies cost memory bandwidth but avoid detached-buffer bugs.** At
  256 px tiles the cap keeps memory bounded.
- **Preloading is viewport-aware** and caps work at 32 tiles per frame.
- **Opacity changes avoid layer rebuilds** and are applied with
  `setPaintProperty`.
- **`preserveDrawingBuffer` is enabled** only because PNG export reads the
  canvas. It has a GPU-memory cost; if export becomes optional, consider a
  separate capture path.

---

## 13. Verification

Current checks used during development:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Functional smoke tests were run in Chromium via Playwright against the Vite dev
server, covering:

- catalog load and **Live** status;
- playback, pause, timeline scrubbing, and nowcast frames;
- radar, satellite, alert, arrow, cell, and lightning overlays;
- basemap switching (including Esri satellite);
- Nominatim search and marker placement;
- PNG export (multi-MB download);
- theme toggle and persistence across reload;
- narrow/mobile layout and panel scrolling;
- absence of HTTP 4xx on satellite tiles after the URL fix.

The Playwright script is intentionally not part of the repo; it requires a
separate browser dependency. Add a proper test runner before shipping a larger
test matrix.

---

## 14. Conventions

- Absolute imports use the `@/` alias for `src/`.
- Upstream payloads never escape `services/`; UI consumes normalised types.
- Store actions are narrow and named after intent (`applyMetadata`,
  `requestRefresh`), not setters.
- Effects that touch MapLibre guard with `if (!map || styleEpoch === 0) return`.
- New network calls accept an `AbortSignal`, set a timeout, and reject with
  `HttpError` where possible.
- Keep persisted settings additive and sanitised; never trust saved JSON.
