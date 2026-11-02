import type {
  FillLayerSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  LineLayerSpecification,
  Map as MapLibreMap,
  RasterLayerSpecification,
  RasterTileSource,
  StyleSpecification,
} from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapViewState } from "@/types/settings";

export const RADAR_SOURCE_ID = "openradar-radar";
export const RADAR_LAYER_ID = "openradar-radar-layer";
export const SATELLITE_SOURCE_ID = "openradar-satellite";
export const SATELLITE_LAYER_ID = "openradar-satellite-layer";
export const COVERAGE_SOURCE_ID = "openradar-coverage";
export const COVERAGE_LAYER_ID = "openradar-coverage-layer";
export const ALERTS_SOURCE_ID = "openradar-alerts";
export const ALERTS_FILL_LAYER_ID = "openradar-alerts-fill";
export const ALERTS_LINE_LAYER_ID = "openradar-alerts-line";

const ALERT_SEVERITY_EXPRESSION: ExpressionSpecification = [
  "match",
  ["get", "severity"],
  "Extreme",
  "#ff4d4f",
  "Severe",
  "#ff9f0a",
  "Moderate",
  "#ffd60a",
  "Minor",
  "#30d158",
  "#94a3b8",
];

/** Insert overlays below the basemap's label layers when possible. */
export function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  let style: StyleSpecification;
  try {
    style = map.getStyle();
  } catch {
    return undefined;
  }
  for (const layer of style.layers ?? []) {
    if (layer.type === "symbol") return layer.id;
  }
  return undefined;
}

export function enforceOverlayOrder(map: MapLibreMap): void {
  const before = firstSymbolLayerId(map);
  if (!before) return;
  // Bottom-to-top order. Each moveLayer goes immediately below labels.
  for (const id of [
    SATELLITE_LAYER_ID,
    COVERAGE_LAYER_ID,
    RADAR_LAYER_ID,
    ALERTS_FILL_LAYER_ID,
    ALERTS_LINE_LAYER_ID,
  ]) {
    if (map.getLayer(id)) map.moveLayer(id, before);
  }
}

function removeLayerAndSource(
  map: MapLibreMap,
  layerId: string,
  sourceId: string,
): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export interface RadarLayerInput {
  enabled: boolean;
  timestamp: number | null;
  tileUrlTemplate: string;
  opacity: number;
}

