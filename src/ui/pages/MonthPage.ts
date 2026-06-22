import { Notice } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";
import type { CalendarSpanBar, CalendarTask, CalendarViewModel, MonthTaskViewMode, SourceTaskGroup, SourceTaskGroupState, TaskSortMode } from "../../models/types";
import { buildMonthViewModel, buildSourceTaskGroups } from "../../services/CalendarViewModel";
import { buildLongTimelineDisplay, type LongTimelineDisplayDay } from "../../services/LongTaskTimelineDisplay";
import { addDays, todayString } from "../../utils/date";
import { cleanTaskContentText, normalizeTaskPriority, parseDurationToMinutes } from "../../utils/DataviewTaskDate";

interface CalendarPageContext {
  anchorDate: string;
  setAnchorDate: (date: string) => void;
}

interface TimelineRow {
  task: CalendarTask;
  startDay: number;
  endDay: number;
  lane: number;
  fullStartDate: string;
  fullEndDate: string;
  clippedStart: boolean;
  clippedEnd: boolean;
  status?: string;
  childTasks: CalendarTask[];
}

let longRangeDraft: { taskId: string; startDate?: string } | null = null;

export function renderMonthPage(container: HTMLElement, plugin: PersonalSchedulerPlugin, context: CalendarPageContext): void {
  container.empty();
  const groupState = getSourceGroupState(plugin);
  const viewMode: MonthTaskViewMode = plugin.data.ui.monthTaskViewMode ?? "point";
  const calendarTasks = viewMode === "long"
    ? plugin.calendarTasks.filter((task) => !isScheduledDayFilePath(task.filePath, plugin.data.settings.scheduledDayFolder))
    : plugin.calendarTasks;
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

function renderGroupedPool(parent: HTMLElement, plugin: PersonalSchedulerPlugin, model: CalendarViewModel, viewMode: MonthTaskViewMode): void {
  setupUnscheduledDropTarget(parent, plugin);
  const state = getSourceGroupState(plugin);
  parent.createEl("h2", { text: "Unscheduled tasks" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => void plugin.rescanTasks());
  renderSortToggle(parent, plugin, state);

  const tasks = model.unifiedUnscheduledTasks.filter((task) => isTaskVisibleInPool(task, viewMode));
  const groups = buildSourceTaskGroups(tasks, state);
  if (groups.length === 0) {
    parent.createDiv({ cls: "cb-empty", text: "No unscheduled tasks." });
    return;
  }

  for (const group of groups) renderSourceGroup(parent, plugin, group, viewMode);
}

function isTaskVisibleInPool(task: CalendarTask, viewMode: MonthTaskViewMode): boolean {
  // The source list is already restricted to unscheduled tasks; do not hide phase-note tasks by mode.
  return true;
}

function renderSortToggle(parent: HTMLElement, plugin: PersonalSchedulerPlugin, state: SourceTaskGroupState): void {
  const row = parent.createDiv({ cls: "cb-pool-controls" });
  row.createSpan({ cls: "cb-muted", text: "Sort" });
  const select = row.createEl("select");
  select.createEl("option", { value: "manual", text: "Manual" });
  select.createEl("option", { value: "priority", text: "Priority" });
  select.value = state.sortMode ?? "manual";
  select.addEventListener("change", async () => {
    getSourceGroupState(plugin).sortMode = select.value as TaskSortMode;
    await plugin.saveData(plugin.data);
    plugin.refreshViews();
  });
}

function renderSourceGroup(parent: HTMLElement, plugin: PersonalSchedulerPlugin, group: SourceTaskGroup, viewMode: MonthTaskViewMode): void {
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
    if (source) void moveSourceGroup(plugin, source, group.sourceFilePath);
  });
  header.createSpan({ cls: "cb-source-caret", text: group.collapsed ? ">" : "v" });
  header.createSpan({ cls: "cb-source-title", text: group.sourceFileName });
  header.createSpan({ cls: "cb-source-count", text: String(group.tasks.length) });
  header.addEventListener("click", () => void toggleSourceGroup(plugin, group.sourceFilePath));

  if (group.collapsed) return;
  for (const task of group.tasks) {
    viewMode === "long" ? renderLongPoolTask(section, plugin, task) : renderPointPoolTask(section, plugin, task);
  }
}

