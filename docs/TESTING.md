# Testing and verification

OpenRadar currently has **no committed unit or end-to-end test suite**. Quality
is enforced by strict TypeScript, production builds, Rust checks, and a manual
regression matrix. This document describes what is checked, how to reproduce it,
and what a future automated suite should cover.

> Do not treat green checks as proof that the map works. Most failure modes in
> this app are network, CORS, WebGL, and upstream-data issues that only appear at
> runtime.

---

## 1. Automated checks

Run these before every change:

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Optional but recommended:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tauri build --no-bundle
```

| Check | Catches | Does not catch |
| --- | --- | --- |
| `tsc --noEmit` | Type errors, unused locals/params, unchecked indexed access | Runtime behaviour |
| `vite build` | Import resolution, bundling, worker URL emission | Network or WebGL issues |
| `cargo check` | Rust type/lifetime errors, command signatures | Runtime file permissions |
| `cargo clippy` | Common Rust mistakes and style | Logic errors |
| `tauri build --no-bundle` | Embedding, CSP syntax, native link | Installer packaging |

Expected result: all commands exit `0` with no errors. Warnings in Rust should be
reviewed; the goal is a clean clippy run.

---

## 2. Test environments

| Environment | Use for |
| --- | --- |
| `npm run dev` + desktop browser | Fast UI iteration, devtools, network inspection |
| `npm run tauri:dev` | Native window, tray, settings file, PNG export |
| `npm run preview` | Production bundle in a browser |
| Built Linux package | Installer behaviour, desktop integration |
| Self-hosted LibreWXR | Custom source, CORS, feature flags |
| Offline / throttled network | Stale data, tile errors, fallbacks |

Minimum useful matrix: one Chromium-based browser, one WebKit-based browser
(Safari or WebKitGTK via Tauri), and the native Linux build.

---

## 3. Manual regression matrix

Record the app version, source, base map, and time of test. Frame counts and
alert counts change constantly; assert *behaviour*, not exact numbers.

### 3.1 Startup and catalog

| # | Steps | Expected |
| --- | --- | --- |
| 1 | Launch with default settings | Splash clears; status reaches **Live**; timeline populated. |
| 2 | Reload | Theme, basemap, overlays, speed, loop, and default view persist. |
| 3 | Switch to RainViewer | Catalog reloads; alerts/satellite/extras disabled; frames play. |
| 4 | Switch back to LibreWXR | Capabilities return; palette remains valid or falls back. |
| 5 | Set auto-refresh to 1 minute | Status shows **Updating** periodically without disrupting playback. |
| 6 | Disable auto-refresh | No periodic **Updating**; manual refresh still works. |

### 3.2 Playback and timeline

| # | Steps | Expected |
| --- | --- | --- |
| 7 | Press play | Frames advance at the selected speed. |
| 8 | Press pause | Playback stops on the current frame. |
| 9 | Step forward/back | One frame per press; buttons disable at the ends. |
| 10 | Scrub the range | Playback pauses; frame follows the handle. |
| 11 | Press play on the last frame | Restarts from the first frame. |
| 12 | Toggle loop off at the end | Playback stops on the last frame. |
| 13 | Toggle nowcast off while a forecast frame is selected | Selection repairs to a remaining frame. |
| 14 | Toggle nowcast on | Forecast frames appear; dashed track and `NOW` marker update. |
| 15 | Change speed | Next tick uses the new interval. |
| 16 | Refresh while playing | Playback continues; selection stays if the frame still exists. |

### 3.3 Radar and overlays

| # | Steps | Expected |
| --- | --- | --- |
| 17 | Toggle radar off/on | Layer disappears/reappears without a catalog refetch. |
| 18 | Change palette | Tiles re-render with the new scheme; old tiles are not reused. |
| 19 | Change radar opacity | Smooth in-place change; no flicker. |
| 20 | Toggle smoothing | New tiles reflect the flag. |
| 21 | Toggle snow mask | New tiles reflect the flag. |
| 22 | Enable satellite | Clouds appear beneath radar; toggle disabled if no frames. |
| 23 | Change satellite opacity | In-place change. |
| 23a | Enable radar coverage | Coverage tiles appear above satellite, below radar; toggle disabled on RainViewer. |
| 23b | Change coverage opacity | In-place change. |
| 24 | Enable alerts | Polygons appear; row shows a count. |
| 25 | Click an alert polygon | Popup shows severity, expiry, title, regions, description, link. |
| 26 | Pan with alerts on | Refetch after ~700 ms; no empty flash. |
| 27 | Enable motion arrows | Arrows align with each frame; colour matches basemap brightness. |
| 28 | Enable storm cells | Cells align with each frame. |
| 29 | Enable lightning dots/bolts | Glyphs align with each frame. |
| 30 | Switch to RainViewer with extras on | Extras clear; controls disable. |

### 3.4 Base maps

| # | Steps | Expected |
| --- | --- | --- |
| 31 | Switch Dark → Light | Style swaps; radar/satellite/alerts reattach; labels stay above overlays. |
| 32 | Switch to Streets | Same. |
| 33 | Switch to Satellite | Esri imagery loads; attribution changes; arrow/cell colours adapt. |
| 34 | Switch rapidly between all four | No duplicate layers, no stuck loading, no console errors. |
| 35 | Simulate style failure (block the style host) | After ~12 s, OSM raster fallback and one warning toast. |

### 3.5 Search and location

| # | Steps | Expected |
| --- | --- | --- |
| 36 | Type 1 character | No request. |
| 37 | Type a city name | Debounced request; up to 6 results. |
| 38 | Select a city result | Map frames the local radar radius (default 50 miles) and draws a range ring; marker and popup appear. |
| 39 | Search again | Previous marker is replaced, not duplicated. |
| 40 | Open search with an empty query | Recent places appear; selecting a local one frames the radar radius. |
| 41 | Search nonsense | “No places found.” |
| 42 | Block Nominatim | Inline error; map and radar remain usable. |
| 43 | Press the locate button or “Use my location” | Permission prompt; on success, the map frames the selected radius with a range ring and an accuracy marker. |
| 44 | Deny permission | Specific error toast; no crash. |

### 3.6 Settings and persistence

| # | Steps | Expected |
| --- | --- | --- |
| 45 | Change every setting, reload | All values restored. |
| 46 | Set a custom default view, reload | Map opens at that view. |
| 47 | Pan without saving | Default view unchanged after reload. |
| 48 | Reset all settings | Confirmation, then defaults restored and persisted. |
| 49 | Corrupt `settings.json` (invalid JSON) | App starts with defaults; no crash. |
| 50 | Make settings directory read-only | UI still works; warning logged; localStorage fallback where possible. |
| 51 | Fill recent places beyond 5 | Oldest dropped. |

### 3.7 Export, tray, and window

| # | Steps | Expected |
| --- | --- | --- |
| 52 | Export PNG (desktop) | File under `Pictures/OpenRadar`; success toast shows path. |
| 53 | Export PNG (browser) | Normal download; filename includes timestamp. |
| 54 | Export with alerts visible | Alert polygons and attribution footer are captured. |
| 55 | Export immediately after load | Waits for idle or 1.5 s; no empty image. |
| 56 | Tray → Show | Window shown, unminimized, focused. |
| 57 | Tray → Refresh | Catalog refresh begins. |
| 58 | Tray → Quit | Process exits. |
| 59 | Close the last window | Process exits. |
| 60 | Resize to 760×560 | Controls remain reachable; panel scrolls. |

### 3.8 Errors and resilience

| # | Steps | Expected |
| --- | --- | --- |
| 61 | Start offline | Error card with retry and data-source settings. |
| 62 | Go offline after load | **Stale** pill and banner; old frames playable. |
| 63 | Restore network, retry | **Live** returns. |
| 64 | Block radar tiles only | One warning toast; catalog and UI remain. |
| 65 | Point at an unreachable custom URL | Clear metadata error; no request loop. |
| 66 | Point at a server with alerts disabled | Alert row reports the layer error; radar unaffected. |
| 67 | Trigger a render error (devtools) | Error boundary with reload/continue. |

### 3.9 Keyboard and accessibility

| # | Steps | Expected |
| --- | --- | --- |
| 68 | `Space`, `←`, `→`, `R`, `L`, `T`, `/`, `?`, `Esc` | Each performs its documented action. |
| 69 | Press shortcuts while typing in search | No action; text input unaffected. |
| 70 | Tab through the top bar and timeline | Visible focus; controls reachable. |
| 71 | Inspect toggles | `role="switch"` and `aria-checked` present. |
| 72 | Inspect the timeline range | `aria-valuetext` describes the frame. |
| 73 | Enable reduced motion | Non-essential animations suppressed. |
| 74 | Narrow viewport (≤520 px) | Panel is full width; secondary labels hidden. |

---

## 4. Browser automation

Playwright was used during development for smoke tests against
`http://localhost:1420`, but the scripts are intentionally not committed. A
useful scripted pass should:

