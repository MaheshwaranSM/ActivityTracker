import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { createActivity } from "./activityService";
import { startTimer, stopTimer } from "./timerService";

describe("timerService", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps only one active timer and closes the previous session on switch", async () => {
    const coding = await createActivity("Coding");
    const dsa = await createActivity("DSA");

    const first = await startTimer(coding.id);
    const second = await startTimer(dsa.id);

    const firstAfterSwitch = await db.sessions.get(first.id);
    const running = await db.sessions.get(second.id);
    const unfinished = await db.sessions.filter((session) => !session.endTime).toArray();

    expect(firstAfterSwitch?.endTime).toEqual(expect.any(String));
    expect(running?.endTime).toBeNull();
    expect(unfinished).toHaveLength(1);
  });

  it("stops the active session", async () => {
    const coding = await createActivity("Coding");
    const session = await startTimer(coding.id);
    await stopTimer();

    const stopped = await db.sessions.get(session.id);
    const state = await db.appState.get("activeSessionId");

    expect(stopped?.endTime).toEqual(expect.any(String));
    expect(state?.value).toBeNull();
  });
});
