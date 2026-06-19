import { Notice } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";
import type { CalendarTask, SourceTaskGroup, SourceTaskGroupState, TaskSortMode, WeekDayRow } from "../../models/types";
import { buildSourceTaskGroups, buildWeekViewModel } from "../../services/CalendarViewModel";
import { addDays, todayString } from "../../utils/date";
import { cleanTaskContentText, normalizeTaskPriority, parseDurationToMinutes } from "../../utils/DataviewTaskDate";

interface CalendarPageContext {
  anchorDate: string;
  setAnchorDate: (date: string) => void;
}

export function renderWeekPage(container: HTMLElement, plugin: PersonalSchedulerPlugin, context: CalendarPageContext): void {
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
  renderPool(pool, plugin, model.unifiedUnscheduledTasks.filter((task) => task.taskKind !== "long"));

  const week = shell.createDiv({ cls: "cb-panel cb-week" });
  renderToolbar(week, context, plugin);

  const list = week.createDiv({ cls: "cb-week-day-list" });
  for (const row of model.weekDayRows) renderDayRow(list, plugin, row);
}

function renderPool(parent: HTMLElement, plugin: PersonalSchedulerPlugin, unscheduled: CalendarTask[]): void {
  setupUnscheduledDropTarget(parent, plugin);
  const state = getSourceGroupState(plugin);
  parent.createEl("h2", { text: "Unscheduled point tasks" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => void plugin.rescanTasks());
  renderSortToggle(parent, plugin, state);

  const groups = buildSourceTaskGroups(unscheduled, state);
  if (groups.length === 0) {
    parent.createDiv({ cls: "cb-empty", text: "No unscheduled point tasks." });
    return;
  }

  for (const group of groups) renderSourceGroup(parent, plugin, group);
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
    await plugin.saveCalendarData();
  });
}

function renderSourceGroup(parent: HTMLElement, plugin: PersonalSchedulerPlugin, group: SourceTaskGroup): void {
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
  for (const task of group.tasks) renderPoolTask(section, plugin, task);
}

function renderToolbar(parent: HTMLElement, context: CalendarPageContext, plugin: PersonalSchedulerPlugin): void {
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

function renderDayRow(parent: HTMLElement, plugin: PersonalSchedulerPlugin, row: WeekDayRow): void {
  const item = parent.createDiv({ cls: "cb-week-day-row" });
  item.toggleClass("is-today", row.day.isToday);
  setupDropTarget(item, plugin, row.day.date);

  const header = item.createDiv({ cls: "cb-week-day-label" });
  header.createDiv({ cls: "cb-week-date", text: row.day.date });
  header.createDiv({ cls: "cb-muted", text: `${row.tasks.length} tasks | ${formatMinutes(row.totalMinutes)}` });

  const taskPane = item.createDiv({ cls: "cb-week-pressure-pane cb-task-pressure" });
  taskPane.createDiv({ cls: "cb-pane-title", text: `Task pressure ${formatMinutes(row.taskMinutes)}` });
  if (row.tasks.length === 0) {
    taskPane.createDiv({ cls: "cb-empty", text: "No tasks" });
  } else {
    const taskList = taskPane.createDiv({ cls: "cb-week-task-list" });
    for (const task of row.tasks) renderScheduledTaskName(taskList, plugin, task);
  }

  const reviewPane = item.createDiv({ cls: "cb-week-pressure-pane cb-review-pressure-pane" });
  reviewPane.createDiv({ cls: "cb-pane-title", text: `Review pressure ${formatMinutes(row.review.minutes)}` });
  reviewPane.createDiv({
    cls: row.review.count > 0 ? "cb-review-summary" : "cb-empty",
    text: row.review.count > 0 ? `${row.review.count} reviews | ${row.review.chars} chars` : "No reviews"
  });
}

function renderPoolTask(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const card = parent.createDiv({ cls: `cb-task-card ${priorityClass(task)}` });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  renderTaskTitle(card, plugin, task);
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip cb-priority-chip", text: priorityLabel(task) });
  meta.createSpan({ cls: "cb-chip", text: task.estimateMinutes ? formatMinutes(task.estimateMinutes) : "no estimate" });
  renderParentLongTaskChip(meta, task);
  if (task.unscheduledReason) meta.createSpan({ cls: "cb-chip cb-chip-info", text: task.unscheduledReason });
  if (task.filePath) card.createDiv({ cls: "cb-muted", text: task.filePath });
  const actions = card.createDiv({ cls: "cb-task-actions cb-inline-actions" });
  renderEstimateControl(actions, plugin, task);
}

function renderParentLongTaskChip(parent: HTMLElement, task: CalendarTask): void {
  if (!task.parentLongTaskText) return;
  parent.createSpan({ cls: "cb-chip cb-parent-long-task-chip", text: `Parent: ${task.parentLongTaskText}` });
}

function renderScheduledTaskName(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const row = parent.createDiv({ cls: `cb-week-task-name ${priorityClass(task)}` });
  row.draggable = true;
  row.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task.id));
  row.createSpan({ cls: "cb-week-priority cb-priority-marker", text: priorityLabel(task) });
  row.createSpan({ cls: "cb-week-task-content", text: taskContentLabel(task) });
}

