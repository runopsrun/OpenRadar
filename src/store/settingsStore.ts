import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_LOCAL_RADAR_MILES, LOCAL_RADAR_RADIUS_OPTIONS } from "@/config/constants";
import { settingsStorage } from "@/services/storage";
import type {
  AppSettings,
  BaseMapId,
  DataSourceId,
  LightningStyle,
  MapViewState,
  SavedPlace,
  ThemePreference,
} from "@/types/settings";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  baseMapId: "dark",

  dataSourceId: "librewxr",
  customHost: "http://localhost:8080",

  radarEnabled: true,
  satelliteEnabled: false,
  coverageEnabled: false,
  alertsEnabled: false,
  radarOpacity: 0.85,
  satelliteOpacity: 0.6,
  coverageOpacity: 0.5,
  colorScheme: 2,
  smooth: true,
  snow: false,

  lightning: "off",
  stormCells: false,
  motionArrows: false,

  animationSpeedMs: 650,
  loop: true,
  includeNowcast: true,
  autoRefreshMinutes: 3,

  defaultView: {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4.2,
  },
  recentPlaces: [],
  localRadarMiles: DEFAULT_LOCAL_RADAR_MILES,
  locationPromptDismissed: false,
};

interface SettingsStore extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
  setDefaultView: (view: MapViewState) => void;
  addRecentPlace: (place: SavedPlace) => void;
  reset: () => void;
}

const THEMES: ThemePreference[] = ["system", "light", "dark"];
const BASE_MAPS: BaseMapId[] = ["dark", "light", "streets", "satellite"];
const DATA_SOURCES: DataSourceId[] = ["librewxr", "rainviewer", "custom"];
const LIGHTNING: LightningStyle[] = ["off", "dots", "bolts"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validView(value: unknown): MapViewState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const longitude = Number(candidate.longitude);
  const latitude = Number(candidate.latitude);
  const zoom = Number(candidate.zoom);
  if (![longitude, latitude, zoom].every(Number.isFinite)) return null;
  if (longitude < -180 || longitude > 180) return null;
  if (latitude < -85 || latitude > 85) return null;
  return {
    longitude,
    latitude,
    zoom: clamp(zoom, 1, 16),
  };
}

function validRecentPlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return [];
  const places: SavedPlace[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const place = item as Record<string, unknown>;
    if (
      typeof place.id !== "string" ||
      typeof place.name !== "string" ||
      !Number.isFinite(place.latitude) ||
      !Number.isFinite(place.longitude)
    ) {
      continue;
    }
    const saved: SavedPlace = {
      id: place.id,
      name: place.name,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    };
    if (typeof place.localRadar === "boolean") saved.localRadar = place.localRadar;
    places.push(saved);
    if (places.length >= 5) break;
  }
  return places;
}

/**
 * Guard against malformed/older persisted settings without throwing away the
 * rest of the user's preferences.
 */
