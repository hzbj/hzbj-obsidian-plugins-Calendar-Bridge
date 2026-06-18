// tests/calendarViewModel.test.ts
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
function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}
function startOfWeek(dateString, weekStartsOn) {
  const date = parseLocalDate(dateString);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return toDateString(date);
}
function weekDates(dateString, weekStartsOn) {
  const start = startOfWeek(dateString, weekStartsOn);
  const today = todayString();
  return Array.from({ length: 7 }, (_unused, index) => {
    const date = addDays(start, index);
    return {
      date,
      dayOfMonth: parseLocalDate(date).getDate(),
      inCurrentMonth: true,
      isToday: date === today
    };
  });
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

// src/utils/DataviewTaskDate.ts
function normalizeTaskPriority(raw) {
  if (!raw)
    return void 0;
  const value = raw.trim().toLowerCase();
  if (value === "p1" || value === "1" || value === "highest")
    return "highest";
  if (value === "p2" || value === "2" || value === "high")
    return "high";
  if (value === "p3" || value === "3" || value === "normal" || value === "medium" || value === "med")
    return "medium";
  if (value === "p4" || value === "4" || value === "low" || value === "lowest")
    return "low";
  return void 0;
}

// src/services/CalendarViewModel.ts
function buildMonthViewModel(anchorDate, tasks2, weekStartsOn, reviewPressure2 = {}, defaultUnestimatedTaskMinutes = 30, sourceGroupState = {}) {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, "month", sourceGroupState);
}
function buildWeekViewModel(anchorDate, tasks2, weekStartsOn, reviewPressure2 = {}, defaultUnestimatedTaskMinutes = 30) {
  const days = weekDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, "week");
}
function buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, mode, sourceGroupState = {}) {
  const activeTasks = tasks2.filter((task2) => !task2.completed);
  const pointTasks = activeTasks.filter((task2) => task2.taskKind !== "long");
  const longTasks = activeTasks.filter((task2) => task2.taskKind === "long");
  const visibleDates = new Set(days.map((day) => day.date));
  const tasksByDate = {};
  const dayLoads = {};
  for (const day of days) {
    const review = reviewPressure2[day.date] ?? { count: 0, minutes: 0, chars: 0 };
    tasksByDate[day.date] = [];
    dayLoads[day.date] = {
      date: day.date,
      taskCount: 0,
      taskMinutes: 0,
      reviewCount: review.count,
      reviewMinutes: review.minutes,
      heatScore: review.minutes
    };
  }
  for (const task2 of pointTasks) {
    for (const date of activeDatesForTask(task2, days[0]?.date, days[days.length - 1]?.date, mode)) {
      if (!visibleDates.has(date))
        continue;
      tasksByDate[date].push(task2);
      dayLoads[date].taskCount += 1;
      dayLoads[date].taskMinutes += task2.estimateMinutes ?? defaultUnestimatedTaskMinutes;
      dayLoads[date].heatScore = dayLoads[date].taskMinutes + dayLoads[date].reviewMinutes;
    }
  }
  const overdueTasks = pointTasks.flatMap((task2) => {
    const reason = getOverdueReason(task2, todayStringFromAnchor(anchorDate));
    return reason ? [{ ...task2, overdueReason: reason }] : [];
  });
  const unifiedUnscheduledTasks = activeTasks.flatMap((task2) => {
    const reason = getUnifiedUnscheduledReason(task2);
    return reason ? [{ ...task2, unscheduledReason: reason }] : [];
  });
  const unscheduledTasks = pointTasks.flatMap((task2) => {
    const reason = getUnscheduledReason(task2);
    return reason ? [{ ...task2, unscheduledReason: reason }] : [];
  });
  return {
    days,
    tasksByDate,
    unscheduledTasks,
    overdueTasks,
    unifiedUnscheduledTasks,
    dayLoads,
    spanBars: mode === "month" ? buildSpanBars(days, activeTasks) : [],
    longTaskTimelineRows: mode === "month" ? buildLongTaskTimelineRows(days, longTasks, todayStringFromAnchor(anchorDate)) : [],
    sourceTaskGroups: mode === "month" ? buildSourceTaskGroups(unifiedUnscheduledTasks, sourceGroupState) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure2, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, todayStringFromAnchor(anchorDate)),
    longUnscheduledTasks: longTasks.filter((task2) => !task2.spanStart || !task2.spanEnd),
    longOverdueTasks: longTasks.filter((task2) => isLongTaskOverdue(task2, todayStringFromAnchor(anchorDate)))
  };
}
function normalizePriorityRank(priority) {
  const normalized = normalizeTaskPriority(priority);
  if (normalized === "highest")
    return 1;
  if (normalized === "high")
    return 2;
  if (normalized === "medium")
    return 3;
  return 4;
}
function buildSourceTaskGroups(tasks2, state = {}) {
  const byFile = /* @__PURE__ */ new Map();
  for (const task2 of tasks2) {
    const items = byFile.get(task2.filePath) ?? [];
    items.push(task2);
    byFile.set(task2.filePath, items);
  }
  const order = state.order ?? [];
  const indexByFile = new Map(order.map((filePath, index) => [filePath, index]));
  return [...byFile.entries()].sort(([left], [right]) => {
    const leftIndex = indexByFile.get(left);
    const rightIndex = indexByFile.get(right);
    if (leftIndex !== void 0 && rightIndex !== void 0)
      return leftIndex - rightIndex;
    if (leftIndex !== void 0)
      return -1;
    if (rightIndex !== void 0)
      return 1;
    return left.localeCompare(right);
  }).map(([sourceFilePath, groupTasks]) => ({
    sourceFilePath,
    sourceFileName: sourceFilePath.split("/").pop() ?? sourceFilePath,
    collapsed: Boolean(state.collapsed?.[sourceFilePath]),
    tasks: sortTasksForGroup(groupTasks, state)
  }));
}
function sortTasksForGroup(tasks2, state) {
  if (state.sortMode !== "priority")
    return tasks2;
  return [...tasks2].sort((a, b) => {
    const priorityCompare = normalizePriorityRank(a.priority) - normalizePriorityRank(b.priority);
    if (priorityCompare !== 0)
      return priorityCompare;
    return a.id.localeCompare(b.id);
  });
}
function buildLongTaskProgress(tasks2, today) {
  return tasks2.filter((task2) => task2.spanStart && task2.spanEnd && !isLongTaskOverdue(task2, today)).map((task2) => {
    const start = task2.spanStart;
    const due = task2.spanEnd;
    const totalDays = Math.max(1, diffDays(start, due));
    const daysElapsed = Math.min(totalDays, Math.max(0, diffDays(start, today)));
    const daysLeft = Math.max(1, diffDays(today, due));
    const progressPercent = task2.progressPercent ?? 0;
    const expectedProgressPercent = Math.min(100, Math.round(daysElapsed / totalDays * 100));
    const remainingRatio = Math.max(0, 100 - progressPercent) / 100;
    const dailyProgressPressure = Math.round((100 - progressPercent) / daysLeft * 10) / 10;
    const dailyEstimatedMinutes = task2.estimateMinutes !== void 0 ? Math.round(task2.estimateMinutes * remainingRatio / daysLeft) : void 0;
    return {
      task: task2,
      daysElapsed,
      daysLeft,
      totalDays,
      expectedProgressPercent,
      progressPercent,
      dailyProgressPressure,
      dailyEstimatedMinutes,
      status: progressPercent + 5 < expectedProgressPercent ? "behind" : progressPercent > expectedProgressPercent + 5 ? "ahead" : "on-track"
    };
  });
}
function isLongTaskOverdue(task2, today) {
  return Boolean(task2.spanEnd && task2.spanEnd < today && (task2.progressPercent ?? 0) < 100);
}
function buildLongTaskTimelineRows(days, tasks2, today) {
  const monthDays = days.filter((day) => day.inCurrentMonth);
  const first = monthDays[0]?.date;
  const last = monthDays[monthDays.length - 1]?.date;
  if (!first || !last)
    return [];
  return tasks2.filter((task2) => task2.spanStart && task2.spanEnd && task2.spanEnd >= first && task2.spanStart <= last).sort((a, b) => {
    const startCompare = a.spanStart.localeCompare(b.spanStart);
    if (startCompare !== 0)
      return startCompare;
    const endCompare = a.spanEnd.localeCompare(b.spanEnd);
    if (endCompare !== 0)
      return endCompare;
    return a.id.localeCompare(b.id);
  }).map((task2) => {
    const fullStartDate = task2.spanStart;
    const fullEndDate = task2.spanEnd;
    const visibleStartDate = fullStartDate < first ? first : fullStartDate;
    const visibleEndDate = fullEndDate > last ? last : fullEndDate;
    const progressPercent = task2.progressPercent ?? 0;
    const totalDays = Math.max(1, diffDays(fullStartDate, fullEndDate));
    const daysElapsed = Math.min(totalDays, Math.max(0, diffDays(fullStartDate, today)));
    const expectedProgressPercent = Math.min(100, Math.round(daysElapsed / totalDays * 100));
    return {
      task: task2,
      fullStartDate,
      fullEndDate,
      visibleStartDate,
      visibleEndDate,
      startDay: Number.parseInt(visibleStartDate.slice(8, 10), 10),
      endDay: Number.parseInt(visibleEndDate.slice(8, 10), 10),
      isClippedStart: fullStartDate < first,
      isClippedEnd: fullEndDate > last,
      isOverdue: isLongTaskOverdue(task2, today),
      daysLeft: Math.max(0, diffDays(today, fullEndDate)),
      progressPercent,
      status: progressPercent + 5 < expectedProgressPercent ? "behind" : progressPercent > expectedProgressPercent + 5 ? "ahead" : "on-track"
    };
  });
}
function buildSpanBars(days, tasks2) {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last)
    return [];
  const indexByDate = new Map(days.map((day, index) => [day.date, index]));
  const bars = [];
  for (const task2 of tasks2) {
    if (!task2.spanStart || !task2.spanEnd || task2.spanEnd < first || task2.spanStart > last)
      continue;
    const startDate = task2.spanStart < first ? first : task2.spanStart;
    const endDate = task2.spanEnd > last ? last : task2.spanEnd;
    bars.push({
      task: task2,
      startDate,
      endDate,
      startIndex: indexByDate.get(startDate) ?? 0,
      endIndex: indexByDate.get(endDate) ?? days.length - 1,
      layoutRow: 1
    });
  }
  return assignSpanBarRows(bars);
}
function assignSpanBarRows(bars) {
  const sorted = [...bars].sort((a, b) => {
    if (a.startIndex !== b.startIndex)
      return a.startIndex - b.startIndex;
    if (a.endIndex !== b.endIndex)
      return a.endIndex - b.endIndex;
    return a.task.id.localeCompare(b.task.id);
  });
  const lastEndByRow = [];
  return sorted.map((bar) => {
    let rowIndex = lastEndByRow.findIndex((lastEnd) => lastEnd < bar.startIndex);
    if (rowIndex < 0) {
      rowIndex = lastEndByRow.length;
      lastEndByRow.push(bar.endIndex);
    } else {
      lastEndByRow[rowIndex] = bar.endIndex;
    }
    return { ...bar, layoutRow: rowIndex + 1 };
  });
}
function buildWeekDayRows(days, tasksByDate, reviewPressure2, dayLoads) {
  return days.map((day) => {
    const review = reviewPressure2[day.date] ?? { count: 0, minutes: 0, chars: 0 };
    return {
      day,
      tasks: tasksByDate[day.date] ?? [],
      taskMinutes: dayLoads[day.date]?.taskMinutes ?? 0,
      review,
      totalMinutes: (dayLoads[day.date]?.taskMinutes ?? 0) + review.minutes
    };
  });
}
function activeDatesForTask(task2, visibleStart, visibleEnd, mode = "month") {
  if (task2.spanStart && task2.spanEnd) {
    if (mode === "week")
      return [];
    const start = visibleStart && task2.spanStart < visibleStart ? visibleStart : task2.spanStart;
    const end = visibleEnd && task2.spanEnd > visibleEnd ? visibleEnd : task2.spanEnd;
    if (end < start)
      return [];
    const dates = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      dates.push(date);
    }
    return dates;
  }
  return task2.scheduleDate ? [task2.scheduleDate] : [];
}
function getOverdueReason(task2, today) {
  if (task2.dates.due && task2.dates.due < today)
    return "due is overdue";
  if (task2.dates.scheduled && task2.dates.scheduled > "2026-06-12" && task2.dates.scheduled < today)
    return "scheduled before today";
  if (isRecurring(task2) && task2.dates.start && task2.dates.start < today)
    return "recurring start before today";
  return void 0;
}
function getUnscheduledReason(task2) {
  if (task2.filePath.includes("\u6536\u96C6/\u4EE3\u529E"))
    return "path contains \u6536\u96C6/\u4EE3\u529E";
  if (task2.filePath.includes("\u89C4\u5212/\u9636\u6BB5"))
    return "path contains \u89C4\u5212/\u9636\u6BB5";
  if (!task2.dates.scheduled && !isRecurring(task2))
    return "scheduled is empty and not recurring";
  return void 0;
}
function getUnifiedUnscheduledReason(task2) {
  if (task2.dates.scheduled)
    return void 0;
  if (isRecurring(task2))
    return void 0;
  if (task2.taskKind === "long" && task2.spanStart && task2.spanEnd)
    return void 0;
  if (task2.filePath.includes("\u93C0\u5815\u6CE6/\u6D60\uFF45\u59D9"))
    return "path contains \u93C0\u5815\u6CE6/\u6D60\uFF45\u59D9";
  if (task2.filePath.includes("\u7459\u52EB\u579D/\u95C3\u8235\uE18C"))
    return "path contains \u7459\u52EB\u579D/\u95C3\u8235\uE18C";
  return "not scheduled";
}
function isRecurring(task2) {
  return Boolean(task2.recurrence?.trim()) || /\brecurr/i.test(task2.rawLine) || /🔁/u.test(task2.rawLine);
}
function todayStringFromAnchor(anchorDate) {
  return anchorDate || todayString();
}
function diffDays(start, end) {
  const startTime = Date.parse(`${start}T00:00:00`);
  const endTime = Date.parse(`${end}T00:00:00`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime))
    return 0;
  return Math.round((endTime - startTime) / 864e5);
}

