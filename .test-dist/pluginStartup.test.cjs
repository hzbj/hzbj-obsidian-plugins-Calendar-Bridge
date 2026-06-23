// tests/pluginStartup.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// tests/mocks/obsidian.ts
var Notice = class _Notice {
  static messages = [];
  constructor(message) {
    _Notice.messages.push(message);
  }
};
var Component = class {
  registerEvent(eventRef) {
  }
};
var Plugin = class extends Component {
  app;
  manifest;
  registeredViews = [];
  commands = [];
  ribbonIcons = [];
  settingTabs = [];
  async loadData() {
    return void 0;
  }
  async saveData(data) {
  }
  registerView(type, viewCreator) {
    this.registeredViews.push(type);
  }
  addSettingTab(tab) {
    this.settingTabs.push(tab);
  }
  addRibbonIcon(icon, title, callback) {
    this.ribbonIcons.push(icon);
  }
  addCommand(command) {
    this.commands.push(command.id);
  }
};
var PluginSettingTab = class {
  app;
  plugin;
  containerEl;
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {};
  }
};
var ItemView = class {
  leaf;
  containerEl;
  constructor(leaf) {
    this.leaf = leaf;
    this.containerEl = { children: [{}, {}] };
  }
};
var Modal = class {
  app;
  contentEl;
  constructor(app) {
    this.app = app;
    this.contentEl = {
      empty: () => void 0,
      createEl: () => ({
        addEventListener: () => void 0
      }),
      createDiv: () => ({
        createEl: () => ({
          addEventListener: () => void 0
        }),
        createDiv: () => void 0
      })
    };
  }
  open() {
    this.onOpen();
  }
  close() {
    this.onClose();
  }
  onOpen() {
  }
  onClose() {
  }
};
var TFile = class {
  path;
  extension;
  constructor(path) {
    this.path = path;
    this.extension = "md";
  }
};
var Setting = class {
  constructor(containerEl) {
  }
  setName() {
    return this;
  }
  setDesc() {
    return this;
  }
  addText() {
    return this;
  }
  addToggle() {
    return this;
  }
  addDropdown() {
    return this;
  }
};

// src/models/constants.ts
var VIEW_TYPE_PERSONAL_SYSTEM = "personal-scheduler-view";
var DEFAULT_DATA = {
  version: 1,
  settings: {
    triggerTags: ["task", "todo"],
    weekStartsOn: 1,
    readLegacyEmojiDates: true,
    includedPathPrefixes: [],
    excludedPathPrefixes: ["time-blocks-data/", ".obsidian/", ".trash/"],
    primaryScheduleField: "scheduled",
    estimateField: "estimate",
    showAllDataviewFields: true,
    reviewPressureEnabled: true,
    reviewBaseMinutes: 2,
    reviewCharsPerMinute: 800,
    defaultUnestimatedTaskMinutes: 30,
    monthHeatmapMode: "task-estimate-plus-review",
    scheduledDayFolder: "Calendar/Scheduled",
    archiveHeading: "\u5F52\u6863",
    scheduleInPlacePathPrefixes: ["\u89C4\u5212/\u9636\u6BB5"]
  },
  ui: {
    sourceTaskGroups: {
      order: [],
      collapsed: {},
      sortMode: "manual"
    }
  }
};

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
var INLINE_FIELD_RE = /\[([^\[\]\n:]+)::\s*([^\]\n]*)\]/gu;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
var LEGACY_EMOJI_DATE_RE = /\s*(?:📅|馃搮)\s*(\d{4}-\d{2}-\d{2})\s*/u;
var DATE_FIELDS = ["due", "scheduled", "start", "completion", "created"];
var LONG_TASK_SYNC_TAG = "#\u957F\u4EFB\u52A1";
function extractTaskMetadata(line, readLegacyEmojiDates) {
  const metadata = {};
  const dates = {};
  const dateSources = {};
  for (const match of line.matchAll(INLINE_FIELD_RE)) {
    const key = normalizeFieldKey(match[1]);
    const value = match[2].trim();
    if (!metadata[key])
      metadata[key] = [];
    metadata[key].push(value);
    if (isDateField(key) && DATE_RE.test(value)) {
      dates[key] = value;
      dateSources[key] = "dataview";
    }
  }
  if (!dates.due && readLegacyEmojiDates) {
    const legacy = line.match(LEGACY_EMOJI_DATE_RE);
    if (legacy) {
      dates.due = legacy[1];
      dateSources.due = "emoji";
    }
  }
  const scheduleDate = dates.scheduled;
  const scheduleSource = scheduleDate ? dateSources.scheduled ?? "none" : "none";
  const plainEstimateMinutes = extractPlainEstimateMinutes(line);
  const estimateMinutes = plainEstimateMinutes ?? firstParsedDuration(metadata.estimate);
  const durationMinutes = firstParsedDuration(metadata.duration);
  const spanEnd = getRangeEndDate(dates);
  const spanStart = dates.start && spanEnd ? dates.start : void 0;
  const progressPercent = parseProgressPercent(first(metadata.progress));
  const plannedDate = firstDate(metadata.planned);
  return {
    metadata,
    dates,
    dateSources,
    createdDate: dates.created,
    scheduleDate,
    spanStart,
    spanEnd: spanStart ? spanEnd : void 0,
    estimateMinutes,
    plainEstimateMinutes,
    progressPercent,
    plannedDate,
    durationMinutes,
    priority: first(metadata.priority),
    recurrence: first(metadata.recurrence) ?? first(metadata.repeat),
    project: first(metadata.project),
    context: first(metadata.context),
    dateSource: scheduleSource
  };
}
function parseDurationToMinutes(raw) {
  if (!raw)
    return void 0;
  const value = raw.trim().toLowerCase().replace(/\s+/gu, "").replace(/minutes?|mins?/gu, "m");
  if (!value)
    return void 0;
  const numeric = value.match(/^(\d+(?:\.\d+)?)$/u);
  if (numeric)
    return Math.round(Number.parseFloat(numeric[1]));
  const compact = value.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/u);
  if (compact && (compact[1] || compact[2])) {
    const hours = compact[1] ? Number.parseFloat(compact[1]) : 0;
    const minutes = compact[2] ? Number.parseInt(compact[2], 10) : 0;
    return Math.round(hours * 60 + minutes);
  }
  return void 0;
}
function setTaskScheduleDate(line, scheduledDate) {
  return appendField(removeFields(line, ["scheduled"]), "scheduled", scheduledDate);
}
function setPointTaskSchedule(line, scheduledDate, defaultEstimateMinutes, createdDate) {
  const parsed = extractTaskMetadata(line, false);
  let updated = removePluginScheduleFields(line);
  if (parsed.plainEstimateMinutes === void 0 && parsed.estimateMinutes === void 0) {
    updated = insertPlainEstimate(updated, defaultEstimateMinutes);
  }
  if (!parsed.createdDate) {
    updated = appendField(updated, "created", createdDate);
  }
  return appendField(updated, "scheduled", scheduledDate);
}
function setTaskSpanDates(line, startDate, scheduledDate) {
  const taggedLine = ensureTag(line, LONG_TASK_SYNC_TAG);
  return appendField(appendField(removePluginScheduleFields(taggedLine), "start", startDate), "scheduled", scheduledDate);
}
function setTaskEstimate(line, estimateMinutes) {
  return appendField(removeFields(line, ["estimate"]), "estimate", `${Math.max(0, Math.round(estimateMinutes))}m`);
}
function setTaskProgress(line, progressPercent) {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  return appendField(removeFields(line, ["progress"]), "progress", `${clamped}%`);
}
function setTaskPlannedDate(line, plannedDate) {
  return appendField(removeFields(line, ["planned"]), "planned", plannedDate);
}
function clearTaskPlannedDate(line) {
  return removeFields(line, ["planned"]);
}
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
function setTaskPriority(line, priority) {
  const normalized = normalizeTaskPriority(priority);
  if (!normalized)
    return removeFields(line, ["priority"]);
  return appendField(removeFields(line, ["priority"]), "priority", normalized);
}
function clearTaskScheduleDates(line) {
  return removeTag(removePluginScheduleFields(line), LONG_TASK_SYNC_TAG).replace(/[ \t]+$/u, "");
}
function cleanTaskDisplayText(line, triggerTags) {
  const withoutCheckbox = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "");
  const withoutFields = withoutCheckbox.replace(INLINE_FIELD_RE, " ").replace(LEGACY_EMOJI_DATE_RE, " ");
  const tagSet = new Set([...triggerTags, LONG_TASK_SYNC_TAG.slice(1)].map((tag) => tag.toLowerCase()));
  return withoutFields.split(/\s+/u).filter((part) => {
    if (!part.startsWith("#"))
      return true;
    return !tagSet.has(part.slice(1).toLowerCase());
  }).filter((part) => !isPlainEstimateToken(part)).join(" ").replace(/\s+/gu, " ").trim();
}
function cleanTaskContentText(line) {
  const withoutCheckbox = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "");
  const withoutFields = withoutCheckbox.replace(INLINE_FIELD_RE, " ").replace(LEGACY_EMOJI_DATE_RE, " ");
  return withoutFields.split(/\s+/u).filter((part) => part && !part.startsWith("#") && !isPlainEstimateToken(part)).join(" ").replace(/\s+/gu, " ").trim();
}
function removeFields(line, fields) {
  const fieldSet = new Set(fields.map(normalizeFieldKey));
  return line.replace(INLINE_FIELD_RE, (full, rawKey) => fieldSet.has(normalizeFieldKey(rawKey)) ? " " : full).replace(/[ \t]+$/u, "").replace(/[ \t]{2,}(?=\[[^\]]+::)/gu, " ");
}
function removePluginScheduleFields(line) {
  return removeFields(line, ["start", "scheduled"]);
}
function appendField(line, field, value) {
  return `${line.replace(/[ \t]+$/u, "")} [${field}:: ${value}]`;
}
function ensureTag(line, tag) {
  if (line.split(/\s+/u).includes(tag))
    return line;
  const firstField = line.search(INLINE_FIELD_RE);
  if (firstField < 0)
    return `${line.replace(/[ \t]+$/u, "")} ${tag}`;
  const before = line.slice(0, firstField).replace(/[ \t]+$/u, "");
  const after = line.slice(firstField).replace(/^[ \t]+/u, "");
  return `${before} ${tag} ${after}`;
}
function removeTag(line, tag) {
  return line.split(/(\s+)/u).filter((part) => part !== tag).join("").replace(/[ \t]{2,}/gu, " ").replace(/[ \t]+$/u, "");
}
function insertPlainEstimate(line, estimateMinutes) {
  const estimate = formatDuration(estimateMinutes);
  const firstField = line.search(INLINE_FIELD_RE);
  if (firstField < 0)
    return `${line.replace(/[ \t]+$/u, "")} ${estimate}`;
  const before = line.slice(0, firstField).replace(/[ \t]+$/u, "");
  const after = line.slice(firstField).replace(/^[ \t]+/u, "");
  return `${before} ${estimate} ${after}`;
}
function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded >= 60 && rounded % 60 === 0)
    return `${rounded / 60}h`;
  if (rounded >= 60)
    return `${Math.floor(rounded / 60)}h${rounded % 60}m`;
  return `${rounded}m`;
}
function normalizeFieldKey(raw) {
  return raw.trim().toLowerCase();
}
function isDateField(key) {
  return DATE_FIELDS.includes(key);
}
function getRangeEndDate(dates) {
  if (!dates.start)
    return void 0;
  for (const candidate of [dates.scheduled]) {
    if (candidate && dates.start < candidate)
      return candidate;
  }
  return void 0;
}
function first(values) {
  return values?.find((value) => value.trim().length > 0)?.trim();
}
function firstParsedDuration(values) {
  for (const value of values ?? []) {
    const parsed = parseDurationToMinutes(value);
    if (parsed !== void 0)
      return parsed;
  }
  return void 0;
}
function firstDate(values) {
  return values?.find((value) => DATE_RE.test(value.trim()))?.trim();
}
function extractPlainEstimateMinutes(line) {
  const body = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "").replace(INLINE_FIELD_RE, " ");
  for (const part of body.split(/\s+/u)) {
    if (!isPlainEstimateToken(part))
      continue;
    const parsed = parseDurationToMinutes(part);
    if (parsed !== void 0)
      return parsed;
  }
  return void 0;
}
function isPlainEstimateToken(part) {
  return /^(?:(?:\d+(?:\.\d+)?)h)?(?:(?:\d+)m)?$/u.test(part.toLowerCase()) && /[hm]/iu.test(part);
}
function parseProgressPercent(raw) {
  if (!raw)
    return 0;
  const numeric = raw.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/u);
  if (!numeric)
    return 0;
  return Math.min(100, Math.max(0, Number.parseFloat(numeric[1])));
}