function sanitizePersisted(value: unknown): Partial<AppSettings> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const out: Partial<AppSettings> = {};

  if (THEMES.includes(raw.theme as ThemePreference)) {
    out.theme = raw.theme as ThemePreference;
  }
  if (BASE_MAPS.includes(raw.baseMapId as BaseMapId)) {
    out.baseMapId = raw.baseMapId as BaseMapId;
  }
  if (DATA_SOURCES.includes(raw.dataSourceId as DataSourceId)) {
    out.dataSourceId = raw.dataSourceId as DataSourceId;
  }
  if (typeof raw.customHost === "string") out.customHost = raw.customHost;

  if (typeof raw.radarEnabled === "boolean") out.radarEnabled = raw.radarEnabled;
  if (typeof raw.satelliteEnabled === "boolean") {
    out.satelliteEnabled = raw.satelliteEnabled;
  }
  if (typeof raw.coverageEnabled === "boolean") {
    out.coverageEnabled = raw.coverageEnabled;
  }
  if (typeof raw.alertsEnabled === "boolean") out.alertsEnabled = raw.alertsEnabled;
  if (typeof raw.radarOpacity === "number") {
    out.radarOpacity = clamp(raw.radarOpacity, 0.1, 1);
  }
  if (typeof raw.satelliteOpacity === "number") {
    out.satelliteOpacity = clamp(raw.satelliteOpacity, 0.1, 1);
  }
  if (typeof raw.coverageOpacity === "number") {
    out.coverageOpacity = clamp(raw.coverageOpacity, 0.1, 1);
  }
  if (typeof raw.colorScheme === "number" && Number.isFinite(raw.colorScheme)) {
    out.colorScheme = Math.round(clamp(raw.colorScheme, 0, 255));
  }
  if (typeof raw.smooth === "boolean") out.smooth = raw.smooth;
  if (typeof raw.snow === "boolean") out.snow = raw.snow;

  if (LIGHTNING.includes(raw.lightning as LightningStyle)) {
    out.lightning = raw.lightning as LightningStyle;
  }
  if (typeof raw.stormCells === "boolean") out.stormCells = raw.stormCells;
  if (typeof raw.motionArrows === "boolean") out.motionArrows = raw.motionArrows;

  if (typeof raw.animationSpeedMs === "number") {
    out.animationSpeedMs = Math.round(clamp(raw.animationSpeedMs, 100, 3_000));
  }
  if (typeof raw.loop === "boolean") out.loop = raw.loop;
  if (typeof raw.includeNowcast === "boolean") {
    out.includeNowcast = raw.includeNowcast;
  }
  if (typeof raw.autoRefreshMinutes === "number") {
    out.autoRefreshMinutes = Math.round(clamp(raw.autoRefreshMinutes, 0, 60));
  }

  const view = validView(raw.defaultView);
  if (view) out.defaultView = view;
  if (Array.isArray(raw.recentPlaces)) {
    out.recentPlaces = validRecentPlaces(raw.recentPlaces);
  }
  if (
    typeof raw.localRadarMiles === "number" &&
    (LOCAL_RADAR_RADIUS_OPTIONS as readonly number[]).includes(raw.localRadarMiles)
  ) {
    out.localRadarMiles = raw.localRadarMiles;
  }
  if (typeof raw.locationPromptDismissed === "boolean") {
    out.locationPromptDismissed = raw.locationPromptDismissed;
  }

  return out;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      update: (patch) => set(patch),

      setDefaultView: (view) => set({ defaultView: view }),

      addRecentPlace: (place) =>
        set((state) => {
          const filtered = state.recentPlaces.filter(
            (existing) => existing.id !== place.id,
          );
          return { recentPlaces: [place, ...filtered].slice(0, 5) };
        }),

      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: "openradar-settings",
      version: 1,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state): AppSettings => ({
        theme: state.theme,
        baseMapId: state.baseMapId,
        dataSourceId: state.dataSourceId,
        customHost: state.customHost,
        radarEnabled: state.radarEnabled,
        satelliteEnabled: state.satelliteEnabled,
        coverageEnabled: state.coverageEnabled,
        alertsEnabled: state.alertsEnabled,
        radarOpacity: state.radarOpacity,
        satelliteOpacity: state.satelliteOpacity,
        coverageOpacity: state.coverageOpacity,
        colorScheme: state.colorScheme,
        smooth: state.smooth,
        snow: state.snow,
        lightning: state.lightning,
        stormCells: state.stormCells,
        motionArrows: state.motionArrows,
        animationSpeedMs: state.animationSpeedMs,
        loop: state.loop,
        includeNowcast: state.includeNowcast,
        autoRefreshMinutes: state.autoRefreshMinutes,
        defaultView: state.defaultView,
        recentPlaces: state.recentPlaces,
        localRadarMiles: state.localRadarMiles,
        locationPromptDismissed: state.locationPromptDismissed,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizePersisted(persisted),
      }),
    },
  ),
);

/** Wait for async storage hydration (Tauri reads a file) before first paint. */
export function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useSettingsStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useSettingsStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);

  return hydrated;
}
