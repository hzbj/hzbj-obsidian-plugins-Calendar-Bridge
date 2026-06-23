import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildMonthViewModel, buildSourceTaskGroups, buildWeekViewModel, normalizePriorityRank } from "../src/services/CalendarViewModel";
import type { CalendarTask, ReviewPressureByDate, SourceTaskGroupState } from "../src/models/types";
import { addDays, todayString } from "../src/utils/date";

const tasks: CalendarTask[] = [
  task("a", "Unscheduled"),
  task("b", "Monday", { scheduled: "2024-01-15" }, { estimateMinutes: 45 }),
  task("c", "Span", { start: "2024-01-16", scheduled: "2024-01-18" }, { estimateMinutes: 90 }),
  task("d", "Done", { scheduled: "2024-01-15" }, { completed: true, estimateMinutes: 60 }),
  task("e", "Due-only unscheduled", { due: "2024-01-17" }),
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
  assert.equal(model.dayLoads["2024-01-15"].taskCount, 2);
  assert.equal(model.dayLoads["2024-01-15"].taskMinutes, 105);
  assert.equal(model.dayLoads["2024-01-15"].reviewMinutes, 11);
  assert.equal(model.dayLoads["2024-01-15"].heatScore, 116);
  assert.equal(model.dayLoads["2024-01-17"].taskMinutes, 90);
});

test("keeps completed point task pressure as month history", () => {
  const model = buildMonthViewModel("2024-01-16", tasks, 1, reviewPressure, 30);
  assert.deepEqual(model.tasksByDate["2024-01-15"].map((item) => item.id), ["b", "d"]);
  assert.equal(model.dayLoads["2024-01-15"].taskCount, 2);
  assert.equal(model.dayLoads["2024-01-15"].taskMinutes, 105);
  assert.equal(model.dayLoads["2024-01-15"].heatScore, 116);
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
  assert.deepEqual(model.weekDayRows[2].tasks.map((item) => item.id), []);
  assert.deepEqual(model.weekDayRows.flatMap((row) => row.tasks).map((item) => item.id), ["b"]);
  assert.equal(model.weekDayRows[0].review.count, 2);
  assert.equal(model.dayLoads["2024-01-18"].reviewMinutes, 4);
  assert.equal(model.dayLoads["2024-01-18"].taskMinutes, 0);
  assert.deepEqual(model.overdueTasks.map((item) => item.id), []);
  assert.equal(model.dayLoads["2024-01-17"].recurringTaskCount, 1);
  assert.equal(model.dayLoads["2024-01-17"].recurringTaskMinutes, 30);
  assert.equal(model.unscheduledTasks[0].unscheduledReason, "scheduled is empty and not recurring");
  assert.equal(model.unscheduledTasks[2].unscheduledReason, "path contains 收集/代办");
});