// src/services/CalendarViewModel.ts
function buildMonthViewModel(anchorDate, tasks, weekStartsOn, reviewPressure = {}, defaultUnestimatedTaskMinutes = 30, sourceGroupState = {}, paceDate = todayString()) {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "month", sourceGroupState, paceDate);
}
function buildWeekViewModel(anchorDate, tasks, weekStartsOn, reviewPressure = {}, defaultUnestimatedTaskMinutes = 30, paceDate = todayString()) {
  const days = weekDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "week", {}, paceDate);
}
function buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, mode, sourceGroupState = {}, paceDate) {
  const activeTasks = tasks.filter((task2) => !task2.completed);
  const activeTasksById = new Map(activeTasks.map((task2) => [task2.id, task2]));
  const allTasksById = new Map(tasks.map((task2) => [task2.id, task2]));
  const recurringLoadTasks = mode === "week" ? dedupeWeekRecurringLoadTasks(activeTasks.filter(isRecurringLoadTask)) : tasks.filter(isRecurringLoadTask);
  const recurringLoadTaskLookup = mode === "month" ? allTasksById : activeTasksById;
  const concreteActiveTasks = activeTasks.filter((task2) => !isRecurringLoadTask(task2));
  const loadTasks = (mode === "month" ? tasks : activeTasks).filter((task2) => !isRecurringLoadTask(task2));
  const pointTasks = concreteActiveTasks.filter((task2) => task2.taskKind !== "long");
  const pointLoadTasks = loadTasks.filter((task2) => task2.taskKind !== "long");
  const longTasks = concreteActiveTasks.filter((task2) => task2.taskKind === "long");
  const topLevelLongTasks = longTasks.filter((task2) => !task2.parentLongTaskId);
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
      recurringTaskCount: 0,
      recurringTaskMinutes: 0,
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
    }
  }
  addRecurringTaskLoads(days, dayLoads, recurringLoadTasks, recurringLoadTaskLookup, defaultUnestimatedTaskMinutes);
  for (const load of Object.values(dayLoads)) {
    load.heatScore = load.taskMinutes + load.recurringTaskMinutes + load.reviewMinutes;
  }
  const overdueTasks = pointTasks.flatMap((task2) => {
    const reason = getOverdueReason(task2, todayStringFromAnchor(anchorDate));
    return reason ? [{ ...task2, overdueReason: reason }] : [];
  });
  const unifiedUnscheduledTasks = concreteActiveTasks.flatMap((task2) => {
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
    spanBars: mode === "month" ? buildSpanBars(days, concreteActiveTasks) : [],
    longTaskTimelineRows: mode === "month" ? buildLongTaskTimelineRows(days, topLevelLongTasks, childTasksByLongTaskId, paceDate) : [],
    sourceTaskGroups: mode === "month" ? buildSourceTaskGroups(unifiedUnscheduledTasks, sourceGroupState) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, paceDate),
    longUnscheduledTasks: longTasks.filter((task2) => !task2.spanStart || !task2.spanEnd)
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
  for (const [parentId, children] of byParent) {
    byParent.set(parentId, sortLongTaskChildren(children));
  }
  return byParent;
}
function sortLongTaskChildren(tasks) {
  return [...tasks].sort((a, b) => {
    const leftDate = childTaskSortDate(a);
    const rightDate = childTaskSortDate(b);
    if (leftDate && rightDate) {
      const dateCompare = leftDate.localeCompare(rightDate);
      if (dateCompare !== 0)
        return dateCompare;
    } else if (leftDate) {
      return -1;
    } else if (rightDate) {
      return 1;
    }
    const endCompare = (a.spanEnd ?? "").localeCompare(b.spanEnd ?? "");
    if (endCompare !== 0)
      return endCompare;
    return a.id.localeCompare(b.id);
  });
}
function childTaskSortDate(task2) {
  if (task2.taskKind === "long")
    return task2.spanStart ?? task2.scheduleDate;
  return task2.scheduleDate;
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
      status: longTaskPaceStatus(progressPercent, expectedProgressPercent)
    };
  });
}
function isLongTaskOverdue(task2, today) {
  return Boolean(task2.spanEnd && task2.spanEnd < today && (task2.progressPercent ?? 0) < 100);
}
function buildLongTaskTimelineRows(days, tasks, childTasksByLongTaskId, today) {
  const monthDays = days.filter((day) => day.inCurrentMonth);
  const first2 = monthDays[0]?.date;
  const last = monthDays[monthDays.length - 1]?.date;
  if (!first2 || !last)
    return [];
  return tasks.filter((task2) => task2.spanStart && task2.spanEnd && task2.spanEnd >= first2 && task2.spanStart <= last).sort((a, b) => {
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
    const visibleStartDate = fullStartDate < first2 ? first2 : fullStartDate;
    const visibleEndDate = fullEndDate > last ? last : fullEndDate;
    const progressPercent = task2.progressPercent ?? 0;
    const totalDays = Math.max(1, diffDays(fullStartDate, fullEndDate));
    const daysElapsed = Math.min(totalDays, Math.max(0, diffDays(fullStartDate, today)));
    const expectedProgressPercent = Math.min(100, Math.round(daysElapsed / totalDays * 100));
    const overdue = isLongTaskOverdue(task2, today);
    return {
      task: task2,
      childTasks: childTasksByLongTaskId.get(task2.id) ?? [],
      fullStartDate,
      fullEndDate,
      visibleStartDate,
      visibleEndDate,
      startDay: Number.parseInt(visibleStartDate.slice(8, 10), 10),
      endDay: Number.parseInt(visibleEndDate.slice(8, 10), 10),
      isClippedStart: fullStartDate < first2,
      isClippedEnd: fullEndDate > last,
      daysLeft: Math.max(0, diffDays(today, fullEndDate)),
      progressPercent,
      status: overdue ? "behind" : longTaskPaceStatus(progressPercent, expectedProgressPercent)
    };
  });
}
function longTaskPaceStatus(progressPercent, expectedProgressPercent) {
  return progressPercent + 5 < expectedProgressPercent ? "behind" : progressPercent > expectedProgressPercent + 5 ? "ahead" : "on-track";
}
function buildSpanBars(days, tasks) {
  const first2 = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first2 || !last)
    return [];
  const indexByDate = new Map(days.map((day, index) => [day.date, index]));
  const bars = [];
  for (const task2 of tasks) {
    if (!task2.spanStart || !task2.spanEnd || task2.spanEnd < first2 || task2.spanStart > last)
      continue;
    const startDate = task2.spanStart < first2 ? first2 : task2.spanStart;
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
      recurringTaskCount: dayLoads[day.date]?.recurringTaskCount ?? 0,
      recurringTaskMinutes: dayLoads[day.date]?.recurringTaskMinutes ?? 0,
      taskMinutes: (dayLoads[day.date]?.taskMinutes ?? 0) + (dayLoads[day.date]?.recurringTaskMinutes ?? 0),
      review,
      totalMinutes: (dayLoads[day.date]?.taskMinutes ?? 0) + (dayLoads[day.date]?.recurringTaskMinutes ?? 0) + review.minutes
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
function isRecurringLoadTask(task2) {
  return recurringFrequency(task2) !== void 0 && Boolean(task2.dates.start);
}
function recurringFrequency(task2) {
  const normalized = task2.recurrence?.trim().toLowerCase().replace(/\s+/gu, " ");
  if (normalized === "every day")
    return "day";
  if (normalized === "every week")
    return "week";
  if (normalized === "every month")
    return "month";
  if (normalized === "every year")
    return "year";
  return void 0;
}
function addRecurringTaskLoads(days, dayLoads, tasks, tasksById, defaultUnestimatedTaskMinutes) {
  for (const task2 of tasks) {
    const frequency = recurringFrequency(task2);
    const startDate = task2.dates.start;
    if (!frequency || !startDate)
      continue;
    const endDate = recurringEndDate(task2, tasksById);
    if (endDate && startDate > endDate)
      continue;
    for (const day of days) {
      if (day.date < startDate)
        continue;
      if (endDate && day.date > endDate)
        continue;
      if (!recursOnDate(startDate, day.date, frequency))
        continue;
      const load = dayLoads[day.date];
      load.recurringTaskCount += 1;
      load.recurringTaskMinutes += task2.estimateMinutes ?? defaultUnestimatedTaskMinutes;
    }
  }
}
function dedupeWeekRecurringLoadTasks(tasks) {
  const latestByKey = /* @__PURE__ */ new Map();
  for (const task2 of tasks) {
    const key = recurringDedupeKey(task2);
    const existing = latestByKey.get(key);
    if (!existing || compareRecurringTaskStart(task2, existing) > 0) {
      latestByKey.set(key, task2);
    }
  }
  return [...latestByKey.values()];
}
function recurringDedupeKey(task2) {
  const content = (cleanTaskContentText(task2.rawLine) || task2.text).toLowerCase().replace(/\s+/gu, " ").trim();
  const recurrence = task2.recurrence?.trim().toLowerCase().replace(/\s+/gu, " ") ?? "";
  const context = task2.parentLongTaskId ?? task2.filePath;
  return `${context}
${recurrence}
${content}`;
}
function compareRecurringTaskStart(left, right) {
  const leftStart = isValidDate(left.dates.start) ? left.dates.start : "";
  const rightStart = isValidDate(right.dates.start) ? right.dates.start : "";
  const startCompare = leftStart.localeCompare(rightStart);
  if (startCompare !== 0)
    return startCompare;
  const lineCompare = left.lineNumber - right.lineNumber;
  if (lineCompare !== 0)
    return lineCompare;
  return left.id.localeCompare(right.id);
}
function recurringEndDate(task2, tasksById) {
  const completionEnd = task2.completed ? task2.dates.completion : void 0;
  if (task2.dates.scheduled)
    return earlierDate(task2.dates.scheduled, completionEnd);
  const parent = task2.parentLongTaskId ? tasksById.get(task2.parentLongTaskId) : void 0;
  return earlierDate(parent?.spanEnd ?? parent?.dates.scheduled, completionEnd);
}
function earlierDate(left, right) {
  if (!left)
    return right;
  if (!right)
    return left;
  return left < right ? left : right;
}
function recursOnDate(startDate, date, frequency) {
  if (frequency === "day")
    return true;
  const start = parseDateParts(startDate);
  const current = parseDateParts(date);
  if (!start || !current)
    return false;
  if (frequency === "week")
    return dayOfWeek(startDate) === dayOfWeek(date);
  if (frequency === "month")
    return current.day === start.day;
  return current.month === start.month && current.day === start.day;
}
function parseDateParts(date) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match)
    return void 0;
  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10)
  };
}
function isValidDate(date) {
  return Boolean(date && parseDateParts(date));
}
function dayOfWeek(date) {
  return (/* @__PURE__ */ new Date(`${date}T00:00:00`)).getDay();
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
    input.settings.defaultUnestimatedTaskMinutes,
    {},
    input.anchorDate
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

// src/services/ReviewPressure.ts
function parseReviewFrontmatter(filePath, content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match)
    return null;
  const frontmatter = parseSimpleYaml(match[1]);
  const knowledgeType = frontmatter["\u77E5\u8BC6\u7C7B\u578B"];
  const status = frontmatter["\u590D\u4E60\u72B6\u6001"];
  const nextReview = frontmatter["\u4E0B\u6B21\u590D\u4E60"];
  const description = frontmatter.description;
  if (!knowledgeType && !nextReview)
    return null;
  return {
    filePath,
    knowledgeType,
    status,
    nextReview,
    description,
    contentChars: countContentChars(match[2])
  };
}
function buildReviewPressureByDate(notes, options) {
  const pressure = {};
  const charsPerMinute = Math.max(1, options.charsPerMinute);
  for (const note of notes) {
    if (!note || note.knowledgeType !== "\u5185\u5316" || note.status === "\u6682\u505C" || !note.nextReview)
      continue;
    const date = note.nextReview < options.today ? options.today : note.nextReview;
    const minutes = Math.max(1, options.baseMinutes) + Math.ceil(note.contentChars / charsPerMinute);
    const current = pressure[date] ?? { count: 0, minutes: 0, chars: 0 };
    pressure[date] = {
      count: current.count + 1,
      minutes: current.minutes + minutes,
      chars: current.chars + note.contentChars
    };
  }
  return pressure;
}
var ReviewPressureScanner = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  async scanReviewPressure() {
    const settings = this.getSettings();
    if (!settings.reviewPressureEnabled)
      return {};
    const notes = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isExcludedPath(file.path, settings.excludedPathPrefixes))
        continue;
      const content = await this.app.vault.cachedRead(file);
      const note = parseReviewFrontmatter(file.path, content);
      if (note)
        notes.push(note);
    }
    return buildReviewPressureByDate(notes, {
      today: todayString(),
      baseMinutes: settings.reviewBaseMinutes,
      charsPerMinute: settings.reviewCharsPerMinute
    });
  }
};
function parseSimpleYaml(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/u)) {
    const match = line.match(/^([^:#][^:]*):\s*(.*?)\s*$/u);
    if (!match)
      continue;
    values[match[1].trim()] = String(match[2]).replace(/^["']|["']$/gu, "").trim();
  }
  return values;
}
function countContentChars(body) {
  return body.replace(/\s+/gu, "").length;
}
function isExcludedPath(filePath, prefixes) {
  return prefixes.some((prefix) => filePath === prefix.replace(/\/$/u, "") || filePath.startsWith(prefix));
}

// src/services/TaskArchiveService.ts
var TOP_LEVEL_COMPLETED_TASK_RE = /^[-*]\s+\[[xX]\]\s+/u;
var CHECKBOX_TASK_RE = /^(\s*)[-*]\s+\[([ xX])\]\s+/u;
function archiveCompletedTopLevelTasks(content, rawHeading) {
  const heading = normalizeArchiveHeading(rawHeading);
  const lines = content.split(/\r?\n/u);
  const originalHeadingInfo = findHeading(lines, heading);
  const originalArchiveStart = originalHeadingInfo ? originalHeadingInfo.index + 1 : -1;
  const originalArchiveEnd = originalHeadingInfo ? findHeadingSectionEnd(lines, originalHeadingInfo.index, originalHeadingInfo.level) : -1;
  const moved = [];
  let archivedCount = 0;
  const kept = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (index >= originalArchiveStart && index < originalArchiveEnd) {
      kept.push(line);
      index += 1;
      continue;
    }
    if (!isCompletedTopLevelTask(line)) {
      kept.push(line);
      index += 1;
      continue;
    }
    const blockEnd = findTaskBlockEnd(lines, index, 0);
    moved.push(...lines.slice(index, blockEnd));
    archivedCount += 1;
    index = blockEnd;
  }
  if (moved.length === 0)
    return { content, archivedCount: 0 };
  const headingInfo = findHeading(kept, heading);
  if (!headingInfo) {
    const base = trimTrailingBlankLines(kept);
    return {
      content: [...base, "", `# ${heading}`, ...moved].join("\n"),
      archivedCount
    };
  }
  const insertIndex = findHeadingSectionEnd(kept, headingInfo.index, headingInfo.level);
  const before = trimTrailingBlankLines(kept.slice(0, insertIndex));
  const after = kept.slice(insertIndex);
  return {
    content: [...before, ...moved, ...after].join("\n"),
    archivedCount
  };
}
var TaskArchiveService = class {
  constructor(app) {
    this.app = app;
  }
  async archiveCompletedTopLevelTasks(file, heading) {
    const content = await this.app.vault.read(file);
    const archived = archiveCompletedTopLevelTasks(content, heading);
    if (archived.archivedCount === 0 || archived.content === content)
      return archived.archivedCount;
    await this.app.vault.modify(file, archived.content);
    return archived.archivedCount;
  }
};
function normalizeArchiveHeading(raw) {
  return raw.trim().replace(/^#+\s*/u, "").trim() || "\u5F52\u6863";
}
function isCompletedTopLevelTask(line) {
  return TOP_LEVEL_COMPLETED_TASK_RE.test(line);
}
function findTaskBlockEnd(lines, taskIndex, parentIndent) {
  for (let index = taskIndex + 1; index < lines.length; index += 1) {
    if (/^(#{1,6})\s+/u.test(lines[index]))
      return index;
    const task2 = lines[index].match(CHECKBOX_TASK_RE);
    if (task2 && countIndentColumns(task2[1]) <= parentIndent)
      return index;
  }
  return lines.length;
}
function countIndentColumns(indent) {
  return [...indent].reduce((columns, char) => columns + (char === "	" ? 2 : 1), 0);
}
function findHeading(lines, heading) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match)
      continue;
    if (match[2].trim() === heading)
      return { index, level: match[1].length };
  }
  return void 0;
}
function findHeadingSectionEnd(lines, headingIndex, headingLevel) {
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/u);
    if (match && match[1].length <= headingLevel)
      return index;
  }
  return lines.length;
}
function trimTrailingBlankLines(lines) {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  return trimmed;
}

// src/services/TaskDateWriter.ts
var CHECKBOX_TASK_RE2 = /^(\s*)[-*]\s+\[[ xX]\]\s+/u;
function buildScheduledDayFilePath(folderPath, scheduledDate) {
  const folder = folderPath.trim().replace(/\\/gu, "/").replace(/\/+$/u, "") || "Calendar/Scheduled";
  const fileName = `${scheduledDate.replace(/-/gu, "")}.md`;
  return `${folder}/${fileName}`.replace(/\/{2,}/gu, "/");
}
function moveTaskLineToScheduledDayContent(input) {
  const sourceLines = input.sourceContent.split(/\r?\n/u);
  if (input.sourceLineNumber < 0 || input.sourceLineNumber >= sourceLines.length || sourceLines[input.sourceLineNumber] === void 0) {
    throw new Error(`Task line ${input.sourceLineNumber} is outside source content`);
  }
  const [rawLine] = sourceLines.splice(input.sourceLineNumber, 1);
  const scheduledLine = setPointTaskSchedule(rawLine, input.scheduledDate, input.defaultEstimateMinutes, input.createdDate);
  const sourceContent = sourceLines.join("\n");
  const targetBase = input.targetContent.trimEnd();
  const targetContent = `${targetBase ? `${targetBase}
` : ""}${scheduledLine}
`;
  return { sourceContent, targetContent };
}
function insertChildTaskContent(sourceContent, parentLineNumber, rawChildContent) {
  const childContent = normalizeChildTaskContent(rawChildContent);
  if (!childContent)
    throw new Error("Child task content is empty");
  const lines = sourceContent.split(/\r?\n/u);
  if (parentLineNumber < 0 || parentLineNumber >= lines.length || lines[parentLineNumber] === void 0) {
    throw new Error(`Task line ${parentLineNumber} is outside source content`);
  }
  const parent = lines[parentLineNumber].match(CHECKBOX_TASK_RE2);
  if (!parent)
    throw new Error(`Line ${parentLineNumber} is not a task line`);
  const parentIndent = countIndentColumns2(parent[1]);
  const blockEnd = findTaskBlockEnd2(lines, parentLineNumber, parentIndent);
  const insertIndex = blockEnd === lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : blockEnd;
  const childIndent = `${parent[1]}  `;
  lines.splice(insertIndex, 0, `${childIndent}- [ ] ${childContent}`);
  return lines.join("\n");
}
var TaskDateWriter = class {
  constructor(app) {
    this.app = app;
  }
  async setScheduleDate(file, lineNumber, scheduledDate) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskScheduleDate(line, scheduledDate));
  }
  async setPointSchedule(file, lineNumber, scheduledDate, defaultEstimateMinutes, createdDate) {
    await this.replaceTaskLine(file, lineNumber, (line) => setPointTaskSchedule(line, scheduledDate, defaultEstimateMinutes, createdDate));
  }
  async setSpanDates(file, lineNumber, startDate, scheduledDate) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskSpanDates(line, startDate, scheduledDate));
  }
  async setEstimate(file, lineNumber, estimateMinutes) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskEstimate(line, estimateMinutes));
  }
  async setProgress(file, lineNumber, progressPercent) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskProgress(line, progressPercent));
  }
  async setPlannedDate(file, lineNumber, plannedDate) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskPlannedDate(line, plannedDate));
  }
  async clearPlannedDate(file, lineNumber) {
    await this.replaceTaskLine(file, lineNumber, (line) => clearTaskPlannedDate(line));
  }
  async setPriority(file, lineNumber, priority) {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskPriority(line, priority));
  }
  async clearSchedule(file, lineNumber) {
    await this.replaceTaskLine(file, lineNumber, (line) => clearTaskScheduleDates(line));
  }
  async addChildTask(file, parentLineNumber, rawChildContent) {
    const content = await this.app.vault.read(file);
    await this.app.vault.modify(file, insertChildTaskContent(content, parentLineNumber, rawChildContent));
  }
  async movePointTaskToScheduledDay(file, lineNumber, scheduledDayFolder, scheduledDate, defaultEstimateMinutes, createdDate) {
    const sourceContent = await this.app.vault.read(file);
    const targetPath = buildScheduledDayFilePath(scheduledDayFolder, scheduledDate);
    if (file.path === targetPath) {
      await this.setPointSchedule(file, lineNumber, scheduledDate, defaultEstimateMinutes, createdDate);
      return;
    }
    await this.ensureFolder(targetPath.split("/").slice(0, -1).join("/"));
    const targetFile = await this.ensureFile(targetPath);
    const targetContent = await this.app.vault.read(targetFile);
    const moved = moveTaskLineToScheduledDayContent({
      sourceContent,
      sourceLineNumber: lineNumber,
      targetContent,
      scheduledDate,
      defaultEstimateMinutes,
      createdDate
    });
    await this.app.vault.modify(targetFile, moved.targetContent);
    try {
      await this.app.vault.modify(file, moved.sourceContent);
    } catch (error) {
      await this.app.vault.modify(targetFile, targetContent);
      throw error;
    }
  }
  async replaceTaskLine(file, lineNumber, replace) {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/u);
    if (lineNumber < 0 || lineNumber >= lines.length) {
      throw new Error(`Task line ${lineNumber} is outside ${file.path}`);
    }
    lines[lineNumber] = replace(lines[lineNumber]);
    await this.app.vault.modify(file, lines.join("\n"));
  }
  async ensureFile(path) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && "extension" in existing)
      return existing;
    return this.app.vault.create(path, `# ${path.split("/").pop()?.replace(/\.md$/u, "") ?? "Scheduled"}
`);
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
function findTaskBlockEnd2(lines, taskIndex, parentIndent) {
  for (let index = taskIndex + 1; index < lines.length; index += 1) {
    if (/^(#{1,6})\s+/u.test(lines[index]))
      return index;
    const task2 = lines[index].match(CHECKBOX_TASK_RE2);
    if (task2 && countIndentColumns2(task2[1]) <= parentIndent)
      return index;
  }
  return lines.length;
}
function countIndentColumns2(indent) {
  return [...indent].reduce((columns, char) => columns + (char === "	" ? 2 : 1), 0);
}
function normalizeChildTaskContent(raw) {
  return raw.replace(/\s+/gu, " ").trim();
}

// src/services/TaskPlanningGuards.ts
function isScheduledPointTask(task2) {
  return task2?.taskKind === "point" && Boolean(task2.dates.scheduled);
}

// src/services/TaskScanner.ts
var CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/u;
function scanMarkdownTasksFromText(filePath, content, options) {
  if (!isIncludedPath(filePath, options.includedPathPrefixes ?? []))
    return [];
  if (isExcludedPath2(filePath, options.excludedPathPrefixes ?? []))
    return [];
  const triggerType = options.forceExtract ? "phase-note" : "inline";
  const tasks = [];
  const indentStack = [];
  content.split(/\r?\n/u).forEach((line, lineNumber) => {
    const match = line.match(CHECKBOX_RE);
    if (!match)
      return;
    const metadata = extractTaskMetadata(line, options.readLegacyEmojiDates);
    const taskKind = metadata.dates.start ? "long" : "point";
    const id = `${filePath}:${lineNumber}`;
    const indentLevel = countIndentColumns3(line);
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indentLevel >= indentLevel) {
      indentStack.pop();
    }
    const parentLongTask = [...indentStack].reverse().find((item) => item.task.taskKind === "long")?.task;
    const task2 = {
      id,
      text: cleanTaskDisplayText(line, options.triggerTags),
      filePath,
      lineNumber,
      rawLine: line,
      completed: match[2].toLowerCase() === "x",
      metadata: metadata.metadata,
      dates: metadata.dates,
      dateSources: metadata.dateSources,
      taskKind,
      indentLevel,
      parentLongTaskId: parentLongTask?.id,
      parentLongTaskText: parentLongTask?.text,
      createdDate: metadata.createdDate,
      scheduleDate: metadata.scheduleDate,
      spanStart: taskKind === "long" ? metadata.dates.start : void 0,
      spanEnd: taskKind === "long" ? metadata.dates.scheduled : void 0,
      estimateMinutes: metadata.estimateMinutes,
      plainEstimateMinutes: metadata.plainEstimateMinutes,
      progressPercent: metadata.progressPercent,
      plannedDate: metadata.plannedDate,
      durationMinutes: metadata.durationMinutes,
      priority: metadata.priority,
      recurrence: metadata.recurrence,
      project: metadata.project,
      context: metadata.context,
      dueDate: metadata.dates.due,
      dateSource: metadata.dateSource,
      triggerType,
      phaseId: options.phaseId
    };
    tasks.push(task2);
    indentStack.push({ indentLevel, task: task2 });
  });
  return tasks;
}
function countIndentColumns3(line) {
  const indent = line.match(/^[\t ]*/u)?.[0] ?? "";
  return [...indent].reduce((columns, char) => columns + (char === "	" ? 2 : 1), 0);
}
var TaskScanner = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  async scanAllMarkdownTasks() {
    const settings = this.getSettings();
    const tasks = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!isIncludedPath(file.path, settings.includedPathPrefixes))
        continue;
      if (isExcludedPath2(file.path, settings.excludedPathPrefixes))
        continue;
      const cache = this.app.metadataCache.getFileCache(file);
      const phaseInfo = getPhaseInfo(cache);
      const isPhaseFile = phaseInfo.isPhaseNote || isPhaseTaskFilePath(file.path);
      const content = await this.app.vault.cachedRead(file);
      tasks.push(...scanMarkdownTasksFromText(file.path, content, {
        triggerTags: settings.triggerTags,
        readLegacyEmojiDates: settings.readLegacyEmojiDates,
        forceExtract: isPhaseFile,
        phaseId: phaseInfo.phaseId,
        includedPathPrefixes: settings.includedPathPrefixes,
        excludedPathPrefixes: settings.excludedPathPrefixes
      }));
    }
    return tasks;
  }
};
function getPhaseInfo(cache) {
  const frontmatter = cache?.frontmatter;
  if (!frontmatter)
    return { isPhaseNote: false };
  const tags = extractFrontmatterTags(cache);
  const isPhaseNote = frontmatter.phase === true || frontmatter.phase === "true" || tags.some((tag) => tag.toLowerCase() === "phase");
  const rawPhaseId = frontmatter["phase-id"];
  return {
    isPhaseNote,
    phaseId: typeof rawPhaseId === "string" && rawPhaseId.trim() ? rawPhaseId.trim() : void 0
  };
}
function extractFrontmatterTags(cache) {
  const tags = [];
  const rawTags = [cache.frontmatter?.tags, cache.frontmatter?.tag];
  for (const raw of rawTags) {
    if (Array.isArray(raw)) {
      tags.push(...raw.filter((item) => typeof item === "string"));
    } else if (typeof raw === "string") {
      tags.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
    }
  }
  return tags.map((tag) => tag.replace(/^#/, ""));
}
function isPhaseTaskFilePath(filePath) {
  return filePath.split("/").includes("\u9636\u6BB5");
}
function isIncludedPath(filePath, prefixes) {
  if (prefixes.length === 0)
    return true;
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}
function isExcludedPath2(filePath, prefixes) {
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}
function matchesPathPrefix(filePath, prefix) {
  const normalized = prefix.trim();
  if (!normalized)
    return false;
  const folder = normalized.replace(/\/$/u, "");
  return filePath === folder || filePath.startsWith(`${folder}/`);
}

// src/services/LongTaskTimelineDisplay.ts
function buildLongTimelineDisplay(monthDays, rows, today, pastDaysExpanded) {
  const pastDays = monthDays.filter((day) => day.date < today);
  const shouldFoldPast = !pastDaysExpanded && pastDays.length > 0;
  if (!shouldFoldPast) {
    return {
      days: monthDays.map(toDisplayDay),
      rows,
      pastDaysFolded: false,
      pastDayCount: pastDays.length
    };
  }
  const foldedPastDay = buildFoldedPastDay(pastDays);
  const days = [
    foldedPastDay,
    ...monthDays.filter((day) => day.date >= today).map(toDisplayDay)
  ];
  const indexByDate = new Map(days.map((day, index) => [day.date, index + 1]));
  return {
    days,
    rows: rows.flatMap((row) => {
      const startDay = row.visibleStartDate < today ? 1 : indexByDate.get(row.visibleStartDate);
      const endDay = row.visibleEndDate < today ? 1 : indexByDate.get(row.visibleEndDate);
      if (!startDay || !endDay)
        return [];
      return [{
        ...row,
        startDay,
        endDay,
        // A folded past segment is still part of the task range, but it no longer maps one-to-one to dates.
        isClippedStart: row.isClippedStart || row.visibleStartDate < today,
        isClippedEnd: row.isClippedEnd || row.visibleEndDate < today
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
  const first2 = pastDays[0];
  const last = pastDays[pastDays.length - 1];
  const label = first2.dayOfMonth === last.dayOfMonth ? String(first2.dayOfMonth) : `${first2.dayOfMonth}-${last.dayOfMonth}`;
  return {
    date: last.date,
    label,
    dayOfMonth: last.dayOfMonth,
    isToday: false,
    isFoldedPast: true,
    foldedStartDate: first2.date,
    foldedEndDate: last.date,
    foldedDayCount: pastDays.length
  };
}

// src/ui/pages/MonthPage.ts
var longRangeDraft = null;
var MONTH_HEAT_MAX_MINUTES = 14 * 60;
var MONTH_HEAT_MID_MINUTES = MONTH_HEAT_MAX_MINUTES / 2;
var MONTH_HEAT_GREEN = { r: 54, g: 147, b: 95 };
var MONTH_HEAT_ORANGE = { r: 208, g: 129, b: 36 };
var MONTH_HEAT_RED = { r: 191, g: 75, b: 69 };
function renderMonthPage(container, plugin, context) {
  container.empty();
  const groupState = getSourceGroupState(plugin);
  const viewMode = plugin.data.ui.monthTaskViewMode ?? "point";
  const calendarTasks = viewMode === "long" ? plugin.calendarTasks.filter((task2) => !isScheduledDayFilePath(task2.filePath, plugin.data.settings.scheduledDayFolder)) : plugin.calendarTasks;
  const model = buildMonthViewModel(
    context.anchorDate,
    calendarTasks,
    plugin.data.settings.weekStartsOn,
    plugin.reviewPressure,
    plugin.data.settings.defaultUnestimatedTaskMinutes,
    groupState
  );
  const shell = container.createDiv({ cls: "cb-calendar-shell" });
  if (viewMode === "long") {
    renderGroupedPool(shell.createDiv({ cls: "cb-panel cb-task-pool" }), plugin, model, viewMode);
    renderLongVerticalTimeline(shell.createDiv({ cls: "cb-panel cb-month" }), plugin, context, model, viewMode, () => renderMonthPage(container, plugin, context));
    return;
  }
  renderGroupedPool(shell.createDiv({ cls: "cb-panel cb-task-pool" }), plugin, model, viewMode);
  renderPointMonthGrid(shell.createDiv({ cls: "cb-panel cb-month" }), plugin, context, model, viewMode);
}
function renderGroupedPool(parent, plugin, model, viewMode) {
  setupUnscheduledDropTarget(parent, plugin);
  const state = getSourceGroupState(plugin);
  parent.createEl("h2", { text: "Unscheduled tasks" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => void plugin.rescanTasks());
  renderSortToggle(parent, plugin, state);
  const tasks = model.unifiedUnscheduledTasks.filter((task2) => isTaskVisibleInPool(task2, viewMode));
  const groups = buildSourceTaskGroups(tasks, state);
  if (groups.length === 0) {
    parent.createDiv({ cls: "cb-empty", text: "No unscheduled tasks." });
    return;
  }
  for (const group of groups)
    renderSourceGroup(parent, plugin, group, viewMode);
}
function isTaskVisibleInPool(task2, viewMode) {
  return true;
}
function renderSortToggle(parent, plugin, state) {
  const row = parent.createDiv({ cls: "cb-pool-controls" });
  row.createSpan({ cls: "cb-muted", text: "Sort" });
  const select = row.createEl("select");
  select.createEl("option", { value: "manual", text: "Manual" });
  select.createEl("option", { value: "priority", text: "Priority" });
  select.value = state.sortMode ?? "manual";
  select.addEventListener("change", async () => {
    getSourceGroupState(plugin).sortMode = select.value;
    await plugin.saveData(plugin.data);
    plugin.refreshViews();
  });
}
function renderSourceGroup(parent, plugin, group, viewMode) {
  const section = parent.createDiv({ cls: "cb-source-group" });
  const header = section.createDiv({ cls: "cb-source-group-header" });
  header.draggable = true;
  header.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("application/x-calendar-bridge-source-group", group.sourceFilePath);
  });
  header.addEventListener("dragover", (event) => event.preventDefault());
  header.addEventListener("drop", (event) => {
    event.preventDefault();
    const source = event.dataTransfer?.getData("application/x-calendar-bridge-source-group");
    if (source)
      void moveSourceGroup(plugin, source, group.sourceFilePath);
  });
  header.createSpan({ cls: "cb-source-caret", text: group.collapsed ? ">" : "v" });
  header.createSpan({ cls: "cb-source-title", text: group.sourceFileName });
  header.createSpan({ cls: "cb-source-count", text: String(group.tasks.length) });
  header.addEventListener("click", () => void toggleSourceGroup(plugin, group.sourceFilePath));
  if (group.collapsed)
    return;
  for (const task2 of group.tasks) {
    viewMode === "long" ? renderLongPoolTask(section, plugin, task2) : renderPointPoolTask(section, plugin, task2);
  }
}
function renderPointPoolTask(parent, plugin, task2) {
  const card = parent.createDiv({ cls: `cb-task-card ${priorityClass(task2)}` });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask(event, task2.id));
  card.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task2));
  renderTaskTitle(card, plugin, task2);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task2) });
  if (task2.estimateMinutes)
    meta.createSpan({ cls: "cb-chip", text: formatMinutes(task2.estimateMinutes) });
  renderParentLongTaskChip(meta, task2);
  if (task2.unscheduledReason)
    meta.createSpan({ cls: "cb-chip cb-chip-info", text: task2.unscheduledReason });
}
function renderLongPoolTask(parent, plugin, task2) {
  const card = parent.createDiv({ cls: `cb-task-card cb-long-task-card ${priorityClass(task2)}` });
  card.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task2));
  renderTaskTitle(card, plugin, task2);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task2) });
  meta.createSpan({ cls: "cb-chip", text: `progress ${task2.progressPercent ?? 0}%` });
  const actions = card.createDiv({ cls: "cb-task-actions cb-inline-actions" });
  actions.createEl("button", { text: "Set range" }).addEventListener("click", () => {
    longRangeDraft = { taskId: task2.id };
    plugin.refreshViews();
  });
}
function renderTaskTitle(parent, plugin, task2) {
  const row = parent.createDiv({ cls: "cb-task-title-row" });
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task2.id));
  row.createSpan({ cls: "cb-priority-marker", text: priorityLabel(task2) });
  row.createSpan({ cls: "cb-task-title", text: task2.text });
}
function renderLongVerticalTimeline(parent, plugin, context, model, viewMode, rerender) {
  renderToolbar(parent, context, plugin, viewMode);
  renderRangeHint(parent, plugin, viewMode);
  const monthDays = model.days.filter((day) => day.inCurrentMonth);
  const display = buildLongTimelineDisplay(monthDays, model.longTaskTimelineRows, todayString(), plugin.data.ui.longTaskPastDaysExpanded === true);
  renderLongPastDaysToggle(parent, plugin, display.pastDayCount, plugin.data.ui.longTaskPastDaysExpanded === true);
  const rows = assignVerticalTimelineLanes(buildLongTimelineRows(display.rows));
  const laneCount = Math.max(1, ...rows.map((row) => row.lane));
  const timeline = parent.createDiv({ cls: "cb-long-vertical-timeline" });
  timeline.style.setProperty("--cb-long-days", String(Math.max(1, display.days.length)));
  timeline.style.setProperty("--cb-long-lanes", String(laneCount));
  renderLongDatePicker(timeline, plugin, display.days, viewMode, rerender);
  const track = timeline.createDiv({ cls: "cb-long-vertical-track" });
  if (rows.length === 0) {
    track.createDiv({ cls: "cb-empty", text: "No long task ranges in this month." });
    return;
  }
  for (const row of rows)
    renderLongVerticalTask(track, plugin, row);
}
function renderLongPastDaysToggle(parent, plugin, pastDayCount, expanded) {
  if (pastDayCount === 0)
    return;
  const controls = parent.createDiv({ cls: "cb-long-past-controls" });
  controls.createEl("button", {
    cls: "cb-long-past-toggle",
    text: expanded ? "Collapse past days" : `Show past days (${pastDayCount})`
  }).addEventListener("click", () => void toggleLongTaskPastDays(plugin));
}
function renderPointMonthGrid(parent, plugin, context, model, viewMode) {
  renderToolbar(parent, context, plugin, viewMode);
  parent.createDiv({ cls: "cb-span-hint", text: "Point task mode: drag an unscheduled task onto a date." });
  renderWeekdayHeader(parent, plugin.data.settings.weekStartsOn);
  const grid = parent.createDiv({ cls: "cb-month-days" });
  for (const day of model.days) {
    const load = model.dayLoads[day.date];
    const cell = grid.createDiv({ cls: "cb-day-cell" });
    cell.toggleClass("is-outside-month", !day.inCurrentMonth);
    cell.toggleClass("is-today", day.isToday);
    applyMonthHeatStyle(cell, load.heatScore);
    setupPointDateTarget(cell, plugin, day.date);
    const header = cell.createDiv({ cls: "cb-day-header" });
    header.createSpan({ cls: "cb-day-number", text: String(day.dayOfMonth) });
    header.createSpan({ cls: "cb-task-count", text: `${load.taskCount}/${load.recurringTaskCount}` });
    const stats = cell.createDiv({ cls: "cb-day-stats" });
    const loads = stats.createDiv({ cls: "cb-day-load-breakdown" });
    renderDayLoadMetric(loads, "Task", formatMinutes(load.taskMinutes), "cb-day-load-task");
    renderDayLoadMetric(loads, "Repeat", formatMinutes(load.recurringTaskMinutes), "cb-day-load-repeat");
    if (load.reviewMinutes > 0)
      stats.createDiv({ cls: "cb-day-review-summary", text: `Review ${formatMinutes(load.reviewMinutes)}` });
  }
  const pointBars = model.spanBars.filter((bar) => bar.task.taskKind !== "long");
  for (const segment of splitSpanBarsByWeek(pointBars)) {
    const bar = grid.createDiv({ cls: "cb-span-bar" });
    bar.setText(segment.bar.task.text);
    bar.addEventListener("click", () => void plugin.openTaskSourceNote(segment.bar.task.id));
    bar.style.gridColumn = `${segment.columnStart} / ${segment.columnEnd}`;
    bar.style.gridRow = String(segment.row);
    bar.title = `${segment.bar.task.text} ${segment.bar.startDate} -> ${segment.bar.endDate}`;
  }
}
function renderDayLoadMetric(parent, label, value, extraClass) {
  const metric = parent.createDiv({ cls: `cb-day-load-summary ${extraClass}` });
  metric.createSpan({ cls: "cb-day-load-label", text: label });
  metric.createSpan({ cls: "cb-day-load-value", text: value });
}
function applyMonthHeatStyle(cell, minutes) {
  const heat = monthHeatStyle(minutes);
  if (!heat)
    return;
  cell.style.setProperty("--cb-heat-r", String(heat.r));
  cell.style.setProperty("--cb-heat-g", String(heat.g));
  cell.style.setProperty("--cb-heat-b", String(heat.b));
  cell.style.setProperty("--cb-heat-alpha", heat.alpha.toFixed(3));
}
function monthHeatStyle(minutes) {
  if (minutes <= 0)
    return void 0;
  const clamped = Math.min(minutes, MONTH_HEAT_MAX_MINUTES);
  const normalized = clamped / MONTH_HEAT_MAX_MINUTES;
  const color = clamped <= MONTH_HEAT_MID_MINUTES ? interpolateHeatColor(MONTH_HEAT_GREEN, MONTH_HEAT_ORANGE, clamped / MONTH_HEAT_MID_MINUTES) : interpolateHeatColor(MONTH_HEAT_ORANGE, MONTH_HEAT_RED, (clamped - MONTH_HEAT_MID_MINUTES) / MONTH_HEAT_MID_MINUTES);
  return {
    ...color,
    alpha: 0.18 + normalized * 0.16
  };
}
function interpolateHeatColor(start, end, ratio) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return {
    r: Math.round(start.r + (end.r - start.r) * clampedRatio),
    g: Math.round(start.g + (end.g - start.g) * clampedRatio),
    b: Math.round(start.b + (end.b - start.b) * clampedRatio)
  };
}
function renderWeekdayHeader(parent, weekStartsOn) {
  const row = parent.createDiv({ cls: "cb-weekday-row" });
  const labels = weekStartsOn === 1 ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const label of labels)
    row.createDiv({ cls: "cb-weekday", text: label });
}
function renderToolbar(parent, context, plugin, viewMode) {
  const toolbar = parent.createDiv({ cls: "cb-toolbar" });
  toolbar.createEl("h2", { text: "Month" });
  toolbar.createEl("button", { text: "Prev" }).addEventListener("click", () => context.setAnchorDate(addDays(context.anchorDate, -31)));
  toolbar.createEl("button", { text: "Today" }).addEventListener("click", () => context.setAnchorDate(todayString()));
  toolbar.createEl("button", { text: "Next" }).addEventListener("click", () => context.setAnchorDate(addDays(context.anchorDate, 31)));
  const input = toolbar.createEl("input");
  input.type = "date";
  input.value = context.anchorDate;
  input.addEventListener("change", () => input.value && context.setAnchorDate(input.value));
  toolbar.createEl("button", { text: "Refresh" }).addEventListener("click", () => void plugin.rescanTasks());
  const toggle = toolbar.createDiv({ cls: "cb-mode-toggle" });
  addModeButton(toggle, plugin, "long", "Long tasks", viewMode);
  addModeButton(toggle, plugin, "point", "Point tasks", viewMode);
}
function addModeButton(parent, plugin, mode, label, current) {
  const button = parent.createEl("button", { text: label });
  button.toggleClass("is-active", mode === current);
  button.addEventListener("click", async () => {
    plugin.data.ui.monthTaskViewMode = mode;
    await plugin.saveData(plugin.data);
    plugin.refreshViews();
  });
}
function renderRangeHint(parent, plugin, viewMode) {
  const hint = parent.createDiv({ cls: "cb-span-hint" });
  if (viewMode !== "long") {
    hint.setText("Point task mode: drag a point task onto a timeline day to schedule it. Right-click a task bar for settings.");
    return;
  }
  const task2 = longRangeDraft ? plugin.calendarTasks.find((item) => item.id === longRangeDraft?.taskId) : void 0;
  if (!task2) {
    hint.setText("Long task mode: click Set range on an unscheduled long task, then choose start and end dates on the timeline.");
    return;
  }
  hint.setText(longRangeDraft?.startDate ? `Range: ${task2.text}. Choose end date.` : `Range: ${task2.text}. Choose start date.`);
}
function buildLongTimelineRows(rows) {
  return rows.map((row) => ({
    task: row.task,
    startDay: row.startDay,
    endDay: row.endDay,
    lane: 1,
    fullStartDate: row.fullStartDate,
    fullEndDate: row.fullEndDate,
    clippedStart: row.isClippedStart,
    clippedEnd: row.isClippedEnd,
    status: row.status,
    childTasks: row.childTasks
  }));
}
function assignVerticalTimelineLanes(rows) {
  const lastEndByLane = [];
  return rows.map((row) => {
    let laneIndex = lastEndByLane.findIndex((lastEnd) => lastEnd < row.startDay);
    if (laneIndex < 0) {
      laneIndex = lastEndByLane.length;
      lastEndByLane.push(row.endDay);
    } else {
      lastEndByLane[laneIndex] = row.endDay;
    }
    return { ...row, lane: laneIndex + 1 };
  });
}
function renderLongDatePicker(parent, plugin, monthDays, viewMode, rerender) {
  const picker = parent.createDiv({ cls: "cb-long-vertical-date-axis" });
  for (const day of monthDays) {
    const button = picker.createEl("button", { cls: "cb-long-vertical-date", text: day.label });
    button.toggleClass("is-today", day.isToday);
    button.toggleClass("is-folded-past", day.isFoldedPast);
    button.title = day.isFoldedPast && day.foldedStartDate && day.foldedEndDate ? `${day.foldedStartDate} - ${day.foldedEndDate}` : day.date;
    if (day.isFoldedPast) {
      button.addClass("cb-long-past-toggle");
      button.addEventListener("click", () => void toggleLongTaskPastDays(plugin));
      continue;
    }
    setupTimelineDateTarget(button, plugin, day.date, viewMode, rerender);
  }
}
function renderLongVerticalTask(parent, plugin, row) {
  const bar = parent.createDiv({ cls: `cb-long-vertical-bar ${priorityClass(row.task)}` });
  bar.toggleClass("is-behind", row.status === "behind");
  bar.toggleClass("is-planned-today", isPlannedToday(row.task));
  bar.draggable = true;
  bar.addEventListener("dragstart", (event) => setDragTask(event, row.task.id));
  bar.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, row.task));
  bar.style.gridRow = `${row.startDay} / ${row.endDay + 1}`;
  bar.style.gridColumn = String(row.lane);
  bar.toggleClass("is-clipped-start", row.clippedStart);
  bar.toggleClass("is-clipped-end", row.clippedEnd);
  renderTaskTitle(bar, plugin, row.task);
  const meta = bar.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip", text: `${shortDate(row.fullStartDate)} - ${shortDate(row.fullEndDate)}` });
  meta.createSpan({ cls: "cb-chip", text: `progress ${row.task.progressPercent ?? 0}%` });
  if (row.clippedStart || row.clippedEnd)
    meta.createSpan({ cls: "cb-chip cb-chip-info", text: "continues" });
  if (row.status)
    meta.createSpan({ cls: `cb-chip cb-pace-status-${row.status}`, text: row.status });
  renderLongTaskChildren(bar, plugin, row.childTasks);
}
function renderLongTaskChildren(parent, plugin, childTasks) {
  if (childTasks.length === 0)
    return;
  const list = parent.createDiv({ cls: "cb-long-child-list" });
  for (const child of childTasks) {
    if (isRecurringTask(child)) {
      renderRecurringChildTask(list, child);
      continue;
    }
    const schedule = childTaskScheduleLabel(child);
    if (child.taskKind === "long" && schedule) {
      renderChildLongTaskCard(list, plugin, child, schedule);
      continue;
    }
    const item = list.createDiv({ cls: "cb-long-child-item" });
    item.createSpan({ cls: "cb-long-child-title", text: childTaskContentLabel(child) });
    if (schedule)
      item.createSpan({ cls: "cb-long-child-time", text: schedule });
  }
}
function renderRecurringChildTask(parent, task2) {
  const item = parent.createDiv({ cls: "cb-long-child-item cb-long-child-recurring" });
  const title = item.createDiv({ cls: "cb-long-child-recurring-title" });
  title.createSpan({ cls: "cb-long-child-title", text: childTaskContentLabel(task2) });
  title.createSpan({ cls: "cb-long-child-cycle", text: recurringCycleLabel(task2) });
  item.createDiv({ cls: "cb-long-child-refresh", text: recurringRefreshLabel(task2) });
}
function renderChildLongTaskCard(parent, plugin, task2, schedule) {
  const item = parent.createDiv({ cls: `cb-long-child-card ${priorityClass(task2)}` });
  item.draggable = true;
  item.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    setDragTask(event, task2.id);
  });
  item.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task2));
  const header = item.createDiv({ cls: "cb-long-child-card-header" });
  header.addEventListener("click", () => void plugin.openTaskSourceNote(task2.id));
  header.createSpan({ cls: "cb-long-child-card-title", text: childTaskContentLabel(task2) });
  header.createSpan({ cls: "cb-long-child-card-range", text: schedule });
}
function renderParentLongTaskChip(parent, task2) {
  if (!task2.parentLongTaskText)
    return;
  parent.createSpan({ cls: "cb-chip cb-parent-long-task-chip", text: `Parent: ${task2.parentLongTaskText}` });
}
function childTaskScheduleLabel(task2) {
  if (task2.taskKind === "long" && task2.spanStart && task2.spanEnd)
    return `${shortDate(task2.spanStart)} - ${shortDate(task2.spanEnd)}`;
  if (task2.scheduleDate)
    return shortDate(task2.scheduleDate);
  return void 0;
}
function recurringCycleLabel(task2) {
  const normalized = normalizedRecurrence(task2);
  if (normalized === "every day")
    return "\u6BCF\u5929";
  if (normalized === "every week")
    return "\u6BCF\u5468";
  if (normalized === "every month")
    return "\u6BCF\u6708";
  if (normalized === "every year")
    return "\u6BCF\u5E74";
  return task2.recurrence?.trim() ?? "\u5FAA\u73AF";
}
function recurringRefreshLabel(task2) {
  const start = task2.dates.start;
  const normalized = normalizedRecurrence(task2);
  if (!start)
    return "\u5237\u65B0\uFF1A--";
  if (normalized === "every day")
    return "\u5237\u65B0\uFF1A\u6BCF\u5929";
  if (normalized === "every week")
    return `\u5237\u65B0\uFF1A${weekdayLabel(start)}`;
  if (normalized === "every month")
    return `\u5237\u65B0\uFF1A${Number.parseInt(start.slice(8, 10), 10)}\u65E5`;
  if (normalized === "every year")
    return `\u5237\u65B0\uFF1A${shortDate(start)}`;
  return `\u5237\u65B0\uFF1A${shortDate(start)}`;
}
function normalizedRecurrence(task2) {
  return task2.recurrence?.trim().toLowerCase().replace(/\s+/gu, " ");
}
function weekdayLabel(date) {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!parts)
    return shortDate(date);
  const day = new Date(Number.parseInt(parts[1], 10), Number.parseInt(parts[2], 10) - 1, Number.parseInt(parts[3], 10)).getDay();
  return ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"][day];
}
function isRecurringTask(task2) {
  return Boolean(task2.recurrence?.trim());
}
function childTaskContentLabel(task2) {
  return cleanTaskContentText(task2.rawLine) || task2.text;
}
function isPlannedToday(task2) {
  return task2.plannedDate === todayString();
}
function setupTimelineDateTarget(target, plugin, date, viewMode, rerender) {
  if (viewMode === "long") {
    target.addEventListener("click", async () => {
      if (!longRangeDraft)
        return;
      if (!longRangeDraft.startDate) {
        longRangeDraft.startDate = date;
        rerender();
        return;
      }
      const taskId = longRangeDraft.taskId;
      const startDate = longRangeDraft.startDate;
      longRangeDraft = null;
      await plugin.scheduleTaskSpan(taskId, startDate, date);
    });
    return;
  }
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId)
      await plugin.scheduleTaskDate(taskId, date);
  });
}
function setupPointDateTarget(target, plugin, date) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId)
      await plugin.scheduleTaskDate(taskId, date);
  });
}
function openTaskMenu(event, plugin, task2) {
  event.preventDefault();
  closeTaskMenu();
  const menu = document.body.createDiv({ cls: "cb-task-context-menu" });
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.createDiv({ cls: "cb-menu-title", text: task2.text });
  const priorityRow = menu.createDiv({ cls: "cb-menu-row" });
  priorityRow.createSpan({ text: "Priority" });
  const priority = priorityRow.createEl("select");
  for (const value of ["", "highest", "high", "medium", "low"])
    priority.createEl("option", { value, text: value || "None" });
  priority.value = normalizeTaskPriority(task2.priority) ?? "";
  const estimateRow = menu.createDiv({ cls: "cb-menu-row" });
  estimateRow.createSpan({ text: "Estimate" });
  const estimate = estimateRow.createEl("input");
  estimate.type = "text";
  estimate.placeholder = "45m";
  estimate.value = task2.estimateMinutes ? `${task2.estimateMinutes}m` : "";
  const progressRow = menu.createDiv({ cls: "cb-menu-row" });
  progressRow.createSpan({ text: "Progress" });
  const progress = progressRow.createEl("input");
  progress.type = "number";
  progress.min = "0";
  progress.max = "100";
  progress.value = String(task2.progressPercent ?? 0);
  const rangeRow = menu.createDiv({ cls: "cb-menu-row cb-menu-range" });
  rangeRow.createSpan({ text: "Range" });
  const start = rangeRow.createEl("input");
  start.type = "date";
  start.value = task2.spanStart ?? "";
  const end = rangeRow.createEl("input");
  end.type = "date";
  end.value = task2.spanEnd ?? "";
  let plannedToday;
  let childContent;
  if (task2.taskKind === "long") {
    const plannedRow = menu.createDiv({ cls: "cb-menu-row" });
    plannedRow.createSpan({ text: "Planned today" });
    plannedToday = plannedRow.createEl("input");
    plannedToday.type = "checkbox";
    plannedToday.checked = task2.plannedDate === todayString();
    const childRow = menu.createDiv({ cls: "cb-menu-row" });
    childRow.createSpan({ text: "Child task" });
    childContent = childRow.createEl("input");
    childContent.type = "text";
    childContent.placeholder = "Task content";
  }
  const actions = menu.createDiv({ cls: "cb-menu-actions" });
  actions.createEl("button", { text: "Apply" }).addEventListener("click", () => void applyTaskMenu(plugin, task2, {
    priority: priority.value,
    estimate: estimate.value,
    progress: progress.value,
    startDate: start.value,
    endDate: end.value,
    plannedToday: plannedToday?.checked
  }));
  if (childContent) {
    actions.createEl("button", { text: "Add child" }).addEventListener("click", () => void addChildTaskFromMenu(plugin, task2, childContent?.value ?? ""));
  }
  actions.createEl("button", { text: "Move to unscheduled" }).addEventListener("click", () => void moveTaskToUnscheduled(plugin, task2));
  actions.createEl("button", { text: "Close" }).addEventListener("click", closeTaskMenu);
  setTimeout(() => {
    const closeOnOutsideClick = (click) => {
      if (!menu.contains(click.target)) {
        closeTaskMenu();
        document.removeEventListener("mousedown", closeOnOutsideClick);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
  }, 0);
}
async function applyTaskMenu(plugin, task2, values) {
  try {
    await plugin.setTaskPriority(task2.id, values.priority);
    const minutes = parseDurationToMinutes(values.estimate);
    if (values.estimate.trim() && minutes === void 0) {
      new Notice("Invalid estimate. Use 45m, 1h, 1h30m, or minutes.");
      return;
    }
    if (minutes !== void 0)
      await plugin.setTaskEstimate(task2.id, minutes);
    const progress = Number.parseFloat(values.progress.replace("%", "").trim());
    if (Number.isFinite(progress))
      await plugin.setTaskProgress(task2.id, progress);
    if (values.plannedToday !== void 0 && values.plannedToday !== (task2.plannedDate === todayString())) {
      await plugin.setLongTaskPlannedToday(task2.id, values.plannedToday);
    }
    if (values.startDate && values.endDate)
      await plugin.scheduleTaskSpan(task2.id, values.startDate, values.endDate);
    closeTaskMenu();
  } catch (error) {
    new Notice(`Failed to update task ${task2.filePath}:${task2.lineNumber}`);
    console.error(error);
  }
}
async function addChildTaskFromMenu(plugin, task2, rawContent) {
  const childContent = rawContent.replace(/\s+/gu, " ").trim();
  if (!childContent) {
    new Notice("Child task content is empty.");
    return;
  }
  try {
    await plugin.addLongTaskChild(task2.id, childContent);
    closeTaskMenu();
  } catch (error) {
    new Notice(`Failed to add child task for ${task2.filePath}:${task2.lineNumber}`);
    console.error(error);
  }
}
async function moveTaskToUnscheduled(plugin, task2) {
  try {
    await plugin.unscheduleTask(task2.id);
    closeTaskMenu();
  } catch (error) {
    new Notice(`Failed to unschedule task ${task2.filePath}:${task2.lineNumber}`);
    console.error(error);
  }
}
function closeTaskMenu() {
  document.querySelectorAll(".cb-task-context-menu").forEach((menu) => menu.remove());
}
function setupUnscheduledDropTarget(target, plugin) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId)
      await plugin.unscheduleTask(taskId);
  });
}
function setDragTask(event, taskId) {
  event.dataTransfer?.setData("application/x-calendar-bridge-task", taskId);
  event.dataTransfer?.setData("text/plain", taskId);
}
function splitSpanBarsByWeek(bars) {
  const segments = [];
  for (const bar of bars) {
    let index = bar.startIndex;
    while (index <= bar.endIndex) {
      const row = Math.floor(index / 7) + 1;
      const weekEnd = Math.min(row * 7 - 1, bar.endIndex);
      segments.push({
        bar,
        row,
        columnStart: index % 7 + 1,
        columnEnd: weekEnd % 7 + 2
      });
      index = weekEnd + 1;
    }
  }
  return segments;
}
async function toggleSourceGroup(plugin, sourceFilePath) {
  const state = getSourceGroupState(plugin);
  state.collapsed = { ...state.collapsed ?? {}, [sourceFilePath]: !state.collapsed?.[sourceFilePath] };
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}
async function toggleLongTaskPastDays(plugin) {
  plugin.data.ui.longTaskPastDaysExpanded = plugin.data.ui.longTaskPastDaysExpanded !== true;
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}
async function moveSourceGroup(plugin, source, target) {
  if (source === target)
    return;
  const state = getSourceGroupState(plugin);
  const known = /* @__PURE__ */ new Set([...state.order ?? [], source, target]);
  const order = [...known].filter((path) => path !== source);
  const targetIndex = order.indexOf(target);
  order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source);
  state.order = order;
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}
function getSourceGroupState(plugin) {
  const existing = plugin.data.ui.sourceTaskGroups;
  if (existing && typeof existing === "object")
    return existing;
  plugin.data.ui.sourceTaskGroups = { order: [], collapsed: {}, sortMode: "manual" };
  return plugin.data.ui.sourceTaskGroups;
}
function priorityLabel(task2) {
  return normalizeTaskPriority(task2.priority) ?? "None";
}
function priorityClass(task2) {
  const normalized = normalizeTaskPriority(task2.priority);
  return normalized ? `is-priority-${normalized.toLowerCase()}` : "is-priority-none";
}
function formatMinutes(minutes) {
  if (minutes >= 60 && minutes % 60 === 0)
    return `${minutes / 60}h`;
  if (minutes >= 60)
    return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}
