import type { StyleSpecification } from "maplibre-gl";
import type { BaseMapId } from "@/types/settings";

export interface BaseMapDefinition {
  id: BaseMapId;
  name: string;
  description: string;
  /** Vector style URL, or an inline raster StyleSpecification. */
  style: string | StyleSpecification;
  /** Whether labels/map detail are dark (used to pick arrow colors). */
  dark: boolean;
  attribution: string;
  attributionUrl: string;
  swatchClass: string;
}

/**
 * Base map options. OpenFreeMap serves free, keyless vector tiles and styles.
 * The satellite option uses Esri World Imagery, which is free for many
 * non-commercial uses but is NOT open data — see README and docs/DATA_SOURCES.md.
 */
export const BASE_MAPS: Record<BaseMapId, BaseMapDefinition> = {
  dark: {
    id: "dark",
    name: "Dark",
    description: "Designed for radar contrast",
    style: "https://tiles.openfreemap.org/styles/dark",
    dark: true,
    attribution: "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors",
    attributionUrl: "https://openfreemap.org",
    swatchClass: "swatch--dark",
  },
  light: {
    id: "light",
    name: "Light",
    description: "Clean daylight basemap",
    style: "https://tiles.openfreemap.org/styles/positron",
    dark: false,
    attribution: "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors",
    attributionUrl: "https://openfreemap.org",
    swatchClass: "swatch--light",
  },
  streets: {
    id: "streets",
    name: "Streets",
    description: "Full-colour street detail",
    style: "https://tiles.openfreemap.org/styles/liberty",
    dark: false,
    attribution: "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors",
    attributionUrl: "https://openfreemap.org",
    swatchClass: "swatch--streets",
  },
  satellite: {
    id: "satellite",
    name: "Satellite",
    description: "Esri World Imagery",
    style: {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution:
            "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        },
      },
      layers: [
        {
          id: "esri-satellite",
          type: "raster",
          source: "esri-satellite",
          paint: { "raster-fade-duration": 200 },
        },
      ],
    },
    dark: true,
    attribution:
      "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    attributionUrl: "https://www.esri.com/en-us/arcgis/products/arcgis-online",
    swatchClass: "swatch--satellite",
  },
};

export const BASE_MAP_LIST = Object.values(BASE_MAPS);

/**
 * Minimal OSM raster style used only if a remote vector style fails to load.
 * It keeps the application useful on a degraded connection.
 */
export const FALLBACK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-raster",
      type: "raster",
      source: "osm",
      paint: { "raster-fade-duration": 200 },
    },
  ],
};

export function getBaseMapStyle(id: BaseMapId): string | StyleSpecification {
  return BASE_MAPS[id].style;
}

export function isDarkBaseMap(id: BaseMapId): boolean {
  return BASE_MAPS[id].dark;
}
