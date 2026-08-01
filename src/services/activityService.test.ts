import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "../db";
import { archiveActivity, createActivity, renameActivity, restoreActivity } from "./activityService";

describe("activityService", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("trims names and prevents duplicate active names case-insensitively", async () => {
    const created = await createActivity("  Coding  ");
    expect(created.name).toBe("Coding");

    await expect(createActivity("coding")).rejects.toThrow(/already exists/i);
  });

  it("keeps archived activities restorable while preventing active name conflicts", async () => {
    const first = await createActivity("Reading");
    await archiveActivity(first.id);
    const second = await createActivity("reading");

    await expect(restoreActivity(first.id)).rejects.toThrow(/already exists/i);
    await renameActivity(second.id, "Books");
    await restoreActivity(first.id);

    const restored = await db.activities.get(first.id);
    expect(restored?.archivedAt).toBeNull();
  });
});