// tests/calendarViewModel.test.ts
var tasks = [
  task("a", "Unscheduled"),
  task("b", "Monday", { scheduled: "2024-01-15" }, { estimateMinutes: 45 }),
  task("c", "Span", { start: "2024-01-16", scheduled: "2024-01-18" }, { estimateMinutes: 90 }),
  task("d", "Done", { scheduled: "2024-01-15" }, { completed: true, estimateMinutes: 60 }),
  task("e", "Due fallback", { due: "2024-01-17" }),
  task("f", "Inbox path", {}, { filePath: "\u6536\u96C6/\u4EE3\u529E/Inbox.md" }),
  task("g", "Recurring unscheduled", {}, { recurrence: "every week" }),
  task("h", "Recurring overdue", { start: "2024-01-10" }, { recurrence: "every week" }),
  task("i", "Scheduled overdue after baseline", { scheduled: "2026-06-16" })
];
var reviewPressure = {
  "2024-01-15": { count: 2, minutes: 11, chars: 5600 },
  "2024-01-18": { count: 1, minutes: 4, chars: 1200 }
};
(0, import_node_test.test)("builds a 42-cell month heatmap model with scheduled load and review pressure", () => {
  const model = buildMonthViewModel("2024-01-16", tasks, 1, reviewPressure, 30);
  import_node_assert.strict.equal(model.days.length, 42);
  import_node_assert.strict.equal(model.days[0].date, "2024-01-01");
  import_node_assert.strict.equal(model.unscheduledTasks.map((item) => item.id).join(","), "a,e,f");
  import_node_assert.strict.equal(model.dayLoads["2024-01-15"].taskCount, 1);
  import_node_assert.strict.equal(model.dayLoads["2024-01-15"].taskMinutes, 45);
  import_node_assert.strict.equal(model.dayLoads["2024-01-15"].reviewMinutes, 11);
  import_node_assert.strict.equal(model.dayLoads["2024-01-15"].heatScore, 56);
  import_node_assert.strict.equal(model.dayLoads["2024-01-17"].taskMinutes, 120);
});
(0, import_node_test.test)("builds month span bars clipped to the visible grid", () => {
  const model = buildMonthViewModel("2024-01-16", tasks, 1, reviewPressure, 30);
  import_node_assert.strict.deepEqual(model.spanBars.map((bar) => ({
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
(0, import_node_test.test)("builds a day-row week model with task and review panes", () => {
  const model = buildWeekViewModel("2024-01-17", tasks, 1, reviewPressure, 30);
  import_node_assert.strict.deepEqual(model.days.map((day) => day.date), [
    "2024-01-15",
    "2024-01-16",
    "2024-01-17",
    "2024-01-18",
    "2024-01-19",
    "2024-01-20",
    "2024-01-21"
  ]);
  import_node_assert.strict.equal(model.weekDayRows.length, 7);
  import_node_assert.strict.deepEqual(model.weekDayRows[0].tasks.map((item) => item.id), ["b"]);
  import_node_assert.strict.deepEqual(model.weekDayRows[2].tasks.map((item) => item.id), ["e"]);
  import_node_assert.strict.deepEqual(model.weekDayRows.flatMap((row) => row.tasks).map((item) => item.id), ["b", "e"]);
  import_node_assert.strict.equal(model.weekDayRows[0].review.count, 2);
  import_node_assert.strict.equal(model.dayLoads["2024-01-18"].reviewMinutes, 4);
  import_node_assert.strict.equal(model.dayLoads["2024-01-18"].taskMinutes, 0);
  import_node_assert.strict.deepEqual(model.overdueTasks.map((item) => item.id), ["h"]);
  import_node_assert.strict.equal(model.overdueTasks[0].overdueReason, "recurring start before today");
  import_node_assert.strict.equal(model.unscheduledTasks[0].unscheduledReason, "scheduled is empty and not recurring");
  import_node_assert.strict.equal(model.unscheduledTasks[2].unscheduledReason, "path contains \u6536\u96C6/\u4EE3\u529E");
});
(0, import_node_test.test)("recognizes TaskForge scheduled overdue after the filter baseline", () => {
  const model = buildWeekViewModel("2026-06-17", tasks, 1, {}, 30);
  const overdue = model.overdueTasks.find((item) => item.id === "i");
  import_node_assert.strict.equal(overdue?.overdueReason, "scheduled before today");
});
(0, import_node_test.test)("keeps long tasks out of point task pressure and builds long task progress lists", () => {
  const longTasks = [
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
  import_node_assert.strict.deepEqual(model.tasksByDate["2026-06-17"].map((item) => item.id), ["p1"]);
  import_node_assert.strict.equal(model.dayLoads["2026-06-17"].taskMinutes, 30);
  import_node_assert.strict.deepEqual(model.longTaskProgress.map((item) => item.task.id), ["l1"]);
  import_node_assert.strict.deepEqual(model.longUnscheduledTasks.map((item) => item.id), ["l2"]);
  import_node_assert.strict.deepEqual(model.longOverdueTasks.map((item) => item.id), ["l3"]);
  import_node_assert.strict.equal(model.longTaskProgress[0].daysLeft, 3);
  import_node_assert.strict.equal(model.longTaskProgress[0].dailyProgressPressure, 25);
  import_node_assert.strict.equal(model.longTaskProgress[0].dailyEstimatedMinutes, 150);
  import_node_assert.strict.equal(model.longTaskProgress[0].status, "behind");
});
(0, import_node_test.test)("builds one unified unscheduled pool for point and long task modes", () => {
  const mixedTasks = [
    task("u1", "Plain unscheduled"),
    task("u2", "Due-only candidate", { due: "2026-06-25" }),
    task("u3", "Partial long candidate", { start: "2026-06-20" }, { taskKind: "long" }),
    task("u4", "Repeating candidate", {}, { recurrence: "every week" }),
    task("p1", "Scheduled point", { scheduled: "2026-06-17", due: "2026-06-17" }),
    task("l1", "Ranged long candidate", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Scheduled long", { start: "2026-06-10", due: "2026-06-20", scheduled: "2026-06-10" }, { taskKind: "long" }),
    task("d1", "Done unscheduled", {}, { completed: true })
  ];
  const model = buildMonthViewModel("2026-06-17", mixedTasks, 1, {}, 30);
  import_node_assert.strict.deepEqual(model.unifiedUnscheduledTasks.map((item) => item.id), ["u1", "u2", "u3"]);
  import_node_assert.strict.equal(model.unifiedUnscheduledTasks.every((item) => !item.dates.scheduled), true);
  import_node_assert.strict.equal(model.unifiedUnscheduledTasks.some((item) => item.id === "u4"), false);
  import_node_assert.strict.equal(model.unifiedUnscheduledTasks.some((item) => item.id === "l1"), false);
  import_node_assert.strict.equal(model.unifiedUnscheduledTasks.some((item) => item.id === "l2"), false);
});
(0, import_node_test.test)("builds current-month long task timeline rows including overdue and clipped cross-month ranges", () => {
  const longTasks = [
    task("l1", "Cross month", { start: "2026-05-28", due: "2026-06-04" }, { taskKind: "long" }),
    task("l2", "Inside month", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l3", "Overdue long", { start: "2026-06-01", due: "2026-06-16" }, { taskKind: "long", progressPercent: 80 }),
    task("p1", "Point", { scheduled: "2026-06-12" })
  ];
  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30);
  import_node_assert.strict.deepEqual(model.longTaskTimelineRows.map((row) => ({
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
(0, import_node_test.test)("assigns overlapping long task bars to independent layout rows", () => {
  const longTasks = [
    task("l1", "Long A", { start: "2026-06-10", due: "2026-06-20" }, { taskKind: "long" }),
    task("l2", "Long B", { start: "2026-06-12", due: "2026-06-18" }, { taskKind: "long" }),
    task("l3", "Long C", { start: "2026-06-21", due: "2026-06-24" }, { taskKind: "long" })
  ];
  const model = buildMonthViewModel("2026-06-17", longTasks, 1, {}, 30);
  const longBars = model.spanBars.filter((bar) => bar.task.taskKind === "long");
  import_node_assert.strict.deepEqual(longBars.map((bar) => ({ id: bar.task.id, layoutRow: bar.layoutRow })), [
    { id: "l1", layoutRow: 1 },
    { id: "l2", layoutRow: 2 },
    { id: "l3", layoutRow: 1 }
  ]);
});
(0, import_node_test.test)("normalizes Dataview priority values for display and sorting", () => {
  import_node_assert.strict.deepEqual([
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
    normalizePriorityRank(void 0)
  ], [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4]);
});
(0, import_node_test.test)("groups tasks by source file with persisted group order and priority sorting", () => {
  const groupState = {
    order: ["Plans/B.md", "Inbox/A.md"],
    collapsed: { "Plans/B.md": true },
    sortMode: "priority"
  };
  const groupedTasks = [
    task("a1", "Loose", {}, { filePath: "Inbox/A.md", priority: "low" }),
    task("a2", "Urgent", {}, { filePath: "Inbox/A.md", priority: "highest" }),
    task("b1", "Plan", {}, { filePath: "Plans/B.md", priority: "medium" }),
    task("c1", "New file", {}, { filePath: "New/C.md" })
  ];
  const groups = buildSourceTaskGroups(groupedTasks, groupState);
  import_node_assert.strict.deepEqual(groups.map((group) => ({
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
function task(id, text, dates = {}, options = {}) {
  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const isLong = options.taskKind === "long";
  const spanStart = isLong ? dates.start : dates.start && dates.scheduled && dates.start < dates.scheduled ? dates.start : void 0;
  const spanEnd = isLong ? dates.due : spanStart ? dates.scheduled : void 0;
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
