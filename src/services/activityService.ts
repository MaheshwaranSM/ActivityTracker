import { db } from "../db";
import type { Activity } from "../types";
import { createId } from "../lib/ids";
import { normalizeActivityName, nowIso } from "../lib/time";
import { stopTimer } from "./timerService";
import { notifyDataChanged } from "./syncService";

export async function createActivity(rawName: string): Promise<Activity> {
  const name = rawName.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeActivityName(name);
  if (!normalizedName) {
    throw new Error("Activity name cannot be blank.");
  }

  const duplicate = await db.activities.where("normalizedName").equals(normalizedName).filter((a) => !a.archivedAt).first();
  if (duplicate) {
    throw new Error("An active activity with this name already exists.");
  }

  const timestamp = nowIso();
  const activity: Activity = {
    id: createId(),
    name,
    normalizedName,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null
  };

  await db.activities.add(activity);
  notifyDataChanged();
  return activity;
}

export async function renameActivity(activityId: string, rawName: string): Promise<void> {
  const name = rawName.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeActivityName(name);
  if (!normalizedName) {
    throw new Error("Activity name cannot be blank.");
  }

  const duplicate = await db.activities
    .where("normalizedName")
    .equals(normalizedName)
    .filter((a) => !a.archivedAt && a.id !== activityId)
    .first();
  if (duplicate) {
    throw new Error("An active activity with this name already exists.");
  }

  await db.activities.update(activityId, {
    name,
    normalizedName,
    updatedAt: nowIso()
  });
  notifyDataChanged();
}

export async function archiveActivity(activityId: string): Promise<void> {
  const activeState = await db.appState.get("activeSessionId");
  if (activeState?.value) {
    const activeSession = await db.sessions.get(activeState.value);
    if (activeSession?.activityId === activityId && !activeSession.endTime) {
      await stopTimer();
    }
  }

  await db.activities.update(activityId, {
    archivedAt: nowIso(),
    updatedAt: nowIso()
  });
  notifyDataChanged();
}

export async function restoreActivity(activityId: string): Promise<void> {
  const activity = await db.activities.get(activityId);
  if (!activity) throw new Error("Activity was not found.");

  const duplicate = await db.activities
    .where("normalizedName")
    .equals(activity.normalizedName)
    .filter((a) => !a.archivedAt && a.id !== activityId)
    .first();
  if (duplicate) {
    throw new Error("An active activity with this name already exists.");
  }

  await db.activities.update(activityId, {
    archivedAt: null,
    updatedAt: nowIso()
  });
  notifyDataChanged();
}
