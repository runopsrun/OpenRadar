import { invoke } from "@tauri-apps/api/core";
import type { StateStorage } from "zustand/middleware";

export const SETTINGS_STORAGE_KEY = "openradar-settings";

/** Tauri injects this object into the webview before any app script runs. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let pendingValue: string | null = null;
let flushTimer: number | null = null;

async function writeThrough(value: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke("save_settings", { contents: value });
      return;
    } catch (error) {
      // If the native file cannot be written, localStorage still keeps the app
      // usable. Log rather than interrupting the user mid-interaction.
      console.warn("Native settings write failed; using localStorage.", error);
    }
  }
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, value);
  } catch (error) {
    console.warn("Could not persist settings.", error);
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const value = pendingValue;
    pendingValue = null;
    if (value != null) void writeThrough(value);
  }, 250);
}

export function flushSettings(): void {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingValue != null) {
    const value = pendingValue;
    pendingValue = null;
    void writeThrough(value);
  }
}

async function readThrough(): Promise<string | null> {
  if (isTauri) {
    try {
      const contents = await invoke<string | null>("load_settings");
      if (contents != null) return contents;
    } catch (error) {
      console.warn("Native settings read failed; checking localStorage.", error);
    }
  }
  try {
    return localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Zustand storage adapter. In Tauri, settings live in a JSON file managed by
 * Rust (app config dir). In the browser, localStorage is used instead.
 * Writes are debounced so dragging an opacity slider does not hammer the disk.
 */
export const settingsStorage: StateStorage = {
  getItem: async () => readThrough(),
  setItem: (_name, value) => {
    pendingValue = value;
    scheduleFlush();
    return Promise.resolve();
  },
  removeItem: async () => {
    pendingValue = null;
    if (flushTimer != null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (isTauri) {
      try {
        await invoke("save_settings", { contents: "{}" });
      } catch {
        /* handled by localStorage below */
      }
    }
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

if (typeof window !== "undefined") {
  // Best-effort final flush when the webview is closed/navigated away.
  window.addEventListener("pagehide", flushSettings);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSettings();
  });
}