test("counts recurring tasks separately without rendering them as scheduled tasks", () => {
  const recurringTasks: CalendarTask[] = [
    task("daily", "Daily habit", { start: "2026-06-22" }, {
      taskKind: "long",
      recurrence: "every day",
      estimateMinutes: 15
    }),
    task("weekly", "Weekly review", { start: "2026-06-23" }, {
      taskKind: "long",
      recurrence: "EVERY WEEK"
    }),
    task("monthly", "Month close", { start: "2026-06-30" }, {
      taskKind: "long",
      recurrence: "every month",
      estimateMinutes: 45
    }),
    task("yearly", "Annual review", { start: "2025-06-24" }, {
      taskKind: "long",
      recurrence: "every year",
      estimateMinutes: 90
    }),
    task("done", "Done repeating", { start: "2026-06-22", completion: "2026-06-22" }, {
      taskKind: "long",
      recurrence: "every day",
      completed: true,
      estimateMinutes: 120
    }),
    task("point", "Scheduled point", { scheduled: "2026-06-24" }, { estimateMinutes: 20 })
  ];

  const week = buildWeekViewModel("2026-06-22", recurringTasks, 1, {}, 30, "2026-06-22");

  assert.equal(week.dayLoads["2026-06-22"].taskCount, 0);
  assert.equal(week.dayLoads["2026-06-22"].recurringTaskCount, 1);
  assert.equal(week.dayLoads["2026-06-22"].recurringTaskMinutes, 15);
  assert.equal(week.dayLoads["2026-06-23"].recurringTaskCount, 2);
  assert.equal(week.dayLoads["2026-06-23"].recurringTaskMinutes, 45);
  assert.equal(week.dayLoads["2026-06-24"].taskCount, 1);
  assert.equal(week.dayLoads["2026-06-24"].recurringTaskCount, 2);
  assert.equal(week.dayLoads["2026-06-24"].taskMinutes, 20);
  assert.equal(week.dayLoads["2026-06-24"].recurringTaskMinutes, 105);
  assert.equal(week.dayLoads["2026-06-24"].heatScore, 125);
  assert.deepEqual(week.tasksByDate["2026-06-24"].map((item) => item.id), ["point"]);
  assert.deepEqual(week.weekDayRows[2].tasks.map((item) => item.id), ["point"]);
  assert.equal(week.weekDayRows[2].recurringTaskCount, 2);
  assert.equal(week.weekDayRows[2].taskMinutes, 125);
  assert.equal(week.longTaskTimelineRows.length, 0);

  const month = buildMonthViewModel("2026-06-15", recurringTasks, 1, {}, 30, {}, "2026-06-22");
  assert.equal(month.dayLoads["2026-06-22"].recurringTaskCount, 2);
  assert.equal(month.dayLoads["2026-06-22"].recurringTaskMinutes, 135);
  assert.equal(month.dayLoads["2026-06-30"].recurringTaskCount, 3);
  assert.equal(month.dayLoads["2026-06-30"].recurringTaskMinutes, 90);
  assert.equal(month.longTaskTimelineRows.length, 0);
});

test("keeps completed recurring pressure only through completion while using parent end dates", () => {
  const recurringTasks: CalendarTask[] = [
    task("parent", "Parent long", { start: "2026-06-20", scheduled: "2026-06-24" }, {
      taskKind: "long"
    }),
    task("done-child", "Completed child habit", { start: "2026-06-22", completion: "2026-06-22" }, {
      taskKind: "long",
      parentLongTaskId: "parent",
      parentLongTaskText: "Parent long",
      recurrence: "every day",
      completed: true,
      estimateMinutes: 20
    }),
    task("active-child", "Active child habit", { start: "2026-06-22" }, {
      taskKind: "long",
      parentLongTaskId: "parent",
      parentLongTaskText: "Parent long",
      recurrence: "every day",
      estimateMinutes: 15
    })
  ];

  const month = buildMonthViewModel("2026-06-15", recurringTasks, 1, {}, 30, {}, "2026-06-22");
  const week = buildWeekViewModel("2026-06-22", recurringTasks, 1, {}, 30, "2026-06-22");

  assert.equal(month.dayLoads["2026-06-22"].recurringTaskCount, 2);
  assert.equal(month.dayLoads["2026-06-22"].recurringTaskMinutes, 35);
  assert.equal(month.dayLoads["2026-06-24"].recurringTaskCount, 1);
  assert.equal(month.dayLoads["2026-06-24"].recurringTaskMinutes, 15);
  assert.equal(month.dayLoads["2026-06-25"].recurringTaskCount, 0);
  assert.equal(week.dayLoads["2026-06-22"].recurringTaskCount, 1);
});