function shortDate(date) {
  return date ? date.slice(5) : "--";
}
function isScheduledDayFilePath(filePath, scheduledDayFolder) {
  const folder = scheduledDayFolder.trim().replace(/\\/gu, "/").replace(/\/+$/u, "") || "Calendar/Scheduled";
  const normalized = filePath.replace(/\\/gu, "/");
  if (!normalized.startsWith(`${folder}/`))
    return false;
  return /^\d{8}\.md$/u.test(normalized.slice(folder.length + 1));
}

// src/utils/pathSettings.ts
var MOJIBAKE_PATH_REPAIRS = [
  ["\u7459\u52EB\u579D", "\u89C4\u5212"],
  ["\u95C3\u8235\uE18C", "\u9636\u6BB5"],
  ["\u6D60\uFF45\u59D9", "\u4EE3\u529E"],
  ["\u93C3?", "\u65E5"]
];
function normalizePathSetting(value) {
  let normalized = value.trim().replace(/\\/gu, "/");
  for (const [broken, fixed] of MOJIBAKE_PATH_REPAIRS) {
    normalized = normalized.split(broken).join(fixed);
  }
  return normalized.replace(/\/{2,}/gu, "/");
}
function splitPathCsv(value, fallback) {
  const parsed = value.split(",").map(normalizePathSetting).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback.map(normalizePathSetting);
}
function normalizeCalendarPathSettings(settings) {
  settings.includedPathPrefixes = settings.includedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.excludedPathPrefixes = settings.excludedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.scheduledDayFolder = normalizePathSetting(settings.scheduledDayFolder) || "Calendar/Scheduled";
  settings.archiveHeading = settings.archiveHeading?.trim() || "\u5F52\u6863";
  settings.scheduleInPlacePathPrefixes = (settings.scheduleInPlacePathPrefixes ?? ["\u89C4\u5212/\u9636\u6BB5"]).map(normalizePathSetting).filter(Boolean);
}
function matchesAnyPathPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => matchesPathPrefix2(filePath, prefix));
}
function matchesPathPrefix2(filePath, prefix) {
  const normalizedFilePath = normalizePathSetting(filePath);
  const normalizedPrefix = normalizePathSetting(prefix);
  if (!normalizedPrefix)
    return false;
  const folder = normalizedPrefix.replace(/\/$/u, "");
  return normalizedFilePath === folder || normalizedFilePath.startsWith(`${folder}/`);
}

