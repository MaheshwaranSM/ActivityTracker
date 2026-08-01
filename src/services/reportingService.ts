import { db } from "../db";
import { dayBounds, durationBetween, isValidCompletedSession, localDateKey, MS_PER_DAY } from "../lib/time";
import type { Activity, ActivitySession, DailyTotal } from "../types";

export interface SessionWithActivity extends ActivitySession {
  activity?: Activity;
  durationMs: number;
}

export interface DailyReport {
  date: string;
  totals: DailyTotal[];
  sessions: SessionWithActivity[];
  totalMs: number;
}

export function splitSessionByLocalDay(session: ActivitySession, now = new Date()): DailyTotal[] {
  if (!isValidCompletedSession(session.startTime, session.endTime)) return [];

  const startMs = new Date(session.startTime).getTime();
  const endMs = session.endTime ? new Date(session.endTime).getTime() : now.getTime();
  if (endMs <= startMs) return [];

  const chunks: DailyTotal[] = [];
  let cursor = new Date(startMs);

  while (cursor.getTime() < endMs) {
    const date = localDateKey(cursor);
    const { end } = dayBounds(date);
    const chunkEndMs = Math.min(end.getTime(), endMs);
    chunks.push({
      date,
      activityId: session.activityId,
      durationMs: chunkEndMs - cursor.getTime()
    });
    cursor = new Date(chunkEndMs);
  }

  return chunks;
}

export function aggregateDailyTotals(sessions: ActivitySession[], now = new Date()): DailyTotal[] {
  const totals = new Map<string, DailyTotal>();

  for (const session of sessions) {
    for (const chunk of splitSessionByLocalDay(session, now)) {
      const key = `${chunk.date}:${chunk.activityId}`;
      const existing = totals.get(key);
      totals.set(key, {
        ...chunk,
        durationMs: (existing?.durationMs ?? 0) + chunk.durationMs
      });
    }
  }

  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSessionsOverlappingDay(date: string): Promise<ActivitySession[]> {
  const { start, end } = dayBounds(date);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const candidates = await db.sessions.where("startTime").below(endIso).toArray();
  return candidates.filter((session) => (session.endTime ?? new Date(Date.now() + MS_PER_DAY).toISOString()) > startIso);
}

export async function buildDailyReport(date: string, now = new Date()): Promise<DailyReport> {
  const [activities, sessions] = await Promise.all([db.activities.toArray(), getSessionsOverlappingDay(date)]);
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const totals = aggregateDailyTotals(sessions, now).filter((total) => total.date === date);
  const totalMs = totals.reduce((sum, total) => sum + total.durationMs, 0);

  return {
    date,
    totals,
    totalMs,
    sessions: sessions
      .filter((session) => isValidCompletedSession(session.startTime, session.endTime))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((session) => ({
        ...session,
        activity: activityMap.get(session.activityId),
        durationMs: durationBetween(session.startTime, session.endTime, now)
      }))
  };
}

export async function getAllSessionsForExport(): Promise<ActivitySession[]> {
  return db.sessions.orderBy("startTime").toArray();
}
