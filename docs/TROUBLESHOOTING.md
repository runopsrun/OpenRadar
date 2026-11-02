# Troubleshooting

Start with the symptom. Each section lists the likely causes and the shortest
verification step.

Useful first checks:

```bash
node --version
npm --version
source "$HOME/.cargo/env" && rustc --version && cargo --version
curl -I https://api.librewxr.net/public/weather-maps.json
```

For a blank or broken app, also open the webview devtools console and look for
the first error, not the last.

---

## 1. Installation and toolchain

### `cargo` is not found

`npm run tauri:dev` shells out to Cargo, and a new terminal may not have
`$HOME/.cargo/bin` on `PATH`.

```bash
source "$HOME/.cargo/env"
npm run tauri:dev
```

Or add this to your shell profile:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

### `failed to run 'cargo metadata'`

Same cause as above. Confirm `which cargo` returns a path before running the
Tauri CLI.

### Rust is too old

The locked Tauri dependency requires Rust 1.90+.

```bash
rustup update stable
rustc --version
```

If the error names a crate MSRV, update stable rather than pinning an older
dependency.

### `webkit2gtk-4.1` / `webkit2gtk-4.1.pc` not found (Linux)

Install the development package:

```bash
# Fedora
sudo dnf install webkit2gtk4.1-devel

# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev
```

### `libayatana-appindicator` / tray build errors (Linux)

```bash
# Fedora
sudo dnf install libappindicator-gtk3-devel

# Debian/Ubuntu
sudo apt install libayatana-appindicator3-dev
```

### Windows: linker `link.exe` not found

Install Visual Studio Build Tools with **Desktop development with C++** and the
Windows SDK. Use a Developer PowerShell. Confirm the MSVC Rust toolchain:

```powershell
rustup default stable-x86_64-pc-windows-msvc
```

### Windows: WebView2 missing

Install the WebView2 Evergreen Runtime. Windows 11 includes it; some older
Windows 10 images do not.

### `npm install` fails

- Confirm Node 20.19+ or 22.12+.
- Delete `node_modules` and reinstall with `npm ci`.
- On a corporate network, check the npm registry/proxy configuration.
- Do not mix npm, pnpm, and yarn lockfiles.

---

## 2. Development server

### Port 1420 is already in use

Vite uses a strict port because `tauri.conf.json` hard-codes
`http://localhost:1420`.

```bash
ss -ltnp | grep 1420
# stop the other process, or change both the Vite port and devUrl
```

Changing only one side produces a blank Tauri window.

### The dev window is blank

1. Confirm Vite is running at `http://localhost:1420`.
2. Open that URL in a browser. If it fails there, the frontend is the problem.
3. Check the Tauri terminal for a Rust panic or a CSP error.
4. Try `npm run dev` alone to isolate the native shell.

### HMR does not work over a remote host

Set `TAURI_DEV_HOST` so Vite binds to a reachable host and uses HMR port 1421:

```bash
TAURI_DEV_HOST=192.168.1.20 npm run tauri:dev
```

Ensure the firewall allows 1421.

### Changes to `src-tauri` do not trigger reload

Vite intentionally ignores `**/src-tauri/**`. Restart `npm run tauri:dev` after
changing Rust code; incremental Cargo compilation still applies.

---

## 3. Map problems

### Blank or black map on Linux

Common with certain NVIDIA/WebKitGTK combinations and DMA-BUF issues.

1. Try the workaround:

   ```bash
   WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
   ```

2. If that helps, keep it in your launcher or shell profile for this app.
3. Update Mesa/WebKitGTK and your GPU driver.
4. Try the browser build to determine whether the issue is the webview or the
   style/data.
5. Check the console for WebGL context creation errors.

Do not disable hardware acceleration globally unless you accept the performance
cost.

### The map loads but no labels or streets appear

The vector style host may be blocked or slow. OpenFreeMap styles are fetched from
`https://tiles.openfreemap.org`. After 12 seconds without `style.load`,
OpenRadar switches to the OSM raster fallback and shows a warning toast.

Check:

```bash
curl -I https://tiles.openfreemap.org/styles/dark
```

If the style host is blocked, the fallback should still render a basic map. If
both are blocked, the map background remains visible but empty.

### Base map switch leaves a blank map

The new style failed to load or the overlay effects did not reattach. Check the
console for style parse errors. Switch back to another base map; a successful
`style.load` recreates radar, satellite, and alert layers.

### Map is upside down, rotated, or pitched

