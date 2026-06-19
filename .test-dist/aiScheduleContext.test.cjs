// tests/aiScheduleContext.test.ts
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
function buildMonthViewModel(anchorDate, tasks, weekStartsOn, reviewPressure = {}, defaultUnestimatedTaskMinutes = 30, sourceGroupState = {}) {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "month", sourceGroupState);
}
function buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, mode, sourceGroupState = {}) {
  const activeTasks = tasks.filter((task2) => !task2.completed);
  const loadTasks = mode === "month" ? tasks : activeTasks;
  const pointTasks = activeTasks.filter((task2) => task2.taskKind !== "long");
  const pointLoadTasks = loadTasks.filter((task2) => task2.taskKind !== "long");
  const longTasks = activeTasks.filter((task2) => task2.taskKind === "long");
  const visibleDates = new Set(days.map((day) => day.date));
  const tasksByDate = {};
  const dayLoads = {};
  for (const day of days) {
    const review = reviewPressure[day.date] ?? { count: 0, minutes: 0, chars: 0 };
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
  for (const task2 of pointLoadTasks) {
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
  const childTasksByLongTaskId = buildChildTasksByLongTaskId(activeTasks);
  return {
    days,
    tasksByDate,
    unscheduledTasks,
    overdueTasks,
    unifiedUnscheduledTasks,
    dayLoads,
    spanBars: mode === "month" ? buildSpanBars(days, activeTasks) : [],
    longTaskTimelineRows: mode === "month" ? buildLongTaskTimelineRows(days, longTasks, childTasksByLongTaskId, todayStringFromAnchor(anchorDate)) : [],
    sourceTaskGroups: mode === "month" ? buildSourceTaskGroups(unifiedUnscheduledTasks, sourceGroupState) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, todayStringFromAnchor(anchorDate)),
    longUnscheduledTasks: longTasks.filter((task2) => !task2.spanStart || !task2.spanEnd),
    longOverdueTasks: longTasks.filter((task2) => isLongTaskOverdue(task2, todayStringFromAnchor(anchorDate)))
  };
}
function buildChildTasksByLongTaskId(tasks) {
  const byParent = /* @__PURE__ */ new Map();
  for (const task2 of tasks) {
    if (!task2.parentLongTaskId || task2.parentLongTaskId === task2.id)
      continue;
    const children = byParent.get(task2.parentLongTaskId) ?? [];
    children.push(task2);
    byParent.set(task2.parentLongTaskId, children);
  }
  return byParent;
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
function buildSourceTaskGroups(tasks, state = {}) {
  const byFile = /* @__PURE__ */ new Map();
  for (const task2 of tasks) {
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
function sortTasksForGroup(tasks, state) {
  if (state.sortMode !== "priority")
    return tasks;
  return [...tasks].sort((a, b) => {
    const priorityCompare = normalizePriorityRank(a.priority) - normalizePriorityRank(b.priority);
    if (priorityCompare !== 0)
      return priorityCompare;
    return a.id.localeCompare(b.id);
  });
}
function buildLongTaskProgress(tasks, today) {
  return tasks.filter((task2) => task2.spanStart && task2.spanEnd && !isLongTaskOverdue(task2, today)).map((task2) => {
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
function buildLongTaskTimelineRows(days, tasks, childTasksByLongTaskId, today) {
  const monthDays = days.filter((day) => day.inCurrentMonth);
  const first = monthDays[0]?.date;
  const last = monthDays[monthDays.length - 1]?.date;
  if (!first || !last)
    return [];
  return tasks.filter((task2) => task2.spanStart && task2.spanEnd && task2.spanEnd >= first && task2.spanStart <= last).sort((a, b) => {
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
      childTasks: childTasksByLongTaskId.get(task2.id) ?? [],
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
function buildSpanBars(days, tasks) {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last)
    return [];
  const indexByDate = new Map(days.map((day, index) => [day.date, index]));
  const bars = [];
  for (const task2 of tasks) {
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
function buildWeekDayRows(days, tasksByDate, reviewPressure, dayLoads) {
  return days.map((day) => {
    const review = reviewPressure[day.date] ?? { count: 0, minutes: 0, chars: 0 };
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

// src/services/AiScheduleContext.ts
var AI_SCHEDULE_CONTEXT_PATH = "Calendar-Bridge/ai-schedule-context.json";
function buildAiScheduleContext(input) {
  const model = buildMonthViewModel(
    input.anchorDate,
    input.tasks,
    input.settings.weekStartsOn,
    input.reviewPressure,
    input.settings.defaultUnestimatedTaskMinutes
  );
  return {
    schemaVersion: 1,
    anchorDate: input.anchorDate,
    writePolicy: {
      mode: "confirm-before-write",
      targetFileRule: "choose-from-user-prompt-under-planning-folder"
    },
    settings: {
      defaultUnestimatedTaskMinutes: input.settings.defaultUnestimatedTaskMinutes,
      includedPathPrefixes: input.settings.includedPathPrefixes,
      excludedPathPrefixes: input.settings.excludedPathPrefixes,
      scheduledDayFolder: input.settings.scheduledDayFolder
    },
    unscheduledTasks: model.unifiedUnscheduledTasks.map((task2) => taskSnapshot(task2, task2.unscheduledReason)),
    overdueTasks: model.overdueTasks.map((task2) => taskSnapshot(task2, task2.overdueReason)),
    dailyLoadsByHorizon: {
      "7": buildDailyLoads(input, 7),
      "14": buildDailyLoads(input, 14),
      "30": buildDailyLoads(input, 30)
    },
    longTaskProgress: model.longTaskProgress.map((item) => ({
      task: taskSnapshot(item.task),
      daysElapsed: item.daysElapsed,
      daysLeft: item.daysLeft,
      totalDays: item.totalDays,
      expectedProgressPercent: item.expectedProgressPercent,
      progressPercent: item.progressPercent,
      dailyProgressPressure: item.dailyProgressPressure,
      dailyEstimatedMinutes: item.dailyEstimatedMinutes,
      status: item.status
    }))
  };
}
var AiScheduleContextExporter = class {
  constructor(app) {
    this.app = app;
  }
  async sync(input) {
    const content = `${JSON.stringify(buildAiScheduleContext(input), null, 2)}
`;
    await this.ensureFolder(AI_SCHEDULE_CONTEXT_PATH.split("/").slice(0, -1).join("/"));
    const existing = this.app.vault.getAbstractFileByPath(AI_SCHEDULE_CONTEXT_PATH);
    if (existing && "extension" in existing) {
      const file = existing;
      const current = await this.app.vault.read(file);
      if (current === content)
        return "unchanged";
      await this.app.vault.modify(file, content);
      return "updated";
    }
    await this.app.vault.create(AI_SCHEDULE_CONTEXT_PATH, content);
    return "created";
  }
  async ensureFolder(folderPath) {
    if (!folderPath)
      return;
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
};
function buildDailyLoads(input, horizonDays) {
  return Array.from({ length: horizonDays }, (_, index) => {
    const date = addDays(input.anchorDate, index);
    const taskMinutes = taskMinutesForDate(input.tasks, date, input.settings.defaultUnestimatedTaskMinutes);
    const reviewMinutes = input.reviewPressure[date]?.minutes ?? 0;
    return {
      date,
      taskMinutes,
      reviewMinutes,
      totalMinutes: taskMinutes + reviewMinutes
    };
  });
}
function taskMinutesForDate(tasks, date, defaultUnestimatedTaskMinutes) {
  return tasks.filter((task2) => !task2.completed && task2.taskKind !== "long" && task2.scheduleDate === date).reduce((total, task2) => total + (task2.estimateMinutes ?? defaultUnestimatedTaskMinutes), 0);
}
function taskSnapshot(task2, reason) {
  const priority = normalizeTaskPriority(task2.priority);
  return {
    id: task2.id,
    text: task2.text,
    filePath: task2.filePath,
    lineNumber: task2.lineNumber,
    taskKind: task2.taskKind,
    priority,
    priorityRank: normalizePriorityRank(task2.priority),
    estimateMinutes: task2.estimateMinutes,
    progressPercent: task2.progressPercent,
    dates: task2.dates,
    project: task2.project,
    context: task2.context,
    reason
  };
}

// tests/aiScheduleContext.test.ts
var settings = {
  triggerTags: ["task", "todo"],
  weekStartsOn: 1,
  readLegacyEmojiDates: true,
  includedPathPrefixes: ["\u89C4\u5212/"],
  excludedPathPrefixes: ["time-blocks-data/", ".obsidian/", ".trash/"],
  primaryScheduleField: "scheduled",
  estimateField: "estimate",
  showAllDataviewFields: true,
  reviewPressureEnabled: true,
  reviewBaseMinutes: 2,
  reviewCharsPerMinute: 800,
  defaultUnestimatedTaskMinutes: 30,
  monthHeatmapMode: "task-estimate-plus-review",
  scheduledDayFolder: "\u89C4\u5212/\u65E5"
};
(0, import_node_test.test)("builds AI schedule context with stable horizons and planning signals", () => {
  const reviewPressure = {
    "2026-06-18": { count: 1, minutes: 12, chars: 8e3 },
    "2026-06-20": { count: 2, minutes: 20, chars: 12e3 }
  };
  const context = buildAiScheduleContext({
    anchorDate: "2026-06-18",
    tasks: [
      task("u1", "Loose", {}, { priority: "P1" }),
      task("s1", "Scheduled", { scheduled: "2026-06-18" }, { estimateMinutes: 45, priority: "high" }),
      task("o1", "Overdue", { due: "2026-06-17" }, { priority: "low" }),
      task("l1", "Long", { start: "2026-06-10", due: "2026-06-22" }, { taskKind: "long", estimateMinutes: 600, progressPercent: 25 })
    ],
    reviewPressure,
    settings
  });
  import_node_assert.strict.equal(AI_SCHEDULE_CONTEXT_PATH, "Calendar-Bridge/ai-schedule-context.json");
  import_node_assert.strict.deepEqual(Object.keys(context.dailyLoadsByHorizon), ["7", "14", "30"]);
  import_node_assert.strict.equal(context.dailyLoadsByHorizon["7"].length, 7);
  import_node_assert.strict.equal(context.dailyLoadsByHorizon["30"].at(-1)?.date, "2026-07-17");
  import_node_assert.strict.deepEqual(context.dailyLoadsByHorizon["7"][0], {
    date: "2026-06-18",
    taskMinutes: 45,
    reviewMinutes: 12,
    totalMinutes: 57
  });
  import_node_assert.strict.deepEqual(context.unscheduledTasks.map((item) => ({ id: item.id, priority: item.priority, priorityRank: item.priorityRank })), [
    { id: "u1", priority: "highest", priorityRank: 1 },
    { id: "o1", priority: "low", priorityRank: 4 }
  ]);
  import_node_assert.strict.deepEqual(context.overdueTasks.map((item) => item.id), ["o1"]);
  import_node_assert.strict.deepEqual(context.longTaskProgress.map((item) => ({
    id: item.task.id,
    status: item.status,
    dailyEstimatedMinutes: item.dailyEstimatedMinutes
  })), [{ id: "l1", status: "behind", dailyEstimatedMinutes: 113 }]);
  import_node_assert.strict.equal(context.settings.defaultUnestimatedTaskMinutes, 30);
  import_node_assert.strict.equal(context.writePolicy.mode, "confirm-before-write");
});
(0, import_node_test.test)("syncs AI schedule context only when exported JSON changes", async () => {
  const fakeApp = createFakeApp();
  const exporter = new AiScheduleContextExporter(fakeApp);
  const input = { anchorDate: "2026-06-18", tasks: [task("u1", "Loose")], reviewPressure: {}, settings };
  import_node_assert.strict.equal(await exporter.sync(input), "created");
  import_node_assert.strict.deepEqual(fakeApp.createdFolders, ["Calendar-Bridge"]);
  import_node_assert.strict.equal(fakeApp.createdFiles.length, 1);
  import_node_assert.strict.equal(await exporter.sync(input), "unchanged");
  import_node_assert.strict.equal(fakeApp.modifiedFiles.length, 0);
  import_node_assert.strict.equal(await exporter.sync({ ...input, tasks: [task("u1", "Loose"), task("u2", "New")] }), "updated");
  import_node_assert.strict.equal(fakeApp.modifiedFiles.length, 1);
});
function task(id, text, dates = {}, options = {}) {
  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const isLong = options.taskKind === "long";
  return {
    id,
    text,
    filePath: options.filePath ?? "\u89C4\u5212/\u4EE3\u529E/\u672A\u6392\u671F\u4EFB\u52A1\u6C60.md",
    lineNumber: Number(id.charCodeAt(0)),
    rawLine: `- [${options.completed ? "x" : " "}] ${text}`,
    completed: options.completed ?? false,
    metadata: {},
    dates,
    dateSources: {},
    taskKind: isLong ? "long" : "point",
    indentLevel: options.indentLevel ?? 0,
    createdDate: dates.created,
    progressPercent: options.progressPercent ?? 0,
    scheduleDate,
    spanStart: isLong ? dates.start : void 0,
    spanEnd: isLong ? dates.due : void 0,
    dueDate: dates.due,
    dateSource: scheduleDate ? "dataview" : "none",
    triggerType: "inline",
    ...options
  };
}
function createFakeApp() {
  const folders = /* @__PURE__ */ new Set();
  const files = /* @__PURE__ */ new Map();
  const fakeApp = {
    createdFolders: [],
    createdFiles: [],
    modifiedFiles: [],
    vault: {
      getAbstractFileByPath(path) {
        if (files.has(path))
          return files.get(path);
        if (folders.has(path))
          return { path };
        return null;
      },
      async createFolder(path) {
        folders.add(path);
        fakeApp.createdFolders.push(path);
      },
      async create(path, content) {
        const file = { path, extension: "json", content };
        files.set(path, file);
        fakeApp.createdFiles.push(path);
        return file;
      },
      async read(file) {
        return file.content;
      },
      async modify(file, content) {
        file.content = content;
        fakeApp.modifiedFiles.push(file.path);
      }
    }
  };
  return fakeApp;
}
