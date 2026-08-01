import { db } from "../db";
import { createId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { ActivitySession } from "../types";
import { notifyDataChanged } from "./syncService";

export async function getActiveSession(): Promise<ActivitySession | undefined> {
  const state = await db.appState.get("activeSessionId");
  if (!state?.value) return undefined;
  const session = await db.sessions.get(state.value);
  return session && !session.endTime ? session : undefined;
}

export async function startTimer(activityId: string): Promise<ActivitySession> {
  const activity = await db.activities.get(activityId);
  if (!activity || activity.archivedAt) {
    throw new Error("Only active activities can be started.");
  }

  const timestamp = nowIso();
  let createdSession!: ActivitySession;

  await db.transaction("rw", db.sessions, db.appState, async () => {
    const state = await db.appState.get("activeSessionId");
    if (state?.value) {
      const existing = await db.sessions.get(state.value);
      if (existing && !existing.endTime) {
        await db.sessions.update(existing.id, {
          endTime: timestamp,
          updatedAt: timestamp
        });
      }
    }

    createdSession = {
      id: createId(),
      activityId,
      startTime: timestamp,
      endTime: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await db.sessions.add(createdSession);
    await db.appState.put({ key: "activeSessionId", value: createdSession.id });
  });

  notifyDataChanged();
  return createdSession;
}

export async function stopTimer(): Promise<void> {
  const timestamp = nowIso();

  await db.transaction("rw", db.sessions, db.appState, async () => {
    const state = await db.appState.get("activeSessionId");
    if (!state?.value) return;

    const session = await db.sessions.get(state.value);
    if (session && !session.endTime) {
      await db.sessions.update(session.id, {
        endTime: timestamp,
        updatedAt: timestamp
      });
    }

    await db.appState.put({ key: "activeSessionId", value: null });
  });

  notifyDataChanged();
}

export async function repairTimerState(): Promise<void> {
  await db.transaction("rw", db.sessions, db.appState, async () => {
    const running = await db.sessions.filter((session) => !session.endTime).sortBy("startTime");
    const newest = running.length > 0 ? running[running.length - 1] : undefined;
    const now = nowIso();

    for (const session of running) {
      if (session.id !== newest?.id) {
        await db.sessions.update(session.id, { endTime: now, updatedAt: now });
      }
    }

    await db.appState.put({ key: "activeSessionId", value: newest?.id ?? null });
  });
}
