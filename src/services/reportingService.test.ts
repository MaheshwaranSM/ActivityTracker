import { describe, expect, it } from "vitest";
import type { ActivitySession } from "../types";
import { splitSessionByLocalDay } from "./reportingService";

describe("reportingService", () => {
  it("splits sessions that cross midnight into local day chunks", () => {
    const session: ActivitySession = {
      id: "session-1",
      activityId: "activity-1",
      startTime: new Date(2026, 6, 31, 23, 40).toISOString(),
      endTime: new Date(2026, 7, 1, 0, 30).toISOString(),
      createdAt: new Date(2026, 6, 31, 23, 40).toISOString(),
      updatedAt: new Date(2026, 7, 1, 0, 30).toISOString()
    };

    const chunks = splitSessionByLocalDay(session);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].durationMs).toBe(20 * 60 * 1000);
    expect(chunks[1].durationMs).toBe(30 * 60 * 1000);
  });

  it("does not include invalid negative sessions", () => {
    const session: ActivitySession = {
      id: "session-1",
      activityId: "activity-1",
      startTime: "2026-08-01T10:00:00.000Z",
      endTime: "2026-08-01T09:00:00.000Z",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z"
    };

    expect(splitSessionByLocalDay(session)).toEqual([]);
  });
});
