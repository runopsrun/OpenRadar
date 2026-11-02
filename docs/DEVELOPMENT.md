# Development guide

How to set up, run, extend, and debug OpenRadar. For installation prerequisites
in more detail, see [Getting started](GETTING_STARTED.md). For release builds,
see [Building](BUILDING.md).

---

## 1. Toolchain

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 LTS (20.19+ or 22.12+ required by Vite 8) | `node --version` |
| npm | Bundled with Node | `npm ci` for clean installs |
| Rust | 1.90+ | Locked Tauri 2.12.5 MSRV |
| Cargo | Installed by rustup | Add `$HOME/.cargo/bin` to `PATH` |
| Platform webview | WebKitGTK 4.1 / WebView2 / WKWebView | See [Getting started](GETTING_STARTED.md) |

No API keys, databases, or environment files are required.

```bash
npm install
npm run tauri:dev
```

If `npm run tauri:dev` cannot find `cargo`:

```bash
source "$HOME/.cargo/env"
npm run tauri:dev
```

---

## 2. Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server at `http://localhost:1420` (strict port). |
| `npm run build` | `tsc` then `vite build` into `dist/`. |
| `npm run preview` | Serve the production `dist/` bundle locally. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run tauri` | Tauri CLI passthrough. |
| `npm run tauri:dev` | Start Vite and the native dev window. |
| `npm run tauri:build` | Production frontend + native binary and bundles. |

Useful direct commands:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tauri build --no-bundle
npx tauri build --bundles deb
```

---

## 3. Repository layout

```text
.
├── index.html                 # Vite entry document
├── package.json               # scripts, JS deps, MIT licence
├── vite.config.ts             # alias, dev server, build targets
├── tsconfig.json              # strict TS, @/* path alias
├── public/                    # static assets (favicon)
├── src/
│   ├── main.tsx               # React mount
│   ├── App.tsx                # shell, hook wiring, layout
│   ├── components/            # UI surfaces and primitives
│   ├── config/                # constants, basemaps, data sources
│   ├── hooks/                 # data lifecycle, playback, theme, events
│   ├── map/                   # MapLibre instance, layers, popups, context
│   ├── services/              # network, storage, tiles, export, geocoding
│   ├── store/                 # Zustand stores
│   ├── styles/                # tokens, base, layout, components, map
│   ├── types/                 # settings and weather contracts
│   └── utils/                 # fetch, errors, geo, time, attribution
├── src-tauri/
│   ├── Cargo.toml             # Rust deps, release profile
│   ├── tauri.conf.json        # window, CSP, bundle metadata
│   ├── capabilities/          # Tauri permissions
│   ├── icons/                 # platform icon set
│   └── src/
│       ├── main.rs
│       └── lib.rs             # commands, tray, atomic writes, PNG export
└── docs/                      # this documentation set
```

Generated directories (`node_modules`, `dist`, `src-tauri/target`, `src-tauri/gen`)
are not source.

---

## 4. How a change flows through the app

A feature usually touches four layers:

```text
config/types  →  service  →  store/hook  →  component/map layer
```

Examples:

- **New setting**: `types/settings.ts` → `settingsStore` defaults/sanitizer →
  component control → docs.
- **New network call**: `services/*.ts` with `fetchJson` + timeout + abort →
  hook that owns lifecycle → store field → component.
- **New overlay**: setting → `map/layers.ts` source/layer pair →
  `MapView` effect guarded by `styleEpoch` → control.
- **New native feature**: `lib.rs` command → `invoke_handler!` → service wrapper
  with browser fallback.

Read [Architecture](ARCHITECTURE.md) for the frame model, tile pipeline, and map
lifecycle before changing data flow. Read [Code reference](CODE_REFERENCE.md) for
module signatures.

---

## 5. Conventions

### TypeScript and React

- Absolute imports use `@/` (configured in `tsconfig.json` and
  `vite.config.ts`). No long `../../` chains.
- `strict`, `noUnusedLocals`, `noUnusedParameters`, and
  `noUncheckedIndexedAccess` are enabled. Indexed access yields `T | undefined`;
  handle it rather than asserting.
