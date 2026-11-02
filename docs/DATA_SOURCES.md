# Data sources, licences, and attribution

OpenRadar intentionally uses free and open data wherever possible. This file
documents what is fetched, from where, under which terms, and how the app
credits it. It also lists the operational limits that matter when self-hosting
or deploying. For step-by-step deployment, see [`SELF_HOSTING.md`](SELF_HOSTING.md).

> This is a practical summary, not legal advice. Always review the upstream
> terms before redistribution or commercial use.

---

## 1. Summary

| Purpose | Default provider | Endpoint | Licence / terms | Key required | Self-hostable |
| --- | --- | --- | --- | --- | --- |
| Radar + nowcast catalog and tiles | LibreWXR public API | `https://api.librewxr.net` | Server AGPL-3.0-or-later; API data CC-BY-4.0 | No | Yes |
| Radar fallback | RainViewer | `https://api.rainviewer.com` | RainViewer API terms | No | No |
| Satellite imagery | NOAA GMGSI via LibreWXR | `{host}/v2/satellite/...` | U.S. government work (public domain); rendered by LibreWXR | No | Yes (via LibreWXR) |
| Weather alerts | WMO CAP via LibreWXR | `{host}/v2/alerts` | Alert text/geometry per originating agency; feed via LibreWXR | No | Yes (via LibreWXR) |
| Vector base maps | OpenFreeMap | `https://tiles.openfreemap.org` | Free service; OpenMapTiles schema; data © OpenStreetMap (ODbL) | No | Yes (OpenFreeMap tooling) |
| Satellite base map | Esri World Imagery | `server.arcgisonline.com` | **Not open data**; Esri/Maxar/Earthstar terms | No | No |
| Place search | Nominatim | `https://nominatim.openstreetmap.org` | OSM data (ODbL); Nominatim usage policy | No | Yes |
| Map rendering | MapLibre GL JS | bundled | BSD-3-Clause | — | — |

---

## 2. LibreWXR (default)

- Project: <https://librewxr.net>
- Repository: <https://github.com/JoshuaKimsey/LibreWXR>
- Public API: <https://api.librewxr.net>
- Server licence: **AGPL-3.0-or-later**
- API data: **CC-BY-4.0** (per the project)
- Requires an API key: **no**

LibreWXR is an open-source, RainViewer-compatible radar tile service. It serves
global radar composites, short-range nowcast frames, NOAA GMGSI satellite
imagery, WMO CAP alerts, and optional server-rendered tile enhancements.

OpenRadar only consumes the HTTP API. It does not link against or embed the
LibreWXR server, so the AGPL does not automatically apply to OpenRadar's source
code. If you modify and redistribute LibreWXR itself, its licence applies to
that server.

### Endpoints used

**Catalog**

```text
GET /public/weather-maps.json
```

Relevant fields:

```jsonc
{
  "version": "2.0",
  "generated": 1700000000,
  "host": "https://api.librewxr.net",
  "radar": {
    "past":    [{ "time": 1699999200, "path": "/v2/radar/1699999200" }],
    "nowcast": [{ "time": 1700000400, "path": "/v2/radar/1700000400" }],
    "colorSchemes": [{ "id": 2, "name": "Universal Blue" }]
  },
  "satellite": {
    "infrared": [{ "time": 1700000000, "path": "/v2/satellite/1700000000" }]
  }
}
```

`host` is authoritative for tile URLs and may differ from the API origin.
`radar.past` is oldest-first; `radar.nowcast` is nearest-future-first in the raw
payload, but OpenRadar sorts everything ascending after normalisation.

**Radar tiles**

```text
GET /v2/radar/{timestamp}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
```

| Parameter | Values | Notes |
| --- | --- | --- |
| `timestamp` | Unix seconds | `0` is a latest-frame alias upstream; OpenRadar always uses explicit timestamps. |
| `size` | `256` (or `512`) | OpenRadar requests 256 px tiles. |
| `color` | `0`–`14`, `255` | Palette list comes from metadata; `255` is raw grayscale. |
| `smooth` | `0` / `1` | Gaussian edge smoothing. |
| `snow` | `0` / `1` | Snow colouring. |
| max zoom | `12` | MapLibre overzooms beyond this. |

**Tile extensions** (LibreWXR only):

```text
?arrows=light|dark
?cells=light|dark
?lightning=dots|bolts
```

These are baked into the PNG by the server and stay aligned with each frame.
`light`/`dark` selects the glyph colour appropriate for the active basemap.
OpenRadar never sends these to RainViewer.

**Satellite tiles**

```text
GET /v2/satellite/{timestamp}/{size}/{z}/{x}/{y}/0/0_0.png
```

