const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local clock time for a Unix-seconds frame timestamp. */
export function formatClock(unixSeconds: number): string {
  return clockFormatter.format(new Date(unixSeconds * 1000));
}

export function formatFullTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  if (isSameDay(date, now)) return `Today, ${clockFormatter.format(date)}`;
  return fullFormatter.format(date);
}

export function formatDate(unixSeconds: number): string {
  return dateFormatter.format(new Date(unixSeconds * 1000));
}

/**
 * A frame's offset from the newest observed frame (not the wall clock — radar
 * data itself can lag by a few minutes).
 */
export function formatFrameOffset(
  frameTime: number,
  latestPastTime: number | null,
): string {
  if (latestPastTime == null) return formatClock(frameTime);
  const diff = frameTime - latestPastTime;
  if (diff === 0) return "Latest";
  const minutes = Math.round(diff / 60);
  if (diff < 0) {
    const ago = Math.abs(minutes);
    if (ago < 60) return `${ago} min ago`;
    const hours = Math.floor(ago / 60);
    return `${hours} hr ${ago % 60} min ago`;
  }
  if (minutes < 60) return `+${minutes} min forecast`;
  const hours = Math.floor(minutes / 60);
  return `+${hours} hr ${minutes % 60} min forecast`;
}

/** Human-friendly age for a millisecond timestamp. */
export function formatAge(timestampMs: number | null, nowMs = Date.now()): string {
  if (timestampMs == null) return "never";
  const seconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(3)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(3)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

export function parseTimestampToMs(unixSeconds: number): number {
  return unixSeconds * 1000;
}