// src/ui/pages/SettingsPage.ts
function renderSettingsPage(container, plugin) {
  container.empty();
  const panel = container.createDiv({ cls: "cb-panel cb-settings" });
  panel.createEl("h2", { text: "Calendar Bridge Settings" });
  panel.createDiv({
    cls: "cb-muted",
    text: "Calendar Bridge scans Markdown tasks and writes Dataview fields for calendar planning."
  });
  addTextSetting(panel, "Task folders", plugin.data.settings.includedPathPrefixes.join(","), async (value) => {
    plugin.data.settings.includedPathPrefixes = splitPathCsv(value, []);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Trigger tags", plugin.data.settings.triggerTags.join(","), async (value) => {
    plugin.data.settings.triggerTags = splitCsv(value, ["task", "todo"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Excluded folders", plugin.data.settings.excludedPathPrefixes.join(","), async (value) => {
    plugin.data.settings.excludedPathPrefixes = splitPathCsv(value, ["time-blocks-data/", ".obsidian/", ".trash/"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Scheduled day folder", plugin.data.settings.scheduledDayFolder, async (value) => {
    plugin.data.settings.scheduledDayFolder = normalizePathSetting(value) || "Calendar/Scheduled";
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Schedule-in-place folders", plugin.data.settings.scheduleInPlacePathPrefixes.join(","), async (value) => {
    plugin.data.settings.scheduleInPlacePathPrefixes = splitPathCsv(value, ["\u89C4\u5212/\u9636\u6BB5"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Archive heading", plugin.data.settings.archiveHeading, async (value) => {
    plugin.data.settings.archiveHeading = value.trim() || "\u5F52\u6863";
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Read legacy emoji dates", plugin.data.settings.readLegacyEmojiDates, async (value) => {
    plugin.data.settings.readLegacyEmojiDates = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Show all Dataview fields", plugin.data.settings.showAllDataviewFields, async (value) => {
    plugin.data.settings.showAllDataviewFields = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Enable spaced-review pressure", plugin.data.settings.reviewPressureEnabled, async (value) => {
    plugin.data.settings.reviewPressureEnabled = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Review base minutes", plugin.data.settings.reviewBaseMinutes, async (value) => {
    plugin.data.settings.reviewBaseMinutes = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Review chars per minute", plugin.data.settings.reviewCharsPerMinute, async (value) => {
    plugin.data.settings.reviewCharsPerMinute = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Default task estimate minutes", plugin.data.settings.defaultUnestimatedTaskMinutes, async (value) => {
    plugin.data.settings.defaultUnestimatedTaskMinutes = value;
    await plugin.saveCalendarData();
  });
  const weekRow = panel.createDiv({ cls: "cb-setting-row" });
  weekRow.createDiv({ cls: "cb-setting-label", text: "Week starts on" });
  const week = weekRow.createEl("select");
  week.createEl("option", { value: "1", text: "Monday" });
  week.createEl("option", { value: "0", text: "Sunday" });
  week.value = String(plugin.data.settings.weekStartsOn);
  week.addEventListener("change", async () => {
    plugin.data.settings.weekStartsOn = week.value === "0" ? 0 : 1;
    await plugin.saveCalendarData();
  });
}
function addTextSetting(parent, label, value, onChange) {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("change", () => void onChange(input.value));
}
function addNumberSetting(parent, label, value, onChange) {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "number";
  input.min = "1";
  input.value = String(value);
  input.addEventListener("change", () => void onChange(Math.max(1, Number.parseInt(input.value, 10) || value)));
}
function addToggleSetting(parent, label, value, onChange) {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => void onChange(input.checked));
}
function splitCsv(value, fallback) {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

// src/ui/pages/WeekPage.ts
function renderWeekPage(container, plugin, context) {
  container.empty();
  const model = buildWeekViewModel(
    context.anchorDate,
    plugin.calendarTasks,
    plugin.data.settings.weekStartsOn,
    plugin.reviewPressure,
    plugin.data.settings.defaultUnestimatedTaskMinutes
  );
  const shell = container.createDiv({ cls: "cb-week-shell" });
  const pool = shell.createDiv({ cls: "cb-panel cb-task-pool" });
  renderPool(pool, plugin, model.unifiedUnscheduledTasks);
  const week = shell.createDiv({ cls: "cb-panel cb-week" });
  renderToolbar2(week, context, plugin);
  const list = week.createDiv({ cls: "cb-week-day-list" });
  for (const row of model.weekDayRows)
    renderDayRow(list, plugin, row);
}
function renderPool(parent, plugin, unscheduled) {
  setupUnscheduledDropTarget2(parent, plugin);
  const state = getSourceGroupState2(plugin);
  parent.createEl("h2", { text: "Unscheduled tasks" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => void plugin.rescanTasks());
  renderSortToggle2(parent, plugin, state);
  const groups = buildSourceTaskGroups(unscheduled, state);
  if (groups.length === 0) {
    parent.createDiv({ cls: "cb-empty", text: "No unscheduled tasks." });
    return;
  }
  for (const group of groups)
    renderSourceGroup2(parent, plugin, group);
}
function renderSortToggle2(parent, plugin, state) {
  const row = parent.createDiv({ cls: "cb-pool-controls" });
  row.createSpan({ cls: "cb-muted", text: "Sort" });
  const select = row.createEl("select");
  select.createEl("option", { value: "manual", text: "Manual" });
  select.createEl("option", { value: "priority", text: "Priority" });
  select.value = state.sortMode ?? "manual";
  select.addEventListener("change", async () => {
    getSourceGroupState2(plugin).sortMode = select.value;
    await plugin.saveCalendarData();
  });
}
function renderSourceGroup2(parent, plugin, group) {
  const section = parent.createDiv({ cls: "cb-source-group" });
  const header = section.createDiv({ cls: "cb-source-group-header" });
  header.draggable = true;
  header.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("application/x-calendar-bridge-source-group", group.sourceFilePath);
  });
  header.addEventListener("dragover", (event) => event.preventDefault());
  header.addEventListener("drop", (event) => {
    event.preventDefault();
    const source = event.dataTransfer?.getData("application/x-calendar-bridge-source-group");
    if (source)
      void moveSourceGroup2(plugin, source, group.sourceFilePath);
  });
  header.createSpan({ cls: "cb-source-caret", text: group.collapsed ? ">" : "v" });
  header.createSpan({ cls: "cb-source-title", text: group.sourceFileName });
  header.createSpan({ cls: "cb-source-count", text: String(group.tasks.length) });
  header.addEventListener("click", () => void toggleSourceGroup2(plugin, group.sourceFilePath));
  if (group.collapsed)
    return;
  for (const task2 of group.tasks)
    renderPoolTask(section, plugin, task2);
}
function renderToolbar2(parent, context, plugin) {
  const toolbar = parent.createDiv({ cls: "cb-toolbar" });
  toolbar.createEl("h2", { text: "Week" });
  toolbar.createEl("button", { text: "Prev" }).addEventListener("click", () => context.setAnchorDate(addDays(context.anchorDate, -7)));
  toolbar.createEl("button", { text: "This week" }).addEventListener("click", () => context.setAnchorDate(todayString()));
  toolbar.createEl("button", { text: "Next" }).addEventListener("click", () => context.setAnchorDate(addDays(context.anchorDate, 7)));
  const input = toolbar.createEl("input");
  input.type = "date";
  input.value = context.anchorDate;
  input.addEventListener("change", () => input.value && context.setAnchorDate(input.value));
  toolbar.createEl("button", { text: "Refresh" }).addEventListener("click", () => void plugin.rescanTasks());
}
function renderDayRow(parent, plugin, row) {
  const item = parent.createDiv({ cls: "cb-week-day-row" });
  item.toggleClass("is-today", row.day.isToday);
  setupDropTarget(item, plugin, row.day.date);
  const header = item.createDiv({ cls: "cb-week-day-label" });
  header.createDiv({ cls: "cb-week-date", text: row.day.date });
  const summary = header.createDiv({ cls: "cb-week-day-summary" });
  renderWeekSummaryMetric(summary, "Task", String(row.tasks.length));
  renderWeekSummaryMetric(summary, "Repeat", String(row.recurringTaskCount));
  renderWeekSummaryMetric(summary, "Total", formatMinutes2(row.totalMinutes), "cb-week-day-total");
  const taskPane = item.createDiv({ cls: "cb-week-pressure-pane cb-task-pressure" });
  taskPane.createDiv({ cls: "cb-pane-title", text: `Task pressure ${formatMinutes2(row.taskMinutes)}` });
  if (row.recurringTaskCount > 0) {
    taskPane.createDiv({ cls: "cb-recurring-compact-summary", text: `${row.recurringTaskCount} repeat / ${formatMinutes2(row.recurringTaskMinutes)}` });
  }
  if (row.tasks.length === 0 && row.recurringTaskCount === 0) {
    taskPane.createDiv({ cls: "cb-empty", text: "No tasks" });
  } else if (row.tasks.length > 0) {
    const taskList = taskPane.createDiv({ cls: "cb-week-task-list" });
    for (const task2 of row.tasks)
      renderScheduledTaskName(taskList, plugin, task2);
  }
  const reviewPane = item.createDiv({ cls: "cb-week-pressure-pane cb-review-pressure-pane" });
  reviewPane.createDiv({ cls: "cb-pane-title", text: `Review pressure ${formatMinutes2(row.review.minutes)}` });
  reviewPane.createDiv({
    cls: row.review.count > 0 ? "cb-review-summary" : "cb-empty",
    text: row.review.count > 0 ? `${row.review.count} reviews | ${row.review.chars} chars` : "No reviews"
  });
}
function renderWeekSummaryMetric(parent, label, value, extraClass = "") {
  const metric = parent.createDiv({ cls: `cb-week-day-metric ${extraClass}`.trim() });
  metric.createDiv({ cls: "cb-week-day-metric-label", text: label });
  metric.createDiv({ cls: "cb-week-day-metric-value", text: value });
}
function renderPoolTask(parent, plugin, task2) {
  const card = parent.createDiv({ cls: `cb-task-card ${priorityClass2(task2)}` });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask2(event, task2.id));
  renderTaskTitle2(card, plugin, task2);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel2(task2) });
  meta.createSpan({ cls: "cb-chip", text: task2.estimateMinutes ? formatMinutes2(task2.estimateMinutes) : "no estimate" });
  renderParentLongTaskChip2(meta, task2);
  if (task2.unscheduledReason)
    meta.createSpan({ cls: "cb-chip cb-chip-info", text: task2.unscheduledReason });
  if (task2.filePath)
    card.createDiv({ cls: "cb-muted", text: task2.filePath });
  const actions = card.createDiv({ cls: "cb-task-actions cb-inline-actions" });
  renderEstimateControl(actions, plugin, task2);
}
function renderParentLongTaskChip2(parent, task2) {
  if (!task2.parentLongTaskText)
    return;
  parent.createSpan({ cls: "cb-chip cb-parent-long-task-chip", text: `Parent: ${task2.parentLongTaskText}` });
}
function renderScheduledTaskName(parent, plugin, task2) {
  const row = parent.createDiv({ cls: `cb-week-task-name ${priorityClass2(task2)}` });
  row.draggable = true;
  row.addEventListener("dragstart", (event) => setDragTask2(event, task2.id));
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task2.id));
  row.createSpan({ cls: "cb-week-priority cb-priority-marker", text: shortPriorityLabel(task2) });
  row.createSpan({ cls: "cb-week-task-content", text: taskContentLabel(task2) });
}
function renderTaskTitle2(parent, plugin, task2) {
  const row = parent.createDiv({ cls: "cb-task-title-row" });
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task2.id));
  row.createSpan({ cls: "cb-priority-marker", text: priorityLabel2(task2) });
  row.createSpan({ cls: "cb-task-title", text: task2.text });
}
function renderEstimateControl(parent, plugin, task2) {
  const group = parent.createDiv({ cls: "cb-mini-control" });
  const input = group.createEl("input");
  input.type = "text";
  input.value = task2.estimateMinutes ? `${task2.estimateMinutes}m` : "";
  input.placeholder = "45m";
  input.title = "Estimate: 45m, 1h, 1h30m, or minutes";
  group.createEl("button", { text: "Estimate" }).addEventListener("click", () => void submitEstimate(plugin, task2, input.value));
}
async function submitEstimate(plugin, task2, raw) {
  const minutes = parseDurationToMinutes(raw);
  if (minutes === void 0 || minutes < 0) {
    new Notice("Invalid estimate. Use 45m, 1h, 1h30m, or minutes.");
    return;
  }
  try {
    await plugin.setTaskEstimate(task2.id, minutes);
  } catch (error) {
    new Notice(`Failed to set estimate for ${task2.filePath}:${task2.lineNumber}`);
    console.error(error);
  }
}
function setupDropTarget(target, plugin, scheduledDate) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId)
      await plugin.scheduleTaskDate(taskId, scheduledDate);
  });
}
function setupUnscheduledDropTarget2(target, plugin) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId)
      await plugin.unscheduleTask(taskId);
  });
}
function setDragTask2(event, taskId) {
  event.dataTransfer?.setData("application/x-calendar-bridge-task", taskId);
  event.dataTransfer?.setData("text/plain", taskId);
}
async function toggleSourceGroup2(plugin, sourceFilePath) {
  const state = getSourceGroupState2(plugin);
  state.collapsed = { ...state.collapsed ?? {}, [sourceFilePath]: !state.collapsed?.[sourceFilePath] };
  await plugin.saveCalendarData();
}
async function moveSourceGroup2(plugin, source, target) {
  if (source === target)
    return;
  const state = getSourceGroupState2(plugin);
  const known = /* @__PURE__ */ new Set([...state.order ?? [], source, target]);
  const order = [...known].filter((path) => path !== source);
  const targetIndex = order.indexOf(target);
  order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source);
  state.order = order;
  await plugin.saveCalendarData();
}
function getSourceGroupState2(plugin) {
  const existing = plugin.data.ui.sourceTaskGroups;
  if (existing && typeof existing === "object")
    return existing;
  plugin.data.ui.sourceTaskGroups = { order: [], collapsed: {}, sortMode: "manual" };
  return plugin.data.ui.sourceTaskGroups;
}
function priorityLabel2(task2) {
  return normalizeTaskPriority(task2.priority) ?? "None";
}
function shortPriorityLabel(task2) {
  const priority = normalizeTaskPriority(task2.priority);
  if (priority === "highest")
    return "hi+";
  if (priority === "medium")
    return "med";
  return priority ?? "None";
}
function priorityClass2(task2) {
  const normalized = normalizeTaskPriority(task2.priority);
  return normalized ? `is-priority-${normalized.toLowerCase()}` : "is-priority-none";
}
function taskContentLabel(task2) {
  return cleanTaskContentText(task2.rawLine) || task2.text;
}
function formatMinutes2(minutes) {
  if (minutes >= 60 && minutes % 60 === 0)
    return `${minutes / 60}h`;
  if (minutes >= 60)
    return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}