test("uses recurring task scheduled dates before parent scheduled dates as inclusive ends", () => {
  const recurringTasks: CalendarTask[] = [
    task("parent", "Parent long", { start: "2026-06-20", scheduled: "2026-06-28" }, {
      taskKind: "long"
    }),
    task("child-parent-end", "Child until parent", { start: "2026-06-24" }, {
      taskKind: "long",
      parentLongTaskId: "parent",
      parentLongTaskText: "Parent long",
      recurrence: "every day"
    }),
    task("child-own-end", "Child own end", { start: "2026-06-24", scheduled: "2026-06-26" }, {
      taskKind: "long",
      parentLongTaskId: "parent",
      parentLongTaskText: "Parent long",
      recurrence: "every day",
      estimateMinutes: 10
    }),
    task("invalid", "Invalid range", { start: "2026-06-29", scheduled: "2026-06-27" }, {
      taskKind: "long",
      recurrence: "every day"
    })
  ];

  const model = buildMonthViewModel("2026-06-15", recurringTasks, 1, {}, 30, {}, "2026-06-24");

  assert.equal(model.dayLoads["2026-06-24"].recurringTaskCount, 2);
  assert.equal(model.dayLoads["2026-06-24"].recurringTaskMinutes, 40);
  assert.equal(model.dayLoads["2026-06-26"].recurringTaskCount, 2);
  assert.equal(model.dayLoads["2026-06-27"].recurringTaskCount, 1);
  assert.equal(model.dayLoads["2026-06-28"].recurringTaskCount, 1);
  assert.equal(model.dayLoads["2026-06-29"].recurringTaskCount, 0);
  assert.deepEqual(model.longTaskTimelineRows.map((row) => row.task.id), ["parent"]);
  assert.deepEqual(model.longTaskTimelineRows[0].childTasks.map((task) => ({
    id: task.id,
    recurrence: task.recurrence,
    start: task.dates.start,
    ownEnd: task.dates.scheduled
  })), [
    { id: "child-parent-end", recurrence: "every day", start: "2026-06-24", ownEnd: undefined },
    { id: "child-own-end", recurrence: "every day", start: "2026-06-24", ownEnd: "2026-06-26" }
  ]);
});

test("dedupes week recurring loads by content and recurrence using the newest start date", () => {
  const recurringTasks: CalendarTask[] = [
    task("old", "Water plants", { start: "2026-06-15" }, {
      taskKind: "long",
      recurrence: "every day",
      estimateMinutes: 10,
      rawLine: "- [ ] Water plants #task [recurrence:: every day] [start:: 2026-06-15]"
    }),
    task("new", "Water plants", { start: "2026-06-20" }, {
      taskKind: "long",
      recurrence: "every day",
      estimateMinutes: 25,
      lineNumber: 9,
      rawLine: "- [ ] Water plants #task [recurrence:: every day] [start:: 2026-06-20]"
    })
  ];

  const week = buildWeekViewModel("2026-06-22", recurringTasks, 1, {}, 30, "2026-06-22");

  assert.equal(week.dayLoads["2026-06-22"].recurringTaskCount, 1);
  assert.equal(week.dayLoads["2026-06-22"].recurringTaskMinutes, 25);
  assert.equal(week.weekDayRows[0].recurringTaskCount, 1);
  assert.equal(week.weekDayRows[0].totalMinutes, 25);

  const month = buildMonthViewModel("2026-06-22", recurringTasks, 1, {}, 30, {}, "2026-06-22");
  assert.equal(month.dayLoads["2026-06-22"].recurringTaskCount, 2);
  assert.equal(month.dayLoads["2026-06-22"].recurringTaskMinutes, 35);
});

test("keeps distinct recurring task content and recurrence rules separate", () => {
  const recurringTasks: CalendarTask[] = [
    task("daily", "Review notes", { start: "2026-06-22" }, {
      taskKind: "long",
      recurrence: "every day",
      estimateMinutes: 10,
      rawLine: "- [ ] Review notes #task [recurrence:: every day] [start:: 2026-06-22]"
    }),
    task("weekly", "Review notes", { start: "2026-06-22" }, {
      taskKind: "long",
      recurrence: "every week",
      estimateMinutes: 20,
      rawLine: "- [ ] Review notes #task [recurrence:: every week] [start:: 2026-06-22]"
    }),
    task("other", "Write notes", { start: "2026-06-22" }, {
      taskKind: "long",
      recurrence: "every day",
      estimateMinutes: 30,
      rawLine: "- [ ] Write notes #task [recurrence:: every day] [start:: 2026-06-22]"
    })
  ];

  const week = buildWeekViewModel("2026-06-22", recurringTasks, 1, {}, 30, "2026-06-22");

  assert.equal(week.dayLoads["2026-06-22"].recurringTaskCount, 3);
  assert.equal(week.dayLoads["2026-06-22"].recurringTaskMinutes, 60);
});