OpenRadar disables rotation and pitch. If you see rotation, a modifier key or
trackpad gesture may have triggered it in a modified build. Reset the view by
reloading or using **Go to default** in Settings.

### Zoom stops at 12 or 6

That is expected. Radar source tiles end at zoom 12 and satellite at zoom 6;
MapLibre overzooms the last level. The map itself allows zoom 1–16.

---

## 4. Radar data

### Status says **Offline** and the error card is shown

No catalog has loaded. Check:

1. Network connectivity.
2. The selected source URL (Settings → Data source).
3. The catalog endpoint directly:

   ```bash
   curl -sS https://api.librewxr.net/public/weather-maps.json | head -c 400
   ```

4. CORS, if using a self-hosted instance.
5. Whether the app is behind a proxy that blocks JSON or tiles.

Click **Try again**. If the source is RainViewer or a custom host, switch back to
LibreWXR to isolate the source.

### Status says **Stale** and a banner appears

The last refresh failed but old frames are still usable. This is intentional.
The banner shows the error and the age of the last successful catalog.

- Wait and press **Retry**.
- The app keeps polling at the configured interval.
- Playback of cached frames continues.

### Timeline is empty or shows one frame

- The source returned no radar frames (invalid catalog).
- Nowcast is disabled and the source only provided forecast frames (unlikely).
- A metadata refresh is in flight and the old catalog was cleared by a source
  switch.

Check the catalog JSON and the status pill. If `radar.past` is empty on your
server, fix the server; the client will not invent frames.

### Frames advance but tiles do not change

- The palette/flags are baked into the tile URL; if only the timestamp changes,
  tiles should still differ.
- A caching proxy may be ignoring the path. Verify with `curl` for two
  timestamps.
- A server bug may return the same bytes for every timestamp.
- Check the network panel for repeated cache hits with identical URLs.

### Tiles are missing over some areas

Radar has no data outside coverage. Oceans, remote regions, and areas outside
the enabled radar regions are transparent or missing. This is normal.

If an entire region is missing on a self-hosted server, check
`LIBREWXR_ENABLED_REGIONS` and the health endpoint.

### “Some map tiles could not load” toast

Shown once per session when MapLibre reports a source/tile error. It is a
warning, not a fatal error. Pan or zoom to retry. If it persists:

- confirm the tile host is reachable;
- check for CORS errors;
- verify the palette and zoom are supported;
- confirm the timestamp/path is valid.

### Radar is offset from the basemap

Both use Web Mercator. A visible offset usually means a malformed tile URL or a
server returning tiles for a different projection. Verify with a known city and
compare a radar tile directly.

### RainViewer shows no frames or 410 errors

RainViewer now uses opaque frame keys. OpenRadar builds tiles from `frame.path`,
so a catalog with a valid `path` works. If RainViewer returns errors, switch to
LibreWXR; RainViewer is a compatibility fallback with its own terms and
availability.

### Nowcast frames are missing

- `includeNowcast` is off in Settings.
- The server has nowcast disabled or has not generated it yet.
- The catalog's `radar.nowcast` array is empty.

### Snow/lightning/arrows/cells do nothing

These are server-rendered LibreWXR extensions. They are unavailable on
RainViewer and on servers with the features disabled. The controls should be
disabled or clear automatically when unsupported. If a toggle stays on but has
no effect, check the server's feature flags and the tile query string.

---

## 5. Satellite overlay

### Satellite toggle is disabled

The catalog has no `satellite.infrared` frames, or the selected source does not
support satellite (RainViewer). Enable satellite on the server or use LibreWXR.

### Satellite is blurry

Source zoom is 6. Above that, MapLibre overzooms the last level. This is
expected for the hourly GMGSI mosaic. Use it as context, not for street-level
analysis.

### Satellite is dark or shows only clouds at night

The composite uses visible imagery on the day side and longwave IR at night.
Night-side imagery is intentionally transparent except for cloud tops, with a
terminator crossfade.

### Satellite timing looks wrong

Satellite frames are hourly. OpenRadar selects the latest satellite frame at or
before the active radar time, falling back to the nearest frame. Some mismatch at
the edges of the satellite history is normal.

---

## 6. Alerts

### Alerts show “This data is disabled on the server.”

`/v2/alerts` returned HTTP 503, meaning alerts are disabled server-side. Enable
`LIBREWXR_ALERTS_ENABLED` or use another source.

### Alerts toggle is disabled

The source does not support alerts (RainViewer), or the app cleared the setting
after a source change. Switch to a LibreWXR source.

