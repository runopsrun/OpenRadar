import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Marker,
  Popup,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { MapViewState } from "@/types/settings";

interface MapContextValue {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
  flyTo: (longitude: number, latitude: number, zoom?: number) => void;
  showMarker: (longitude: number, latitude: number, label: string) => void;
  clearMarker: () => void;
  getView: () => MapViewState | null;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const setMap = useCallback((nextMap: MapLibreMap | null) => {
    setMapState(nextMap);
  }, []);

  const clearMarker = useCallback(() => {
    markerRef.current?.remove();
    markerRef.current = null;
  }, []);

  const flyTo = useCallback(
    (longitude: number, latitude: number, zoom?: number) => {
      if (!map) return;
      map.flyTo({
        center: [longitude, latitude],
        zoom: zoom ?? Math.max(map.getZoom(), 9),
        duration: 1_100,
        essential: true,
      });
    },
    [map],
  );

  const showMarker = useCallback(
    (longitude: number, latitude: number, label: string) => {
      if (!map) return;
      markerRef.current?.remove();

      const popup = new Popup({
        offset: 24,
        closeButton: false,
        className: "openradar-popup",
      }).setText(label);

      const marker = new Marker({ color: "#38d5ff" })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);

      marker.togglePopup();
      markerRef.current = marker;
    },
    [map],
  );

  const getView = useCallback((): MapViewState | null => {
    if (!map) return null;
    const center = map.getCenter();
    return {
      longitude: center.lng,
      latitude: center.lat,
      zoom: map.getZoom(),
    };
  }, [map]);

  useEffect(() => clearMarker, [clearMarker]);

  const value = useMemo<MapContextValue>(
    () => ({ map, setMap, flyTo, showMarker, clearMarker, getView }),
    [map, setMap, flyTo, showMarker, clearMarker, getView],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext(): MapContextValue {
  const value = useContext(MapContext);
  if (!value) {
    throw new Error("useMapContext must be used inside <MapProvider>.");
  }
  return value;
}
