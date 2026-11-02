import { useCallback, useEffect, useMemo } from "react";
import { latestPastFrame } from "@/services/metadata";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { RadarFrame } from "@/types/weather";

export interface TimelineModel {
  frames: RadarFrame[];
  index: number;
  currentFrame: RadarFrame | null;
  latestPast: RadarFrame | null;
  canPlay: boolean;
  isPlaying: boolean;
  setFrame: (index: number) => void;
  step: (delta: number) => void;
  togglePlay: () => void;
  pause: () => void;
}

/**
 * Derives the visible timeline (past + optional nowcast) from the catalog and
 * exposes playback controls. Frame identity is the timestamp, so a metadata
 * refresh can add/remove frames without invalidating the user's position.
 */
export function useTimeline(): TimelineModel {
  const metadata = useRadarStore((state) => state.metadata);
  const frameTime = useRadarStore((state) => state.frameTime);
  const playing = useRadarStore((state) => state.playing);
  const includeNowcast = useSettingsStore((state) => state.includeNowcast);
  const setFrameTime = useRadarStore((state) => state.setFrameTime);
  const setPlaying = useRadarStore((state) => state.setPlaying);

  const frames = useMemo<RadarFrame[]>(() => {
    if (!metadata) return [];
    return metadata.frames.filter(
      (frame) =>
        frame.kind === "past" || (includeNowcast && frame.kind === "nowcast"),
    );
  }, [metadata, includeNowcast]);

  const latestPast = useMemo(
    () => (metadata ? latestPastFrame(metadata) : null),
    [metadata],
  );

  const index = useMemo(() => {
    if (frameTime == null) return -1;
    return frames.findIndex((frame) => frame.time === frameTime);
  }, [frames, frameTime]);

  const currentFrame = index >= 0 ? (frames[index] ?? null) : null;

  // Repair the selection when the timeline changes underneath it (e.g. the
  // user toggles nowcast off while a forecast frame is active).
  useEffect(() => {
    if (frames.length === 0) return;
    if (frameTime != null && frames.some((frame) => frame.time === frameTime)) {
      return;
    }
    const fallback = frames.at(-1);
    if (fallback) setFrameTime(fallback.time);
  }, [frames, frameTime, setFrameTime]);

  const setFrame = useCallback(
    (nextIndex: number) => {
      if (frames.length === 0) return;
      const clamped = Math.max(0, Math.min(frames.length - 1, nextIndex));
      const frame = frames[clamped];
      if (!frame) return;
      setPlaying(false);
      setFrameTime(frame.time);
    },
    [frames, setFrameTime, setPlaying],
  );

  const step = useCallback(
    (delta: number) => {
      const base = index >= 0 ? index : frames.length - 1;
      setFrame(base + delta);
    },
    [index, frames.length, setFrame],
  );

  const pause = useCallback(() => setPlaying(false), [setPlaying]);

  const togglePlay = useCallback(() => {
    if (frames.length < 2) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    // Restart from the beginning when the user presses play on the last frame.
    if (index === frames.length - 1) {
      const first = frames[0];
      if (first) setFrameTime(first.time);
    }
    setPlaying(true);
  }, [frames, index, playing, setFrameTime, setPlaying]);

  return {
    frames,
    index,
    currentFrame,
    latestPast,
    canPlay: frames.length > 1,
    isPlaying: playing,
    setFrame,
    step,
    togglePlay,
    pause,
  };
}
