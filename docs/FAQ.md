# Frequently asked questions

Short answers. Follow the links for detail.

---

## Product and scope

### What is OpenRadar?

A lightweight desktop weather radar viewer built with Tauri, React, TypeScript,
and MapLibre. It animates past and nowcast radar frames, with optional satellite,
weather alerts, lightning, storm cells, and motion arrows.

### Is it free?

The source is MIT-licensed and free to use. Data and services have their own
terms; some are open, some are not. See [Data sources](DATA_SOURCES.md).

### Which platforms are supported?

Linux is the primary and tested platform. Windows is supported by the Tauri
stack. macOS should work but is untested for v0.1.0. A browser build runs
anywhere modern webviews run.

### Is there a mobile app?

No native mobile app. The browser build is responsive and works on mobile
browsers, but it is not a packaged PWA and has no offline map.

### Does it work offline?

Only for tiles already in memory. The catalog, new tiles, basemaps, search, and
alerts require network access. There is no offline archive.

### Does it need an API key or account?

No. The default LibreWXR instance is keyless, as are OpenFreeMap and Nominatim.

### Is there telemetry?

No analytics, crash reporting, accounts, or cloud sync. See
[Security and privacy](SECURITY_PRIVACY.md).

---

## Data and accuracy

### Where does the radar data come from?

By default, the public LibreWXR API, which composites regional radar networks and
serves RainViewer-compatible tiles. RainViewer is available as a fallback. See
[Data sources](DATA_SOURCES.md).

### Is the radar official?

No. It is a display of upstream composites. It is not an official warning
product and can lag or be incomplete. **Do not use it for life-safety
decisions.** Always consult the issuing weather agency.

### Why does the radar not align with what I see outside?

Radar reflects precipitation aloft, not ground truth. Beam height, terrain
blockage, evaporation, and timing all affect what appears. A few minutes of lag
is normal.

### Why is there no radar over the ocean or in some countries?

Radar coverage depends on ground-based networks. Outside coverage, LibreWXR may
fill with satellite-derived precipitation estimates or model data, which are not
radar-grade. Transparent tiles are normal.

### What is nowcast?

A short-range forecast, typically up to 60 minutes, produced by extrapolating
recent radar motion and blending with model data. It is experimental and less
reliable for rapidly developing storms.

### Why do frame counts change?

The server retains a rolling window of frames. Counts change as old frames expire
and new ones arrive. Do not rely on a fixed number.

### Why is the newest frame a few minutes old?

Radar ingestion, compositing, and network transfer take time. The status pill's
age is when *your client* fetched the catalog, not the age of the newest frame.
Use the timeline offset (`Latest`, `10 min ago`) for frame age.

### Are alerts official?

They come from WMO CAP feeds and the NWS (via LibreWXR). They can lag, be
incomplete, or use regional geometry. They are informational. Consult the issuing
agency.

### Why do alert counts change when I pan?

Alerts are requested for the current viewport. Panning changes the bbox and the
count. Zoomed-out views may use the global feed.

---

## Using the app

### How do I change the data source?

