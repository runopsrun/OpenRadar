import { useEffect } from "react";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { RadarFrame } from "@/types/weather";

/**
 * Playback timer. Reads the current frame from the store at each tick instead
 * of closing over it, so scrubbing during playback stays coherent.
 */
export function useAnimation(frames: RadarFrame[]): void {
  const playing = useRadarStore((state) => state.playing);
  const animationSpeedMs = useSettingsStore((state) => state.animationSpeedMs);
  const loop = useSettingsStore((state) => state.loop);

  useEffect(() => {
    if (!playing || frames.length < 2) return;

    let cancelled = false;
    let timer: number | undefined;

    const tick = () => {
      if (cancelled) return;
      const state = useRadarStore.getState();
      const currentIndex = frames.findIndex(
        (frame) => frame.time === state.frameTime,
      );
      const nextIndex = currentIndex + 1;

      if (nextIndex < frames.length) {
        const next = frames[nextIndex];
        if (next) state.setFrameTime(next.time);
        timer = window.setTimeout(tick, animationSpeedMs);
        return;
      }

      if (loop) {
        const first = frames[0];
        if (first) state.setFrameTime(first.time);
        timer = window.setTimeout(tick, animationSpeedMs);
        return;
      }

      state.setPlaying(false);
    };

    timer = window.setTimeout(tick, animationSpeedMs);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [playing, frames, animationSpeedMs, loop]);

  // Stop if the timeline collapses to a single frame.
  useEffect(() => {
    if (playing && frames.length < 2) {
      useRadarStore.getState().setPlaying(false);
    }
  }, [playing, frames.length]);
}