test("recognizes TaskForge scheduled overdue after the filter baseline", () => {
  const model = buildWeekViewModel("2026-06-17", tasks, 1, {}, 30);
  const overdue = model.overdueTasks.find((item) => item.id === "i");
  assert.equal(overdue?.overdueReason, "scheduled before today");
});

test("keeps long tasks out of point task pressure and builds long task progress lists", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Scheduled long", { start: "2026-06-10", scheduled: "2026-06-20" }, {
      taskKind: "long",
      progressPercent: 25,
      estimateMinutes: 600
    }),
    task("l2", "Unscheduled long", { due: "2026-06-25" }, {
      taskKind: "long",
      progressPercent: 0
    }),
    task("l3", "Overdue long", { start: "2026-06-01", scheduled: "2026-06-16" }, {
      taskKind: "long",
      progressPercent: 80
    }),
    task("p1", "Point", { scheduled: "2026-06-17" }, { estimateMinutes: 30 })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30, {}, "2026-06-17");
  assert.deepEqual(model.tasksByDate["2026-06-17"].map((item) => item.id), ["p1"]);
  assert.equal(model.dayLoads["2026-06-17"].taskMinutes, 30);
  assert.deepEqual(model.longTaskProgress.map((item) => item.task.id), ["l1"]);
  assert.deepEqual(model.longUnscheduledTasks.map((item) => item.id), ["l2"]);
  assert.equal(model.longTaskProgress[0].daysLeft, 3);
  assert.equal(model.longTaskProgress[0].dailyProgressPressure, 25);
  assert.equal(model.longTaskProgress[0].dailyEstimatedMinutes, 150);
  assert.equal(model.longTaskProgress[0].status, "behind");
});

test("uses the real current date for long-task pace while browsing a future month", () => {
  const today = todayString();
  const start = addDays(today, 10);
  const end = addDays(today, 40);
  const futureMonthAnchor = addDays(today, 25);
  const model = buildMonthViewModel(futureMonthAnchor, [
    task("future", "Future long", { start, scheduled: end }, {
      taskKind: "long",
      progressPercent: 0
    })
  ], 1, {}, 30);

  assert.equal(model.longTaskTimelineRows[0].status, "on-track");
  assert.equal(model.longTaskProgress[0].status, "on-track");
});

test("builds one unified unscheduled pool for point and long task modes", () => {
  const mixedTasks: CalendarTask[] = [
    task("u1", "Plain unscheduled"),
    task("u2", "Due-only candidate", { due: "2026-06-25" }),
    task("u3", "Partial long candidate", { start: "2026-06-20" }, { taskKind: "long" }),
    task("u4", "Repeating candidate", {}, { recurrence: "every week" }),
    task("p1", "Scheduled point", { scheduled: "2026-06-17", due: "2026-06-17" }),
    task("l1", "Ranged long candidate", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Scheduled long", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("d1", "Done unscheduled", {}, { completed: true })
  ];

  const model = buildMonthViewModel("2026-06-17", mixedTasks, 1, {}, 30) as any;

  assert.deepEqual(model.unifiedUnscheduledTasks.map((item: CalendarTask) => item.id), ["u1", "u2", "u3"]);
  assert.equal(model.unifiedUnscheduledTasks.every((item: CalendarTask) => !item.dates.scheduled), true);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "u4"), false);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "l1"), false);
  assert.equal(model.unifiedUnscheduledTasks.some((item: CalendarTask) => item.id === "l2"), false);
});