function renderPointPoolTask(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const card = parent.createDiv({ cls: `cb-task-card ${priorityClass(task)}` });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  card.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task));
  renderTaskTitle(card, plugin, task);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task) });
  if (task.estimateMinutes) meta.createSpan({ cls: "cb-chip", text: formatMinutes(task.estimateMinutes) });
  renderParentLongTaskChip(meta, task);
  if (task.unscheduledReason) meta.createSpan({ cls: "cb-chip cb-chip-info", text: task.unscheduledReason });
}

function renderLongPoolTask(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const card = parent.createDiv({ cls: `cb-task-card cb-long-task-card ${priorityClass(task)}` });
  card.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task));
  renderTaskTitle(card, plugin, task);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task) });
  meta.createSpan({ cls: "cb-chip", text: `progress ${task.progressPercent ?? 0}%` });
  const actions = card.createDiv({ cls: "cb-task-actions cb-inline-actions" });
  actions.createEl("button", { text: "Set range" }).addEventListener("click", () => {
    longRangeDraft = { taskId: task.id };
    plugin.refreshViews();
  });
}

function renderTaskTitle(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const row = parent.createDiv({ cls: "cb-task-title-row" });
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task.id));
  row.createSpan({ cls: "cb-priority-marker", text: priorityLabel(task) });
  row.createSpan({ cls: "cb-task-title", text: task.text });
}

function renderLongVerticalTimeline(
  parent: HTMLElement,
  plugin: PersonalSchedulerPlugin,
  context: CalendarPageContext,
  model: CalendarViewModel,
  viewMode: MonthTaskViewMode,
  rerender: () => void
): void {
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

  for (const row of rows) renderLongVerticalTask(track, plugin, row);
}

function renderLongPastDaysToggle(parent: HTMLElement, plugin: PersonalSchedulerPlugin, pastDayCount: number, expanded: boolean): void {
  if (pastDayCount === 0) return;
  const controls = parent.createDiv({ cls: "cb-long-past-controls" });
  controls.createEl("button", {
    cls: "cb-long-past-toggle",
    text: expanded ? "Collapse past days" : `Show past days (${pastDayCount})`
  }).addEventListener("click", () => void toggleLongTaskPastDays(plugin));
}