export function syncRadarLayer(map: MapLibreMap, input: RadarLayerInput): void {
  if (!input.enabled || input.timestamp == null) {
    removeLayerAndSource(map, RADAR_LAYER_ID, RADAR_SOURCE_ID);
    return;
  }

  let source = map.getSource(RADAR_SOURCE_ID) as RasterTileSource | undefined;
  if (!source) {
    map.addSource(RADAR_SOURCE_ID, {
      type: "raster",
      tiles: [input.tileUrlTemplate],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
      attribution: "Radar data © LibreWXR",
    });
  } else {
    source.setTiles([input.tileUrlTemplate]);
  }

  if (!map.getLayer(RADAR_LAYER_ID)) {
    const layer: RasterLayerSpecification = {
      id: RADAR_LAYER_ID,
      type: "raster",
      source: RADAR_SOURCE_ID,
      paint: {
        "raster-opacity": input.opacity,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    };
    map.addLayer(layer, firstSymbolLayerId(map));
  } else {
    map.setPaintProperty(RADAR_LAYER_ID, "raster-opacity", input.opacity);
  }

  enforceOverlayOrder(map);
}

export interface SatelliteLayerInput {
  enabled: boolean;
  timestamp: number | null;
  tileUrlTemplate: string;
  opacity: number;
}

export function syncSatelliteLayer(
  map: MapLibreMap,
  input: SatelliteLayerInput,
): void {
  if (!input.enabled || input.timestamp == null) {
    removeLayerAndSource(map, SATELLITE_LAYER_ID, SATELLITE_SOURCE_ID);
    return;
  }

  let source = map.getSource(SATELLITE_SOURCE_ID) as RasterTileSource | undefined;
  if (!source) {
    map.addSource(SATELLITE_SOURCE_ID, {
      type: "raster",
      tiles: [input.tileUrlTemplate],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 6,
      attribution: "Satellite imagery © NOAA GMGSI / LibreWXR",
    });
  } else {
    source.setTiles([input.tileUrlTemplate]);
  }

  if (!map.getLayer(SATELLITE_LAYER_ID)) {
    const layer: RasterLayerSpecification = {
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      paint: {
        "raster-opacity": input.opacity,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    };
    map.addLayer(layer, firstSymbolLayerId(map));
  } else {
    map.setPaintProperty(SATELLITE_LAYER_ID, "raster-opacity", input.opacity);
  }

  enforceOverlayOrder(map);
}

export interface CoverageLayerInput {
  enabled: boolean;
  tileUrlTemplate: string;
  opacity: number;
}

export function syncCoverageLayer(
  map: MapLibreMap,
  input: CoverageLayerInput,
): void {
  if (!input.enabled) {
    removeLayerAndSource(map, COVERAGE_LAYER_ID, COVERAGE_SOURCE_ID);
    return;
  }

  if (!map.getSource(COVERAGE_SOURCE_ID)) {
    map.addSource(COVERAGE_SOURCE_ID, {
      type: "raster",
      tiles: [input.tileUrlTemplate],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
      attribution: "Radar coverage © LibreWXR",
    });
  }

  if (!map.getLayer(COVERAGE_LAYER_ID)) {
    const layer: RasterLayerSpecification = {
      id: COVERAGE_LAYER_ID,
      type: "raster",
      source: COVERAGE_SOURCE_ID,
      paint: {
        "raster-opacity": input.opacity,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    };
    map.addLayer(layer, firstSymbolLayerId(map));
  } else {
    map.setPaintProperty(COVERAGE_LAYER_ID, "raster-opacity", input.opacity);
  }

  enforceOverlayOrder(map);
}

export function setRadarOpacity(map: MapLibreMap, opacity: number): void {
  if (map.getLayer(RADAR_LAYER_ID)) {
    map.setPaintProperty(RADAR_LAYER_ID, "raster-opacity", opacity);
  }
}

export function setSatelliteOpacity(map: MapLibreMap, opacity: number): void {
  if (map.getLayer(SATELLITE_LAYER_ID)) {
    map.setPaintProperty(SATELLITE_LAYER_ID, "raster-opacity", opacity);
  }
}

export interface AlertsLayerInput {
  enabled: boolean;
  data: FeatureCollection | null;
}

export function syncAlertsLayer(map: MapLibreMap, input: AlertsLayerInput): void {
  if (!input.enabled || !input.data) {
    if (map.getLayer(ALERTS_FILL_LAYER_ID)) map.removeLayer(ALERTS_FILL_LAYER_ID);
    if (map.getLayer(ALERTS_LINE_LAYER_ID)) map.removeLayer(ALERTS_LINE_LAYER_ID);
    if (map.getSource(ALERTS_SOURCE_ID)) map.removeSource(ALERTS_SOURCE_ID);
    return;
  }

  const source = map.getSource(ALERTS_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    map.addSource(ALERTS_SOURCE_ID, {
      type: "geojson",
      data: input.data,
      attribution: "Weather alerts © WMO CAP via LibreWXR",
    });
  } else {
    source.setData(input.data);
  }

  const before = firstSymbolLayerId(map);

  if (!map.getLayer(ALERTS_FILL_LAYER_ID)) {
    const fill: FillLayerSpecification = {
      id: ALERTS_FILL_LAYER_ID,
      type: "fill",
      source: ALERTS_SOURCE_ID,
      paint: {
        "fill-color": ALERT_SEVERITY_EXPRESSION,
        "fill-opacity": 0.17,
      },
    };
    map.addLayer(fill, before);
  }

  if (!map.getLayer(ALERTS_LINE_LAYER_ID)) {
    const line: LineLayerSpecification = {
      id: ALERTS_LINE_LAYER_ID,
      type: "line",
      source: ALERTS_SOURCE_ID,
      paint: {
        "line-color": ALERT_SEVERITY_EXPRESSION,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 9, 1.6],
        "line-opacity": 0.9,
      },
    };
    map.addLayer(line, before);
  }

  enforceOverlayOrder(map);
}

export function currentView(map: MapLibreMap): MapViewState {
  const center = map.getCenter();
  return {
    longitude: center.lng,
    latitude: center.lat,
    zoom: map.getZoom(),
  };
}
