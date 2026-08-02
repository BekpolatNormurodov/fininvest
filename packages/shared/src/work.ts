/**
 * Collector work shifts (SP-4) — shared shapes and a browser-free duration helper.
 *
 * A shift is a check-in → check-out with the location at each end and periodic pings in between, so
 * admin/director can see when a collector started and finished and roughly where they were.
 */

export interface WorkSessionDto {
  id: string;
  collectorId: string;
  collectorName: string | null;
  startedAt: string;
  endedAt: string | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  pingCount: number;
  /** Whole minutes; null while the shift is still open. */
  durationMin: number | null;
}

export interface WorkStartInput {
  lat?: number | null;
  lng?: number | null;
}

/** A collector's latest known position while on shift — feeds the admin/director live map. */
export interface LiveLocationDto {
  collectorId: string;
  name: string;
  lat: number;
  lng: number;
  /** When this position was recorded (ISO). */
  at: string;
  /** When the shift started (ISO). */
  since: string;
}

export interface WorkPingInput {
  lat: number;
  lng: number;
}

/** Shift length in whole minutes, or null when it has not ended. */
export function workSessionDuration(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 60000);
}

/** «2 soat 15 daq» / «45 daq» — a duration for display; «—» while open. */
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} soat ${m} daq`;
  if (h) return `${h} soat`;
  return `${m} daq`;
}
