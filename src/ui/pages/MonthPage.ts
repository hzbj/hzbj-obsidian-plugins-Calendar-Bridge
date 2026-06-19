import { Notice } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";
import type { CalendarSpanBar, CalendarTask, CalendarViewModel, MonthTaskViewMode, SourceTaskGroup, SourceTaskGroupState, TaskSortMode } from "../../models/types";
import { buildMonthViewModel, buildSourceTaskGroups } from "../../services/CalendarViewModel";
import { buildLongTimelineDisplay, type LongTimelineDisplayDay } from "../../services/LongTaskTimelineDisplay";
import { addDays, todayString } from "../../utils/date";
import { normalizeTaskPriority, parseDurationToMinutes } from "../../utils/DataviewTaskDate";

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
  overdue: boolean;
  status?: string;
}

let longRangeDraft: { taskId: string; startDate?: string } | null = null;

export function renderMonthPage(container: HTMLElement, plugin: PersonalSchedulerPlugin, context: CalendarPageContext): void {
  container.empty();
  const groupState = getSourceGroupState(plugin);
  const model = buildMonthViewModel(
    context.anchorDate,
    plugin.calendarTasks,
    plugin.data.settings.weekStartsOn,
    plugin.reviewPressure,
    plugin.data.settings.defaultUnestimatedTaskMinutes,
    groupState
  );
  const viewMode: MonthTaskViewMode = plugin.data.ui.monthTaskViewMode ?? "point";
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
  parent.createEl("h2", { text: viewMode === "long" ? "Unscheduled long tasks" : "Unscheduled point tasks" });
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
  if (viewMode === "point") return task.taskKind !== "long";
  return task.taskKind === "long" || task.triggerType !== "phase-note";
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
  renderTaskTitle(card, task);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task) });
  if (task.estimateMinutes) meta.createSpan({ cls: "cb-chip", text: formatMinutes(task.estimateMinutes) });
  if (task.unscheduledReason) meta.createSpan({ cls: "cb-chip cb-chip-info", text: task.unscheduledReason });
}

function renderLongPoolTask(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const card = parent.createDiv({ cls: `cb-task-card cb-long-task-card ${priorityClass(task)}` });
  card.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, task));
  renderTaskTitle(card, task);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task) });
  meta.createSpan({ cls: "cb-chip", text: `progress ${task.progressPercent ?? 0}%` });
  const actions = card.createDiv({ cls: "cb-task-actions cb-inline-actions" });
  actions.createEl("button", { text: "Set range" }).addEventListener("click", () => {
    longRangeDraft = { taskId: task.id };
    plugin.refreshViews();
  });
}

function renderTaskTitle(parent: HTMLElement, task: CalendarTask): void {
  const row = parent.createDiv({ cls: "cb-task-title-row" });
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
    header.createSpan({ cls: "cb-task-count", text: String(load.taskCount) });

    const stats = cell.createDiv({ cls: "cb-day-stats" });
    stats.createDiv({ text: `${formatMinutes(load.taskMinutes)} task` });
    if (load.reviewMinutes > 0) stats.createDiv({ text: `${formatMinutes(load.reviewMinutes)} review` });
  }

  const pointBars = model.spanBars.filter((bar) => bar.task.taskKind !== "long");
  for (const segment of splitSpanBarsByWeek(pointBars)) {
    const bar = grid.createDiv({ cls: "cb-span-bar" });
    bar.setText(segment.bar.task.text);
    bar.style.gridColumn = `${segment.columnStart} / ${segment.columnEnd}`;
    bar.style.gridRow = String(segment.row);
    bar.title = `${segment.bar.task.text} ${segment.bar.startDate} -> ${segment.bar.endDate}`;
  }
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
    overdue: row.isOverdue,
    status: row.status
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
  bar.toggleClass("is-overdue", row.overdue);
  bar.draggable = true;
  bar.addEventListener("dragstart", (event) => setDragTask(event, row.task.id));
  bar.addEventListener("contextmenu", (event) => openTaskMenu(event, plugin, row.task));
  bar.style.gridRow = `${row.startDay} / ${row.endDay + 1}`;
  bar.style.gridColumn = String(row.lane);
  bar.toggleClass("is-clipped-start", row.clippedStart);
  bar.toggleClass("is-clipped-end", row.clippedEnd);
  renderTaskTitle(bar, row.task);
  const meta = bar.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip", text: `${shortDate(row.fullStartDate)} - ${shortDate(row.fullEndDate)}` });
  meta.createSpan({ cls: "cb-chip", text: `progress ${row.task.progressPercent ?? 0}%` });
  if (row.clippedStart || row.clippedEnd) meta.createSpan({ cls: "cb-chip cb-chip-info", text: "continues" });
  if (row.status) meta.createSpan({ cls: "cb-chip", text: row.status });
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
