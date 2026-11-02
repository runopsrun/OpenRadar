# Roadmap

This is a direction document, not a schedule or a promise. Priorities can change
when upstream APIs, data terms, or contributor capacity change.

Current release: **v0.1.0**.

---

## 1. Shipped in v0.1.0

- Full-window MapLibre map with a custom radar tile protocol and 64 MB LRU cache.
- Past + nowcast radar animation, timeline scrubbing, speed, loop, and preload.
- LibreWXR and RainViewer sources, plus self-hosted/custom instances.
- Satellite overlay synchronized to radar time.
- WMO CAP alert polygons with safe popups.
- Server-rendered motion arrows, storm cells, and lightning glyphs.
- Four base maps, including an explicitly non-open Esri satellite option.
- Nominatim search, recent places, and one-shot geolocation.
- Light/dark/system themes and responsive panels.
- PNG export with baked-in attribution.
- Native settings file, tray menu, and keyboard shortcuts.
- Documentation covering users, operators, and contributors.

---

## 2. Near term

### 2.1 Automated tests

The highest-value engineering gap. Add:

- unit tests for URL normalisation, settings sanitising, frame normalisation,
  tile maths, and relative-time formatting;
- protocol tests for opaque RainViewer paths and traversal rejection;
- a small Playwright smoke suite for load, playback, overlays, export, and
  persistence;
- Rust tests for filename sanitisation and settings validation.

### 2.2 Live updates

LibreWXR exposes `/v2/ws` with topics for the catalog, alerts, storm cells, and
lightning. A reconnecting client would reduce polling and make alerts more
timely. Requirements:

- exponential backoff with jitter;
- polling fallback while disconnected;
- clean teardown on source change;
- origin/CORS compatibility;
- no duplicate store updates during a reconnect snapshot.

### 2.3 PWA / installable web build

The browser build is already standalone. Add a manifest, icons, and a service
worker that caches the shell and the last few radar frames, registered only
outside Tauri. Keep the desktop build free of service-worker caching.

### 2.4 Accessibility audit

- Verify focus order and focus visibility across panels.
- Confirm dialog focus trapping and restoration.
- Test with screen readers on Linux and Windows.
- Improve live-region announcements for status changes and playback.
- Ensure all icon-only controls have durable accessible names.
- Check contrast in both themes and over map imagery.

### 2.5 Performance profiling

- Measure first interactive time on a mid-range laptop.
- Profile frame switches with a warm and cold cache.
- Evaluate the GPU cost of `preserveDrawingBuffer`.
- Consider a shared worker or offscreen canvas if the map workload grows.
- Track memory over a long playback session.

### 2.6 Documentation and onboarding

- Add screenshots or short recordings to the user guide.
- Add a troubleshooting decision tree for “catalog vs tiles”.
- Expand self-hosting examples for Caddy, nginx, and a home LAN.
- Keep the dependency/MSRV notes current.

---

## 3. Later

### 3.1 Alert improvements

- Filter by severity or event type.
- Sort or list alerts for the current view.
- Highlight the selected alert polygon.
- Show alert age and issuance source more prominently.
- Add an optional “alerts only” view.

These depend on stable upstream properties and must not imply official warnings.

### 3.2 Timeline and playback

- Drag-to-scrub with a visible hover preview.
- Optional frame-by-frame keyboard nudging with modifiers.
- Remember the last selected frame per session.
- Show a clearer observed vs forecast boundary at a glance.
- Optional “play once” mode distinct from loop.

### 3.3 Map tools

- Distance/measure tool.
- Coordinate readout and copy.
- Optional graticule.
- Custom marker labels or saved pins.
- Shareable view links for the browser build.

### 3.4 Data and layers

- Client-side lightning and storm-cell GeoJSON layers (instead of only
  server-rendered glyphs).
- Additional open radar sources where licensing allows.
- A source health panel with last success, latency, and frame counts.
- Custom palette import/export for self-hosters.
- Optional coverage mask display.

### 3.5 Desktop polish

- Remember window size and position.
- “Minimize to tray on close” as an explicit preference.
- Native notifications for newly issued severe alerts (opt-in, local only).
- Signed auto-updates with a documented trust model.
- macOS packaging and notarisation validation.

### 3.6 Internationalisation

- Extract UI strings.
- Add translations with community review.
- Keep attribution and provider names accurate.
- Test longer strings in narrow layouts.

---

## 4. Explicit non-goals

OpenRadar will not:

- replace official weather warnings or claim to be a life-safety service;
- generate its own numerical weather prediction;
- bundle a global radar archive;
- require an account or upload user data;
- add telemetry or advertising;
- silently switch to a paid or non-open data source;
- remove attribution or the export footer;
- hide that Esri World Imagery is not open data;
- implement map rotation or 3D pitch (weather maps are north-up and 2D);
- guarantee uptime for the public LibreWXR instance.

---

## 5. How to influence the roadmap

- Open an issue describing the user problem and the constraints.
- Include platform, data source, and licensing implications.
- Link prior art or upstream API support.
- Start with a small, reviewable change.
- Contribute tests or documentation even if you cannot implement the feature.

See [Contributing](CONTRIBUTING.md). Roadmap items without an owner may wait a
long time; that is the nature of a volunteer project.
