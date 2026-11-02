# Changelog

All notable changes to OpenRadar are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

---

## [Unreleased]

Nothing yet. See [Roadmap](ROADMAP.md) for planned work.

---

## [0.1.0] - 2026-11-01

First public release.

### Added

- Full-window MapLibre GL map with north-up, rotation-disabled navigation and a
  1–16 zoom range.
- Animated radar playback over a rolling catalog of observed and nowcast frames.
- Timeline with play/pause, frame stepping, scrubbing, speed presets, loop
  toggle, nowcast filter, and immediate refresh.
- Custom `openradar://` tile protocol with a 64 MB in-memory LRU cache and
  centre-biased preloading of nearby frames.
- LibreWXR as the default source, with radar, nowcast, satellite, alerts,
  lightning, storm cells, and motion arrows.
- RainViewer as a radar-only compatibility fallback.
- Self-hosted / custom LibreWXR source with URL normalisation, connection
  validation, and capability detection.
- Satellite overlay automatically matched to the active radar timestamp.
- WMO CAP alert polygons with severity colours, viewport-aware refresh, and a
  safe DOM popup with an optional official link.
- Server-rendered LibreWXR extras: lightning (dots or bolts), storm cells, and
  storm motion arrows, with basemap-aware glyph colours.
- Four base maps: OpenFreeMap Dark, Positron, Liberty, and Esri World Imagery.
- Automatic OpenStreetMap raster fallback if a vector style fails to load.
- Place search through Nominatim with debouncing, caching, recent places, and a
  single replaceable marker.
- One-shot high-accuracy geolocation with accuracy-aware marker and specific
  error messages.
- Light, dark, and system themes with live OS preference handling.
- Responsive top bar, panels, timeline, and dialogs down to the 760×560 minimum
  window size.
- PNG export with a baked-in attribution footer; native save under
  `Pictures/OpenRadar/` and browser download.
- Native settings persistence with atomic writes, `0600` permissions on Unix,
  JSON validation, and a 2 MiB cap.
- Browser persistence through `localStorage` when running outside Tauri.
- System tray with Show, Refresh radar data, and Quit.
- Global keyboard shortcuts for playback, stepping, refresh, loop, theme,
  search, About, and closing panels.
- Attribution bar, expandable data panel, About dialog, and export credits.
- Graceful failure states: full error card on first-load failure, stale-data
  banner on later failures, one-time tile warning, and a render error boundary.
- Comprehensive documentation: getting started, user guide, configuration,
  architecture, code reference, data sources, self-hosting, development,
  building, testing, security/privacy, troubleshooting, FAQ, contributing,
  roadmap, and this changelog.

### Changed

- Radar tiles are built from the catalog's `frame.path` rather than a
  reconstructed timestamp, so LibreWXR and RainViewer both work without a
  source-specific URL branch.
- Weather raster layers use `raster-fade-duration: 0` to avoid frame ghosting.
- Opacity changes update paint properties in place instead of rebuilding layers.
- The map worker is emitted as an explicit Vite asset and wired with
  `setWorkerUrl`, avoiding a pre-bundling breakage.
- The Settings version label reads from `APP_VERSION` instead of a duplicated
  string.

### Fixed

- RainViewer frames using opaque keys (for example
  `/v2/radar/f91b44fddba5`) now load correctly instead of producing invalid
  timestamp URLs.
- Satellite tile URLs no longer produce HTTP 422 errors; the fixed
  `/0/0_0.png` suffix is used.
- Switching base maps no longer leaves radar, satellite, or alert layers
  detached; a style epoch recreates them on the new style.
- Palette selection repairs to an advertised scheme when the saved palette is
  missing on a newly selected server.
- Capability toggles clear automatically when switching to a source that does
  not support them.
- Selection repairs when the active frame disappears after a refresh or a
  nowcast filter change.
- Native settings writes fall back to localStorage instead of interrupting the
  user.

### Security

- Production CSP restricts scripts to bundled code, blocks objects and frames,
  and allows only the network and asset types the map needs.
- Data-source URLs are restricted to HTTP(S) and normalised before use.
- Radar frame paths are validated against a strict pattern before entering a
  tile URL.
- Alert popups are constructed with `textContent`; no upstream HTML is injected.
- Export filenames are sanitised in Rust; PNG payloads are validated by prefix,
  base64 decoding, and magic bytes.
- Settings writes are size-limited, JSON-validated, atomic, and permission
  restricted on Unix.
- Tauri capabilities are limited to core defaults and the opener plugin.

### Known limitations

- Linux is the tested platform; Windows is supported by the stack but not
  validated for this release; macOS is untested.
- No automated test suite is committed; verification is typecheck, build, Rust
  checks, and a manual matrix.
- No WebSocket live updates; the client polls the catalog.
- No offline maps or historical archive.
- Radar source resolution ends at zoom 12; satellite at zoom 6.
- RainViewer mode has no satellite, alerts, or tile extensions.
- The public LibreWXR instance has no SLA.
- Esri World Imagery is not open data.
- The UI is English-only.
- Not for life-safety decisions.

---