function renderPointMonthGrid(
  parent: HTMLElement,
  plugin: PersonalSchedulerPlugin,
  context: CalendarPageContext,
  model: CalendarViewModel,
  viewMode: MonthTaskViewMode
): void {
  renderToolbar(parent, context, plugin, viewMode);
  parent.createDiv({ cls: "cb-span-hint", text: "Point task mode: drag an unscheduled task onto a date." });
  renderWeekdayHeader(parent, plugin.data.settings.weekStartsOn);

  const grid = parent.createDiv({ cls: "cb-month-days" });
  for (const day of model.days) {
    const load = model.dayLoads[day.date];
    const cell = grid.createDiv({ cls: "cb-day-cell" });
    cell.toggleClass("is-outside-month", !day.inCurrentMonth);
    cell.toggleClass("is-today", day.isToday);
    cell.style.setProperty("--cb-heat", String(Math.min(1, load.heatScore / 360)));
    setupPointDateTarget(cell, plugin, day.date);

    const header = cell.createDiv({ cls: "cb-day-header" });
    header.createSpan({ cls: "cb-day-number", text: String(day.dayOfMonth) });
    header.createSpan({ cls: "cb-task-count", text: `${load.taskCount}/${load.recurringTaskCount}` });

    const stats = cell.createDiv({ cls: "cb-day-stats" });
    const loads = stats.createDiv({ cls: "cb-day-load-breakdown" });
    renderDayLoadMetric(loads, "Task", formatMinutes(load.taskMinutes), "cb-day-load-task");
    renderDayLoadMetric(loads, "Repeat", formatMinutes(load.recurringTaskMinutes), "cb-day-load-repeat");
    if (load.reviewMinutes > 0) stats.createDiv({ cls: "cb-day-review-summary", text: `Review ${formatMinutes(load.reviewMinutes)}` });
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

function renderDayLoadMetric(parent: HTMLElement, label: string, value: string, extraClass: string): void {
  const metric = parent.createDiv({ cls: `cb-day-load-summary ${extraClass}` });
  metric.createSpan({ cls: "cb-day-load-label", text: label });
  metric.createSpan({ cls: "cb-day-load-value", text: value });
}

function renderWeekdayHeader(parent: HTMLElement, weekStartsOn: 0 | 1): void {
  const row = parent.createDiv({ cls: "cb-weekday-row" });
  const labels = weekStartsOn === 1 ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const label of labels) row.createDiv({ cls: "cb-weekday", text: label });
}

function renderToolbar(parent: HTMLElement, context: CalendarPageContext, plugin: PersonalSchedulerPlugin, viewMode: MonthTaskViewMode): void {
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

function addModeButton(parent: HTMLElement, plugin: PersonalSchedulerPlugin, mode: MonthTaskViewMode, label: string, current: MonthTaskViewMode): void {
  const button = parent.createEl("button", { text: label });
  button.toggleClass("is-active", mode === current);
  button.addEventListener("click", async () => {
    plugin.data.ui.monthTaskViewMode = mode;
    await plugin.saveData(plugin.data);
    plugin.refreshViews();
  });
}

function renderRangeHint(parent: HTMLElement, plugin: PersonalSchedulerPlugin, viewMode: MonthTaskViewMode): void {
  const hint = parent.createDiv({ cls: "cb-span-hint" });
  if (viewMode !== "long") {
    hint.setText("Point task mode: drag a point task onto a timeline day to schedule it. Right-click a task bar for settings.");
    return;
  }
  const task = longRangeDraft ? plugin.calendarTasks.find((item) => item.id === longRangeDraft?.taskId) : undefined;
  if (!task) {
    hint.setText("Long task mode: click Set range on an unscheduled long task, then choose start and end dates on the timeline.");
    return;
  }
  hint.setText(longRangeDraft?.startDate ? `Range: ${task.text}. Choose end date.` : `Range: ${task.text}. Choose start date.`);
}

function buildLongTimelineRows(rows: CalendarViewModel["longTaskTimelineRows"]): TimelineRow[] {
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

function assignVerticalTimelineLanes(rows: TimelineRow[]): TimelineRow[] {
  const lastEndByLane: number[] = [];
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

function renderLongDatePicker(
  parent: HTMLElement,
  plugin: PersonalSchedulerPlugin,
  monthDays: LongTimelineDisplayDay[],
  viewMode: MonthTaskViewMode,
  rerender: () => void
): void {
  const picker = parent.createDiv({ cls: "cb-long-vertical-date-axis" });
  for (const day of monthDays) {
    const button = picker.createEl("button", { cls: "cb-long-vertical-date", text: day.label });
    button.toggleClass("is-today", day.isToday);
    button.toggleClass("is-folded-past", day.isFoldedPast);
    button.title = day.isFoldedPast && day.foldedStartDate && day.foldedEndDate
      ? `${day.foldedStartDate} - ${day.foldedEndDate}`
      : day.date;
    if (day.isFoldedPast) {
      button.addClass("cb-long-past-toggle");
      button.addEventListener("click", () => void toggleLongTaskPastDays(plugin));
      continue;
    }
    setupTimelineDateTarget(button, plugin, day.date, viewMode, rerender);
  }
}

function renderLongVerticalTask(
  parent: HTMLElement,
  plugin: PersonalSchedulerPlugin,
  row: TimelineRow
): void {
  const bar = parent.createDiv({ cls: `cb-long-vertical-bar ${priorityClass(row.task)}` });
  bar.toggleClass("is-behind", row.status === "behind");
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
  if (row.clippedStart || row.clippedEnd) meta.createSpan({ cls: "cb-chip cb-chip-info", text: "continues" });
  if (row.status) meta.createSpan({ cls: `cb-chip cb-pace-status-${row.status}`, text: row.status });
  renderLongTaskChildren(bar, plugin, row.childTasks);
}

function renderLongTaskChildren(parent: HTMLElement, plugin: PersonalSchedulerPlugin, childTasks: CalendarTask[]): void {
  if (childTasks.length === 0) return;
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
    if (schedule) item.createSpan({ cls: "cb-long-child-time", text: schedule });
  }
}

function renderRecurringChildTask(parent: HTMLElement, task: CalendarTask): void {
  const item = parent.createDiv({ cls: "cb-long-child-item cb-long-child-recurring" });
  const title = item.createDiv({ cls: "cb-long-child-recurring-title" });
  title.createSpan({ cls: "cb-long-child-title", text: childTaskContentLabel(task) });
  title.createSpan({ cls: "cb-long-child-cycle", text: recurringCycleLabel(task) });
  item.createDiv({ cls: "cb-long-child-refresh", text: recurringRefreshLabel(task) });
}

function renderChildLongTaskCard(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask, schedule: string): void {
  const item = parent.createDiv({ cls: `cb-long-child-card ${priorityClass(task)}` });
  item.draggable = true;
  item.addEventListener("dragstart", (event) => {
    // Child cards are nested in a draggable parent bar; keep the child's id from being overwritten.
    event.stopPropagation();
    setDragTask(event, task.id);
  });
  const header = item.createDiv({ cls: "cb-long-child-card-header" });
  header.addEventListener("click", () => void plugin.openTaskSourceNote(task.id));
  header.createSpan({ cls: "cb-long-child-card-title", text: childTaskContentLabel(task) });
  header.createSpan({ cls: "cb-long-child-card-range", text: schedule });
}

function renderParentLongTaskChip(parent: HTMLElement, task: CalendarTask): void {
  if (!task.parentLongTaskText) return;
  parent.createSpan({ cls: "cb-chip cb-parent-long-task-chip", text: `Parent: ${task.parentLongTaskText}` });
}

function childTaskScheduleLabel(task: CalendarTask): string | undefined {
  if (task.taskKind === "long" && task.spanStart && task.spanEnd) return `${shortDate(task.spanStart)} - ${shortDate(task.spanEnd)}`;
  if (task.scheduleDate) return shortDate(task.scheduleDate);
  return undefined;
}

function recurringCycleLabel(task: CalendarTask): string {
  const normalized = normalizedRecurrence(task);
  if (normalized === "every day") return "每天";
  if (normalized === "every week") return "每周";
  if (normalized === "every month") return "每月";
  if (normalized === "every year") return "每年";
  return task.recurrence?.trim() ?? "循环";
}

function recurringRefreshLabel(task: CalendarTask): string {
  const start = task.dates.start;
  const normalized = normalizedRecurrence(task);
  if (!start) return "刷新：--";
  if (normalized === "every day") return "刷新：每天";
  if (normalized === "every week") return `刷新：${weekdayLabel(start)}`;
  if (normalized === "every month") return `刷新：${Number.parseInt(start.slice(8, 10), 10)}日`;
  if (normalized === "every year") return `刷新：${shortDate(start)}`;
  return `刷新：${shortDate(start)}`;
}

function normalizedRecurrence(task: CalendarTask): string | undefined {
  return task.recurrence?.trim().toLowerCase().replace(/\s+/gu, " ");
}

function weekdayLabel(date: string): string {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!parts) return shortDate(date);
  const day = new Date(Number.parseInt(parts[1], 10), Number.parseInt(parts[2], 10) - 1, Number.parseInt(parts[3], 10)).getDay();
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day];
}

function isRecurringTask(task: CalendarTask): boolean {
  return Boolean(task.recurrence?.trim());
}

function childTaskContentLabel(task: CalendarTask): string {
  return cleanTaskContentText(task.rawLine) || task.text;
}

function setupTimelineDateTarget(target: HTMLElement, plugin: PersonalSchedulerPlugin, date: string, viewMode: MonthTaskViewMode, rerender: () => void): void {
  if (viewMode === "long") {
    target.addEventListener("click", async () => {
      if (!longRangeDraft) return;
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
    if (taskId) await plugin.scheduleTaskDate(taskId, date);
  });
}

function setupPointDateTarget(target: HTMLElement, plugin: PersonalSchedulerPlugin, date: string): void {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId) await plugin.scheduleTaskDate(taskId, date);
  });
}

