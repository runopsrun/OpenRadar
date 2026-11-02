export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

const MAX_MERCATOR_LAT = 85.05112878;
const WORLD_TILES = 1;

export function clampLatitude(latitude: number): number {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, latitude));
}

export function lonToTileX(longitude: number, zoom: number): number {
  const n = 2 ** zoom;
  return ((longitude + 180) / 360) * n;
}

export function latToTileY(latitude: number, zoom: number): number {
  const n = 2 ** zoom;
  const lat = (clampLatitude(latitude) * Math.PI) / 180;
  return (
    (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n
  );
}

function wrapTileX(x: number, n: number): number {
  return ((x % n) + n) % n;
}

/**
 * Return the visible XYZ tiles at `zoom`, prioritising tiles nearest the
 * viewport centre when the viewport covers more than `limit` tiles. Used only
 * to warm the tile cache; it does not need to be pixel-perfect.
 */
export function visibleTiles(
  bounds: Bounds,
  zoom: number,
  limit = 32,
): TileCoordinate[] {
  const z = Math.max(0, Math.min(18, Math.round(zoom)));
  const n = 2 ** z;

  const south = clampLatitude(bounds.south);
  const north = clampLatitude(bounds.north);
  let west = bounds.west;
  let east = bounds.east;

  // Keep the unwrapped span (MapLibre can return values outside ±180 while
  // panning across the antimeridian).
  if (east < west) east += 360;
  const startX = Math.floor(lonToTileX(west, z));
  const endX = Math.floor(lonToTileX(east, z));
  const startY = Math.max(0, Math.floor(latToTileY(north, z)));
  const endY = Math.min(n - 1, Math.floor(latToTileY(south, z)));

  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const tiles: Array<TileCoordinate & { distance: number }> = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      const wrappedX = wrapTileX(x, n);
      const dx = x - centerX;
      const dy = y - centerY;
      tiles.push({
        z,
        x: wrappedX,
        y,
        distance: dx * dx + dy * dy,
      });
    }
  }

  tiles.sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  const unique: TileCoordinate[] = [];
  for (const tile of tiles) {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ z: tile.z, x: tile.x, y: tile.y });
    if (unique.length >= limit) break;
  }
  return unique;
}

/** Nearest frame to a target timestamp (used to sync satellite with radar). */
export function nearestFrame<T extends { time: number }>(
  frames: readonly T[],
  targetTime: number,
): T | null {
  if (frames.length === 0) return null;
  let best = frames[0] ?? null;
  if (!best) return null;
  let bestDistance = Math.abs(best.time - targetTime);
  for (let i = 1; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame) continue;
    const distance = Math.abs(frame.time - targetTime);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Latest satellite frame at or before `targetTime`; falls back to the nearest
 * frame when the radar timeline starts before the satellite history.
 */
export function satelliteFrameForTime<T extends { time: number }>(
  frames: readonly T[],
  targetTime: number,
): T | null {
  if (frames.length === 0) return null;
  let candidate: T | null = null;
  for (const frame of frames) {
    if (frame.time <= targetTime) {
      if (!candidate || frame.time > candidate.time) candidate = frame;
    }
  }
  return candidate ?? nearestFrame(frames, targetTime);
}

export { WORLD_TILES };
