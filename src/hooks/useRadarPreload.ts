import { useCallback, useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  MAX_RADAR_SOURCE_ZOOM,
  MAX_SATELLITE_SOURCE_ZOOM,
  PRELOAD_RADIUS,
  PRELOAD_TILES_PER_FRAME,
} from "@/config/constants";
import {
  enqueuePreload,
  radarProtocolUrlsForTiles,
  satelliteProtocolUrlsForTiles,
  type RadarTileOptions,
} from "@/services/tiles";
import type { RadarFrame } from "@/types/weather";
import { visibleTiles } from "@/utils/geo";

interface PreloadOptions {
  map: MapLibreMap | null;
  enabled: boolean;
  frames: RadarFrame[];
  frameTime: number | null;
  tileOptions: RadarTileOptions;
  satelliteEnabled: boolean;
  satelliteFrameTime: number | null;
}

function mapBounds(map: MapLibreMap) {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

/**
 * Warms the tile cache for the active frame, adjacent frames, and the matching
 * satellite frame. Ordering is intentional: active frame first, then frames
 * ahead of the playhead (the ones the animation will need next).
 */
export function useRadarPreload({
  map,
  enabled,
  frames,
  frameTime,
  tileOptions,
  satelliteEnabled,
  satelliteFrameTime,
}: PreloadOptions): void {
  const run = useCallback(() => {
    if (!map || !enabled || frames.length === 0) return;
    if (document.visibilityState === "hidden") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const radarZoom = Math.min(
      Math.floor(map.getZoom()),
      MAX_RADAR_SOURCE_ZOOM,
    );
    const bounds = mapBounds(map);
    const radarTiles = visibleTiles(bounds, radarZoom, PRELOAD_TILES_PER_FRAME);

    const currentIndex = Math.max(
      0,
      frames.findIndex((frame) => frame.time === frameTime),
    );
    const orderedFrames: RadarFrame[] = [];
    for (let offset = 0; offset <= PRELOAD_RADIUS; offset += 1) {
      const ahead = frames[currentIndex + offset];
      if (ahead) orderedFrames.push(ahead);
      if (offset > 0) {
        const behind = frames[currentIndex - offset];
        if (behind) orderedFrames.push(behind);
      }
    }

    for (const frame of orderedFrames) {
      enqueuePreload(
        radarProtocolUrlsForTiles(
          { ...tileOptions, timestamp: frame.time, path: frame.path },
          radarTiles,
        ),
      );
    }

    if (
      satelliteEnabled &&
      satelliteFrameTime != null &&
      radarTiles.length > 0
    ) {
      const satelliteZoom = Math.min(
        Math.floor(map.getZoom()),
        MAX_SATELLITE_SOURCE_ZOOM,
      );
      const satelliteTiles = visibleTiles(
        bounds,
        satelliteZoom,
        PRELOAD_TILES_PER_FRAME,
      );
      enqueuePreload(
        satelliteProtocolUrlsForTiles(satelliteFrameTime, satelliteTiles),
      );
    }
  }, [
    map,
    enabled,
    frames,
    frameTime,
    tileOptions,
    satelliteEnabled,
    satelliteFrameTime,
  ]);

  // Preload on frame/settings changes.
  useEffect(() => {
    run();
  }, [run]);

  // Preload after the user stops panning/zooming.
  useEffect(() => {
    if (!map) return;
    let timer: number | undefined;
    const schedule = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(run, 350);
    };
    map.on("moveend", schedule);
    return () => {
      map.off("moveend", schedule);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [map, run]);
}
