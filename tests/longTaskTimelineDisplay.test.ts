import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { LongTaskTimelineRow } from "../src/models/types";
import { monthGridDates } from "../src/utils/date";
import { buildLongTimelineDisplay } from "../src/services/LongTaskTimelineDisplay";

function monthDays(anchorDate: string) {
  return monthGridDates(anchorDate, 1).filter((day) => day.inCurrentMonth);
}

function row(id: string, visibleStartDate: string, visibleEndDate: string): LongTaskTimelineRow {
  return {
    task: { id } as any,
    childTasks: [],
    fullStartDate: visibleStartDate,
    fullEndDate: visibleEndDate,
    visibleStartDate,
    visibleEndDate,
    startDay: Number.parseInt(visibleStartDate.slice(8, 10), 10),
    endDay: Number.parseInt(visibleEndDate.slice(8, 10), 10),
    isClippedStart: false,
    isClippedEnd: false,
    daysLeft: 0,
    progressPercent: 0,
    status: "on-track"
  };
}

test("folds past days into one long-task timeline row by default", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-06-17"), [
    row("past", "2026-06-01", "2026-06-10"),
    row("spanning", "2026-06-10", "2026-06-20"),
    row("future", "2026-06-20", "2026-06-22")
  ], "2026-06-19", false);

  assert.equal(display.days[0].isFoldedPast, true);
  assert.equal(display.days[0].label, "1-18");
  assert.equal(display.days[1].date, "2026-06-19");
  assert.equal(display.days.length, 13);
  assert.deepEqual(display.rows.map((item) => ({
    id: item.task.id,
    startDay: item.startDay,
    endDay: item.endDay,
    clippedStart: item.isClippedStart,
    clippedEnd: item.isClippedEnd
  })), [
    { id: "past", startDay: 1, endDay: 1, clippedStart: true, clippedEnd: true },
    { id: "spanning", startDay: 1, endDay: 3, clippedStart: true, clippedEnd: false },
    { id: "future", startDay: 3, endDay: 5, clippedStart: false, clippedEnd: false }
  ]);
});

test("keeps full long-task timeline days when past days are expanded", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-06-17"), [
    row("spanning", "2026-06-10", "2026-06-20")
  ], "2026-06-19", true);

  assert.equal(display.days.some((day) => day.isFoldedPast), false);
  assert.equal(display.days.length, 30);
  assert.equal(display.days[0].date, "2026-06-01");
  assert.equal(display.rows[0].startDay, 10);
  assert.equal(display.rows[0].endDay, 20);
});

test("does not fold a future long-task month", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-07-17"), [
    row("future", "2026-07-10", "2026-07-20")
  ], "2026-06-19", false);

  assert.equal(display.days.some((day) => day.isFoldedPast), false);
  assert.equal(display.days.length, 31);
  assert.equal(display.rows[0].startDay, 10);
  assert.equal(display.rows[0].endDay, 20);
});