function openTaskMenu(event: MouseEvent, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  event.preventDefault();
  closeTaskMenu();
  const menu = document.body.createDiv({ cls: "cb-task-context-menu" });
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  menu.createDiv({ cls: "cb-menu-title", text: task.text });

  const priorityRow = menu.createDiv({ cls: "cb-menu-row" });
  priorityRow.createSpan({ text: "Priority" });
  const priority = priorityRow.createEl("select");
  for (const value of ["", "highest", "high", "medium", "low"]) priority.createEl("option", { value, text: value || "None" });
  priority.value = normalizeTaskPriority(task.priority) ?? "";

  const estimateRow = menu.createDiv({ cls: "cb-menu-row" });
  estimateRow.createSpan({ text: "Estimate" });
  const estimate = estimateRow.createEl("input");
  estimate.type = "text";
  estimate.placeholder = "45m";
  estimate.value = task.estimateMinutes ? `${task.estimateMinutes}m` : "";

  const progressRow = menu.createDiv({ cls: "cb-menu-row" });
  progressRow.createSpan({ text: "Progress" });
  const progress = progressRow.createEl("input");
  progress.type = "number";
  progress.min = "0";
  progress.max = "100";
  progress.value = String(task.progressPercent ?? 0);

  const rangeRow = menu.createDiv({ cls: "cb-menu-row cb-menu-range" });
  rangeRow.createSpan({ text: "Range" });
  const start = rangeRow.createEl("input");
  start.type = "date";
  start.value = task.spanStart ?? "";
  const end = rangeRow.createEl("input");
  end.type = "date";
  end.value = task.spanEnd ?? "";

  const actions = menu.createDiv({ cls: "cb-menu-actions" });
  actions.createEl("button", { text: "Apply" }).addEventListener("click", () => void applyTaskMenu(plugin, task, {
    priority: priority.value,
    estimate: estimate.value,
    progress: progress.value,
    startDate: start.value,
    endDate: end.value
  }));
  actions.createEl("button", { text: "Move to unscheduled" }).addEventListener("click", () => void moveTaskToUnscheduled(plugin, task));
  actions.createEl("button", { text: "Close" }).addEventListener("click", closeTaskMenu);

  setTimeout(() => {
    const closeOnOutsideClick = (click: MouseEvent) => {
      if (!menu.contains(click.target as Node)) {
        closeTaskMenu();
        document.removeEventListener("mousedown", closeOnOutsideClick);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
  }, 0);
}

async function applyTaskMenu(
  plugin: PersonalSchedulerPlugin,
  task: CalendarTask,
  values: { priority: string; estimate: string; progress: string; startDate: string; endDate: string }
): Promise<void> {
  try {
    await plugin.setTaskPriority(task.id, values.priority);
    const minutes = parseDurationToMinutes(values.estimate);
    if (values.estimate.trim() && minutes === undefined) {
      new Notice("Invalid estimate. Use 45m, 1h, 1h30m, or minutes.");
      return;
    }
    if (minutes !== undefined) await plugin.setTaskEstimate(task.id, minutes);
    const progress = Number.parseFloat(values.progress.replace("%", "").trim());
    if (Number.isFinite(progress)) await plugin.setTaskProgress(task.id, progress);
    if (values.startDate && values.endDate) await plugin.scheduleTaskSpan(task.id, values.startDate, values.endDate);
    closeTaskMenu();
  } catch (error) {
    new Notice(`Failed to update task ${task.filePath}:${task.lineNumber}`);
    console.error(error);
  }
}

async function moveTaskToUnscheduled(plugin: PersonalSchedulerPlugin, task: CalendarTask): Promise<void> {
  try {
    await plugin.unscheduleTask(task.id);
    closeTaskMenu();
  } catch (error) {
    new Notice(`Failed to unschedule task ${task.filePath}:${task.lineNumber}`);
    console.error(error);
  }
}

function closeTaskMenu(): void {
  document.querySelectorAll(".cb-task-context-menu").forEach((menu) => menu.remove());
}

function setupUnscheduledDropTarget(target: HTMLElement, plugin: PersonalSchedulerPlugin): void {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId) await plugin.unscheduleTask(taskId);
  });
}

