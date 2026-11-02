import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;
const debug = Boolean(process.env.TAURI_ENV_DEBUG);

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development. The fixed port is required by
  // `src-tauri/tauri.conf.json` and `clearScreen` keeps Rust errors visible.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // WebKitGTK (Linux) and WebView2 (Windows) both support this baseline.
    target: "es2021",
    sourcemap: debug,
    minify: debug ? false : true,
    // MapLibre GL is ~1.4 MB minified and is required for the first paint, so
    // splitting it would only add a request. Keep the warning threshold above
    // the map bundle instead of hiding real regressions at the default 500 kB.
    chunkSizeWarningLimit: 1_500,
  },

  envPrefix: ["VITE_", "TAURI_ENV_"],
}));
