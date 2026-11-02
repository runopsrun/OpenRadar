import { useEffect, useState } from "react";
import {
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
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
  const { map } = useMapContext();
  const { locate, locating, radiusMiles } = useDeviceLocation();
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
          title={`Centre on my location · ${radiusMiles} mile radar`}
          aria-label={`Centre on my location and show a ${radiusMiles} mile radar area`}
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