### No polygons appear

- The current viewport has no active alerts.
- The bbox request returned an empty collection.
- The layer is enabled but the data request failed; check the row's error text.
- Very zoomed-out views request the global feed; give it time.

### Alert count changes on its own

Expected. Alerts expire, new ones are issued, and the viewport changes. Counts
are not stable fixtures.

### Alert popup link does not open

Only `http(s)` URIs are rendered as links. In the desktop app, the opener plugin
must be available; if it fails, the app falls back to `window.open`. A blocked
popup or a missing system browser can prevent it.

### Alerts lag official warnings

Upstream CAP feeds and polling introduce delay. Alerts are informational. Always
consult the issuing agency for official warnings.

---

## 7. Search and geolocation

### Search returns “No places found.”

- Try a less specific query.
- Check network access to `nominatim.openstreetmap.org`.
- Public Nominatim may rate-limit or block unusual clients.
- Queries shorter than two characters are not sent.

### Search shows a network error

Nominatim is unreachable, blocked, or returning an error. The map and radar
remain usable. For production, run your own geocoder or proxy.

### Search results are stale

Results are cached in memory for the session (60 queries). Reload the app to
clear the cache.

### Geolocation fails

| Message | Cause |
| --- | --- |
| Permission denied | The webview/browser denied location access. |
| Timed out | No fix within 12 seconds. |
| Unavailable | The OS/location provider could not produce a position. |

Enable location services and retry. On Linux, a GeoClue provider must be
installed and running. The desktop webview may require a portal permission.

### The marker does not move

A new search or locate action replaces the marker only if the map instance is
ready. Wait for the map to load and try again.

---

## 8. Settings and persistence

### Settings do not persist

Desktop settings live at:

```text
~/.config/com.mumma.openradar/settings.json
```

Windows: `%APPDATA%\com.mumma.openradar\settings.json`.

Check:

```bash
ls -l ~/.config/com.mumma.openradar/
cat ~/.config/com.mumma.openradar/settings.json
```

- If the file is missing, the native write may be failing. Look for
  “Native settings write failed” in the console.
- If the directory is read-only or the disk is full, writes fail and the app
  falls back to localStorage.
- If the JSON is corrupt, the app starts with defaults; delete the file for a
  factory reset.
- If you changed the bundle identifier, the path changed too.

Browser settings are under `localStorage["openradar-settings"]`. Private
browsing may discard them on exit.

### A setting reverts after a source change

Expected for capabilities the new source lacks: alerts, satellite, lightning,
storm cells, and motion arrows are cleared. The palette falls back to the first
advertised scheme if the saved one is missing.

### Reset did not clear everything

**Reset all settings** restores `DEFAULT_SETTINGS`, including theme, basemap,
source, overlays, animation, default view, and recent places. It does not clear
the in-memory tile cache (it is bounded and harmless) or delete exported PNGs.

### Settings file grows unexpectedly

The app caps the payload at 2 MiB and validates JSON. A huge file usually means
external editing or a different application writing to the same path. Inspect
it; do not raise the cap without understanding the cause.

---

## 9. Export

### “Could not export the map”

- The map canvas is empty or not ready. Wait for the map to render and retry.
- The webview may not support `preserveDrawingBuffer`/`toDataURL` in your
  configuration.
- The image may exceed the size limit.
- On desktop, the export directory may be unwritable.

### Export succeeds but the file is not where expected

Desktop exports go to `Pictures/OpenRadar/`. If Pictures is unavailable, the app
falls back to Downloads, then the home directory, then a temp directory. The
success toast shows the absolute path.

Browser exports use the browser's download location.

### Export is missing the timeline or panels

By design. Export captures the map canvas plus an attribution footer. It does
not include the side panel, timeline, toasts, or dialogs.

### Export has no attribution

The footer is drawn onto the canvas. If it is missing, the canvas capture may
have failed partially. Do not distribute exports without attribution.

---

## 10. Tray and window

### Tray icon missing on Linux

The tray requires an AppIndicator-compatible desktop environment and the
`libappindicator`/`libayatana-appindicator` library. GNOME may need an extension
such as AppIndicator Support. Without a tray, use the window controls; the app
still works.

Check:

```bash
echo "$XDG_CURRENT_DESKTOP"
```

### Tray menu does nothing

- **Show OpenRadar** requires the `main` window to exist.
- **Refresh** emits an event consumed only when the webview is alive.
- **Quit** exits the process.

