import { dataSourceKey, normalizeBaseUrl, type ResolvedDataSource } from "@/config/dataSources";
import {
  FALLBACK_COLOR_SCHEMES,
  GRAYSCALE_SCHEME,
  METADATA_TIMEOUT_MS,
} from "@/config/constants";
import type {
  ColorScheme,
  RadarFrame,
  RadarMetadata,
  RawFrame,
  RawWeatherMaps,
} from "@/types/weather";
import { fetchJson } from "@/utils/fetch";

function normalizePath(path: string | undefined, fallback: string): string {
  const value = (path ?? fallback).trim();
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/+$/, "");
}

function normalizeFrames(
  frames: RawFrame[] | undefined,
  kind: "past" | "nowcast" | "satellite",
): RadarFrame[] {
  if (!Array.isArray(frames)) return [];

  const byTime = new Map<number, RadarFrame>();
  for (const frame of frames) {
    if (
      !frame ||
      typeof frame.time !== "number" ||
      !Number.isFinite(frame.time) ||
      frame.time <= 0
    ) {
      continue;
    }
    const fallback =
      kind === "satellite"
        ? `/v2/satellite/${frame.time}`
        : `/v2/radar/${frame.time}`;
    byTime.set(frame.time, {
      time: frame.time,
      path: normalizePath(frame.path, fallback),
      kind,
    });
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function normalizeColorSchemes(raw: ColorScheme[] | undefined, includeGrayscale: boolean): ColorScheme[] {
  const schemes: ColorScheme[] = [];
  const seen = new Set<number>();
  if (Array.isArray(raw)) {
    for (const scheme of raw) {
      if (
        scheme &&
        typeof scheme.id === "number" &&
        typeof scheme.name === "string" &&
        !seen.has(scheme.id)
      ) {
        seen.add(scheme.id);
        schemes.push({ id: scheme.id, name: scheme.name });
      }
    }
  }

  if (schemes.length === 0) schemes.push(...FALLBACK_COLOR_SCHEMES);
  if (includeGrayscale && !schemes.some((scheme) => scheme.id === GRAYSCALE_SCHEME.id)) {
    schemes.push(GRAYSCALE_SCHEME);
  }
  return schemes;
}

/**
 * Fetch and normalize the LibreWXR/RainViewer weather-maps catalog.
 * The service boundary is deliberately strict: an invalid catalog is an error,
 * rather than a partially working UI.
 */
export async function fetchRadarMetadata(
  source: ResolvedDataSource,
  signal?: AbortSignal,
): Promise<RadarMetadata> {
  if (!source.baseUrl) {
    throw new Error(
      "No valid data source URL is configured. Open Settings to add one.",
    );
  }

  const url = `${source.baseUrl}/public/weather-maps.json`;
  const raw = await fetchJson<RawWeatherMaps>(url, {
    signal,
    timeoutMs: METADATA_TIMEOUT_MS,
  });

  if (!raw || typeof raw !== "object") {
    throw new Error("The data source returned an empty metadata response.");
  }

  const past = normalizeFrames(raw.radar?.past, "past");
  const nowcast = normalizeFrames(raw.radar?.nowcast, "nowcast");
  const frames = [...past, ...nowcast]
    .filter((frame, index, list) => list.findIndex((f) => f.time === frame.time) === index)
    .sort((a, b) => a.time - b.time);

  if (frames.length === 0) {
    throw new Error("The data source did not return any radar frames.");
  }

  const satelliteFrames = normalizeFrames(
    raw.satellite?.infrared,
    "satellite",
  );
  const host =
    normalizeBaseUrl(raw.host ?? source.baseUrl) ?? source.baseUrl;

  return {
    sourceKey: dataSourceKey(source),
    host,
    generated:
      typeof raw.generated === "number" && raw.generated > 0
        ? raw.generated
        : Math.floor(Date.now() / 1000),
    fetchedAt: Date.now(),
    frames,
    satelliteFrames,
    colorSchemes: normalizeColorSchemes(
      raw.radar?.colorSchemes,
      source.id !== "rainviewer",
    ),
  };
}

/** Most recent observed frame — the anchor for relative frame labels. */
export function latestPastFrame(metadata: RadarMetadata): RadarFrame | null {
  for (let i = metadata.frames.length - 1; i >= 0; i -= 1) {
    const frame = metadata.frames[i];
    if (frame?.kind === "past") return frame;
  }
  return null;
}
