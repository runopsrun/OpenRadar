import { useEffect } from "react";
import { useRadarStore } from "@/store/radarStore";
import { isTauri } from "@/services/storage";

/** Reacts to native tray/menu actions emitted by the Rust backend. */
export function useTauriEvents(): void {
  useEffect(() => {
    if (!isTauri) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("openradar:refresh", () => {
          useRadarStore.getState().requestRefresh();
        }),
      )
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((error) => {
        console.warn("Could not subscribe to native events.", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
