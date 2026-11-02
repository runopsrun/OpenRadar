# OpenRadar documentation

This is the documentation hub for OpenRadar **v0.1.0**. It covers installation,
day-to-day use, every setting, the internal design, data licensing,
self-hosting, development, testing, packaging, security, and troubleshooting.

Start with [Getting started](GETTING_STARTED.md) if you just want the app
running. Use the reading paths below if you are looking for something specific.

---

## Reading paths

### “I want to use OpenRadar”

1. [Getting started](GETTING_STARTED.md) — dependencies, install, first launch.
2. [User guide](USER_GUIDE.md) — every control and feature.
3. [Configuration](CONFIGURATION.md) — defaults, settings files, data sources.
4. [Troubleshooting](TROUBLESHOOTING.md) and [FAQ](FAQ.md) — when something is
   wrong.

### “I want to run my own data service”

1. [Data sources](DATA_SOURCES.md) — what the app expects and how it is licensed.
2. [Self-hosting LibreWXR](SELF_HOSTING.md) — deployment, CORS, TLS, feature
   flags, and verification.
3. [Configuration § Data source](CONFIGURATION.md#22-data-source) — pointing the
   app at your instance.

### “I want to change the code”

1. [Development](DEVELOPMENT.md) — toolchain, commands, layout, conventions.
2. [Architecture](ARCHITECTURE.md) — frame system, tile pipeline, state, map
   lifecycle, extension points.
3. [Code reference](CODE_REFERENCE.md) — module-by-module exports and signatures.
4. [Testing](TESTING.md) — checks and manual regression matrix.
5. [Contributing](CONTRIBUTING.md) — workflow and review expectations.
6. [Building](BUILDING.md) — release builds, bundles, artifacts.

### “I need to operate or audit this”

- [Security and privacy](SECURITY_PRIVACY.md)
- [Data sources and licences](DATA_SOURCES.md)
- [Building](BUILDING.md)
- [Troubleshooting](TROUBLESHOOTING.md)

---

## Document index

| Document | What it answers |
| --- | --- |
| [Getting started](GETTING_STARTED.md) | What do I install, and how do I launch it? |
| [User guide](USER_GUIDE.md) | What does each control do? |
| [Configuration](CONFIGURATION.md) | What are the defaults, ranges, and file locations? |
| [Architecture](ARCHITECTURE.md) | How does the app work internally? |
| [Code reference](CODE_REFERENCE.md) | Which module owns which behaviour? |
| [Data sources](DATA_SOURCES.md) | Where does the data come from and how must it be credited? |
| [Self-hosting](SELF_HOSTING.md) | How do I run LibreWXR for OpenRadar? |
| [Development](DEVELOPMENT.md) | How do I set up, run, and extend the project? |
| [Building](BUILDING.md) | How do I produce and release installers? |
| [Testing](TESTING.md) | How is the app verified? |
| [Security and privacy](SECURITY_PRIVACY.md) | What is trusted, what is local, what leaves the device? |
| [Troubleshooting](TROUBLESHOOTING.md) | Why is the map blank / tiles missing / build failing? |
| [FAQ](FAQ.md) | Short answers to common questions. |
| [Contributing](CONTRIBUTING.md) | How do I submit a useful change? |
| [Roadmap](ROADMAP.md) | What is planned, and what is deliberately out of scope? |
| [Changelog](CHANGELOG.md) | What changed in this release? |

---

## Project at a glance

| Item | Value |
| --- | --- |
| Product name | OpenRadar |
| Version | 0.1.0 |
| Bundle identifier | `com.mumma.openradar` |
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript 6 + Vite 8 |
| Map | MapLibre GL JS 6 |
| State | Zustand 5 |
| Default radar/satellite/alerts source | LibreWXR (`https://api.librewxr.net`) |
| Radar fallback | RainViewer |
| Base maps | OpenFreeMap Dark/Positron/Liberty, Esri World Imagery |
| Geocoding | Nominatim |
| Persistence | Native JSON settings file, `localStorage` in the browser |
| Source licence | MIT (data and services keep their own licences) |
| Primary platform | Linux (Fedora/Ubuntu/Arch); Windows supported; macOS untested |

---

## Documentation conventions

- Commands are shown for a POSIX shell; Windows users should use PowerShell and
  the equivalent paths.
- “Desktop app” means the Tauri build. “Browser build” means `npm run dev` or a
  static deployment of `dist/`.
- Unix timestamps in the API are seconds; client-side “age” values are
  milliseconds.
- File paths use the bundle identifier for the current release. If you change
  `identifier` in `src-tauri/tauri.conf.json`, the settings path changes too.
- Links to source files use repository-relative paths such as
  `src/services/tiles.ts`.

---

## Keeping documentation current

When changing behaviour, update the closest document rather than only the
README:

| Change | Document to update |
| --- | --- |
| New setting or default | [Configuration](CONFIGURATION.md), [User guide](USER_GUIDE.md) |
| New source, endpoint, or licence | [Data sources](DATA_SOURCES.md) |
| Frame/tile/state design | [Architecture](ARCHITECTURE.md) |
| New module or exported API | [Code reference](CODE_REFERENCE.md) |
| Commands, dependencies, packaging | [Getting started](GETTING_STARTED.md), [Development](DEVELOPMENT.md), [Building](BUILDING.md) |
| Security-relevant change | [Security and privacy](SECURITY_PRIVACY.md) |
| User-visible fix/feature | [Changelog](CHANGELOG.md) |