function renderTaskTitle(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const row = parent.createDiv({ cls: "cb-task-title-row" });
  row.addEventListener("click", () => void plugin.openTaskSourceNote(task.id));
  row.createSpan({ cls: "cb-priority-marker", text: priorityLabel(task) });
  row.createSpan({ cls: "cb-task-title", text: task.text });
}

function renderEstimateControl(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const group = parent.createDiv({ cls: "cb-mini-control" });
  const input = group.createEl("input");
  input.type = "text";
  input.value = task.estimateMinutes ? `${task.estimateMinutes}m` : "";
  input.placeholder = "45m";
  input.title = "Estimate: 45m, 1h, 1h30m, or minutes";
  group.createEl("button", { text: "Estimate" }).addEventListener("click", () => void submitEstimate(plugin, task, input.value));
}

async function submitEstimate(plugin: PersonalSchedulerPlugin, task: CalendarTask, raw: string): Promise<void> {
  const minutes = parseDurationToMinutes(raw);
  if (minutes === undefined || minutes < 0) {
    new Notice("Invalid estimate. Use 45m, 1h, 1h30m, or minutes.");
    return;
  }
  try {
    await plugin.setTaskEstimate(task.id, minutes);
  } catch (error) {
    new Notice(`Failed to set estimate for ${task.filePath}:${task.lineNumber}`);
    console.error(error);
  }
}

function setupDropTarget(target: HTMLElement, plugin: PersonalSchedulerPlugin, scheduledDate: string): void {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    target.addClass("is-drop-target");
  });
  target.addEventListener("dragleave", () => target.removeClass("is-drop-target"));
  target.addEventListener("drop", async (event) => {
    event.preventDefault();
    target.removeClass("is-drop-target");
    const taskId = event.dataTransfer?.getData("application/x-calendar-bridge-task");
    if (taskId) await plugin.scheduleTaskDate(taskId, scheduledDate);
  });
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

async function toggleSourceGroup(plugin: PersonalSchedulerPlugin, sourceFilePath: string): Promise<void> {
  const state = getSourceGroupState(plugin);
  state.collapsed = { ...(state.collapsed ?? {}), [sourceFilePath]: !state.collapsed?.[sourceFilePath] };
  await plugin.saveCalendarData();
}

async function moveSourceGroup(plugin: PersonalSchedulerPlugin, source: string, target: string): Promise<void> {
  if (source === target) return;
  const state = getSourceGroupState(plugin);
  const known = new Set([...(state.order ?? []), source, target]);
  const order = [...known].filter((path) => path !== source);
  const targetIndex = order.indexOf(target);
  order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source);
  state.order = order;
  await plugin.saveCalendarData();
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

function taskContentLabel(task: CalendarTask): string {
  return cleanTaskContentText(task.rawLine) || task.text;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}
