import type { FeatureCollection } from "geojson";
import { create } from "zustand";

interface AlertsStore {
  status: "idle" | "loading" | "ready" | "error";
  data: FeatureCollection | null;
  error: string | null;
  lastUpdated: number | null;
  count: number;

  begin: () => void;
  succeed: (data: FeatureCollection) => void;
  fail: (message: string) => void;
  clear: () => void;
}

export const useAlertsStore = create<AlertsStore>((set) => ({
  status: "idle",
  data: null,
  error: null,
  lastUpdated: null,
  count: 0,

  begin: () => set({ status: "loading", error: null }),

  succeed: (data) =>
    set({
      status: "ready",
      data,
      error: null,
      lastUpdated: Date.now(),
      count: data.features.length,
    }),

  fail: (message) => set({ status: "error", error: message }),

  clear: () =>
    set({
      status: "idle",
      data: null,
      error: null,
      lastUpdated: null,
      count: 0,
    }),
}));
