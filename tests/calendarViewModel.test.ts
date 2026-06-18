import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildMonthViewModel, buildSourceTaskGroups, buildWeekViewModel, normalizePriorityRank } from "../src/services/CalendarViewModel";
import type { CalendarTask, ReviewPressureByDate, SourceTaskGroupState } from "../src/models/types";

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

test("builds one unified unscheduled pool for point and long task modes", () => {
  const mixedTasks: CalendarTask[] = [
    task("u1", "Plain unscheduled"),
    task("u2", "Due-only candidate", { due: "2026-06-25" }),
    task("u3", "Partial long candidate", { start: "2026-06-20" }, { taskKind: "long" }),
    task("u4", "Repeating candidate", {}, { recurrence: "every week" }),
    task("p1", "Scheduled point", { scheduled: "2026-06-17", due: "2026-06-17" }),
    task("l1", "Ranged long candidate", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Scheduled long", { start: "2026-06-10", due: "2026-06-20", scheduled: "2026-06-10" }, { taskKind: "long" }),
    task("d1", "Done unscheduled", {}, { completed: true })
  ];

  const model = buildMonthViewModel("2026-06-17", mixedTasks, 1, {}, 30) as any;

  assert.deepEqual(model.unifiedUnscheduledTasks.map((item: CalendarTask) => item.id), ["u1", "u2", "u3"]);
  assert.equal(model.unifiedUnscheduledTasks.every((item: CalendarTask) => !item.dates.scheduled), true);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "u4"), false);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "l1"), false);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "l2"), false);
});

test("builds current-month long task timeline rows including overdue and clipped cross-month ranges", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Cross month", { start: "2026-05-28", due: "2026-06-04" }, { taskKind: "long" }),
    task("l2", "Inside month", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l3", "Overdue long", { start: "2026-06-01", due: "2026-06-16" }, { taskKind: "long", progressPercent: 80 }),
    task("p1", "Point", { scheduled: "2026-06-12" })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30) as any;

  assert.deepEqual(model.longTaskTimelineRows.map((row: any) => ({
    id: row.task.id,
    visibleStartDate: row.visibleStartDate,
    visibleEndDate: row.visibleEndDate,
    startDay: row.startDay,
    endDay: row.endDay,
    isOverdue: row.isOverdue
  })), [
    { id: "l1", visibleStartDate: "2026-06-01", visibleEndDate: "2026-06-04", startDay: 1, endDay: 4, isOverdue: true },
    { id: "l3", visibleStartDate: "2026-06-01", visibleEndDate: "2026-06-16", startDay: 1, endDay: 16, isOverdue: true },
    { id: "l2", visibleStartDate: "2026-06-10", visibleEndDate: "2026-06-20", startDay: 10, endDay: 20, isOverdue: false }
  ]);
});

test("assigns overlapping long task bars to independent layout rows", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Long A", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Long B", { start: "2026-06-12", due: "2026-06-18" }, { taskKind: "long" }),
    task("l3", "Long C", { start: "2026-06-21", due: "2026-06-24" }, { taskKind: "long" })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30);
  const longBars = model.spanBars.filter((bar) => bar.task.taskKind === "long");

  assert.deepEqual(longBars.map((bar) => ({ id: bar.task.id, layoutRow: bar.layoutRow })), [
    { id: "l1", layoutRow: 1 },
    { id: "l2", layoutRow: 2 },
    { id: "l3", layoutRow: 1 }
  ]);
});

test("normalizes Dataview priority values for display and sorting", () => {
  assert.deepEqual([
    normalizePriorityRank("highest"),
    normalizePriorityRank("P1"),
    normalizePriorityRank("high"),
    normalizePriorityRank("P2"),
    normalizePriorityRank("medium"),
    normalizePriorityRank("normal"),
    normalizePriorityRank("P3"),
    normalizePriorityRank("low"),
    normalizePriorityRank("lowest"),
    normalizePriorityRank("P4"),
    normalizePriorityRank("none"),
    normalizePriorityRank(undefined)
  ], [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4]);
});

test("groups tasks by source file with persisted group order and priority sorting", () => {
  const groupState: SourceTaskGroupState = {
    order: ["Plans/B.md", "Inbox/A.md"],
    collapsed: { "Plans/B.md": true },
    sortMode: "priority"
  };
  const groupedTasks: CalendarTask[] = [
    task("a1", "Loose", {}, { filePath: "Inbox/A.md", priority: "low" }),
    task("a2", "Urgent", {}, { filePath: "Inbox/A.md", priority: "highest" }),
    task("b1", "Plan", {}, { filePath: "Plans/B.md", priority: "medium" }),
    task("c1", "New file", {}, { filePath: "New/C.md" })
  ];

  const groups = buildSourceTaskGroups(groupedTasks, groupState);

  assert.deepEqual(groups.map((group) => ({
    sourceFilePath: group.sourceFilePath,
    sourceFileName: group.sourceFileName,
    collapsed: group.collapsed,
    taskIds: group.tasks.map((item) => item.id)
  })), [
    { sourceFilePath: "Plans/B.md", sourceFileName: "B.md", collapsed: true, taskIds: ["b1"] },
    { sourceFilePath: "Inbox/A.md", sourceFileName: "A.md", collapsed: false, taskIds: ["a2", "a1"] },
    { sourceFilePath: "New/C.md", sourceFileName: "C.md", collapsed: false, taskIds: ["c1"] }
  ]);
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
