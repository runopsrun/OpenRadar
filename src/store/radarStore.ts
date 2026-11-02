import { create } from "zustand";
import { latestPastFrame } from "@/services/metadata";
import type { MetadataError, MetadataStatus, RadarMetadata } from "@/types/weather";
import { nearestFrame } from "@/utils/geo";

interface RadarStore {
  metadata: RadarMetadata | null;
  status: MetadataStatus;
  error: MetadataError | null;
  /** Currently displayed frame timestamp (Unix seconds). */
  frameTime: number | null;
  playing: boolean;
  refreshing: boolean;
  /** Increment to ask the metadata hook to fetch immediately. */
  refreshNonce: number;

  beginLoad: () => void;
  applyMetadata: (metadata: RadarMetadata) => void;
  markError: (message: string) => void;
  setFrameTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  requestRefresh: () => void;
  reset: () => void;
}

/**
 * Ephemeral radar catalog + playback state. Persisted preferences live in
 * settingsStore; this store is rebuilt from the network on every launch.
 */
export const useRadarStore = create<RadarStore>((set) => ({
  metadata: null,
  status: "idle",
  error: null,
  frameTime: null,
  playing: false,
  refreshing: false,
  refreshNonce: 0,

  beginLoad: () =>
    set((state) => {
      if (!state.metadata) {
        return { status: "loading" as MetadataStatus, refreshing: false };
      }
      return { refreshing: true, error: null };
    }),

  applyMetadata: (metadata) =>
    set((state) => {
      const sourceChanged =
        state.metadata != null && state.metadata.sourceKey !== metadata.sourceKey;
      const latestObserved = latestPastFrame(metadata);
      const times = metadata.frames.map((frame) => frame.time);

      let nextFrameTime = state.frameTime;
      if (sourceChanged || nextFrameTime == null) {
        nextFrameTime = latestObserved?.time ?? times.at(-1) ?? null;
      } else if (!times.includes(nextFrameTime)) {
        nextFrameTime = nearestFrame(metadata.frames, nextFrameTime)?.time ?? null;
      }

      return {
        metadata,
        status: "ready",
        error: null,
        frameTime: nextFrameTime,
        refreshing: false,
      };
    }),

  markError: (message) =>
    set((state) => {
      if (state.metadata) {
        return {
          refreshing: false,
          error: { message, stale: true },
        };
      }
      return {
        status: "error",
        refreshing: false,
        error: { message, stale: false },
      };
    }),

  setFrameTime: (time) =>
    set((state) => {
      if (!Number.isFinite(time)) return state;
      return { frameTime: time };
    }),

  setPlaying: (playing) => set({ playing }),

  requestRefresh: () =>
    set((state) => ({ refreshNonce: state.refreshNonce + 1 })),

  reset: () =>
    set({
      metadata: null,
      status: "idle",
      error: null,
      frameTime: null,
      playing: false,
      refreshing: false,
    }),
}));
