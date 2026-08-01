import { db } from "../db";
import type { Activity, ActivitySession, AppSetting, BackupFile } from "../types";
import { isValidCompletedSession, nowIso } from "../lib/time";
import { notifyDataChanged } from "./syncService";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.normalizedName === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (typeof value.archivedAt === "string" || value.archivedAt === null)
  );
}

function validateSession(value: unknown): value is ActivitySession {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.activityId !== "string" ||
    typeof value.startTime !== "string" ||
    !(typeof value.endTime === "string" || value.endTime === null) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return false;
  }

  return !Number.isNaN(new Date(value.startTime).getTime()) && (!value.endTime || !Number.isNaN(new Date(value.endTime).getTime())) && isValidCompletedSession(value.startTime, value.endTime);
}

function validateSetting(value: unknown): value is AppSetting {
  return isRecord(value) && typeof value.key === "string";
}

export function parseBackup(rawText: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error("Unsupported or missing backup version.");
  }

  if (!Array.isArray(parsed.activities) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.settings)) {
    throw new Error("Backup is missing required data sections.");
  }

  if (!parsed.activities.every(validateActivity) || !parsed.sessions.every(validateSession) || !parsed.settings.every(validateSetting)) {
    throw new Error("Backup contains invalid records.");
  }

  const activityIds = new Set(parsed.activities.map((activity) => activity.id));
  if (!parsed.sessions.every((session) => activityIds.has(session.activityId))) {
    throw new Error("Backup contains sessions for missing activities.");
  }

  return parsed as unknown as BackupFile;
}

export async function exportBackup(): Promise<void> {
  const backup: BackupFile = {
    version: 1,
    exportedAt: nowIso(),
    activities: await db.activities.toArray(),
    sessions: await db.sessions.toArray(),
    settings: await db.settings.toArray()
  };

  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `activity-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`);
}

export async function replaceFromBackup(backup: BackupFile): Promise<void> {
  await db.transaction("rw", db.activities, db.sessions, db.settings, db.appState, async () => {
    await Promise.all([db.activities.clear(), db.sessions.clear(), db.settings.clear(), db.appState.clear()]);
    await db.activities.bulkAdd(backup.activities);
    await db.sessions.bulkAdd(backup.sessions);
    await db.settings.bulkPut(backup.settings);
    const running = backup.sessions.find((session) => !session.endTime);
    await db.appState.put({ key: "activeSessionId", value: running?.id ?? null });
  });
  notifyDataChanged();
}
