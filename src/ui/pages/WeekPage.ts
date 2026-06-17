import type PersonalSchedulerPlugin from "../../main";
import type { CalendarTask, WeekDayRow } from "../../models/types";
import { buildWeekViewModel } from "../../services/CalendarViewModel";
import { addDays, todayString } from "../../utils/date";
import { parseDurationToMinutes } from "../../utils/DataviewTaskDate";

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
  renderPool(pool, plugin, model.unscheduledTasks, model.overdueTasks);

  const week = shell.createDiv({ cls: "cb-panel cb-week" });
  renderToolbar(week, context, plugin);

  const list = week.createDiv({ cls: "cb-week-day-list" });
  for (const row of model.weekDayRows) renderDayRow(list, plugin, row);
}

function renderPool(parent: HTMLElement, plugin: PersonalSchedulerPlugin, unscheduled: CalendarTask[], overdue: CalendarTask[]): void {
  setupUnscheduledDropTarget(parent, plugin);
  parent.createEl("h2", { text: "Unscheduled" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => plugin.rescanTasks());
  parent.createDiv({ cls: "cb-section-label", text: `Unscheduled (${unscheduled.length})` });
  if (unscheduled.length === 0) parent.createDiv({ cls: "cb-empty", text: "No unscheduled tasks." });
  for (const task of unscheduled) renderPoolTask(parent, plugin, task);
  parent.createDiv({ cls: "cb-section-label", text: `Before anchor (${overdue.length})` });
  for (const task of overdue.slice(0, 12)) renderPoolTask(parent, plugin, task);
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
  toolbar.createEl("button", { text: "Refresh" }).addEventListener("click", () => plugin.rescanTasks());
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
    for (const task of row.tasks) renderScheduledTaskName(taskPane, task);
  }

  const reviewPane = item.createDiv({ cls: "cb-week-pressure-pane cb-review-pressure-pane" });
  reviewPane.createDiv({ cls: "cb-pane-title", text: `Review pressure ${formatMinutes(row.review.minutes)}` });
  reviewPane.createDiv({
    cls: row.review.count > 0 ? "cb-review-summary" : "cb-empty",
    text: row.review.count > 0 ? `${row.review.count} reviews | ${row.review.chars} chars` : "No reviews"
  });
}

function renderPoolTask(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const card = parent.createDiv({ cls: "cb-task-card" });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  card.createDiv({ cls: "cb-task-title", text: task.text });
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip", text: task.estimateMinutes ? formatMinutes(task.estimateMinutes) : "no estimate" });
  if (task.overdueReason) meta.createSpan({ cls: "cb-chip cb-chip-danger", text: task.overdueReason });
  if (task.unscheduledReason) meta.createSpan({ cls: "cb-chip cb-chip-info", text: task.unscheduledReason });
  if (task.filePath) card.createDiv({ cls: "cb-muted", text: task.filePath });
  renderTaskActions(card, plugin, task);
}

function renderScheduledTaskName(parent: HTMLElement, task: CalendarTask): void {
  const row = parent.createDiv({ cls: "cb-week-task-name" });
  row.draggable = true;
  row.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  row.createSpan({ text: task.text });
}

function renderTaskActions(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const actions = parent.createDiv({ cls: "cb-task-actions" });
  actions.createEl("button", { text: "Estimate" }).addEventListener("click", () => promptEstimate(plugin, task));
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

function promptEstimate(plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const raw = window.prompt("Estimate, e.g. 45m, 1h, 1h30m", task.estimateMinutes ? `${task.estimateMinutes}m` : "30m");
  const minutes = parseDurationToMinutes(raw ?? undefined);
  if (minutes !== undefined && minutes >= 0) void plugin.setTaskEstimate(task.id, minutes);
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}
