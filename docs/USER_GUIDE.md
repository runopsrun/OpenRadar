# User guide

This is the complete tour of the OpenRadar interface. For installation, see
[Getting started](GETTING_STARTED.md); for every setting and default, see
[Configuration](CONFIGURATION.md).

---

## 1. Interface at a glance

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Logo   [Live · just now]   [ Search a city or place… ]  Layers  …    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                              MAP                                     │
│                 radar / satellite / alerts / marker                  │
│                                                                      │
│  [+ −]                                                    [Data]     │
│  [◎ ⛶]                                                              │
│                                                                      │
│        ┌────────────────────────────────────────────────────┐        │
│        │  ‹  ▶  ›     7:30 AM         Slow  Loop  Refresh  │        │
│        │  Latest · Today, 7:30 AM                    forecast│        │
│        │  ────────●─────────────────────────────── NOW ────│        │
│        │  5:40 AM          18 frames · observed + nowcast   │        │
│        └────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

The map is the full-window surface. The side panel overlays the right side on
desktop and becomes a full-width sheet on narrow windows.

---

## 2. Top bar

### Logo

The OpenRadar mark and wordmark identify the app. It is not a button.

### Status pill

The pill reports the catalog state and can be clicked to refresh immediately.

| State | Meaning |
| --- | --- |
| **Loading** | No catalog yet; the initial request is in flight. Shown as a spinner. |
| **Updating** | A refresh is in flight while old frames remain usable. Shown as a spinner and a tooltip; playback continues. |
| **Live** | Catalog is fresh and the last request succeeded. |
| **Stale** | The last refresh failed, but frames from an earlier catalog are still displayed. |
| **Offline** | No catalog has loaded; the map and search may still work. |

The age after the label (`just now`, `2m ago`, `1h ago`) is the time since the
client fetched the catalog, not the age of the newest radar frame.

### Search