function setDragTask(event: DragEvent, taskId: string): void {
  event.dataTransfer?.setData("application/x-calendar-bridge-task", taskId);
  event.dataTransfer?.setData("text/plain", taskId);
}

function splitSpanBarsByWeek(bars: CalendarSpanBar[]): Array<{ bar: CalendarSpanBar; row: number; columnStart: number; columnEnd: number }> {
  const segments: Array<{ bar: CalendarSpanBar; row: number; columnStart: number; columnEnd: number }> = [];
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

async function toggleSourceGroup(plugin: PersonalSchedulerPlugin, sourceFilePath: string): Promise<void> {
  const state = getSourceGroupState(plugin);
  state.collapsed = { ...(state.collapsed ?? {}), [sourceFilePath]: !state.collapsed?.[sourceFilePath] };
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}

async function toggleLongTaskPastDays(plugin: PersonalSchedulerPlugin): Promise<void> {
  plugin.data.ui.longTaskPastDaysExpanded = plugin.data.ui.longTaskPastDaysExpanded !== true;
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}

async function moveSourceGroup(plugin: PersonalSchedulerPlugin, source: string, target: string): Promise<void> {
  if (source === target) return;
  const state = getSourceGroupState(plugin);
  const known = new Set([...(state.order ?? []), source, target]);
  const order = [...known].filter((path) => path !== source);
  const targetIndex = order.indexOf(target);
  order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source);
  state.order = order;
  await plugin.saveData(plugin.data);
  plugin.refreshViews();
}

function getSourceGroupState(plugin: PersonalSchedulerPlugin): SourceTaskGroupState {
  const existing = plugin.data.ui.sourceTaskGroups;
  if (existing && typeof existing === "object") return existing;
  plugin.data.ui.sourceTaskGroups = { order: [], collapsed: {}, sortMode: "manual" };
  return plugin.data.ui.sourceTaskGroups;
}

function priorityLabel(task: CalendarTask): string {
  return normalizeTaskPriority(task.priority) ?? "None";
}

function priorityClass(task: CalendarTask): string {
  const normalized = normalizeTaskPriority(task.priority);
  return normalized ? `is-priority-${normalized.toLowerCase()}` : "is-priority-none";
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}

function shortDate(date: string | undefined): string {
  return date ? date.slice(5) : "--";
}

export function isScheduledDayFilePath(filePath: string, scheduledDayFolder: string): boolean {
  const folder = (scheduledDayFolder.trim().replace(/\\/gu, "/").replace(/\/+$/u, "") || "Calendar/Scheduled");
  const normalized = filePath.replace(/\\/gu, "/");
  if (!normalized.startsWith(`${folder}/`)) return false;
  return /^\d{8}\.md$/u.test(normalized.slice(folder.length + 1));
}