If the menu is unresponsive, the app may be hung; quit from the terminal.

### Closing the window does not keep the app running

Closing the last window exits the app by design. There is no “minimize to tray
on close” setting in v0.1.0.

### Window is too small or off-screen

The minimum size is 760×560. If the window is off-screen after a monitor change,
delete the window-state cache if your desktop stores one, or restart the app.
OpenRadar does not persist window geometry itself.

---

## 11. Theme and appearance

### Theme does not follow the OS

- **System** listens to `prefers-color-scheme` changes. Some Linux desktops do
  not expose this to WebKitGTK; choose Light or Dark explicitly.
- Pressing `T` writes an explicit preference, leaving System mode.

### The base map did not change with the theme

By design. The UI theme and basemap are independent. Change the basemap in
Layers.

### Colours look wrong on an old webview

The UI uses `color-mix()` and modern CSS. Very old WebKitGTK/WebView2 versions
may render incorrect colours. Update the webview runtime.

### Text is tiny or clipped

The layout is responsive down to 760 px. At high OS scaling, the webview may
report a smaller CSS viewport. Increase the window size or reduce scaling.
Report a screenshot if controls overlap at the minimum size.

---

## 12. Performance

### High CPU while idle

- Radar animation may be playing. Pause it.
- A base map with many labels can be expensive.
- Check for a runaway interval in devtools; the core loops are one catalog poll,
  one alert poll, and one animation timer, plus small 30 s UI refresh timers.
- On Linux, try the DMA-BUF workaround or update the GPU driver.

### High memory

- The tile cache is capped at 64 MB, but decoded GPU textures add more.
- Satellite and alerts add memory.
- Long sessions with many basemaps can fragment GPU memory; restart the app.
- If memory grows without bound, capture a heap snapshot and report it.

### Playback stutters

- Tiles may be uncached. Let the loop run once to warm the cache.
- Lower the speed (increase the interval) or reduce the window size.
- Check network latency to the tile host.
- Preloading is capped at 32 tiles per frame; a very large viewport may still
  outrun it.

### First load is slow

The first catalog fetch and first tiles are network-bound. MapLibre is also the
largest bundle. Subsequent frames benefit from the cache. Self-host closer to
users or use a caching proxy for repeated deployments.

---

## 13. Self-hosted source problems

### Catalog loads but tiles 404

- The catalog's `host` is wrong or unreachable.
- The tile path is malformed (for example a duplicated `.png`).
- The timestamp is no longer retained by the server.
- The palette/zoom is unsupported.

Check the effective host in Settings and request a tile with `curl`.

### Catalog loads but tiles are blocked by CORS

Add the webview origins to `LIBREWXR_CORS_ORIGINS`:

- `tauri://localhost`
- `http://tauri.localhost`
- `http://localhost:1420`

See [Self-hosting § CORS](SELF_HOSTING.md#5-cors-origins).

### Works in the browser but not the desktop app

Almost always CORS or TLS. The desktop webview has different origins and a
stricter certificate policy. Check the webview console, not just the browser.

### Works on the server but not remotely

- `LIBREWXR_PUBLIC_URL` still points at `localhost`.
- A firewall blocks the port.
- TLS is terminated at a proxy but the app uses `http://`.
- A reverse proxy does not forward WebSocket upgrades (only relevant to future
  live updates).

### Satellite/alerts are disabled even though the server has them

- The catalog's arrays are empty.
- The server returned 503 for `/v2/alerts`.
- The source is RainViewer, which does not support them.

### Health endpoint shows errors

```bash
curl -sS https://radar.example.com/health | jq .
```

Inspect the frame counts, satellite/alerts status, cache, and memory sections.
Field names vary by LibreWXR version, so read the payload rather than assuming a
fixed schema. A healthy server with zero radar frames will still fail in
OpenRadar.

---

## 14. Collecting a useful bug report

Include:

- OpenRadar version and platform (`Settings` shows the version).
- Desktop or browser, and the browser/webview version.
- Selected source and effective host.
- The exact error text and the first console error.
- Whether the catalog loads and whether tiles load (they are different).
- Steps to reproduce, including the view and frame time if relevant.
- A screenshot, with precise personal locations removed.

Do not include:

- API keys or tokens (the app has none, but proxies might).
- Exact home coordinates or sensitive search queries.
- Full settings files unless necessary; redact `recentPlaces`.

If the issue is upstream data (a missing alert, wrong radar return), report it to
the data provider. OpenRadar only displays their data.