See [§7 Search and location](#7-search-and-location).

### Layers

Opens the **Layers & overlays** panel. The button is highlighted while the
panel is open. The panel title bar also has tabs for **Layers** and **Settings**.

### Settings

Opens the **Settings** panel. The button is highlighted while the panel is open.

### Theme

Toggles between light and dark UI chrome. This does not change the base map:
the base map is selected separately in Layers. The choice is persisted.

### Export

Captures the current map canvas to a PNG with an attribution footer. See
[§9 Export](#9-export).

---

## 3. The map

OpenRadar uses MapLibre GL JS with a north-up, rotation-disabled projection.

- **Pan** by dragging.
- **Zoom** with the scroll wheel, pinch gesture, double-click, or the `+`/`−`
  buttons.
- **Zoom range:** 1–16. Radar tiles stop at source zoom 12 and satellite tiles
  at 6; MapLibre overzooms the last available level beyond that.
- **Rotation and pitch are disabled** because weather maps are conventionally
  north-up and 2D.
- **Fullscreen** is available from the lower-right map controls.
- **Markers** are temporary; selecting another place replaces the marker.

### Base maps

| Base map | Character | Attribution |
| --- | --- | --- |
| **Dark** | Dark vector map designed for radar contrast (default). | OpenFreeMap / OpenStreetMap |
| **Light** | Clean Positron-style vector map. | OpenFreeMap / OpenStreetMap |
| **Streets** | Full-colour Liberty-style vector map. | OpenFreeMap / OpenStreetMap |
| **Satellite** | Esri World Imagery raster. | Esri / Maxar / Earthstar — **not open data** |

The base map is independent of the UI theme. A light interface with the Dark
base map is a valid and common combination for radar readability.

If a remote vector style cannot load within 12 seconds, OpenRadar switches once
to an OpenStreetMap raster fallback and shows a warning toast.

### Map controls

| Control | Action |
| --- | --- |
| `+` | Zoom in |
| `−` | Zoom out |
| Crosshair | Request a one-shot high-accuracy location and centre the map there |
| Fullscreen | Enter or exit fullscreen |

Geolocation is requested only when you press the crosshair. The coordinate is
used for the map and a temporary marker; it is not written to settings.

---

## 4. Timeline and playback

The timeline is the primary control surface.

### Transport

| Control | Behaviour |
| --- | --- |
| **‹ Previous** | Step one frame back. Disabled on the first frame. |
| **Play / Pause** | Start or stop the animation. Disabled when fewer than two frames are visible. |
| **› Next** | Step one frame forward. Disabled on the last frame. |

Pressing play while on the last frame restarts from the oldest frame. Scrubbing
or stepping pauses playback.

### Readout

- **Clock** — local time of the selected frame.
- **forecast** chip — shown when the selected frame is a nowcast frame.
- **Offset** — difference from the newest observed frame, for example
  `Latest`, `20 min ago`, or `+30 min forecast`. This is relative to the radar
  catalog, not the wall clock, because radar data itself can lag.
- **Date/time line** — full local date and time for the selected frame.

### Track

- Blue solid segment — observed frames.
- Dashed amber segment — forecast/nowcast frames.
- `NOW` marker — boundary between the latest observation and forecast.
- Ticks — one per frame; the active tick is highlighted.
- Range input — drag or use arrow keys to scrub.

The footer shows the first frame time, frame count and composition
(`observed + nowcast` or `observed`), and the last frame time.

### Tools

- **Speed** — Slow (1.10 s), Normal (0.65 s), Fast (0.35 s), Very fast (0.20 s).
- **Loop** — when on, the animation wraps from the last frame to the first.
- **Refresh** — fetch the catalog immediately.

### Nowcast

If **Include nowcast** is enabled in Settings, forecast frames after the latest
observation are added to the timeline. Disable it to show observations only.
Selection is repaired automatically if the active forecast frame disappears
when the filter changes.

---

## 5. Layers panel

Open with the **Layers** button.

### Radar

Enabled by default. While enabled:

- **Colour scheme** — populated from the server’s metadata. The default is
  Universal Blue (id 2). LibreWXR currently advertises 15 schemes plus raw
  grayscale; RainViewer uses its compatible fallback list.
- **Radar opacity** — 15 %–100 %, default 85 %.
- **Smoothing** — server-side Gaussian edge smoothing, default on.
- **Snow mask** — server-side snow colouring, default off.

Satellite sits beneath radar so precipitation remains readable.

### Satellite

Hourly NOAA GMGSI imagery served through LibreWXR. It is automatically matched
to the active radar time (latest satellite frame at or before the radar frame).

- **Opacity** — 15 %–100 %, default 60 %.
- Disabled when the current source provides no satellite frames.
- Source zoom is 6; the map overzooms above that.

### Weather alerts

WMO CAP alerts as a GeoJSON overlay. The row shows the number of active alerts
in the current view.

- Fill opacity is low (17 %) with severity-coloured outlines.
- Click a polygon to open a popup containing severity, expiry, title, regions,
  issue time, description, and an official link when the alert provides an
  `http(s)` URI.
- Alerts refresh after map movement (700 ms debounce) and every five minutes.
- Only available on LibreWXR sources. The toggle is disabled on RainViewer.
- A server with alerts disabled returns HTTP 503; the app reports the layer
  error without breaking the map.

Alerts are informational, can lag, and may be incomplete. Always consult the
issuing agency for official warnings.

### LibreWXR extras

These are rendered by the server into each radar tile, so they stay aligned with
the frame:

| Extra | Options | Notes |
| --- | --- | --- |
| **Storm motion arrows** | Off / on | Optical-flow direction and speed. Colour adapts to the basemap. |
| **Storm cells** | Off / on | Detected convective cells and motion. Colour adapts to the basemap. |
| **Lightning glyphs** | Off / dots / bolts | Strikes for each frame’s time window. |

All three are disabled on RainViewer and cleared automatically when switching to
a source that does not support them.

### Base map

Four options with visual swatches. The active option is outlined. See
[§3 Base maps](#base-maps).

---

## 6. Settings panel

### Appearance

- **Theme:** System / Light / Dark. System follows the OS and reacts to live
  changes.
- Note: the base map has its own selector in Layers.

### Data source

| Option | Description |
| --- | --- |
| **LibreWXR (public)** | Recommended default; radar, nowcast, satellite, alerts, extras. |
| **RainViewer** | Compatibility fallback; radar only, no alerts/extras. |
| **Self-hosted / custom** | A LibreWXR-compatible instance you control. |

When **Self-hosted / custom** is selected, enter an instance URL and click
**Apply & reconnect**. `localhost`, `127.0.0.1`, and private IPv4 ranges default
to `http://` when the scheme is omitted; public hostnames default to `https://`.
Invalid URLs are rejected before any request is made.

The panel also shows:

- **Effective host** — the tile host advertised by the catalog.
- **Last catalog** — age and frame count.
- **Connection error** — the reason the current source failed, if any.
- **Refresh now**.

Switching sources resets the catalog, clears the tile cache, and disables
features the new source does not support.

See [Self-hosting](SELF_HOSTING.md) for server requirements.

### Animation

- **Frame duration** — 0.20–1.50 s, default 0.65 s.
- **Loop animation** — wrap to the first frame, default on.
- **Include nowcast** — show forecast frames, default on.
- **Auto-refresh catalog** — every 1, 3, 5, or 10 minutes, or off. Default 3.

Playback continues during background refreshes. If a refresh removes the active
frame, the app selects the nearest remaining frame.

### Default location

- Shows the saved latitude/longitude and zoom.
- **Use current view** — save the map’s current centre and zoom as the startup
  view.
- **Go to default** — move the map to the saved view now.

The default view is only changed explicitly; panning the map does not silently
overwrite it.

### Reset and About

- **Reset all settings** — confirmation dialog, then restore every default.
- **About OpenRadar & data licenses** — opens the data-source, licence, and
  shortcut dialog.
- Version label.

---

## 7. Search and location

### Place search

Type at least two characters. Requests are debounced by 550 ms, cached for the
session (60 queries), and limited to six results. Results come from Nominatim.

- Selecting a result flies to a zoom appropriate to the place type:
  country 4, boundary 8, city/town 10, address/building 15, other 12.
- A marker with the display name is placed at the result.
- The place is added to **Recent places** (maximum five).
- Empty results show “No places found.”; network failures show an inline error.

The search box footer credits Nominatim and OpenStreetMap.

### Recent places

Focus the empty search box to see recent places. Selecting one flies to zoom 10
and restores the marker. Recent places are persisted in settings.

### Geolocation

The crosshair control:

- asks for high accuracy with a 12 s timeout and a 60 s maximum cache age;
- flies to the coordinate at the greater of the current zoom and 10;
- places a marker labelled with the accuracy radius;
- shows a success toast, or a specific message for permission denial, timeout,
  or unavailable location.

Location is not persisted.

---

## 8. Theme

Light and dark themes affect the app chrome, panels, timeline, dialogs, and
toasts. The map style is independent. The theme preference is persisted; the
default is **System**.

Press `T` or use the sun/moon button to toggle. Toggling from System writes an
explicit Light or Dark preference.

---

## 9. Export

The download button in the top bar:

1. waits for the map to finish rendering (or 1.5 s);
2. copies the WebGL canvas at device resolution;
3. draws a translucent attribution footer with radar and base-map credits plus
   an OpenRadar mark;
4. writes a PNG.

- **Desktop:** saved as
  `Pictures/OpenRadar/openradar-YYYYMMDD-HHMMSS.png`. If Pictures is unavailable,
  the app falls back to Downloads or the home directory. A success toast shows
  the absolute path.
- **Browser:** normal file download with the same filename.
- Export failures (empty canvas, permission problem, oversized image) produce an
  error toast.

Export captures what is currently visible, including overlays and attribution.
It does not include the side panel, timeline, or toasts.

---

## 10. System tray

The tray menu contains:

- **Show OpenRadar** — show, unminimize, and focus the window.
- **Refresh radar data** — request an immediate catalog refresh.
- **Quit** — exit the app.

Closing the last window exits the app. The tray menu is available while the app
runs. On Linux, tray visibility depends on an AppIndicator-compatible desktop;
see [troubleshooting](TROUBLESHOOTING.md#tray-icon-missing-on-linux).

---

## 11. Status, loading, and error states

| Situation | What you see |
| --- | --- |
| Settings hydration | Full splash: “Restoring your settings…” |
| Initial catalog load | Overlay splash with a loading message. |
| Initial load failure | Full error card with **Try again**, **Data source settings**, and the current source/URL. |
| Later refresh failure | **Stale** status pill plus a non-blocking “Live updates paused” banner with **Retry**. Old frames remain playable. |
| Tile failure | One warning toast per session: “Some map tiles could not load.” |
| Base style failure | One warning toast and the OSM raster fallback. |
| Alerts failure | Inline description in the alert row; radar continues. |
| Render crash | Error boundary card with **Reload OpenRadar** and **Try to continue**. |

Toasts are limited to three visible at a time. Informational toasts last 5.5 s;
errors last 9 s. They can be dismissed manually.

---

## 12. Attribution

The lower-left **Data** control expands a panel listing:

- radar source and capabilities;
- base map and its attribution;
- OpenStreetMap data (vector styles only);
- Nominatim for search;
- WMO CAP when alerts are enabled.

A compact line is always visible. The About dialog repeats the full list, and
exported images bake in the credits. Do not remove attribution in derivative
works; see [data sources](DATA_SOURCES.md).

A persistent warning notes that radar imagery can lag and must not be used for
life-safety decisions.

---

## 13. Responsive layout and accessibility

- The side panel overlays the map on desktop and becomes full-width at 520 px.
- Top-bar actions and the timeline hide secondary labels on narrow screens.
- The timeline summary and full date are hidden on very narrow windows.
- Panels scroll independently; the map remains behind them.
- Controls have accessible names, toggles expose checked state, the timeline
  range has an `aria-valuetext`, panels are landmarks, and the About dialog uses
  `role="dialog"` with `aria-modal`.
- Reduced-motion preferences disable non-essential animations.

Keyboard shortcuts are listed below and in the About dialog.

---

## 14. Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Step one frame |
| `R` | Refresh catalog |
| `L` | Toggle loop |
| `T` | Toggle UI theme |
| `/` | Focus search |
| `?` | Open About/shortcuts |
| `Esc` | Close panel, dialog, or search dropdown |

Shortcuts do not fire while typing in an input, textarea, select, or
content-editable element. A focused button keeps its native Space/Enter
behaviour.

---

## 15. Data limitations

- Radar and nowcast are composites, not official warnings.
- The public LibreWXR instance has no SLA.
- Radar source resolution ends at zoom 12; satellite at 6.
- RainViewer mode has no alerts, satellite, or extras.
- Alert coverage and timeliness depend on upstream CAP feeds.
- Esri World Imagery is **not open data** and is subject to Esri’s terms.
- OpenRadar does not replace official weather services. Do not use it for
  life-safety decisions.
