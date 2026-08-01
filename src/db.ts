import Dexie, { type Table } from "dexie";
import type { Activity, ActivitySession, AppSetting, AppStateRecord } from "./types";

export class ActivityTrackerDatabase extends Dexie {
  activities!: Table<Activity, string>;
  sessions!: Table<ActivitySession, string>;
  settings!: Table<AppSetting, string>;
  appState!: Table<AppStateRecord, string>;

  constructor(name = "activity-tracker-v1") {
    super(name);
    this.version(1).stores({
      activities: "id, name, normalizedName, archivedAt, createdAt, updatedAt",
      sessions: "id, activityId, startTime, endTime, createdAt, updatedAt, [activityId+startTime]",
      settings: "key",
      appState: "key"
    });
  }
}

export const db = new ActivityTrackerDatabase();

export async function resetDatabase(): Promise<void> {
  await db.transaction("rw", db.activities, db.sessions, db.settings, db.appState, async () => {
    await Promise.all([db.activities.clear(), db.sessions.clear(), db.settings.clear(), db.appState.clear()]);
  });
}
