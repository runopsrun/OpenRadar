# Security and privacy

OpenRadar is a local desktop app that talks directly to public HTTP services. It
has no accounts, no backend, no telemetry, and no auto-update channel. This
document describes what is trusted, what leaves the device, and how the attack
surface is limited.

> This is a practical security summary, not a formal audit. Report suspected
> vulnerabilities privately; see [§10](#10-reporting-a-vulnerability).

---

## 1. Trust boundaries

```text
┌──────────────────────────────────────────────────────────────┐
│ Device                                                       │
│                                                              │
│  ┌──────────────┐   IPC    ┌───────────────────────────────┐ │
│  │ Rust shell   │◄────────►│ Webview (React + MapLibre)    │ │
│  │              │          │                               │ │
│  │ settings     │          │ settings store, map, UI       │ │
│  │ files, PNG   │          │                               │ │
│  └──────────────┘          └──────────────┬────────────────┘ │
│                                           │ HTTPS/HTTP       │
└───────────────────────────────────────────┼──────────────────┘
                                            ▼
              Radar / basemap / geocoder providers (untrusted data)
```

Trusted:

- The bundled application code and assets.
- The local settings file written by the app.
- The OS webview and certificate store.

Untrusted:

- Every HTTP response: catalog JSON, tile PNGs, alert GeoJSON, Nominatim
  results, basemap styles and tiles.
- Any URL entered as a custom data source.
- Alert titles, descriptions, regions, and links.
- Place names and display names.

The design assumes upstream data is *data*, never code.

---

## 2. What leaves the device

OpenRadar makes direct requests from the webview. There is no proxy and no
first-party server.

| Destination | When | What is sent | What the provider sees |
| --- | --- | --- | --- |
| Selected radar source (`api.librewxr.net`, RainViewer, or custom) | Launch, refresh, tile loads | Catalog and tile paths; palette, smoothing, snow, overlay flags | IP address, user agent, requested frames/tiles |
| OpenFreeMap | Basemap selected | Style and vector-tile requests | IP address, user agent, tile coordinates |
| Esri ArcGIS | Satellite basemap selected | Raster tile requests | IP address, user agent, tile coordinates |
| Nominatim | Place search | Query text, language, result limit | IP address, user agent, query text |
| OSM tile server | Vector style fallback only | Raster tile requests | IP address, user agent, tile coordinates |

Not sent anywhere:

- Settings, recent places, theme, default view.
- Alert popup contents or click history.
- Exported images.
- Analytics, crash reports, or usage events (none exist).
- The result of geolocation (used locally only).

### 2.1 Precise location

The crosshair button requests a one-shot high-accuracy position. The coordinate:

- moves the map;
- places a temporary marker labelled with the accuracy radius;
- is **not** written to settings, logs, or any server by OpenRadar.

However, the radar/basemap requests that follow reveal the approximate viewport
through tile coordinates. That is inherent to any map client. If location
privacy matters, do not use the locate button and avoid searching for a home
address.

### 2.2 Search queries

Search text is sent to Nominatim. It is not persisted by OpenRadar beyond the
selected place's **name** and coordinates in `recentPlaces` (maximum five).
Search results are cached in memory for the session.

Do not type sensitive addresses into a third-party geocoder.

---

## 3. Data at rest

| Data | Location | Protection |
| --- | --- | --- |
| Settings | `~/.config/com.mumma.openradar/settings.json` (Linux); `%APPDATA%\com.mumma.openradar\settings.json` (Windows); Application Support on macOS | Plain JSON; `0600` on Unix; atomic replace |
| Browser settings | `localStorage["openradar-settings"]` | Protected by the browser profile, not encrypted |
| PNG exports | `Pictures/OpenRadar/` (or Downloads/home fallback) | Normal user file permissions |
| Tile/alert/search caches | Memory only | Cleared on exit |
| Logs | Terminal/console only | No file logging by the app |

Settings are **not encrypted**. They contain preferences and up to five recent
place names. Do not store secrets there.

There is no cloud sync. Copying the app to another machine does not copy
settings unless you copy the file manually.

---

## 4. Input validation

### 4.1 Data source URLs

`normalizeBaseUrl`:

- trims whitespace;
- requires `http://` or `https://` (adding a scheme when omitted);
- rejects every other protocol, including `javascript:`, `data:`, `file:`, and
  `ftp:`;
- strips query strings, fragments, and trailing slashes;
- returns `null` for unparsable values.

The settings panel rejects invalid values before any request. A stored invalid
value produces a clear metadata error rather than a request.

### 4.2 Tile paths

The radar frame path comes from upstream JSON and is used in a URL path.
`tiles.ts` accepts it only if it matches:

```text
^/v2/radar/[A-Za-z0-9_-]+$
```

Otherwise it falls back to `/v2/radar/<timestamp>`. This prevents a malicious
catalog from injecting `../`, query strings, or an absolute URL into the tile
request. Satellite paths are built only from a numeric timestamp.

The internal `path` query parameter on `openradar://` URLs is validated again in
`resolveRemoteTileUrl` and stripped before the upstream request.

### 4.3 Alert content

Alert popups are built with DOM APIs and `textContent`, never `innerHTML` or
`insertAdjacentHTML`. A malicious alert title or description is displayed as
text, not executed.

Alert links are rendered only when the `uri` starts with `http://` or `https://`.
Clicks are routed through `openExternal`, which re-checks the scheme. Links open
in the system browser (Tauri opener) or a new tab with
`noopener,noreferrer`.

### 4.4 Place names

React escapes place names and display names. The marker popup uses
`Popup.setText`, not HTML.

### 4.5 Native inputs

Rust validates:

- settings JSON size (2 MiB) and well-formedness before writing;
- PNG data URL prefix, base64 decoding, and the PNG magic bytes;
- export filenames (strips path separators, allows only alphanumerics, `-`,
  `_`, `.`, caps at 96 characters, forces `.png`);
- export size (64 MiB base64 payload).

This prevents path traversal and arbitrary file writes from a compromised
webview.

---

## 5. Webview and CSP

Production CSP from `src-tauri/tauri.conf.json`:

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https: http:;
connect-src 'self' ipc: http://ipc.localhost http: https: ws: wss:;
worker-src 'self' blob:;
font-src 'self' data:;
media-src 'self' data: blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-src 'none'
```

Interpretation:

- **No remote scripts.** Only bundled code executes. `wasm-unsafe-eval` is for
  WebAssembly used by the map stack.
- **Inline styles are allowed** because MapLibre and the UI set style
  attributes. This does not allow script execution.
- **Images may come from HTTP(S), `data:`, and `blob:`** because tiles and
  exports need them. An `img-src` allowance cannot execute code.
- **Connections may go to HTTP(S) and WebSocket** because sources are
  user-configurable and self-hosted instances may be plain HTTP on a LAN.
- **Workers may come from `blob:`** for MapLibre.
- **Objects, frames, and forms are blocked.**
- `devCsp` is `null`; the dev server is not CSP-constrained. Do not ship a dev
  build as a security boundary.

### 5.1 Why `connect-src` is broad

The app supports arbitrary self-hosted sources, including private-network HTTP.
A strict allowlist would break that feature. The trade-off is documented here:
a compromised renderer could exfiltrate data to any host, but the renderer only
holds preferences and public weather data, and remote scripts cannot run under
`script-src 'self'`.

If you fork for a fixed deployment, narrow `connect-src` and `img-src` to your
known hosts.

### 5.2 Tauri permissions

`src-tauri/capabilities/default.json` grants:

- `core:default` — standard window/webview APIs.
- `opener:default` — open HTTP(S) links in the system browser.

No filesystem, shell, HTTP, dialog, or process plugins are enabled. The only
native file access is through the three app commands, which validate their
inputs.

---

## 6. Native surface

| Command | Risk | Mitigation |
| --- | --- | --- |
| `load_settings` | Reads a file from the app config dir | Fixed filename; no user path. |
| `save_settings` | Writes a file | Size + JSON validation; atomic write; `0600`. |
| `save_export` | Writes a PNG | Data URL + PNG signature validation; sanitised filename; fixed directory. |

There is no `eval`, shell, subprocess, or arbitrary path command. The tray emits
a single event (`openradar:refresh`) with no payload.

The app does not install a custom protocol handler at the OS level. The
`openradar://` scheme exists only inside MapLibre's protocol registry.

---

## 7. Supply chain

- JavaScript dependencies are pinned by `package-lock.json`.
- Rust dependencies are pinned by `Cargo.lock`.
- There is no runtime CDN dependency for app code; MapLibre is bundled.
- Map styles, sprites, glyphs, and tiles are fetched at runtime from the
  configured providers. They are data, not executable code.
- The app has no auto-updater. Updates are manual; there is no background
  download or signature check to attack.

Recommendations for distributors:

- build from a clean checkout with `npm ci` and `cargo build --locked`;
- review dependency updates, especially Tauri, MapLibre, and React;
- sign Windows/macOS artifacts;
- publish SHA-256 checksums with installers;
- keep the Rust toolchain and webview runtime patched.

---

## 8. Threat model

| Threat | Impact | Mitigation |
| --- | --- | --- |
| Malicious catalog/tile server | Arbitrary images, misleading data, tracking | No script execution; URL/path validation; user chose the source. |
| Malicious alert text | XSS in popup | `textContent` construction; no `innerHTML`; link scheme check. |
| Path traversal via frame path | Request to an unintended host/path | Strict regex; fallback to numeric timestamp. |
| Path traversal via export filename | Write outside export dir | Rust sanitisation; fixed directory. |
| Oversized settings/export | Disk or memory exhaustion | 2 MiB and 64 MiB caps; JSON and PNG validation. |
| Compromised dependency | Code execution | Lockfiles; review; signing; no remote code loading. |
| Shoulder-surfing settings | Reveals recent place names | Plain JSON is intentional; rely on OS file permissions/disk encryption. |
| Network observer | Sees weather tiles and search queries | Use HTTPS sources and a trusted network; the app cannot encrypt upstream traffic itself. |
| Self-signed TLS MITM | Intercepted traffic | Webview rejects untrusted certificates; do not add exceptions. |
| Malicious local process | Reads settings/exports | OS user isolation; `0600` settings. |

Out of scope:

- A compromised OS or webview runtime.
- A malicious build artifact distributed outside your control.
- Upstream providers logging requests (see [§2](#2-what-leaves-the-device)).
- Denial of service against public providers by modified clients.

---

## 9. Privacy summary

| Question | Answer |
| --- | --- |
| Is there telemetry? | No. |
| Are there accounts? | No. |
| Is data synced to a cloud? | No. |
| Are settings uploaded? | No. |
| Is location stored? | No. |
| Are search queries stored? | Only the selected place name/coords in recent places. |
| Are exports uploaded? | No. |
| Can the app work offline? | Only with already-cached tiles; the catalog and basemaps need network. |
| Does the app phone home on update? | It has no updater. |

The providers you choose see your IP and requests. That is the main privacy
consideration. Self-hosting LibreWXR and a tile proxy reduces third parties but
does not eliminate them.

---

## 10. Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the maintainer
privately (the repository's security contact or a direct maintainer address) with:

- affected version and platform;
- a description of the issue and impact;
- reproduction steps or a proof of concept;
- whether the issue is in OpenRadar, Tauri, MapLibre, or an upstream service.

Please allow time for a fix before disclosure. For issues in LibreWXR, report to
that project; for Esri, OpenFreeMap, OSM, or Nominatim, report to the relevant
operator.

---

## 11. Hardening checklist for distributors

- [ ] Build with a clean checkout and locked dependencies.
- [ ] Run `npm audit` and `cargo audit`; triage findings.
- [ ] Keep the production CSP; do not add `'unsafe-eval'` or remote scripts.
- [ ] Keep the capability list minimal.
- [ ] Sign Windows/macOS artifacts and publish checksums.
- [ ] Ship the `LICENSE` and third-party notices.
- [ ] Keep the attribution and life-safety warning visible.
- [ ] Test with a self-hosted server and restricted CORS.
- [ ] Verify settings permissions (`0600`) after the first save.
- [ ] Review any new native command for path and size validation.
- [ ] Avoid logging precise user locations or search queries.
