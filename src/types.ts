export type ID = string;

export interface Activity {
  id: ID;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ActivitySession {
  id: ID;
  activityId: ID;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface AppStateRecord {
  key: "activeSessionId";
  value: string | null;
}

export interface DailyTotal {
  date: string;
  activityId: string;
  durationMs: number;
}

export interface BackupFile {
  version: 1;
  exportedAt: string;
  activities: Activity[];
  sessions: ActivitySession[];
  settings: AppSetting[];
}
