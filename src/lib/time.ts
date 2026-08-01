export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeActivityName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function formatDuration(durationMs: number): string {
  const safeMs = Math.max(0, durationMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatShortDuration(durationMs: number): string {
  const safeMs = Math.max(0, durationMs);
  const totalMinutes = Math.floor(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayBounds(dateKey: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

export function formatDateLabel(dateKey: string): string {
  const { start } = dayBounds(dateKey);
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(start);
}

export function formatTimeLabel(iso: string | null): string {
  if (!iso) return "Running";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function durationBetween(startIso: string, endIso: string | null, now = new Date()): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now.getTime();
  return Math.max(0, end - start);
}

export function isValidCompletedSession(startIso: string, endIso: string | null): boolean {
  return !endIso || new Date(endIso).getTime() >= new Date(startIso).getTime();
}
