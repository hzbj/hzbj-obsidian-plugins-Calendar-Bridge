// tests/longTaskTimelineDisplay.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/utils/date.ts
function todayString(date = /* @__PURE__ */ new Date()) {
  return toDateString(date);
}
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function monthGridDates(anchorDate, weekStartsOn) {
  const anchor = parseLocalDate(anchorDate);
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const today = todayString();
  return Array.from({ length: 42 }, (_unused, index) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - offset + index);
    const dateString = toDateString(date);
    return {
      date: dateString,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: dateString === today
    };
  });
}
function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

// src/services/LongTaskTimelineDisplay.ts
function buildLongTimelineDisplay(monthDays2, rows, today, pastDaysExpanded) {
  const pastDays = monthDays2.filter((day) => day.date < today);
  const shouldFoldPast = !pastDaysExpanded && pastDays.length > 0;
  if (!shouldFoldPast) {
    return {
      days: monthDays2.map(toDisplayDay),
      rows,
      pastDaysFolded: false,
      pastDayCount: pastDays.length
    };
  }
  const foldedPastDay = buildFoldedPastDay(pastDays);
  const days = [
    foldedPastDay,
    ...monthDays2.filter((day) => day.date >= today).map(toDisplayDay)
  ];
  const indexByDate = new Map(days.map((day, index) => [day.date, index + 1]));
  return {
    days,
    rows: rows.flatMap((row2) => {
      const startDay = row2.visibleStartDate < today ? 1 : indexByDate.get(row2.visibleStartDate);
      const endDay = row2.visibleEndDate < today ? 1 : indexByDate.get(row2.visibleEndDate);
      if (!startDay || !endDay)
        return [];
      return [{
        ...row2,
        startDay,
        endDay,
        // A folded past segment is still part of the task range, but it no longer maps one-to-one to dates.
        isClippedStart: row2.isClippedStart || row2.visibleStartDate < today,
        isClippedEnd: row2.isClippedEnd || row2.visibleEndDate < today
      }];
    }),
    pastDaysFolded: true,
    pastDayCount: pastDays.length
  };
}
function toDisplayDay(day) {
  return {
    date: day.date,
    label: String(day.dayOfMonth),
    dayOfMonth: day.dayOfMonth,
    isToday: day.isToday,
    isFoldedPast: false
  };
}
function buildFoldedPastDay(pastDays) {
  const first = pastDays[0];
  const last = pastDays[pastDays.length - 1];
  const label = first.dayOfMonth === last.dayOfMonth ? String(first.dayOfMonth) : `${first.dayOfMonth}-${last.dayOfMonth}`;
  return {
    date: last.date,
    label,
    dayOfMonth: last.dayOfMonth,
    isToday: false,
    isFoldedPast: true,
    foldedStartDate: first.date,
    foldedEndDate: last.date,
    foldedDayCount: pastDays.length
  };
}

// tests/longTaskTimelineDisplay.test.ts
function monthDays(anchorDate) {
  return monthGridDates(anchorDate, 1).filter((day) => day.inCurrentMonth);
}
function row(id, visibleStartDate, visibleEndDate) {
  return {
    task: { id },
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
(0, import_node_test.test)("folds past days into one long-task timeline row by default", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-06-17"), [
    row("past", "2026-06-01", "2026-06-10"),
    row("spanning", "2026-06-10", "2026-06-20"),
    row("future", "2026-06-20", "2026-06-22")
  ], "2026-06-19", false);
  import_node_assert.strict.equal(display.days[0].isFoldedPast, true);
  import_node_assert.strict.equal(display.days[0].label, "1-18");
  import_node_assert.strict.equal(display.days[1].date, "2026-06-19");
  import_node_assert.strict.equal(display.days.length, 13);
  import_node_assert.strict.deepEqual(display.rows.map((item) => ({
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
(0, import_node_test.test)("keeps full long-task timeline days when past days are expanded", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-06-17"), [
    row("spanning", "2026-06-10", "2026-06-20")
  ], "2026-06-19", true);
  import_node_assert.strict.equal(display.days.some((day) => day.isFoldedPast), false);
  import_node_assert.strict.equal(display.days.length, 30);
  import_node_assert.strict.equal(display.days[0].date, "2026-06-01");
  import_node_assert.strict.equal(display.rows[0].startDay, 10);
  import_node_assert.strict.equal(display.rows[0].endDay, 20);
});
(0, import_node_test.test)("does not fold a future long-task month", () => {
  const display = buildLongTimelineDisplay(monthDays("2026-07-17"), [
    row("future", "2026-07-10", "2026-07-20")
  ], "2026-06-19", false);
  import_node_assert.strict.equal(display.days.some((day) => day.isFoldedPast), false);
  import_node_assert.strict.equal(display.days.length, 31);
  import_node_assert.strict.equal(display.rows[0].startDay, 10);
  import_node_assert.strict.equal(display.rows[0].endDay, 20);
});