- Prefer function components and hooks. Only `ErrorBoundary` is a class.
- Keep network and MapLibre access out of presentational components.
- Store actions are named after intent (`applyMetadata`, `requestRefresh`), not
  generic setters.
- Effects that touch MapLibre start with `if (!map || styleEpoch === 0) return`.
- Every network call accepts an `AbortSignal`, sets a timeout, and maps errors
  through `getErrorMessage`.
- Do not use `innerHTML` for server data. Build DOM nodes or let React escape.
- Keep persisted settings additive and validate them in `sanitizePersisted`.

### Rust

- Commands return `Result<T, String>` with user-readable messages.
- Validate size and content before writing files.
- Use the existing atomic-write helper; do not write settings in place.
- Restrict Unix permissions to `0600` for user data.
- Sanitise any filename that comes from the webview.
- `cargo fmt` and `cargo clippy` should pass before review.

### CSS

- Design tokens live in `src/styles/tokens.css`.
- Component styles live in `components.css`; layout in `layout.css`; map
  chrome in `map.css`.
- Themes are selected with `html[data-theme="light"|"dark"]`.
- Use `color-mix()` and existing tokens rather than hard-coded colours.
- Respect `prefers-reduced-motion`.

### Docs

When behaviour changes, update the closest document (see the maintenance table
in [docs/README.md](README.md)). At minimum, update
[Configuration](CONFIGURATION.md) for settings and [Changelog](CHANGELOG.md) for
user-visible changes.

---

## 6. Common recipes

### Add a setting

1. Add the field to `AppSettings` in `src/types/settings.ts`.
2. Add a default to `DEFAULT_SETTINGS`.
3. Include it in `partialize`.
4. Validate/clamp it in `sanitizePersisted`.
5. Read it with a selector in the component or hook.
6. Update it with `useSettingsStore.getState().update({ ... })`.
7. Document it in [Configuration](CONFIGURATION.md) and [User guide](USER_GUIDE.md).

### Add a data source

1. Extend `DataSourceId` in `types/settings.ts`.
2. Add a preset in `config/dataSources.ts`.
3. Extend `resolveDataSource` with capabilities and attribution.
4. If the payload shape differs, normalise it in `services/metadata.ts` and keep
   `RadarMetadata` unchanged.
5. Add the option to `SettingsPanel`.
6. Update [Data sources](DATA_SOURCES.md) and [Configuration](CONFIGURATION.md).

### Add a base map

Add an entry to `BASE_MAPS` with `id`, `name`, `description`, `style`, `dark`,
attribution, URL, and swatch class. Extend `BaseMapId`. The Layers panel and
attribution bar read from `BASE_MAP_LIST`.

### Add a client-side GeoJSON overlay

1. Add a store or reuse one with `data/status/error`.
2. Add a fetch service with bbox support, timeout, and abort.
3. Add source/layer IDs and a `sync…Layer` function in `map/layers.ts`.
4. Call it from `MapView` in an effect that depends on `styleEpoch`.
5. Add a toggle, loading/error copy, and attribution.
6. Follow `useAlerts` for viewport refresh and popup safety.

### Add a server-rendered tile extra

1. Add a field to `RadarTileOptions` and to `queryParams`/`buildProtocolQuery`.
2. Add a setting and control.
3. Ensure unsupported sources clear the option (see `useRadarMetadata`).
4. Update the tile URL documentation.

### Add a native command

```rust
#[tauri::command]
fn my_command(app: AppHandle) -> Result<String, String> { /* ... */ }
```

Register it in `generate_handler![...]`, then call it from a service:

```ts
if (isTauri) await invoke("my_command");
```

Provide a browser fallback or hide the control when `isTauri` is false.

---

## 7. Debugging

### Frontend

- In the Tauri dev window, open the webview inspector with the platform
  shortcut (often `Ctrl+Shift+I`; on Linux WebKitGTK it may require the
  `devtools` feature, which `tauri dev` enables).
