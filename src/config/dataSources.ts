import type { AppSettings, DataSourceId } from "@/types/settings";

export interface ResolvedDataSource {
  id: DataSourceId;
  label: string;
  baseUrl: string;
  /** LibreWXR-specific tile query parameters (/v2/alerts, arrows, cells, lightning). */
  supportsExtensions: boolean;
  supportsAlerts: boolean;
  attributionName: string;
  attributionUrl: string;
}

export interface DataSourcePreset {
  id: DataSourceId;
  label: string;
  shortLabel: string;
  description: string;
  baseUrl: string;
}

export const DATA_SOURCE_PRESETS: DataSourcePreset[] = [
  {
    id: "librewxr",
    label: "LibreWXR (public)",
    shortLabel: "LibreWXR",
    description: "Open-source, RainViewer-compatible API. Recommended.",
    baseUrl: "https://api.librewxr.net",
  },
  {
    id: "rainviewer",
    label: "RainViewer",
    shortLabel: "RainViewer",
    description: "Compatibility fallback. Radar only; no alerts or extensions.",
    baseUrl: "https://api.rainviewer.com",
  },
  {
    id: "custom",
    label: "Self-hosted / custom",
    shortLabel: "Custom",
    description: "A LibreWXR-compatible instance you control.",
    baseUrl: "",
  },
];

/**
 * Accepts `example.com`, `http://localhost:8080`, or a full URL and returns a
 * normalized origin. Returns null for anything that is not an HTTP(S) URL.
 */
export function normalizeBaseUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    // Local development instances are usually plain HTTP. Everything else
    // defaults to HTTPS so credentials/requests are not sent in the clear.
    const isLocal =
      /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(value) ||
      /^10\.\d+\.\d+\.\d+(:\d+)?(\/|$)/.test(value) ||
      /^192\.168\.\d+\.\d+(:\d+)?(\/|$)/.test(value) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?(\/|$)/.test(value);
    value = `${isLocal ? "http" : "https"}://${value}`;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveDataSource(
  settings: Pick<AppSettings, "dataSourceId" | "customHost">,
): ResolvedDataSource {
  if (settings.dataSourceId === "rainviewer") {
    return {
      id: "rainviewer",
      label: "RainViewer",
      baseUrl: "https://api.rainviewer.com",
      supportsExtensions: false,
      supportsAlerts: false,
      attributionName: "RainViewer",
      attributionUrl: "https://www.rainviewer.com/api.html",
    };
  }

  if (settings.dataSourceId === "custom") {
    return {
      id: "custom",
      label: "Self-hosted LibreWXR",
      baseUrl: normalizeBaseUrl(settings.customHost) ?? "",
      supportsExtensions: true,
      supportsAlerts: true,
      attributionName: "LibreWXR (self-hosted)",
      attributionUrl: "https://librewxr.net",
    };
  }

  return {
    id: "librewxr",
    label: "LibreWXR",
    baseUrl: "https://api.librewxr.net",
    supportsExtensions: true,
    supportsAlerts: true,
    attributionName: "LibreWXR",
    attributionUrl: "https://librewxr.net",
  };
}

/** Stable key used to detect when configuration changes require a data reset. */
export function dataSourceKey(source: ResolvedDataSource): string {
  return `${source.id}:${source.baseUrl}`;
}
