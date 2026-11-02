import { useEffect, useState } from "react";
import {
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import { useMapContext } from "@/map/MapContext";
import { toast } from "@/store/uiStore";
import { cx } from "@/utils/cx";
import { getErrorMessage } from "@/utils/errors";
import { Spinner } from "@/components/ui";

/**
 * Floating map controls. These are intentionally separate from the MapLibre
 * control widgets so they can be styled consistently with the rest of the app.
 */
export function MapControls() {
  const { map, flyTo, showMarker } = useMapContext();
  const [locating, setLocating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const zoomBy = (delta: number) => {
    if (!map) return;
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: 260,
      essential: true,
    });
  };

  const locate = () => {
    if (!map) return;
    if (!("geolocation" in navigator)) {
      toast({
        tone: "warning",
        title: "Location is not available",
        message: "This browser or webview does not expose the Geolocation API.",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { longitude, latitude, accuracy } = position.coords;
        flyTo(longitude, latitude, Math.max(map.getZoom(), 10));
        showMarker(
          longitude,
          latitude,
          `Your location · ±${Math.round(accuracy)} m`,
        );
        toast({
          tone: "success",
          title: "Centred on your location",
          message: `Accuracy ±${Math.round(accuracy)} m`,
        });
      },
      (error) => {
        setLocating(false);
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Enable it in your system or browser settings."
            : error.code === error.TIMEOUT
              ? "The location request timed out. Try again with a clear view of the sky."
              : "Your location could not be determined right now.";
        toast({ tone: "warning", title: "Could not find you", message });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      toast({
        tone: "warning",
        title: "Fullscreen is unavailable",
        message: getErrorMessage(error, "This window cannot enter fullscreen."),
      });
    }
  };

  return (
    <div className="map-controls" aria-label="Map controls">
      <div className="map-control-group">
        <button
          type="button"
          className="map-control-button"
          onClick={() => zoomBy(1)}
          disabled={!map}
          title="Zoom in (+) — double-click also works"
          aria-label="Zoom in"
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          className="map-control-button"
          onClick={() => zoomBy(-1)}
          disabled={!map}
          title="Zoom out (−)"
          aria-label="Zoom out"
        >
          <Minus size={17} />
        </button>
      </div>

      <div className="map-control-group">
        <button
          type="button"
          className={cx("map-control-button", locating && "is-active")}
          onClick={locate}
          disabled={!map || locating}
          title="Centre on my location"
          aria-label="Centre on my location"
        >
          {locating ? <Spinner size={17} /> : <Crosshair size={17} />}
        </button>
        <button
          type="button"
          className={cx("map-control-button", fullscreen && "is-active")}
          onClick={() => void toggleFullscreen()}
          title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={fullscreen}
        >
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
    </div>
  );
}