- In the browser build, use normal browser devtools. Network, console, and React
  DevTools all work.
- Useful console checks:

  ```js
  // Current settings (Zustand persist shape is under .state)
  JSON.parse(localStorage.getItem("openradar-settings"))
  ```

- To inspect tile URLs, filter Network by `openradar://` or `/v2/radar/`.
  `openradar://` requests are handled in-process and may appear differently by
  webview.

### Rust

The shell does not install a structured logger, so `RUST_LOG` has no effect.
Add temporary `println!`/`eprintln!` calls; their output appears in the terminal
that launched the app. `cargo check` is much faster than a full build when
iterating on commands. Command errors are returned to the webview as strings and
surfaced through toasts or console warnings.

### Blank map or WebGL issues

Some Linux GPU/driver combinations need:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
```

See [Troubleshooting](TROUBLESHOOTING.md#blank-or-black-map-on-linux).

### Network and CORS

- Test the catalog directly with `curl`.
- Check whether the failure is catalog or tiles; they use different paths and
  different hosts.
- A self-hosted instance must list the webview origins; see
  [Self-hosting § CORS](SELF_HOSTING.md#5-cors-origins).
- Remember that `host` in the catalog overrides the URL you typed.

### Settings not persisting

- Desktop: check `~/.config/com.mumma.openradar/settings.json`.
- Browser: check `localStorage["openradar-settings"]`.
- A native write failure logs a warning and falls back to localStorage; check
  permissions and free space.
- See [Troubleshooting](TROUBLESHOOTING.md#settings-do-not-persist).

### Performance

- The map is the largest bundle. Do not split it without measuring first; it is
  needed for first paint.
- Frame changes call `source.setTiles([...])`; they must not recreate sources.
- Opacity changes use `setPaintProperty`.
- Preloading is capped; raising `PRELOAD_TILES_PER_FRAME` increases bandwidth
  linearly.
- `preserveDrawingBuffer` costs GPU memory because PNG export reads the canvas.
  If you remove export, remove that flag and measure.

---

## 8. Dependency upgrades

### JavaScript

```bash
npm outdated
npm update
npm run typecheck
npm run build
```

Major upgrades to MapLibre, React, Vite, or TypeScript can change APIs or build
output. Test:

- map init and style switching;
- tile protocol and worker URL;
- export;
- strict TypeScript errors.

### Rust

```bash
cd src-tauri
cargo update
cargo check
cargo clippy -- -D warnings
```

Tauri minor upgrades can raise the MSRV. If `rust-version` changes, update
`src-tauri/Cargo.toml`, [Getting started](GETTING_STARTED.md), and
[Building](BUILDING.md).

Commit `package-lock.json` and `Cargo.lock` with dependency changes.

---

## 9. Working with the map

- The map instance lives for the app lifetime. Do not create a second one.
- Base-style changes destroy all sources/layers. Use `styleEpoch` to reattach.
- Insert overlays below the first symbol layer so labels stay on top.
- Radar must sit above satellite; alerts above both.
- Disable rotation and pitch; weather maps are north-up.
- Use `raster-fade-duration: 0` for weather layers to avoid frame ghosting.
- Marker ownership belongs to `MapContext`; do not add ad-hoc markers.

---

## 10. Verification before opening a change

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Then run the app and check the relevant manual cases in
[Testing](TESTING.md). At minimum, verify:

- catalog loads and the status is **Live**;
- playback, pause, stepping, and scrubbing;
- the overlay you changed;
- a base-map switch (sources must reappear);
- a reload (settings persist);
- a narrow window (no clipped controls).

If you change the Rust shell, also build without bundling:

```bash
npx tauri build --no-bundle
```

---

## 11. Where to ask questions

- Behaviour and design: [Architecture](ARCHITECTURE.md) and
  [Code reference](CODE_REFERENCE.md).
- Data contract: [Data sources](DATA_SOURCES.md).
- Packaging: [Building](BUILDING.md).
- Failures: [Troubleshooting](TROUBLESHOOTING.md).
- Contribution process: [Contributing](CONTRIBUTING.md).
