import { db } from "../db";

export interface StorageSummary {
  activityCount: number;
  sessionCount: number;
  usageText: string;
  quotaText: string;
  persisted: boolean | null;
}

function formatBytes(value?: number): string {
  if (!value && value !== 0) return "Unavailable";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const [activityCount, sessionCount] = await Promise.all([db.activities.count(), db.sessions.count()]);
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;

  return {
    activityCount,
    sessionCount,
    usageText: formatBytes(estimate.usage),
    quotaText: formatBytes(estimate.quota),
    persisted
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
