import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildMonthViewModel, buildWeekViewModel } from "../src/services/CalendarViewModel";
import type { CalendarTask, ReviewPressureByDate } from "../src/models/types";

const tasks: CalendarTask[] = [
  task("a", "Unscheduled"),
  task("b", "Monday", { scheduled: "2024-01-15" }, { estimateMinutes: 45 }),
  task("c", "Span", { start: "2024-01-16", scheduled: "2024-01-18" }, { estimateMinutes: 90 }),
  task("d", "Done", { scheduled: "2024-01-15" }, { completed: true, estimateMinutes: 60 }),
  task("e", "Due fallback", { due: "2024-01-17" }),
  task("f", "Inbox path", {}, { filePath: "收集/代办/Inbox.md" }),
  task("g", "Recurring unscheduled", {}, { recurrence: "every week" }),
  task("h", "Recurring overdue", { start: "2024-01-10" }, { recurrence: "every week" }),
  task("i", "Scheduled overdue after baseline", { scheduled: "2026-06-16" })
];

const reviewPressure: ReviewPressureByDate = {
  "2024-01-15": { count: 2, minutes: 11, chars: 5600 },
  "2024-01-18": { count: 1, minutes: 4, chars: 1200 }
};

test("builds a 42-cell month heatmap model with scheduled load and review pressure", () => {
  const model = buildMonthViewModel("2024-01-16", tasks, 1, reviewPressure, 30);
  assert.equal(model.days.length, 42);
  assert.equal(model.days[0].date, "2024-01-01");
  assert.equal(model.unscheduledTasks.map((item) => item.id).join(","), "a,e,f");
  assert.equal(model.dayLoads["2024-01-15"].taskCount, 1);
  assert.equal(model.dayLoads["2024-01-15"].taskMinutes, 45);
  assert.equal(model.dayLoads["2024-01-15"].reviewMinutes, 11);
  assert.equal(model.dayLoads["2024-01-15"].heatScore, 56);
  assert.equal(model.dayLoads["2024-01-17"].taskMinutes, 120);
});

test("builds month span bars clipped to the visible grid", () => {
  const model = buildMonthViewModel("2024-01-16", tasks, 1, reviewPressure, 30);
  assert.deepEqual(model.spanBars.map((bar) => ({
    taskId: bar.task.id,
    startDate: bar.startDate,
    endDate: bar.endDate,
    startIndex: bar.startIndex,
    endIndex: bar.endIndex
  })), [{
    taskId: "c",
    startDate: "2024-01-16",
    endDate: "2024-01-18",
    startIndex: 15,
    endIndex: 17
  }]);
});

test("builds a day-row week model with task and review panes", () => {
  const model = buildWeekViewModel("2024-01-17", tasks, 1, reviewPressure, 30);
  assert.deepEqual(model.days.map((day) => day.date), [
    "2024-01-15",
    "2024-01-16",
    "2024-01-17",
    "2024-01-18",
    "2024-01-19",
    "2024-01-20",
    "2024-01-21"
  ]);
  assert.equal(model.weekDayRows.length, 7);
  assert.deepEqual(model.weekDayRows[0].tasks.map((item) => item.id), ["b"]);
  assert.deepEqual(model.weekDayRows[2].tasks.map((item) => item.id), ["e"]);
  assert.deepEqual(model.weekDayRows.flatMap((row) => row.tasks).map((item) => item.id), ["b", "e"]);
  assert.equal(model.weekDayRows[0].review.count, 2);
  assert.equal(model.dayLoads["2024-01-18"].reviewMinutes, 4);
  assert.equal(model.dayLoads["2024-01-18"].taskMinutes, 0);
  assert.deepEqual(model.overdueTasks.map((item) => item.id), ["h"]);
  assert.equal(model.overdueTasks[0].overdueReason, "recurring start before today");
  assert.equal(model.unscheduledTasks[0].unscheduledReason, "scheduled is empty and not recurring");
  assert.equal(model.unscheduledTasks[2].unscheduledReason, "path contains 收集/代办");
});

test("recognizes TaskForge scheduled overdue after the filter baseline", () => {
  const model = buildWeekViewModel("2026-06-17", tasks, 1, {}, 30);
  const overdue = model.overdueTasks.find((item) => item.id === "i");
  assert.equal(overdue?.overdueReason, "scheduled before today");
});

test("keeps long tasks out of point task pressure and builds long task progress lists", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Scheduled long", { start: "2026-06-10", due: "2026-06-20" }, {
      taskKind: "long",
      progressPercent: 25,
      estimateMinutes: 600
    }),
    task("l2", "Unscheduled long", { due: "2026-06-25" }, {
      taskKind: "long",
      progressPercent: 0
    }),
    task("l3", "Overdue long", { start: "2026-06-01", due: "2026-06-16" }, {
      taskKind: "long",
      progressPercent: 80
    }),
    task("p1", "Point", { scheduled: "2026-06-17" }, { estimateMinutes: 30 })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30);
  assert.deepEqual(model.tasksByDate["2026-06-17"].map((item) => item.id), ["p1"]);
  assert.equal(model.dayLoads["2026-06-17"].taskMinutes, 30);
  assert.deepEqual(model.longTaskProgress.map((item) => item.task.id), ["l1"]);
  assert.deepEqual(model.longUnscheduledTasks.map((item) => item.id), ["l2"]);
  assert.deepEqual(model.longOverdueTasks.map((item) => item.id), ["l3"]);
  assert.equal(model.longTaskProgress[0].daysLeft, 3);
  assert.equal(model.longTaskProgress[0].dailyProgressPressure, 25);
  assert.equal(model.longTaskProgress[0].dailyEstimatedMinutes, 150);
  assert.equal(model.longTaskProgress[0].status, "behind");
});

function task(
  id: string,
  text: string,
  dates: Partial<CalendarTask["dates"]> = {},
  options: Partial<CalendarTask> = {}
): CalendarTask {
  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const isLong = options.taskKind === "long";
  const spanStart = isLong ? dates.start : dates.start && dates.scheduled && dates.start < dates.scheduled ? dates.start : undefined;
  const spanEnd = isLong ? dates.due : spanStart ? dates.scheduled : undefined;
  return {
    id,
    text,
    filePath: options.filePath ?? "Tasks.md",
    lineNumber: Number(id.charCodeAt(0)),
    rawLine: `- [${options.completed ? "x" : " "}] ${text}`,
    completed: options.completed ?? false,
    metadata: {},
    dates,
    dateSources: {},
    taskKind: isLong ? "long" : "point",
    createdDate: dates.created,
    progressPercent: 0,
    scheduleDate,
    spanStart,
    spanEnd,
    dueDate: dates.due,
    dateSource: scheduleDate ? "dataview" : "none",
    triggerType: "inline",
    ...options
  };
}