- NOAA GMGSI mosaic, hourly cadence, roughly 12 hours of history.
- Max source zoom `6`; MapLibre overzooms.
- Day side shows visible reflectance; night side shows longwave IR cloud tops
  with a transparent background and an automatic terminator.
- Coverage extends to about ±72.7° latitude.

The final path segments (`/0/0_0.png`) are fixed in the current API. Do not
insert `.png` after `{y}` in the template; that produces a malformed path and an
HTTP error.

**Alerts**

```text
GET /v2/alerts?bbox=west,south,east,north&simplify=metres
```

Returns a GeoJSON `FeatureCollection` of active WMO CAP alerts. OpenRadar:

- uses a bbox when zoom ≥ 3 and the view does not cross the antimeridian;
- otherwise requests the global feed with stronger simplification;
- simplifies at 5 km (zoom < 4), 2 km (zoom < 6), or 1 km;
- refreshes after map movement (700 ms debounce) and every five minutes.

The endpoint returns `503` when alerts are disabled server-side. The app treats
that as a layer error, not a fatal app error.

**Future WebSocket**

```text
GET /v2/ws?topics=weather-maps,alerts,lightning,storm-cells
```

Not yet used. See `docs/ARCHITECTURE.md` §11.1. WebSocket handshakes are subject
to `LIBREWXR_CORS_ORIGINS` as well.

### Public instance etiquette

`https://api.librewxr.net` is a shared public instance without an SLA. It is
suitable for development and small-scale use. For anything sustained, self-host
LibreWXR or run a caching proxy. OpenRadar already:

- polls the catalog every 3 minutes by default (configurable up to 10, or off);
- caches tile bytes in a 64 MB LRU;
- preloads at most 32 tiles per frame with concurrency 6;
- refreshes alerts at most every 5 minutes plus debounced map movement.

---

## 3. RainViewer (fallback)

- API docs: <https://www.rainviewer.com/api.html>
- Licence: RainViewer API terms; not an open-data guarantee.
- Capabilities in OpenRadar: radar catalog and tiles only.

RainViewer is RainViewer-compatible with the LibreWXR radar URL shape, so the
same tile builder works. Its current metadata uses an opaque frame key in
`path` (for example `/v2/radar/f91b44fddba5`) rather than the timestamp; OpenRadar
always builds tiles from `frame.path`, so both services work without a
source-specific URL branch. OpenRadar disables alerts, satellite, and the
`arrows`/`cells`/`lightning` query parameters when this source is selected, and
does not append the grayscale pseudo-palette.

Review RainViewer's terms for your intended use, especially for commercial or
high-volume deployments. RainViewer is a hosted service and cannot be
self-hosted.

---

## 4. Base maps

### OpenFreeMap (default vector styles)

- Site: <https://openfreemap.org>
- Styles used: `dark`, `positron`, `liberty`
- Attribution: `OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors`
- Data licence: OpenStreetMap data is **ODbL 1.0**.
- API key: none.

OpenFreeMap is a free, keyless vector-tile service. It is excellent for desktop
and small deployments; for large-scale production, review its capacity guidance
or self-host compatible tiles.

### OpenStreetMap raster fallback

If a vector style fails to load within 12 seconds, OpenRadar switches to the
standard OSM raster tiles:

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Attribution: `© OpenStreetMap contributors` (ODbL). This is a degraded-mode
fallback only; the OSM tile service has a strict usage policy and must not be
used as a production tile CDN.

### Esri World Imagery (optional satellite basemap)

- Service: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- Attribution: `Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community`
- **This is not open data.**

Esri World Imagery is included for situational context because it is widely
available without a key. It is subject to Esri's terms, not an open licence.
Do not describe it as open, do not redistribute the imagery, and review Esri's
terms before commercial use. If you need a fully open satellite basemap,
replace this definition in `src/config/basemaps.ts` (for example with a
self-hosted imagery source or Sentinel-2 mosaic).

---

## 5. Place search (Nominatim)

- Service: <https://nominatim.openstreetmap.org>
- Data: © OpenStreetMap contributors, ODbL.
- Usage policy: <https://operations.osmfoundation.org/policies/nominatim/>

OpenRadar sends:

```text
GET /search?q=<query>&format=jsonv2&limit=6&addressdetails=1&accept-language=en
```

Client-side safeguards:

- queries shorter than 2 characters are not sent;
- 550 ms debounce;
- in-memory cache of 60 query results;
- maximum 6 results per request;
- no autocomplete-style request per keystroke burst.

The public Nominatim instance is intended for light use and requires a valid
identifying Referer/User-Agent (the webview supplies a normal browser identity).
For production, run your own Nominatim instance or proxy requests through your
backend, and add caching/rate limiting there.