1. Wait for the status pill to read **Live**.
2. Assert the timeline has more than one frame.
3. Click play, wait, click pause, and assert the frame changed.
4. Scrub the range and assert the readout updates.
5. Toggle each overlay and assert no console errors.
6. Switch base maps and assert the radar layer still exists (`map.getLayer`).
7. Search and assert a marker/popup appears.
8. Trigger export and assert a download or success toast.
9. Reload and assert theme/basemap persistence.
10. Resize to a mobile viewport and assert no horizontal overflow.

Example minimal harness (not part of the repo):

```ts
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const errors: string[] = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:1420");
await page.getByText("Live", { exact: false }).waitFor({ timeout: 30_000 });
// ...interactions...
if (errors.length) throw new Error(errors.join("\n"));
await browser.close();
```

Playwright needs its own browser download:

```bash
npm i -D playwright
npx playwright install chromium
```

Do not add a browser dependency to the production bundle.

### 4.1 What not to assert

- Exact frame counts, alert counts, or timestamps.
- Exact status age (`just now` vs `2m ago`).
- Ordering of asynchronous toasts.
- Presence of a specific alert or storm cell.
- Pixel colours from remote tiles.

Assert states and invariants: `Live`, `frames > 1`, a layer exists, a toast with
the expected title appears, settings survive a reload.

