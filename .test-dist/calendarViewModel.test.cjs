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

// src/services/CalendarViewModel.ts
function buildMonthViewModel(anchorDate, tasks2, weekStartsOn, reviewPressure2 = {}, defaultUnestimatedTaskMinutes = 30) {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, "month");
}
function buildWeekViewModel(anchorDate, tasks2, weekStartsOn, reviewPressure2 = {}, defaultUnestimatedTaskMinutes = 30) {
  const days = weekDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, "week");
}
function buildViewModel(days, tasks2, anchorDate, reviewPressure2, defaultUnestimatedTaskMinutes, mode) {
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
  const unscheduledTasks = pointTasks.flatMap((task2) => {
    const reason = getUnscheduledReason(task2);
    return reason ? [{ ...task2, unscheduledReason: reason }] : [];
  });
  return {
    days,
    tasksByDate,
    unscheduledTasks,
    overdueTasks,
    dayLoads,
    spanBars: mode === "month" ? buildSpanBars(days, activeTasks) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure2, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, todayStringFromAnchor(anchorDate)),
    longUnscheduledTasks: longTasks.filter((task2) => !task2.spanStart || !task2.spanEnd),
    longOverdueTasks: longTasks.filter((task2) => isLongTaskOverdue(task2, todayStringFromAnchor(anchorDate)))
  };
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
      endIndex: indexByDate.get(endDate) ?? days.length - 1
    });
  }
  return bars;
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