Search text is sent to the selected geocoder. Do not type sensitive addresses if
that is a concern. Recent places are stored locally in settings; search results
are otherwise not persisted.

---

## 6. Software licences

| Component | Licence |
| --- | --- |
| OpenRadar source | MIT (see [`LICENSE`](../LICENSE)) |
| Tauri | MIT or Apache-2.0 |
| React / React DOM | MIT |
| Zustand | MIT |
| MapLibre GL JS | BSD-3-Clause |
| Vite | MIT |
| lucide-react | ISC |
| TypeScript | Apache-2.0 |
| LibreWXR server | AGPL-3.0-or-later |

Bundled dependency licence texts remain with their packages. If you distribute
installers, include the usual third-party notices for the Rust and JavaScript
dependencies.

---

## 7. Attribution implementation

Attribution is not optional in OpenRadar, because several sources require it.

1. **Compact bar** (lower-left): `Radar © <source> · Map © OpenStreetMap /
   OpenFreeMap` or `Radar © <source> · Imagery © Esri` on the satellite basemap.
2. **Data popover**: expands to list radar, base map, OSM data (vector styles
   only), place search, and alerts, with links.
3. **About dialog**: full data-source and licence summary.
4. **PNG export**: a translucent footer is drawn onto the canvas with the radar
   and basemap credits plus an `OpenRadar` brand mark.
5. **MapLibre sources**: `attribution` fields are set on raster/GeoJSON sources
   as a second line of defence, even though the built-in attribution control is
   disabled in favour of the custom bar.

If you fork OpenRadar:

- keep the credits and links;
- keep the export footer;
- do not imply endorsement by LibreWXR, OpenFreeMap, OSM, NOAA, or Esri;
- update the attribution if you change the source or basemap.

The app also displays: **“Radar imagery can lag observations and must not be
used for life-safety decisions.”** Keep a similar warning in derivative works.

---

## 8. Privacy and network behaviour

- **No telemetry, analytics, accounts, or cloud sync.** State is local.
- **Direct requests.** The webview contacts the selected radar source, the
  basemap CDN, Esri (if selected), and Nominatim (if searching). Those providers
  see the user's IP address and standard request metadata.
- **Geolocation** is requested only when the user presses the crosshair button.
  The coordinate is used to move the map and place a temporary marker; it is not
  written to settings.
- **Settings** are stored under the app config directory (or localStorage in a
  browser) and are not uploaded.
- **Exports** are written locally.
- **Search queries** go to Nominatim; recent-place names are persisted locally.

If you add a proxy or self-hosted service, update this section and the in-app
About dialog.

---

## 9. Self-hosting checklist

1. Deploy LibreWXR from <https://github.com/JoshuaKimsey/LibreWXR>.
2. Confirm `GET /public/weather-maps.json` returns radar frames and a usable
   `host`.
3. Confirm radar tiles at `/v2/radar/...` and, if desired, satellite and alerts.
4. Set `LIBREWXR_CORS_ORIGINS` to include the app origins if you do not use the
   default `["*"]`:
   - `tauri://localhost` (Linux/macOS webview)
   - `http://tauri.localhost` (Windows webview)
   - `http://localhost:1420` (browser dev)
5. Use HTTPS with a trusted certificate for remote access. The webview rejects
   self-signed certificates.
6. Enable the server features you expect to use (alerts, satellite, lightning,
   storm cells). Missing features are handled gracefully by the UI.
7. In OpenRadar: **Settings → Data source → Self-hosted / custom**, enter the
   URL, and click **Apply & reconnect**.
8. Monitor disk, bandwidth, and upstream radar feeds. Tiles are the dominant
   traffic; the client cache only helps repeat views.

See [`SELF_HOSTING.md`](SELF_HOSTING.md) for Docker/bare-metal deployment,
reverse-proxy examples, capacity guidance, and verification commands.

### CORS and tile failures

If tiles fail but the catalog loads:

- check the `host` field in `weather-maps.json` (it must be reachable from the
  client);
- check the browser/webview console for CORS errors;
- verify the URL has no duplicated `.png` segment;
- confirm the palette and zoom are supported;
- remember that radar has no data outside coverage — transparent/missing tiles
  are normal over oceans and some regions.

---

## 10. Reporting data issues

- Radar/satellite/alert content: contact the upstream provider (LibreWXR or
  RainViewer). OpenRadar only displays their data.
- Basemap labelling or geometry: OpenStreetMap / OpenFreeMap.
- App bugs: open an issue in the OpenRadar repository with the selected source,
  timestamp, view, and console output. Do not include precise personal
  locations unless necessary.