test("builds current-month long task timeline rows with clipped ranges and pace status", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Cross month", { start: "2026-05-28", scheduled: "2026-06-04" }, { taskKind: "long", progressPercent: 99 }),
    task("l2", "Inside month", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("l3", "Overdue long", { start: "2026-06-01", scheduled: "2026-06-16" }, { taskKind: "long", progressPercent: 80 }),
    task("p1", "Point", { scheduled: "2026-06-12" })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30, {}, "2026-06-17") as any;

  assert.deepEqual(model.longTaskTimelineRows.map((row: any) => ({
    id: row.task.id,
    visibleStartDate: row.visibleStartDate,
    visibleEndDate: row.visibleEndDate,
    startDay: row.startDay,
    endDay: row.endDay,
    status: row.status
  })), [
    { id: "l1", visibleStartDate: "2026-06-01", visibleEndDate: "2026-06-04", startDay: 1, endDay: 4, status: "behind" },
    { id: "l3", visibleStartDate: "2026-06-01", visibleEndDate: "2026-06-16", startDay: 1, endDay: 16, status: "behind" },
    { id: "l2", visibleStartDate: "2026-06-10", visibleEndDate: "2026-06-20", startDay: 10, endDay: 20, status: "behind" }
  ]);
});

test("attaches active indented child tasks to their parent long task timeline row", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Parent long", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("p1", "Unscheduled child", {}, { parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("p2", "Scheduled child", { scheduled: "2026-06-12" }, { parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("l2", "Child long", { start: "2026-06-13", scheduled: "2026-06-15" }, { taskKind: "long", parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("d1", "Done child", {}, { completed: true, parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("p3", "Other child", {}, { parentLongTaskId: "missing", parentLongTaskText: "Missing" })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30, {}, "2026-06-17");
  const parentRow = model.longTaskTimelineRows.find((row) => row.task.id === "l1");

  assert.deepEqual(model.longTaskTimelineRows.map((row) => row.task.id), ["l1"]);
  assert.deepEqual(parentRow?.childTasks.map((item) => item.id), ["p2", "l2", "p1"]);
  assert.equal(parentRow?.childTasks.some((item) => item.id === "l1"), false);
  assert.equal(parentRow?.childTasks.some((item) => item.completed), false);
});

test("sorts parent long task children by scheduled time with unscheduled children last", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Parent long", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("u1", "Unscheduled child", {}, { parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("l2", "Later child long", { start: "2026-06-13", scheduled: "2026-06-15" }, { taskKind: "long", parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("p1", "Earlier point child", { scheduled: "2026-06-11" }, { parentLongTaskId: "l1", parentLongTaskText: "Parent long" }),
    task("p2", "Middle point child", { scheduled: "2026-06-12" }, { parentLongTaskId: "l1", parentLongTaskText: "Parent long" })
  ];

  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30, {}, "2026-06-17");
  const parentRow = model.longTaskTimelineRows.find((row) => row.task.id === "l1");

  assert.deepEqual(parentRow?.childTasks.map((item) => item.id), ["p1", "p2", "l2", "u1"]);
});

test("assigns overlapping long task bars to independent layout rows", () => {
  const longTasks: CalendarTask[] = [
    task("l1", "Long A", { start: "2026-06-10", scheduled: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Long B", { start: "2026-06-12", scheduled: "2026-06-18" }, { taskKind: "long" }),
    task("l3", "Long C", { start: "2026-06-21", scheduled: "2026-06-24" }, { taskKind: "long" })
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
  const scheduleDate = dates.scheduled;
  const isLong = options.taskKind === "long";
  const spanStart = isLong ? dates.start : dates.start && dates.scheduled && dates.start < dates.scheduled ? dates.start : undefined;
  const spanEnd = isLong ? dates.scheduled : spanStart ? dates.scheduled : undefined;
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
    indentLevel: options.indentLevel ?? 0,
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
