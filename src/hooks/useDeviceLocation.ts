import { useCallback, useState } from "react";
import { approximateNetworkLocation } from "@/services/approximateLocation";
import { useMapContext } from "@/map/MapContext";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore, toast, type LocalRadarArea } from "@/store/uiStore";

function blockedReason(error: GeolocationPositionError | null): string {
  if (!error) {
    return "This window cannot read device location, so the map is centred on your network area.";
  }
  if (error.code === error.PERMISSION_DENIED) {
    return "Precise location is blocked, so the map is centred on your approximate network location.";
  }
  if (error.code === error.TIMEOUT) {
    return "The precise location request timed out, so the map is centred on your approximate network location.";
  }
  return "Precise location was unavailable, so the map is centred on your approximate network location.";
}

/**
 * Frames a mile-radius radar view and requests a one-shot device location.
 * The radius is the persisted local-radar setting (50 miles by default).
 */
export function useDeviceLocation() {
  const { map, fitToRadius, showMarker, clearMarker } = useMapContext();
  const radiusMiles = useSettingsStore((state) => state.localRadarMiles);
  const setLocalArea = useUiStore((state) => state.setLocalArea);
  const [locating, setLocating] = useState(false);

  const frameLocalRadar = useCallback(
    (
      longitude: number,
      latitude: number,
      miles: number,
      label: string,
    ) => {
      const area: LocalRadarArea = {
        longitude,
        latitude,
        radiusMiles: miles,
        label,
      };
      fitToRadius(longitude, latitude, miles);
      showMarker(longitude, latitude, label);
      setLocalArea(area);
    },
    [fitToRadius, showMarker, setLocalArea],
  );

  const setRadiusMiles = useCallback(
    (miles: number) => {
      useSettingsStore.getState().update({ localRadarMiles: miles });
      const area = useUiStore.getState().localArea;
      if (!area) return;
      fitToRadius(area.longitude, area.latitude, miles);
      setLocalArea({ ...area, radiusMiles: miles });
    },
    [fitToRadius, setLocalArea],
  );

  const clearLocalRadar = useCallback(() => {
    setLocalArea(null);
    clearMarker();
  }, [setLocalArea, clearMarker]);

  const locate = useCallback(() => {
    if (!map) return;

    const frameApproximate = async (error: GeolocationPositionError | null) => {
      try {
        const approx = await approximateNetworkLocation();
        const miles = useSettingsStore.getState().localRadarMiles;
        frameLocalRadar(
          approx.longitude,
          approx.latitude,
          miles,
          approx.label,
        );
        useSettingsStore.getState().update({ locationPromptDismissed: true });
        const where = approx.place ? ` Near ${approx.place}.` : "";
        toast({
          tone: "info",
          title: `${miles}-mile local radar`,
          message: `${blockedReason(error)}${where}`,
        });
      } catch {
        toast({
          tone: "warning",
          title: "Could not find you",
          message:
            "Precise location is blocked, and an approximate network location was unavailable. Search for a city instead.",
        });
      } finally {
        setLocating(false);
      }
    };

    if (!("geolocation" in navigator)) {
      setLocating(true);
      void frameApproximate(null);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { longitude, latitude, accuracy } = position.coords;
        const miles = useSettingsStore.getState().localRadarMiles;
        frameLocalRadar(
          longitude,
          latitude,
          miles,
          `Your location · ±${Math.round(accuracy)} m`,
        );
        useSettingsStore.getState().update({ locationPromptDismissed: true });
        toast({
          tone: "success",
          title: `${miles}-mile local radar`,
          message: `Centred on your location. Accuracy ±${Math.round(accuracy)} m.`,
        });
      },
      (error) => {
        void frameApproximate(error);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [map, frameLocalRadar]);

  return {
    locate,
    locating,
    frameLocalRadar,
    setRadiusMiles,
    clearLocalRadar,
    radiusMiles,
    ready: map != null,
  };
}