// src/ui/PersonalSystemView.ts
var PersonalSystemView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentPage = "month";
    this.anchorDate = todayString();
  }
  getViewType() {
    return VIEW_TYPE_PERSONAL_SYSTEM;
  }
  getDisplayText() {
    return "Calendar Bridge";
  }
  getIcon() {
    return "calendar-days";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("ps-root");
    const nav = root.createDiv({ cls: "ps-top-nav" });
    this.addNavButton(nav, "month", "\u6708\u89C6\u56FE");
    this.addNavButton(nav, "week", "\u5468\u89C6\u56FE");
    nav.createEl("button", { cls: "ps-nav-button", text: "\u5F52\u6863" }).addEventListener("click", () => this.plugin.openTaskArchiveModal());
    this.addNavButton(nav, "settings", "\u8BBE\u7F6E");
    const page = root.createDiv({ cls: "ps-page" });
    const context = {
      anchorDate: this.anchorDate,
      setAnchorDate: (date) => {
        this.anchorDate = date;
        this.render();
      }
    };
    if (this.currentPage === "month")
      renderMonthPage(page, this.plugin, context);
    else if (this.currentPage === "week")
      renderWeekPage(page, this.plugin, context);
    else
      renderSettingsPage(page, this.plugin);
  }
  addNavButton(nav, page, label) {
    const button = nav.createEl("button", { cls: "ps-nav-button", text: label });
    button.toggleClass("is-active", page === this.currentPage);
    button.addEventListener("click", () => {
      this.currentPage = page;
      this.render();
    });
  }
};

