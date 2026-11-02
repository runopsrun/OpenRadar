import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  TriangleAlert,
} from "lucide-react";
import { ANIMATION_SPEED_OPTIONS } from "@/config/constants";
import type { TimelineModel } from "@/hooks/useTimeline";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { cx } from "@/utils/cx";
import {
  formatClock,
  formatFrameOffset,
  formatFullTime,
} from "@/utils/time";
import { Chip, SelectField, Spinner } from "@/components/ui";

export function Timeline({ timeline }: { timeline: TimelineModel }) {
  const metadata = useRadarStore((state) => state.metadata);
  const status = useRadarStore((state) => state.status);
  const refreshing = useRadarStore((state) => state.refreshing);
  const requestRefresh = useRadarStore((state) => state.requestRefresh);
  const animationSpeedMs = useSettingsStore((state) => state.animationSpeedMs);
  const loop = useSettingsStore((state) => state.loop);
  const update = useSettingsStore((state) => state.update);

  const { frames, index, currentFrame, latestPast, canPlay, isPlaying } = timeline;
  const count = frames.length;
  const safeIndex = index >= 0 ? index : Math.max(0, count - 1);
  const latestPastIndex = latestPast
    ? frames.findIndex((frame) => frame.time === latestPast.time)
    : -1;
  const nowPct =
    count <= 1
      ? 100
      : latestPastIndex >= 0
        ? (latestPastIndex / (count - 1)) * 100
        : 100;

  const startFrame = frames[0];
  const endFrame = frames[count - 1];
  const offset = currentFrame
    ? formatFrameOffset(currentFrame.time, latestPast?.time ?? null)
    : "No frame selected";
  const speedOptions = ANIMATION_SPEED_OPTIONS.some(
    (option) => option.value === animationSpeedMs,
  )
    ? ANIMATION_SPEED_OPTIONS
    : [
        ...ANIMATION_SPEED_OPTIONS,
        {
          label: `${(animationSpeedMs / 1000).toFixed(2)}s`,
          value: animationSpeedMs,
        },
      ];

  const loading = !metadata && status === "loading";
  const failed = !metadata && status === "error";

  return (
    <section
      className={cx(
        "timeline",
        loading && "timeline--loading",
        failed && "timeline--failed",
      )}
      aria-label="Radar animation timeline"
    >
      <div className="timeline__controls">
        <div className="timeline__transport">
          <button
            type="button"
            className="transport-button"
            onClick={() => timeline.step(-1)}
            disabled={!canPlay || safeIndex === 0}
            title="Previous frame (←)"
            aria-label="Previous frame"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="play-button"
            onClick={timeline.togglePlay}
            disabled={!canPlay || loading || failed}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            aria-label={isPlaying ? "Pause radar animation" : "Play radar animation"}
          >
            {isPlaying ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="transport-button"
            onClick={() => timeline.step(1)}
            disabled={!canPlay || safeIndex >= count - 1}
            title="Next frame (→)"
            aria-label="Next frame"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="timeline__readout">
          {loading ? (
            <>
              <span className="timeline__clock timeline__skeleton" />
              <span className="timeline__offset">Loading radar frames…</span>
            </>
          ) : failed ? (
            <>
              <span className="timeline__clock">
                <TriangleAlert size={14} /> Radar unavailable
              </span>
              <span className="timeline__offset">
                Use Retry or open Settings to change the data source.
              </span>
            </>
          ) : (
            <>
              <span className="timeline__clock" title={currentFrame ? formatFullTime(currentFrame.time) : undefined}>
                {currentFrame ? formatClock(currentFrame.time) : "—"}
                {currentFrame?.kind === "nowcast" && (
                  <Chip tone="warning">forecast</Chip>
                )}
                {isPlaying && <span className="timeline__pulse" aria-hidden="true" />}
              </span>
              <span className="timeline__offset">
                {offset}
                {currentFrame && (
                  <span className="timeline__date">
                    {" "}
                    · {formatFullTime(currentFrame.time)}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        <div className="timeline__tools">
          <SelectField
            className="speed-select"
            value={animationSpeedMs}
            label="Animation speed"
            onChange={(value) => update({ animationSpeedMs: Number(value) })}
          >
            {speedOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <button
            type="button"
            className={cx("tool-button", loop && "is-active")}
            onClick={() => update({ loop: !loop })}
            title="Loop animation (L)"
            aria-label="Loop animation"
            aria-pressed={loop}
          >
            <Repeat size={15} />
          </button>

          <button
            type="button"
            className="tool-button"
            onClick={requestRefresh}
            disabled={refreshing}
            title="Refresh radar data (R)"
            aria-label="Refresh radar data"
          >
            {refreshing ? <Spinner size={15} /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      <div className="timeline__track">
        <div
          className="timeline__segment timeline__segment--past"
          style={{ width: `${nowPct}%` }}
        />
        <div
          className="timeline__segment timeline__segment--forecast"
          style={{ left: `${nowPct}%`, width: `${100 - nowPct}%` }}
        />
        <div className="timeline__ticks" aria-hidden="true">
          {frames.map((frame, frameIndex) => (
            <span
              key={frame.time}
              className={cx(
                "timeline__tick",
                frame.kind === "nowcast" && "timeline__tick--forecast",
                frameIndex === safeIndex && "is-active",
              )}
              style={{
                left: count <= 1 ? "0%" : `${(frameIndex / (count - 1)) * 100}%`,
              }}
            />
          ))}
        </div>
        <input
          className="timeline__range"
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          step={1}
          value={safeIndex}
          disabled={count < 2}
          aria-label="Radar animation frame"
          aria-valuetext={
            currentFrame
              ? `${formatClock(currentFrame.time)}, ${offset}`
              : "No radar frame"
          }
          onChange={(event) => timeline.setFrame(Number(event.target.value))}
        />
        {latestPastIndex >= 0 && count > 1 && (
          <span
            className="timeline__now-marker"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <span>now</span>
          </span>
        )}
      </div>

      <div className="timeline__footer">
        <span>{startFrame ? formatClock(startFrame.time) : "—"}</span>
        <span className="timeline__summary">
          {count > 0
            ? `${count} frame${count === 1 ? "" : "s"} · ${
                frames.some((frame) => frame.kind === "nowcast")
                  ? "observed + nowcast"
                  : "observed"
              }`
            : "Waiting for radar data"}
        </span>
        <span>{endFrame ? formatClock(endFrame.time) : "—"}</span>
      </div>
    </section>
  );
}
