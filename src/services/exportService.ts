import { db } from "../db";
import { formatDuration, formatShortDuration, localDateKey } from "../lib/time";
import { aggregateDailyTotals, getAllSessionsForExport } from "./reportingService";
import type { SheetData } from "write-excel-file/browser";

type SheetRow = SheetData[number];

function headerRow(values: string[]): SheetRow {
  return values.map((value) => ({ value, fontWeight: "bold" }));
}

export async function exportExcel(): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const [activities, sessions] = await Promise.all([db.activities.toArray(), getAllSessionsForExport()]);
  const activityMap = new Map(activities.map((activity) => [activity.id, activity.name]));

  const sessionRows: SheetRow[] = [
    headerRow(["Date", "Activity", "Start Time", "End Time", "Duration", "Duration Hours", "Activity ID", "Session ID"])
  ];

  for (const session of sessions) {
    const end = session.endTime ? new Date(session.endTime) : null;
    const durationMs = end ? end.getTime() - new Date(session.startTime).getTime() : 0;
    sessionRows.push([
      { value: localDateKey(new Date(session.startTime)) },
      { value: activityMap.get(session.activityId) ?? "Unknown activity" },
      { value: new Date(session.startTime) },
      { value: end ?? "Running" },
      { value: durationMs > 0 ? formatDuration(durationMs) : "Running" },
      { value: durationMs > 0 ? durationMs / 3600000 : undefined },
      { value: session.activityId },
      { value: session.id }
    ]);
  }

  const totals = aggregateDailyTotals(sessions);
  const dates = [...new Set(totals.map((total) => total.date))].sort();
  const activeActivityNames = [...new Set(totals.map((total) => activityMap.get(total.activityId) ?? "Unknown activity"))].sort();
  const summaryRows: SheetRow[] = [headerRow(["Date", ...activeActivityNames, "Total", "Total Hours"])];

  for (const date of dates) {
    let totalMs = 0;
    const row: SheetRow = [{ value: date }];

    for (const activityName of activeActivityNames) {
      const durationMs = totals
        .filter((total) => total.date === date && (activityMap.get(total.activityId) ?? "Unknown activity") === activityName)
        .reduce((sum, total) => sum + total.durationMs, 0);
      row.push({ value: formatShortDuration(durationMs) });
      totalMs += durationMs;
    }

    row.push({ value: formatShortDuration(totalMs) }, { value: totalMs / 3600000 });
    summaryRows.push(row);
  }

  const workbook = await writeXlsxFile([
    { sheet: "Sessions", data: sessionRows },
    { sheet: "Daily Summary", data: summaryRows }
  ]);
  await workbook.toFile(`activity-tracker-${localDateKey(new Date())}.xlsx`);
}