// src/ui/TaskArchiveModal.ts
var TaskArchiveModal = class extends Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.selected = /* @__PURE__ */ new Set();
    this.collapsed = /* @__PURE__ */ new Set();
    for (const candidate of options.candidates) {
      this.selected.add(candidate.filePath);
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cb-archive-modal");
    contentEl.createEl("h2", { text: "\u5F52\u6863\u5DF2\u5B8C\u6210\u4EFB\u52A1" });
    if (this.options.candidates.length === 0) {
      contentEl.createDiv({ cls: "cb-empty", text: "\u6CA1\u6709\u53EF\u5F52\u6863\u7684\u5DF2\u5B8C\u6210\u9876\u5C42\u4EFB\u52A1\u3002" });
      return;
    }
    this.renderSummary(contentEl);
    this.renderCandidateGroups(contentEl);
    const actions = contentEl.createDiv({ cls: "cb-menu-actions" });
    actions.createEl("button", { text: "\u5F52\u6863" }).addEventListener("click", () => void this.archiveSelected());
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
  async archiveSelected() {
    const filePaths = [...this.selected];
    if (filePaths.length === 0) {
      new Notice("\u8BF7\u9009\u62E9\u8981\u5F52\u6863\u7684\u7B14\u8BB0\u3002");
      return;
    }
    const archivedCount = await this.options.onArchive(filePaths);
    new Notice(`\u5DF2\u5F52\u6863 ${archivedCount} \u4E2A\u4EFB\u52A1\u3002`);
    this.close();
  }
  renderSummary(parent) {
    const selectedCount = this.selected.size;
    const totalCount = this.options.candidates.length;
    const selectedTasks = this.options.candidates.filter((candidate) => this.selected.has(candidate.filePath)).reduce((sum, candidate) => sum + candidate.completedTopLevelCount, 0);
    parent.createDiv({
      cls: "cb-archive-summary",
      text: `${selectedCount}/${totalCount} notes selected \xB7 ${selectedTasks} completed tasks`
    });
  }
  renderCandidateGroups(parent) {
    const list = parent.createDiv({ cls: "cb-archive-note-list" });
    for (const group of groupArchiveCandidates(this.options.candidates)) {
      this.renderCandidateGroup(list, group);
    }
  }
  renderCandidateGroup(parent, group) {
    const section = parent.createDiv({ cls: "cb-archive-folder-group" });
    const header = section.createDiv({ cls: "cb-archive-folder-header" });
    const groupCheckbox = header.createEl("input");
    groupCheckbox.type = "checkbox";
    groupCheckbox.checked = group.candidates.every((candidate) => this.selected.has(candidate.filePath));
    groupCheckbox.addEventListener("click", (event) => event.stopPropagation());
    groupCheckbox.addEventListener("change", () => {
      for (const candidate of group.candidates) {
        if (groupCheckbox.checked)
          this.selected.add(candidate.filePath);
        else
          this.selected.delete(candidate.filePath);
      }
      this.onOpen();
    });
    header.createSpan({ cls: "cb-archive-folder-caret", text: this.collapsed.has(group.folderPath) ? ">" : "v" });
    const title = header.createDiv({ cls: "cb-archive-folder-title" });
    title.createDiv({ cls: "cb-archive-folder-name", text: group.folderName });
    title.createDiv({ cls: "cb-archive-folder-path", text: group.folderPath });
    header.createDiv({
      cls: "cb-archive-folder-count",
      text: `${this.selectedCountForGroup(group)}/${group.candidates.length} notes \xB7 ${group.completedTopLevelCount} tasks`
    });
    header.addEventListener("click", () => {
      if (this.collapsed.has(group.folderPath))
        this.collapsed.delete(group.folderPath);
      else
        this.collapsed.add(group.folderPath);
      this.onOpen();
    });
    if (this.collapsed.has(group.folderPath))
      return;
    const rows = section.createDiv({ cls: "cb-archive-folder-rows" });
    for (const candidate of group.candidates) {
      this.renderCandidateRow(rows, candidate);
    }
  }
  renderCandidateRow(parent, candidate) {
    const row = parent.createDiv({ cls: "cb-archive-note-row" });
    row.toggleClass("is-selected", this.selected.has(candidate.filePath));
    const checkbox = row.createEl("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.selected.has(candidate.filePath);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked)
        this.selected.add(candidate.filePath);
      else
        this.selected.delete(candidate.filePath);
      this.onOpen();
    });
    const text = row.createDiv({ cls: "cb-archive-note-text" });
    text.createDiv({ cls: "cb-archive-note-title", text: candidate.fileName });
    text.createDiv({ cls: "cb-archive-note-path", text: candidate.filePath });
    row.createDiv({ cls: "cb-archive-note-count", text: `${candidate.completedTopLevelCount}` });
  }
  selectedCountForGroup(group) {
    return group.candidates.filter((candidate) => this.selected.has(candidate.filePath)).length;
  }
};
function groupArchiveCandidates(candidates) {
  const groups = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const folderPath = parentFolderPath(candidate.filePath);
    const group = groups.get(folderPath) ?? [];
    group.push(candidate);
    groups.set(folderPath, group);
  }
  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "Vault root" && right !== "Vault root")
      return -1;
    if (right === "Vault root" && left !== "Vault root")
      return 1;
    return left.localeCompare(right);
  }).map(([folderPath, groupCandidates]) => ({
    folderPath,
    folderName: folderName(folderPath),
    candidates: [...groupCandidates].sort((left, right) => left.fileName.localeCompare(right.fileName)),
    completedTopLevelCount: groupCandidates.reduce((sum, candidate) => sum + candidate.completedTopLevelCount, 0)
  }));
}
function parentFolderPath(filePath) {
  const index = filePath.lastIndexOf("/");
  return index < 0 ? "Vault root" : filePath.slice(0, index);
}
function folderName(folderPath) {
  if (folderPath === "Vault root")
    return folderPath;
  return folderPath.split("/").pop() ?? folderPath;
}