---

## 5. Testing against a self-hosted server

1. Deploy LibreWXR following [Self-hosting](SELF_HOSTING.md).
2. Verify the catalog, a radar tile, satellite, and alerts with `curl`.
3. Point OpenRadar at the instance.
4. Confirm the **Effective host** matches the public URL.
5. Repeat the startup, playback, overlay, and error sections above.
6. Restrict `LIBREWXR_CORS_ORIGINS` to the app origins and confirm tiles still
   load in both the desktop and browser builds.
7. Disable satellite and alerts server-side and confirm the client disables the
   controls without errors.

---

## 6. Performance checks

| Check | How | Target |
| --- | --- | --- |
| First paint | Browser performance panel | Splash → map under a few seconds on a normal connection |
| Frame switch | Playback with network throttling | No blank frame once tiles are cached |
| Memory | Long playback session | Stable; tile cache capped at 64 MB |
| CPU | Idle with radar on | Low; no runaway timers |
| Bundle | `npm run build` output | MapLibre is the largest chunk and is expected |

Inspect the tile cache in the console only if you expose a debug hook; the app
does not print cache stats by default. `getTileCacheStats()` is available from
`services/tiles.ts` for temporary instrumentation.

---

## 7. Security tests

- Try `javascript:` and `data:` URLs in the custom source field; they must be
  rejected.
- Try a path-like frame value; the tile builder must fall back to a safe
  timestamp path.
- Try an alert `uri` that is not HTTP(S); the popup must not render a link.
- Confirm alert text is inserted as text, not HTML.
- Confirm export filenames cannot escape the export directory.
- Confirm the CSP blocks inline scripts (production build).
- Confirm settings writes are rejected when the payload is invalid JSON or
  larger than 2 MB.

See [Security and privacy](SECURITY_PRIVACY.md) for the threat model.

---

## 8. Release verification

Use the checklist in [Building § Release checklist](BUILDING.md#10-release-checklist).
At minimum, install the produced package on a clean machine or VM and repeat
sections 3.1, 3.2, 3.3, 3.5, 3.7, and 3.8.

---

## 9. Future test coverage

Priority order if a suite is added:

1. **Unit tests** for `normalizeBaseUrl`, `sanitizePersisted`, frame
   normalisation, `visibleTiles`, `satelliteFrameForTime`, and
   `formatFrameOffset`.
2. **Protocol tests** for `resolveRemoteTileUrl`, including opaque RainViewer
   paths and rejection of traversal attempts.
3. **Component tests** for the timeline model and settings controls.
4. **End-to-end tests** for the smoke path in §4.
5. **Visual snapshots** only for stable chrome (not remote map tiles).
6. **Rust tests** for filename sanitisation and settings validation.

Keep tests deterministic: mock upstream JSON and tile bytes rather than calling
public services in CI.
