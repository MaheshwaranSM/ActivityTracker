import { describe, expect, it } from "vitest";
import { parseBackup } from "./backupService";

describe("backupService", () => {
  it("rejects invalid JSON and unsupported versions", () => {
    expect(() => parseBackup("{")).toThrow(/valid JSON/i);
    expect(() => parseBackup(JSON.stringify({ version: 2, activities: [], sessions: [], settings: [] }))).toThrow(/version/i);
  });

  it("rejects sessions that reference missing activities", () => {
    const backup = {
      version: 1,
      exportedAt: "2026-07-31T00:00:00.000Z",
      activities: [],
      sessions: [
        {
          id: "s1",
          activityId: "missing",
          startTime: "2026-07-31T00:00:00.000Z",
          endTime: "2026-07-31T01:00:00.000Z",
          createdAt: "2026-07-31T00:00:00.000Z",
          updatedAt: "2026-07-31T01:00:00.000Z"
        }
      ],
      settings: []
    };

    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/missing activities/i);
  });
});