// src/ui/settings/PersonalSystemSettingTab.ts
var PersonalSystemSettingTab = class extends PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar Bridge" });
    new Setting(containerEl).setName("Task folders").setDesc("Only scan tasks from these folders. Separate multiple folders with commas; leave empty to scan the whole vault.").addText((text) => text.setValue(this.plugin.data.settings.includedPathPrefixes.join(",")).onChange(async (value) => {
      this.plugin.data.settings.includedPathPrefixes = splitPathCsv(value, []);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Trigger tags").setDesc("Scan checkbox lines with these tags. Separate multiple tags with commas.").addText((text) => text.setValue(this.plugin.data.settings.triggerTags.join(",")).onChange(async (value) => {
      this.plugin.data.settings.triggerTags = splitCsv2(value, ["task", "todo"]);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Read legacy emoji dates").setDesc("Read legacy date tokens, but write Dataview fields when rescheduling.").addToggle((toggle) => toggle.setValue(this.plugin.data.settings.readLegacyEmojiDates).onChange(async (value) => {
      this.plugin.data.settings.readLegacyEmojiDates = value;
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Week starts on").setDesc("Shared by month and week views.").addDropdown((dropdown) => dropdown.addOption("1", "Monday").addOption("0", "Sunday").setValue(String(this.plugin.data.settings.weekStartsOn)).onChange(async (value) => {
      this.plugin.data.settings.weekStartsOn = value === "0" ? 0 : 1;
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Excluded folders").setDesc("Do not scan Markdown files under these folders. Separate multiple folders with commas.").addText((text) => text.setValue(this.plugin.data.settings.excludedPathPrefixes.join(",")).onChange(async (value) => {
      this.plugin.data.settings.excludedPathPrefixes = splitPathCsv(value, ["time-blocks-data/", ".obsidian/", ".trash/"]);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Scheduled day folder").setDesc("Point tasks scheduled from the month view move into YYYYMMDD.md files in this folder.").addText((text) => text.setValue(this.plugin.data.settings.scheduledDayFolder).onChange(async (value) => {
      this.plugin.data.settings.scheduledDayFolder = normalizePathSetting(value) || "Calendar/Scheduled";
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Schedule-in-place folders").setDesc("Tasks in these folders keep their original note when scheduled. Separate multiple folders with commas.").addText((text) => text.setValue(this.plugin.data.settings.scheduleInPlacePathPrefixes.join(",")).onChange(async (value) => {
      this.plugin.data.settings.scheduleInPlacePathPrefixes = splitPathCsv(value, ["\u89C4\u5212/\u9636\u6BB5"]);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Archive heading").setDesc("Completed top-level tasks are moved under this heading in the same note.").addText((text) => text.setValue(this.plugin.data.settings.archiveHeading).onChange(async (value) => {
      this.plugin.data.settings.archiveHeading = value.trim() || "\u5F52\u6863";
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("spaced-review pressure").setDesc("Read spaced-review notes and include review pressure in calendar load.").addToggle((toggle) => toggle.setValue(this.plugin.data.settings.reviewPressureEnabled).onChange(async (value) => {
      this.plugin.data.settings.reviewPressureEnabled = value;
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Review base minutes").setDesc("Fixed estimated minutes per review note.").addText((text) => text.setValue(String(this.plugin.data.settings.reviewBaseMinutes)).onChange(async (value) => {
      this.plugin.data.settings.reviewBaseMinutes = positiveInt(value, 2);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Review chars per minute").setDesc("Body character count is divided by this value and added to the base minutes.").addText((text) => text.setValue(String(this.plugin.data.settings.reviewCharsPerMinute)).onChange(async (value) => {
      this.plugin.data.settings.reviewCharsPerMinute = positiveInt(value, 800);
      await this.plugin.saveCalendarData();
    }));
    new Setting(containerEl).setName("Default task estimate minutes").setDesc("Used for heatmap and weekly pressure when a point task has no estimate.").addText((text) => text.setValue(String(this.plugin.data.settings.defaultUnestimatedTaskMinutes)).onChange(async (value) => {
      this.plugin.data.settings.defaultUnestimatedTaskMinutes = positiveInt(value, 30);
      await this.plugin.saveCalendarData();
    }));
  }
};
function splitCsv2(value, fallback) {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}
function positiveInt(value, fallback) {
  return Math.max(1, Number.parseInt(value, 10) || fallback);
}

// src/main.ts
var PersonalSchedulerPlugin = class extends Plugin {
  constructor() {
    super(...arguments);
    this.data = createDefaultData();
    this.calendarTasks = [];
    this.reviewPressure = {};
    this.rescanInFlight = null;
    this.rescanQueued = false;
    this.scheduledRescanHandle = null;
  }
  async onload() {
    this.data = mergeCalendarData(await this.loadData());
    this.taskScanner = new TaskScanner(this.app, () => this.data.settings);
    this.taskDateWriter = new TaskDateWriter(this.app);
    this.taskArchiveService = new TaskArchiveService(this.app);
    this.reviewPressureScanner = new ReviewPressureScanner(this.app, () => this.data.settings);
    this.aiScheduleContextExporter = new AiScheduleContextExporter(this.app);
    this.registerView(VIEW_TYPE_PERSONAL_SYSTEM, (leaf) => new PersonalSystemView(leaf, this));
    this.addSettingTab(new PersonalSystemSettingTab(this));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path === AI_SCHEDULE_CONTEXT_PATH)
        return;
      this.scheduleRescan();
    }));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRescan()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRescan()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRescan()));
    this.addRibbonIcon("calendar-days", "Open Calendar Bridge", () => this.activateView());
    this.addCommand({
      id: "open-calendar-bridge",
      name: "Open Calendar Bridge",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "rescan-calendar-bridge-tasks",
      name: "Rescan Calendar Bridge tasks",
      callback: async () => {
        await this.rescanTasks();
        new Notice("Calendar Bridge tasks rescanned.");
      }
    });
    this.app.workspace.onLayoutReady(() => {
      this.scheduleRescan(1e3);
    });
  }
  async activateView() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM);
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_PERSONAL_SYSTEM, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async saveCalendarData() {
    normalizeCalendarPathSettings(this.data.settings);
    await this.saveData(this.data);
    await this.rescanTasks();
  }
  async rescanTasks() {
    this.clearScheduledRescan();
    if (this.rescanInFlight) {
      this.rescanQueued = true;
      await this.rescanInFlight;
      return;
    }
    do {
      this.rescanQueued = false;
      this.rescanInFlight = this.runSingleRescan();
      try {
        await this.rescanInFlight;
      } finally {
        this.rescanInFlight = null;
      }
    } while (this.rescanQueued);
  }
  async runSingleRescan() {
    const [tasks, reviewPressure] = await Promise.all([
      this.taskScanner.scanAllMarkdownTasks(),
      this.reviewPressureScanner.scanReviewPressure()
    ]);
    this.calendarTasks = tasks;
    this.reviewPressure = reviewPressure;
    await this.aiScheduleContextExporter.sync({
      anchorDate: todayString(),
      tasks,
      reviewPressure,
      settings: this.data.settings
    });
    this.refreshViews();
  }
  scheduleRescan(delayMs = 300) {
    if (this.scheduledRescanHandle)
      return;
    this.scheduledRescanHandle = globalThis.setTimeout(() => {
      this.scheduledRescanHandle = null;
      void this.rescanTasks().catch((error) => this.reportStartupScanFailure(error));
    }, delayMs);
  }
  clearScheduledRescan() {
    if (!this.scheduledRescanHandle)
      return;
    globalThis.clearTimeout(this.scheduledRescanHandle);
    this.scheduledRescanHandle = null;
  }
  async scheduleTaskDueDate(taskId, dueDate) {
    await this.scheduleTaskDate(taskId, dueDate);
  }
  async scheduleTaskDate(taskId, scheduledDate) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    const task2 = this.calendarTasks.find((item) => item.id === taskId);
    if (task2?.spanStart && task2.spanEnd) {
      new Notice("Tasks with a long range must be edited in long task mode.");
      return;
    }
    if (task2?.parentLongTaskId) {
      await this.taskDateWriter.setPointSchedule(
        target.file,
        target.lineNumber,
        scheduledDate,
        this.data.settings.defaultUnestimatedTaskMinutes,
        todayString()
      );
      await this.rescanTasks();
      return;
    }
    if (this.shouldScheduleTaskInPlace(task2)) {
      await this.taskDateWriter.setPointSchedule(
        target.file,
        target.lineNumber,
        scheduledDate,
        this.data.settings.defaultUnestimatedTaskMinutes,
        todayString()
      );
      await this.rescanTasks();
      return;
    }
    await this.taskDateWriter.movePointTaskToScheduledDay(
      target.file,
      target.lineNumber,
      this.data.settings.scheduledDayFolder,
      scheduledDate,
      this.data.settings.defaultUnestimatedTaskMinutes,
      todayString()
    );
    await this.rescanTasks();
  }
  async scheduleTaskSpan(taskId, startDate, scheduledDate) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    const task2 = this.calendarTasks.find((item) => item.id === taskId);
    if (isScheduledPointTask(task2)) {
      new Notice("Scheduled point tasks cannot be planned as long tasks.");
      return;
    }
    const begin = startDate <= scheduledDate ? startDate : scheduledDate;
    const end = startDate <= scheduledDate ? scheduledDate : startDate;
    await this.taskDateWriter.setSpanDates(target.file, target.lineNumber, begin, end);
    await this.rescanTasks();
  }
  async setTaskEstimate(taskId, estimateMinutes) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    await this.taskDateWriter.setEstimate(target.file, target.lineNumber, estimateMinutes);
    await this.rescanTasks();
  }
  async setTaskProgress(taskId, progressPercent) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    await this.taskDateWriter.setProgress(target.file, target.lineNumber, progressPercent);
    await this.rescanTasks();
  }
  async setLongTaskPlannedToday(taskId, planned) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    const task2 = this.calendarTasks.find((item) => item.id === taskId);
    if (task2?.taskKind !== "long") {
      new Notice("Only long tasks can be marked as planned today.");
      return;
    }
    if (planned)
      await this.taskDateWriter.setPlannedDate(target.file, target.lineNumber, todayString());
    else
      await this.taskDateWriter.clearPlannedDate(target.file, target.lineNumber);
    await this.rescanTasks();
  }
  async setTaskPriority(taskId, priority) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    await this.taskDateWriter.setPriority(target.file, target.lineNumber, priority);
    await this.rescanTasks();
  }
  async unscheduleTask(taskId) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    await this.taskDateWriter.clearSchedule(target.file, target.lineNumber);
    await this.rescanTasks();
  }
  async addLongTaskChild(taskId, childContent) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    const task2 = this.calendarTasks.find((item) => item.id === taskId);
    if (task2?.taskKind !== "long") {
      new Notice("Only long tasks can have child tasks added here.");
      return;
    }
    await this.taskDateWriter.addChildTask(target.file, target.lineNumber, childContent);
    await this.rescanTasks();
  }
  openTaskArchiveModal() {
    new TaskArchiveModal(this.app, {
      candidates: this.getArchiveCandidates(),
      onArchive: (filePaths) => this.archiveCompletedTasksInNotes(filePaths)
    }).open();
  }
  async archiveCompletedTasksInNotes(filePaths) {
    let archivedCount = 0;
    for (const filePath of filePaths) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile))
        continue;
      archivedCount += await this.taskArchiveService.archiveCompletedTopLevelTasks(file, this.data.settings.archiveHeading);
    }
    await this.rescanTasks();
    return archivedCount;
  }
  async openTaskSourceNote(taskId) {
    const target = this.resolveTaskRef(taskId);
    if (!target)
      return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(target.file, {
      active: true,
      eState: { line: Math.max(0, target.lineNumber - 1) }
    });
    this.app.workspace.revealLeaf(leaf);
  }
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM)) {
      const view = leaf.view;
      if (view instanceof PersonalSystemView)
        view.render();
    }
  }
  resolveTaskRef(taskId) {
    const separator = taskId.lastIndexOf(":");
    if (separator < 0) {
      new Notice(`Invalid task ID: ${taskId}`);
      return null;
    }
    const filePath = taskId.slice(0, separator);
    const lineNumber = Number.parseInt(taskId.slice(separator + 1), 10);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || !Number.isFinite(lineNumber)) {
      new Notice(`Task not found: ${taskId}`);
      return null;
    }
    return { file, lineNumber };
  }
  shouldScheduleTaskInPlace(task2) {
    if (!task2)
      return false;
    return matchesAnyPathPrefix(task2.filePath, this.data.settings.scheduleInPlacePathPrefixes);
  }
  getArchiveCandidates() {
    const byFile = /* @__PURE__ */ new Map();
    for (const task2 of this.calendarTasks) {
      if (!task2.completed || task2.indentLevel !== 0)
        continue;
      const existing = byFile.get(task2.filePath);
      if (existing) {
        existing.completedTopLevelCount += 1;
        continue;
      }
      byFile.set(task2.filePath, {
        filePath: task2.filePath,
        fileName: task2.filePath.split("/").pop() ?? task2.filePath,
        completedTopLevelCount: 1
      });
    }
    return [...byFile.values()].sort((left, right) => left.filePath.localeCompare(right.filePath));
  }
  reportStartupScanFailure(error) {
    console.error("Calendar Bridge startup task scan failed.", error);
    new Notice("Calendar Bridge loaded, but startup task scan failed. Run Rescan after Obsidian finishes loading.");
  }
};
function createDefaultData() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function mergeCalendarData(raw) {
  const defaults = createDefaultData();
  if (!raw || typeof raw !== "object")
    return defaults;
  const partial = raw;
  const merged = {
    ...defaults,
    ...partial,
    settings: { ...defaults.settings, ...partial.settings ?? {} },
    ui: { ...defaults.ui, ...partial.ui ?? {} }
  };
  normalizeCalendarPathSettings(merged.settings);
  return merged;
}

