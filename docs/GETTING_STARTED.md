# Getting started

This guide takes you from a clean machine to a running OpenRadar desktop app and
a first successful build. For feature-by-feature instructions, continue to the
[user guide](USER_GUIDE.md).

---

## 1. What you need

| Requirement | Version |
| --- | --- |
| Node.js | 22 LTS recommended; Vite 8 needs 20.19+ or 22.12+ |
| npm | Bundled with Node |
| Rust | Stable **1.90+** (`rustup update stable`) |
| Cargo | Installed by rustup |
| Platform webview | WebKitGTK 4.1 (Linux), WebView2 (Windows), WKWebView (macOS) |
| Platform C/C++ toolchain | GCC/Clang (Linux), MSVC Build Tools (Windows), Xcode CLT (macOS) |
| Disk | ~1 GB for Node modules and the Rust target directory |

No API keys, accounts, databases, or cloud services are required. The default
public data source is LibreWXR.

---

## 2. Install the toolchain

### 2.1 Node.js

Install Node 22 LTS from your package manager or <https://nodejs.org>. Confirm:

```bash
node --version    # v22.x or newer
npm --version
```

### 2.2 Rust

Install rustup if you do not have it:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

OpenRadar’s locked Tauri dependency currently requires Rust **1.90 or newer**.
If `cargo` is not found in a new shell, add `$HOME/.cargo/bin` to `PATH` or run
`source "$HOME/.cargo/env"`.

---

## 3. Linux dependencies

Tauri uses WebKitGTK 4.1. The tray feature needs an AppIndicator implementation.
Package names differ slightly by distribution.

### Fedora

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel
sudo dnf group install "c-development"

# Needed for RPM/AppImage packaging
sudo dnf install patchelf rpm-build
```

### Debian / Ubuntu

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Needed for AppImage packaging
sudo apt install patchelf
```

### Arch Linux

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  libappindicator-gtk3 librsvg patchelf
```

### Headless or remote machines

The native app needs a graphical session. For UI work without a desktop, use the
browser build (`npm run dev`) and a browser on your local machine.

Some NVIDIA + WebKitGTK combinations produce a blank map. See
[troubleshooting](TROUBLESHOOTING.md#blank-or-black-map-on-linux).

---

## 4. Windows dependencies

1. Install **Visual Studio Build Tools** with the **Desktop development with
   C++** workload. The MSVC linker and Windows SDK are required.
2. Install Rust with the MSVC toolchain:

   ```powershell
   rustup default stable-x86_64-pc-windows-msvc
   ```

3. Install the **WebView2 Evergreen Runtime** if it is not already present
   (Windows 11 includes it; most current Windows 10 machines do too).
4. Use **Developer PowerShell** for `npm`/`cargo` commands.

No extra C libraries are needed for the tray.

---

## 5. macOS dependencies (untested)

OpenRadar is developed and validated on Linux. macOS should work with Tauri’s
normal prerequisites, but it has not been tested for this release.

```bash
xcode-select --install
rustup default stable
```

---

## 6. Get the source and install packages

From the repository root:

```bash
npm install
```

This installs React, MapLibre GL JS, Zustand, the Tauri CLI, TypeScript, Vite,
and the Lucide icon set. It does not install system libraries.

---

## 7. Run the desktop app

```bash
npm run tauri:dev
```

What happens:

1. Vite starts on `http://localhost:1420` (strict port).
2. Cargo compiles the Rust shell (first run can take several minutes).
3. A native 1280×820 window opens.
4. The app restores settings, fetches the radar catalog, and begins at the
   default view over the contiguous United States.

To stop, close the window or press `Ctrl+C` in the terminal. The tray remains
available while the app is running; **Quit** exits fully.

### Useful variants

```bash
# Compile the native shell without launching it
cargo build --manifest-path src-tauri/Cargo.toml

# Rebuild the production binary without creating installers
PATH="$HOME/.cargo/bin:$PATH" npx tauri build --no-bundle

# Check Rust only
cargo check --manifest-path src-tauri/Cargo.toml
```

`npm run tauri:dev` assumes `cargo` is on `PATH`. If the CLI reports
`failed to run 'cargo metadata'`, run `source "$HOME/.cargo/env"` first.

---

## 8. Run the browser build

For quick UI iteration, or on a machine without the native dependencies:

```bash
npm run dev
# open http://localhost:1420
```

Differences from the desktop app:

| Capability | Desktop (Tauri) | Browser |
| --- | --- | --- |
| Map, radar, alerts, search | Yes | Yes |
| Settings persistence | Native JSON file | `localStorage` |
| PNG export | Saves under `Pictures/OpenRadar` | Normal browser download |
| System tray | Yes | No |
| Native window/fullscreen | Native window | Browser fullscreen API |
| Geolocation | WebView permission | Browser permission |

Both builds use the same data sources and CORS rules.

---

## 9. First launch checklist

1. **Wait for the splash to clear.** The first catalog request usually takes
   under a second; slow networks may take longer.
2. **Check the status pill.** It should read **Live** with an age such as
   `just now`. **Updating** means a refresh is in flight; **Stale** means the
   last refresh failed but old frames are still usable; **Offline** means no
   catalog is available.
3. **Press play** on the timeline. Observed frames animate, then forecast frames
   (dashed track) if the source provides nowcast.
4. **Open Layers** and try a base map, the satellite overlay, and alerts.
5. **Search** for a city, select a result, and confirm the marker appears.
6. **Open Settings** and confirm the effective host and last catalog age.
7. Optional: press `?` to see the in-app shortcuts and licence summary.

Default view: latitude `39.8283`, longitude `-98.5795`, zoom `4.2`.

---

## 10. Build your first package

```bash
npm run typecheck
npm run build
npm run tauri:build
```

Artifacts land under:

```text
src-tauri/target/release/
  openradar                         # Linux/macOS executable
  bundle/
    deb/OpenRadar_0.1.0_amd64.deb
    rpm/OpenRadar-0.1.0-1.x86_64.rpm
    appimage/OpenRadar_0.1.0_amd64.AppImage
```

Windows produces MSI/NSIS installers; macOS produces `.app`/`.dmg`. See
[building](BUILDING.md) for profiles, signing, and release checklists.

---

## 11. Where to go next

- Learn the interface: [User guide](USER_GUIDE.md)
- Change defaults or point at your own server:
  [Configuration](CONFIGURATION.md)
- Run LibreWXR yourself: [Self-hosting](SELF_HOSTING.md)
- Something is broken: [Troubleshooting](TROUBLESHOOTING.md)
- Start hacking: [Development](DEVELOPMENT.md) and
  [Architecture](ARCHITECTURE.md)