**Settings → Data source.** Choose LibreWXR, RainViewer, or a self-hosted
instance. See [Configuration](CONFIGURATION.md#22-data-source).

### Why are satellite, alerts, or extras disabled?

The selected source does not advertise them, or the server has them disabled.
RainViewer supports radar only. The app clears unsupported toggles automatically.

### Why does the theme not change the map?

The UI theme and base map are separate. Change the base map in **Layers**.

### How do I save my current view as the startup view?

**Settings → Default location → Use current view.** Panning does not overwrite
it automatically.

### How do I reset everything?

**Settings → Reset all settings.** This restores defaults and persists them.

### Where are settings stored?

Linux: `~/.config/com.mumma.openradar/settings.json`. Windows:
`%APPDATA%\com.mumma.openradar\settings.json`. Browser:
`localStorage["openradar-settings"]`.

### How do I export an image?

Use the download button in the top bar. Desktop saves under
`Pictures/OpenRadar/`; the browser downloads normally. The attribution footer is
baked in.

### Why is there no timeline/panel in my export?

Export captures the map canvas only. UI chrome is intentionally excluded.

### Can I measure distance or draw on the map?

Not in v0.1.0. See [Roadmap](ROADMAP.md).

### Can I view historical storms from last week?

No. The app shows the source's current rolling window, typically a few hours.

### Can I get severe-weather notifications?

No. There are no background notifications or push alerts. The tray refreshes
data but does not notify.

### Can I open multiple locations at once?

No. There is one map view and one temporary marker at a time.

### Why can't I rotate or tilt the map?

Weather maps are conventionally north-up and 2D. Rotation and pitch are disabled
by design.

---

## Sources and self-hosting

### Can I run my own server?

Yes. LibreWXR is self-hostable and OpenRadar supports custom instances. See
[Self-hosting](SELF_HOSTING.md).

### Why do the catalog and tiles use different hosts?

The catalog's `host` field is authoritative for tiles and may differ from the API
origin. A reverse proxy or misconfigured `LIBREWXR_PUBLIC_URL` commonly causes a
mismatch.

### Why do tiles fail with CORS errors?

The server's `LIBREWXR_CORS_ORIGINS` must include the webview origins:
`tauri://localhost`, `http://tauri.localhost`, and `http://localhost:1420`. See
[Self-hosting § CORS](SELF_HOSTING.md#5-cors-origins).

### Can I use a self-signed certificate?

Not with the desktop webview; it rejects untrusted certificates. Install a
locally trusted CA in the OS trust store, or use a certificate from a public CA.

### Can I use RainViewer instead?

Yes, as a radar-only fallback. Review its terms, especially for commercial or
high-volume use. It cannot be self-hosted.

### Can I use a different basemap or satellite source?

Yes, by editing `src/config/basemaps.ts`. Keep attribution correct and respect
the new provider's terms. See [Development](DEVELOPMENT.md).

### Is the satellite basemap open data?

No. Esri World Imagery is included for context and is **not** open data. The
vector basemaps use OpenStreetMap data under ODbL. See
[Data sources](DATA_SOURCES.md).

### Can I remove attribution?

No. Several sources require it, and the app bakes it into exports and the About
dialog. Keep it in derivative works.

---

## Privacy and security

### Does the app track my location?

Only when you press the locate button. The coordinate is used locally and is not
saved to settings. See [Security and privacy](SECURITY_PRIVACY.md#21-precise-location).

### Do search queries leave my device?

Yes, to Nominatim. Only the selected place's name and coordinates are persisted
(maximum five recent places).

### Are settings encrypted?

No. They are plain JSON with `0600` permissions on Unix. Do not store secrets.

### Does the app auto-update?

No. There is no updater or background download. Update manually.

### Is it safe to use a custom server?

The client validates URLs and paths and does not execute remote code, but a
malicious server can still serve misleading images and data. Use servers you
trust, preferably over HTTPS.

---

## Development and contributing

### How do I run it from source?

```bash
npm install
npm run tauri:dev
```

See [Getting started](GETTING_STARTED.md).

### Why does the build need Rust 1.90+?

The locked Tauri 2.12.5 dependency requires it. See
[Getting started](GETTING_STARTED.md#22-rust).

### How do I add a data source or overlay?

See [Development § Common recipes](DEVELOPMENT.md#6-common-recipes) and
[Architecture § Extension points](ARCHITECTURE.md#11-extension-points).

### Are there tests?

There is no committed automated suite yet. Verification is typecheck, build,
Rust checks, and a manual matrix. See [Testing](TESTING.md).

### How do I build installers?

```bash
npm run tauri:build
```

See [Building](BUILDING.md).

### How do I contribute?

See [Contributing](CONTRIBUTING.md).

### Why is Linux the primary platform?

It is the development and validation environment. Windows paths and packaging are
supported; macOS remains untested.

### Is the app translated?

The UI is English-only in v0.1.0. Dates and times use the OS locale through
`Intl`.

### Is it accessible?

Controls have accessible names, toggles expose switch state, the timeline has an
`aria-valuetext`, panels are landmarks, dialogs are modal, and reduced-motion
preferences are respected. It is not a substitute for a formal accessibility
audit.

### Can I use it commercially?

The MIT licence allows it. Data and service terms still apply, especially Esri,
RainViewer, OpenFreeMap, OSM, and Nominatim. Review them before commercial use.