// tests/pluginStartup.test.ts
(0, import_node_test.test)("plugin registration survives a startup scan failure", async () => {
  const notices = Notice.messages;
  notices.length = 0;
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const layoutReadyCallbacks = [];
  const timeoutCallbacks = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => {
    timeoutCallbacks.push(callback);
    return 1;
  };
  plugin.app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Inbox.md" }],
      cachedRead: async () => {
        throw new Error("metadata cache is still warming up");
      },
      on: () => ({})
    },
    metadataCache: {
      getFileCache: () => null
    },
    workspace: {
      getLeavesOfType: () => [],
      onLayoutReady: (callback) => {
        layoutReadyCallbacks.push(callback);
      }
    }
  };
  await import_node_assert.strict.doesNotReject(() => plugin.onload());
  import_node_assert.strict.deepEqual(plugin.registeredViews, [VIEW_TYPE_PERSONAL_SYSTEM]);
  import_node_assert.strict.deepEqual(plugin.commands, ["open-calendar-bridge", "rescan-calendar-bridge-tasks"]);
  import_node_assert.strict.equal(plugin.settingTabs.length, 1);
  import_node_assert.strict.equal(layoutReadyCallbacks.length, 1);
  const originalConsoleError = console.error;
  const errors = [];
  console.error = (...args) => {
    errors.push(args);
  };
  try {
    layoutReadyCallbacks[0]();
    await new Promise((resolve) => setImmediate(resolve));
    import_node_assert.strict.equal(timeoutCallbacks.length, 1);
    import_node_assert.strict.equal(errors.length, 0);
    import_node_assert.strict.equal(notices.length, 0);
    timeoutCallbacks[0]();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.error = originalConsoleError;
    globalThis.setTimeout = originalSetTimeout;
  }
  import_node_assert.strict.equal(errors.length, 1);
  import_node_assert.strict.equal(notices.length, 1);
});
(0, import_node_test.test)("activating the calendar opens a main workspace tab", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const calls = [];
  const leaf = {
    setViewState: async (state) => {
      calls.push(`setViewState:${state.type}:${state.active}`);
    }
  };
  plugin.app = {
    workspace: {
      getLeavesOfType: () => [],
      detachLeavesOfType: (viewType) => {
        calls.push(`detachLeavesOfType:${viewType}`);
      },
      getLeaf: (location) => {
        calls.push(`getLeaf:${location}`);
        return leaf;
      },
      getRightLeaf: () => {
        calls.push("getRightLeaf");
        return leaf;
      },
      revealLeaf: (target) => {
        import_node_assert.strict.equal(target, leaf);
        calls.push("revealLeaf");
      }
    }
  };
  await plugin.activateView();
  import_node_assert.strict.deepEqual(calls, [
    `detachLeavesOfType:${VIEW_TYPE_PERSONAL_SYSTEM}`,
    "getLeaf:tab",
    `setViewState:${VIEW_TYPE_PERSONAL_SYSTEM}:true`,
    "revealLeaf"
  ]);
});
(0, import_node_test.test)("activating the calendar moves an existing sidebar view into a main workspace tab", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const calls = [];
  const existingLeaf = {};
  const newLeaf = {
    setViewState: async (state) => {
      calls.push(`setViewState:${state.type}:${state.active}`);
    }
  };
  plugin.app = {
    workspace: {
      getLeavesOfType: () => [existingLeaf],
      detachLeavesOfType: (viewType) => {
        calls.push(`detachLeavesOfType:${viewType}`);
      },
      getLeaf: (location) => {
        calls.push(`getLeaf:${location}`);
        return newLeaf;
      },
      revealLeaf: (target) => {
        import_node_assert.strict.equal(target, newLeaf);
        calls.push("revealLeaf");
      }
    }
  };
  await plugin.activateView();
  import_node_assert.strict.deepEqual(calls, [
    `detachLeavesOfType:${VIEW_TYPE_PERSONAL_SYSTEM}`,
    "getLeaf:tab",
    `setViewState:${VIEW_TYPE_PERSONAL_SYSTEM}:true`,
    "revealLeaf"
  ]);
});
(0, import_node_test.test)("opening a task source jumps to the task note line", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const file = new TFile();
  file.path = "Inbox.md";
  const opened = [];
  const leaf = {
    openFile: async (target, state) => {
      opened.push({ file: target, state });
    }
  };
  plugin.app = {
    vault: {
      getAbstractFileByPath: (path) => path === "Inbox.md" ? file : null
    },
    workspace: {
      getLeaf: (location) => {
        import_node_assert.strict.equal(location, false);
        return leaf;
      },
      revealLeaf: (target) => {
        import_node_assert.strict.equal(target, leaf);
      }
    }
  };
  await plugin.openTaskSourceNote("Inbox.md:12");
  import_node_assert.strict.deepEqual(opened, [{
    file,
    state: { active: true, eState: { line: 11 } }
  }]);
});
(0, import_node_test.test)("scheduling a child of a long task keeps the child in its source note", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const file = new TFile();
  file.path = "Plans.md";
  const calls = [];
  plugin.app = {
    vault: {
      getAbstractFileByPath: (path) => path === "Plans.md" ? file : null
    }
  };
  plugin.data.settings.scheduledDayFolder = "Calendar/Scheduled";
  plugin.calendarTasks = [task("Plans.md:1", {
    lineNumber: 1,
    parentLongTaskId: "Plans.md:0",
    parentLongTaskText: "Parent long"
  })];
  plugin.taskDateWriter = {
    setPointSchedule: async (targetFile, lineNumber, scheduledDate) => {
      import_node_assert.strict.equal(targetFile, file);
      calls.push(`set:${lineNumber}:${scheduledDate}`);
    },
    movePointTaskToScheduledDay: async () => {
      calls.push("move");
    }
  };
  plugin.rescanTasks = async () => {
    calls.push("rescan");
  };
  await plugin.scheduleTaskDate("Plans.md:1", "2026-06-20");
  import_node_assert.strict.deepEqual(calls, ["set:1:2026-06-20", "rescan"]);
});
(0, import_node_test.test)("scheduling tasks under configured in-place folders keeps them in the source note", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const file = new TFile();
  file.path = "\u89C4\u5212/\u9636\u6BB5/Project.md";
  const calls = [];
  plugin.app = {
    vault: {
      getAbstractFileByPath: (path) => path === "\u89C4\u5212/\u9636\u6BB5/Project.md" ? file : null
    }
  };
  plugin.data.settings.scheduledDayFolder = "Calendar/Scheduled";
  plugin.data.settings.scheduleInPlacePathPrefixes = ["\u89C4\u5212/\u9636\u6BB5"];
  plugin.calendarTasks = [task("\u89C4\u5212/\u9636\u6BB5/Project.md:3", {
    filePath: "\u89C4\u5212/\u9636\u6BB5/Project.md",
    lineNumber: 3
  })];
  plugin.taskDateWriter = {
    setPointSchedule: async (targetFile, lineNumber, scheduledDate) => {
      import_node_assert.strict.equal(targetFile, file);
      calls.push(`set:${lineNumber}:${scheduledDate}`);
    },
    movePointTaskToScheduledDay: async () => {
      calls.push("move");
    }
  };
  plugin.rescanTasks = async () => {
    calls.push("rescan");
  };
  await plugin.scheduleTaskDate("\u89C4\u5212/\u9636\u6BB5/Project.md:3", "2026-06-20");
  import_node_assert.strict.deepEqual(calls, ["set:3:2026-06-20", "rescan"]);
});
(0, import_node_test.test)("scheduling ordinary source tasks still moves them into scheduled day notes", async () => {
  const PluginCtor = PersonalSchedulerPlugin;
  const plugin = new PluginCtor();
  const file = new TFile();
  file.path = "Inbox.md";
  const calls = [];
  plugin.app = {
    vault: {
      getAbstractFileByPath: (path) => path === "Inbox.md" ? file : null
    }
  };
  plugin.data.settings.scheduledDayFolder = "Calendar/Scheduled";
  plugin.data.settings.scheduleInPlacePathPrefixes = ["\u89C4\u5212/\u9636\u6BB5"];
  plugin.calendarTasks = [task("Inbox.md:2", {
    filePath: "Inbox.md",
    lineNumber: 2
  })];
  plugin.taskDateWriter = {
    setPointSchedule: async () => {
      calls.push("set");
    },
    movePointTaskToScheduledDay: async (targetFile, lineNumber, folder, scheduledDate) => {
      import_node_assert.strict.equal(targetFile, file);
      calls.push(`move:${lineNumber}:${folder}:${scheduledDate}`);
    }
  };
  plugin.rescanTasks = async () => {
    calls.push("rescan");
  };
  await plugin.scheduleTaskDate("Inbox.md:2", "2026-06-20");
  import_node_assert.strict.deepEqual(calls, ["move:2:Calendar/Scheduled:2026-06-20", "rescan"]);
});
function task(id, overrides = {}) {
  return {
    id,
    text: "Child point",
    filePath: "Plans.md",
    lineNumber: 1,
    rawLine: "  - [ ] Child point",
    completed: false,
    metadata: {},
    dates: {},
    taskKind: "point",
    indentLevel: 2,
    progressPercent: 0,
    dateSource: "none",
    triggerType: "inline",
    ...overrides
  };
}
