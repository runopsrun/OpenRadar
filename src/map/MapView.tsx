import { useEffect, useMemo, useRef, useState } from "react";
import {
  setWorkerUrl,
  Map as MapLibreMap,
  Popup,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { FALLBACK_RASTER_STYLE, getBaseMapStyle, isDarkBaseMap } from "@/config/basemaps";
import { useAlerts } from "@/hooks/useAlerts";
import { useRadarPreload } from "@/hooks/useRadarPreload";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import { useTimeline } from "@/hooks/useTimeline";
import { createAlertPopupContent } from "@/map/alertPopup";
import {
  ALERTS_FILL_LAYER_ID,
  ALERTS_LINE_LAYER_ID,
  setRadarOpacity,
  setSatelliteOpacity,
  syncCoverageLayer,
  syncAlertsLayer,
  syncRadarLayer,
  syncSatelliteLayer,
} from "@/map/layers";
import { useMapContext } from "@/map/MapContext";
import {
  radarProtocolUrlTemplate,
  COVERAGE_PROTOCOL_URL_TEMPLATE,
  satelliteProtocolUrlTemplate,
  type RadarTileOptions,
} from "@/services/tiles";
import { useAlertsStore } from "@/store/alertsStore";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "@/store/uiStore";
import { satelliteFrameForTime } from "@/utils/geo";

// Vite pre-bundles the MapLibre entry point, which breaks the package-relative
// worker URL. Emit the worker as an asset and point MapLibre at it explicitly.
setWorkerUrl(maplibreWorkerUrl);

/**
 * The MapLibre instance and all overlay synchronization live here.
 *
 * Key idea: base-map styles can be swapped at runtime, which destroys every
 * source/layer. `styleEpoch` increments after each `style.load`; the overlay
 * effects depend on it and re-create radar, satellite, and alerts layers on
 * top of the new style. The map object itself is stable for the app lifetime.
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const fallbackUsedRef = useRef(false);
  const styleFallbackTimerRef = useRef<number | undefined>(undefined);
  const previousBaseMapRef = useRef<string>("");

  const [map, setMapInstance] = useState<MapLibreMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const { setMap } = useMapContext();

  const baseMapId = useSettingsStore((state) => state.baseMapId);
  const radarEnabled = useSettingsStore((state) => state.radarEnabled);
  const satelliteEnabled = useSettingsStore((state) => state.satelliteEnabled);
  const coverageEnabled = useSettingsStore((state) => state.coverageEnabled);
  const coverageOpacity = useSettingsStore((state) => state.coverageOpacity);
  const alertsEnabled = useSettingsStore((state) => state.alertsEnabled);
  const radarOpacity = useSettingsStore((state) => state.radarOpacity);
  const satelliteOpacity = useSettingsStore((state) => state.satelliteOpacity);
  const colorScheme = useSettingsStore((state) => state.colorScheme);
  const smooth = useSettingsStore((state) => state.smooth);
  const snow = useSettingsStore((state) => state.snow);
  const lightning = useSettingsStore((state) => state.lightning);
  const stormCells = useSettingsStore((state) => state.stormCells);
  const motionArrows = useSettingsStore((state) => state.motionArrows);

  const source = useResolvedDataSource();
  const metadata = useRadarStore((state) => state.metadata);
  const alertsData = useAlertsStore((state) => state.data);

  const { frames, currentFrame } = useTimeline();

  const tileOptions = useMemo<RadarTileOptions>(() => {
    const arrowColor = isDarkBaseMap(baseMapId) ? "light" : "dark";
    return {
      color: colorScheme,
      smooth,
      snow,
      arrows: source.supportsExtensions && motionArrows ? arrowColor : null,
      cells: source.supportsExtensions && stormCells ? arrowColor : null,
      lightning: source.supportsExtensions ? lightning : "off",
    };
  }, [
    baseMapId,
    colorScheme,
    smooth,
    snow,
    source.supportsExtensions,
    motionArrows,
    stormCells,
    lightning,
  ]);

  const radarTemplate = useMemo(
    () =>
      currentFrame
        ? radarProtocolUrlTemplate({
            ...tileOptions,
            timestamp: currentFrame.time,
            path: currentFrame.path,
          })
        : "",
    [currentFrame, tileOptions],
  );

  const satelliteFrame = useMemo(() => {
    if (!metadata || metadata.satelliteFrames.length === 0) return null;
    const target = currentFrame?.time ?? Date.now() / 1000;
    return satelliteFrameForTime(metadata.satelliteFrames, target);
  }, [metadata, currentFrame?.time]);

  const satelliteTemplate = useMemo(
    () =>
      satelliteFrame
        ? satelliteProtocolUrlTemplate(satelliteFrame.time)
        : "",
    [satelliteFrame],
  );

  useAlerts(map);
  useRadarPreload({
    map,
    enabled: radarEnabled && currentFrame != null,
    frames,
    frameTime: currentFrame?.time ?? null,
    tileOptions,
    satelliteEnabled,
    satelliteFrameTime: satelliteFrame?.time ?? null,
  });

  /* ---------------------------------------------------------------- map init */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const settings = useSettingsStore.getState();
    previousBaseMapRef.current = settings.baseMapId;
    styleLoadedRef.current = false;
    fallbackUsedRef.current = false;

    const instance = new MapLibreMap({
      container,
      style: getBaseMapStyle(settings.baseMapId),
      center: [settings.defaultView.longitude, settings.defaultView.latitude],
      zoom: settings.defaultView.zoom,
      minZoom: 1,
      maxZoom: 16,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      fadeDuration: 150,
      canvasContextAttributes: {
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      },
    });
    mapRef.current = instance;

    // Weather maps are conventionally north-up.
    instance.touchZoomRotate.disableRotation();

    const clearFallbackTimer = () => {
      if (styleFallbackTimerRef.current != null) {
        window.clearTimeout(styleFallbackTimerRef.current);
        styleFallbackTimerRef.current = undefined;
      }
    };

    const useFallbackStyle = () => {
      if (fallbackUsedRef.current) return;
      fallbackUsedRef.current = true;
      clearFallbackTimer();
      toast({
        tone: "warning",
        title: "Base map unavailable",
        message: "Switched to the OpenStreetMap raster fallback.",
      });
      instance.setStyle(FALLBACK_RASTER_STYLE);
    };

    const armStyleFallback = () => {
      clearFallbackTimer();
      styleFallbackTimerRef.current = window.setTimeout(() => {
        if (!styleLoadedRef.current) useFallbackStyle();
      }, 12_000);
    };
    // Exposed to the base-map style-switch effect below.
    styleFallbackArmRef.current = armStyleFallback;

    instance.on("style.load", () => {
      styleLoadedRef.current = true;
      clearFallbackTimer();
      setStyleEpoch((epoch) => epoch + 1);
    });

    instance.on("load", () => {
      setMapInstance(instance);
      setMap(instance);
    });

    let tileErrorShown = false;
    instance.on("error", (event) => {
      const sourceId = (event as unknown as { sourceId?: string }).sourceId;
      if (sourceId) {
        if (!tileErrorShown) {
          tileErrorShown = true;
          toast({
            tone: "warning",
            title: "Some map tiles could not load",
            message: "Pan or zoom to retry. Radar data may still be available.",
          });
        }
        return;
      }
      // Style parse/load errors are handled by the fallback timer; log the
      // details for debugging instead of showing a noisy toast.
      console.warn("MapLibre error:", event.error?.message ?? event);
    });

    armStyleFallback();

    return () => {
      clearFallbackTimer();
      styleFallbackArmRef.current = () => {};
      setMap(null);
      setMapInstance(null);
      mapRef.current = null;
      instance.remove();
    };
  }, [setMap]);

  const styleFallbackArmRef = useRef<() => void>(() => {});

  /* ------------------------------------------------------- base style switch */
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;
    if (previousBaseMapRef.current === baseMapId) return;

    previousBaseMapRef.current = baseMapId;
    styleLoadedRef.current = false;
    fallbackUsedRef.current = false;
    instance.setStyle(getBaseMapStyle(baseMapId));
    styleFallbackArmRef.current();
  }, [baseMapId]);

  /* ---------------------------------------------------------- radar overlay */
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    syncRadarLayer(map, {
      enabled: radarEnabled,
      timestamp: currentFrame?.time ?? null,
      tileUrlTemplate: radarTemplate,
      opacity: useSettingsStore.getState().radarOpacity,
    });
  }, [map, styleEpoch, radarEnabled, currentFrame?.time, radarTemplate]);

  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    setRadarOpacity(map, radarOpacity);
  }, [map, styleEpoch, radarOpacity, radarEnabled]);

  /* ------------------------------------------------------ satellite overlay */
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    syncSatelliteLayer(map, {
      enabled: satelliteEnabled,
      timestamp: satelliteFrame?.time ?? null,
      tileUrlTemplate: satelliteTemplate,
      opacity: useSettingsStore.getState().satelliteOpacity,
    });
  }, [map, styleEpoch, satelliteEnabled, satelliteFrame?.time, satelliteTemplate]);

  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    setSatelliteOpacity(map, satelliteOpacity);
  }, [map, styleEpoch, satelliteOpacity, satelliteEnabled]);

  /* ------------------------------------------------------ coverage overlay */
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    syncCoverageLayer(map, {
      enabled: coverageEnabled,
      tileUrlTemplate: COVERAGE_PROTOCOL_URL_TEMPLATE,
      opacity: coverageOpacity,
    });
  }, [map, styleEpoch, coverageEnabled, coverageOpacity]);

  /* ----------------------------------------------------------- alert layer */
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    syncAlertsLayer(map, { enabled: alertsEnabled, data: alertsData });
  }, [map, styleEpoch, alertsEnabled, alertsData]);

  useEffect(() => {
    if (!map || styleEpoch === 0 || !alertsEnabled || !alertsData) return;
    if (!map.getLayer(ALERTS_FILL_LAYER_ID)) return;

    const popup = new Popup({
      maxWidth: "340px",
      className: "openradar-popup",
      closeButton: true,
    });

    const onClick = (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [ALERTS_FILL_LAYER_ID, ALERTS_LINE_LAYER_ID].filter((id) =>
          Boolean(map.getLayer(id)),
        ),
      });
      const feature = features[0] as MapGeoJSONFeature | undefined;
      if (!feature) {
        popup.remove();
        return;
      }
      popup
        .setLngLat(event.lngLat)
        .setDOMContent(createAlertPopupContent(feature))
        .addTo(map);
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", onClick);
    map.on("mouseenter", ALERTS_FILL_LAYER_ID, onEnter);
    map.on("mouseleave", ALERTS_FILL_LAYER_ID, onLeave);

    return () => {
      map.off("click", onClick);
      map.off("mouseenter", ALERTS_FILL_LAYER_ID, onEnter);
      map.off("mouseleave", ALERTS_FILL_LAYER_ID, onLeave);
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
  }, [map, styleEpoch, alertsEnabled, alertsData]);

  return (
    <div
      ref={containerRef}
      className="map-view"
      role="application"
      aria-label="Interactive weather radar map"
    />
  );
}
