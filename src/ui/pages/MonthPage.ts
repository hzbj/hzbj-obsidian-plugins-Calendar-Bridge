import type PersonalSchedulerPlugin from "../../main";
import type { CalendarSpanBar, CalendarTask, CalendarViewModel, LongTaskProgress, MonthTaskViewMode } from "../../models/types";
import { buildMonthViewModel } from "../../services/CalendarViewModel";
import { addDays, todayString } from "../../utils/date";
import { parseDurationToMinutes } from "../../utils/DataviewTaskDate";

interface CalendarPageContext {
  anchorDate: string;
  setAnchorDate: (date: string) => void;
}

let spanDraft: { taskId: string; startDate?: string } | null = null;

export function renderMonthPage(container: HTMLElement, plugin: PersonalSchedulerPlugin, context: CalendarPageContext): void {
  container.empty();
  const model = buildMonthViewModel(
    context.anchorDate,
    plugin.calendarTasks,
    plugin.data.settings.weekStartsOn,
    plugin.reviewPressure,
    plugin.data.settings.defaultUnestimatedTaskMinutes
  );
  const viewMode: MonthTaskViewMode = plugin.data.ui.monthTaskViewMode ?? "point";
  const shell = container.createDiv({ cls: "cb-calendar-shell" });

  const pool = shell.createDiv({ cls: "cb-panel cb-task-pool" });
  if (viewMode === "long") renderLongTaskSidebar(pool, plugin, model);
  else renderPool(pool, plugin, model.unscheduledTasks, model.overdueTasks);

  const calendar = shell.createDiv({ cls: "cb-panel cb-month" });
  renderToolbar(calendar, context, plugin, viewMode);
  if (viewMode === "point") renderSpanHint(calendar, plugin);
  else calendar.createDiv({ cls: "cb-span-hint", text: "长任务视图显示总体进度、截止压力和跨度位置；点任务压力请切回点任务。" });
  renderWeekdayHeader(calendar, plugin.data.settings.weekStartsOn);

  const grid = calendar.createDiv({ cls: "cb-month-days" });
  for (const day of model.days) {
    const load = model.dayLoads[day.date];
    const cell = grid.createDiv({ cls: "cb-day-cell" });
    cell.toggleClass("is-outside-month", !day.inCurrentMonth);
    cell.toggleClass("is-today", day.isToday);
    cell.style.setProperty("--cb-heat", String(Math.min(1, load.heatScore / 360)));
    if (viewMode === "point") setupDateTarget(cell, plugin, day.date, () => renderMonthPage(container, plugin, context));

    const header = cell.createDiv({ cls: "cb-day-header" });
    header.createSpan({ cls: "cb-day-number", text: String(day.dayOfMonth) });
    header.createSpan({ cls: "cb-task-count", text: String(viewMode === "point" ? load.taskCount : longTasksTouchingDate(model, day.date)) });

    const stats = cell.createDiv({ cls: "cb-day-stats" });
    if (viewMode === "point") {
      stats.createDiv({ text: `${formatMinutes(load.taskMinutes)} task` });
      if (load.reviewMinutes > 0) stats.createDiv({ text: `${formatMinutes(load.reviewMinutes)} review` });
    } else {
      const dueToday = model.longTaskProgress.filter((item) => item.task.spanEnd === day.date).length;
      stats.createDiv({ text: dueToday > 0 ? `${dueToday} due` : "long tasks" });
    }
  }

  const visibleSpanBars = model.spanBars.filter((bar) => viewMode === "long" ? bar.task.taskKind === "long" : bar.task.taskKind !== "long");
  for (const segment of splitSpanBarsByWeek(visibleSpanBars)) {
    const bar = grid.createDiv({ cls: "cb-span-bar" });
    bar.setText(segment.bar.task.text);
    bar.style.gridColumn = `${segment.columnStart} / ${segment.columnEnd}`;
    bar.style.gridRow = String(segment.row);
    bar.title = `${segment.bar.task.text} ${segment.bar.startDate} -> ${segment.bar.endDate}`;
  }
}

function renderLongTaskSidebar(parent: HTMLElement, plugin: PersonalSchedulerPlugin, model: CalendarViewModel): void {
  parent.createEl("h2", { text: "长任务" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => plugin.rescanTasks());

  parent.createDiv({ cls: "cb-section-label", text: `排期任务进度 (${model.longTaskProgress.length})` });
  if (model.longTaskProgress.length === 0) parent.createDiv({ cls: "cb-empty", text: "没有已排期长任务。" });
  for (const item of model.longTaskProgress) renderLongProgressCard(parent, plugin, item);

  parent.createDiv({ cls: "cb-section-label", text: `未排期任务 (${model.longUnscheduledTasks.length})` });
  if (model.longUnscheduledTasks.length === 0) parent.createDiv({ cls: "cb-empty", text: "没有未排期长任务。" });
  for (const task of model.longUnscheduledTasks) renderLongSimpleCard(parent, task, "missing start or due");

  parent.createDiv({ cls: "cb-section-label", text: `逾期任务 (${model.longOverdueTasks.length})` });
  if (model.longOverdueTasks.length === 0) parent.createDiv({ cls: "cb-empty", text: "没有逾期长任务。" });
  for (const task of model.longOverdueTasks) renderLongSimpleCard(parent, task, `due ${task.spanEnd ?? task.dueDate ?? "-"}`);
}

function renderLongProgressCard(parent: HTMLElement, plugin: PersonalSchedulerPlugin, item: LongTaskProgress): void {
  const card = parent.createDiv({ cls: "cb-task-card cb-long-task-card" });
  card.createDiv({ cls: "cb-task-title", text: item.task.text });
  const progress = card.createDiv({ cls: "cb-progress-track" });
  progress.createDiv({ cls: "cb-progress-fill" }).style.width = `${Math.min(100, Math.max(0, item.progressPercent))}%`;

  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip", text: `剩余 ${item.daysLeft} 天` });
  meta.createSpan({ cls: "cb-chip", text: `进度 ${item.progressPercent}%` });
  meta.createSpan({ cls: "cb-chip", text: `每日 ${item.dailyProgressPressure}%` });
  if (item.dailyEstimatedMinutes !== undefined) meta.createSpan({ cls: "cb-chip", text: `${formatMinutes(item.dailyEstimatedMinutes)}/day` });
  meta.createSpan({ cls: item.status === "behind" ? "cb-chip cb-chip-danger" : "cb-chip", text: item.status });

  const actions = card.createDiv({ cls: "cb-task-actions" });
  actions.createEl("button", { text: "Progress" }).addEventListener("click", () => promptProgress(plugin, item.task));
}

function renderLongSimpleCard(parent: HTMLElement, task: CalendarTask, reason: string): void {
  const card = parent.createDiv({ cls: "cb-task-card cb-long-task-card" });
  card.createDiv({ cls: "cb-task-title", text: task.text });
  const meta = card.createDiv({ cls: "cb-meta-row" });
  meta.createSpan({ cls: "cb-chip", text: `进度 ${task.progressPercent ?? 0}%` });
  meta.createSpan({ cls: "cb-chip cb-chip-info", text: reason });
  if (task.filePath) card.createDiv({ cls: "cb-muted", text: task.filePath });
}

function renderPool(parent: HTMLElement, plugin: PersonalSchedulerPlugin, unscheduled: CalendarTask[], overdue: CalendarTask[]): void {
  setupUnscheduledDropTarget(parent, plugin);
  parent.createEl("h2", { text: "Unscheduled" });
  parent.createEl("button", { cls: "cb-action-button", text: "Rescan" }).addEventListener("click", () => plugin.rescanTasks());

  parent.createDiv({ cls: "cb-section-label", text: `Unscheduled (${unscheduled.length})` });
  if (unscheduled.length === 0) parent.createDiv({ cls: "cb-empty", text: "No unscheduled tasks." });
  for (const task of unscheduled) renderTaskCard(parent, plugin, task, true);

  parent.createDiv({ cls: "cb-section-label", text: `Before anchor (${overdue.length})` });
  for (const task of overdue.slice(0, 12)) renderTaskCard(parent, plugin, task, true);
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
  toolbar.createEl("button", { text: "Refresh" }).addEventListener("click", () => plugin.rescanTasks());
  const toggle = toolbar.createDiv({ cls: "cb-mode-toggle" });
  addModeButton(toggle, plugin, "long", "长任务", viewMode);
  addModeButton(toggle, plugin, "point", "点任务", viewMode);
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

function renderSpanHint(parent: HTMLElement, plugin: PersonalSchedulerPlugin): void {
  const hint = parent.createDiv({ cls: "cb-span-hint" });
  const task = spanDraft ? plugin.calendarTasks.find((item) => item.id === spanDraft?.taskId) : undefined;
  if (!task) {
    hint.setText("Span mode: click Span in the pool, then choose start and end dates.");
    return;
  }
  hint.setText(spanDraft?.startDate ? `Span: ${task.text}. Choose end date.` : `Span: ${task.text}. Choose start date.`);
}

function renderWeekdayHeader(parent: HTMLElement, weekStartsOn: 0 | 1): void {
  const row = parent.createDiv({ cls: "cb-weekday-row" });
  const labels = weekStartsOn === 1 ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const label of labels) row.createDiv({ cls: "cb-weekday", text: label });
}

function renderTaskCard(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask, showSource = false): HTMLElement {
  const card = parent.createDiv({ cls: "cb-task-card" });
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragTask(event, task.id));
  card.createDiv({ cls: "cb-task-title", text: task.text });
  renderTaskMeta(card, plugin, task);
  const actions = card.createDiv({ cls: "cb-task-actions" });
  actions.createEl("button", { text: "Span" }).addEventListener("click", () => {
    spanDraft = { taskId: task.id };
    plugin.refreshViews();
  });
  actions.createEl("button", { text: "Estimate" }).addEventListener("click", () => promptEstimate(plugin, task));
  if (showSource) card.createDiv({ cls: "cb-muted", text: task.filePath });
  return card;
}

function renderTaskMeta(parent: HTMLElement, plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const meta = parent.createDiv({ cls: "cb-meta-row" });
  if (task.scheduleDate) meta.createSpan({ cls: "cb-chip", text: `scheduled ${task.scheduleDate}` });
  if (task.spanStart && task.spanEnd) meta.createSpan({ cls: "cb-chip", text: `${task.spanStart} -> ${task.spanEnd}` });
  if (task.estimateMinutes) meta.createSpan({ cls: "cb-chip", text: formatMinutes(task.estimateMinutes) });
  if (task.overdueReason) meta.createSpan({ cls: "cb-chip cb-chip-danger", text: task.overdueReason });
  if (task.unscheduledReason) meta.createSpan({ cls: "cb-chip cb-chip-info", text: task.unscheduledReason });
  const entries = plugin.data.settings.showAllDataviewFields ? Object.entries(task.metadata) : Object.entries(task.metadata).slice(0, 4);
  for (const [key, values] of entries) {
    if (["scheduled", "start", "estimate"].includes(key)) continue;
    meta.createSpan({ cls: "cb-chip", text: `${key}: ${values[0]}` });
  }
}

function setupDateTarget(target: HTMLElement, plugin: PersonalSchedulerPlugin, date: string, rerender: () => void): void {
  target.addEventListener("click", async () => {
    if (!spanDraft) return;
    if (!spanDraft.startDate) {
      spanDraft.startDate = date;
      rerender();
      return;
    }
    await plugin.scheduleTaskSpan(spanDraft.taskId, spanDraft.startDate, date);
    spanDraft = null;
  });
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

function setDragTask(event: DragEvent, taskId: string): void {
  event.dataTransfer?.setData("application/x-calendar-bridge-task", taskId);
  event.dataTransfer?.setData("text/plain", taskId);
}

function promptEstimate(plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const raw = window.prompt("Estimate, e.g. 45m, 1h, 1h30m", task.estimateMinutes ? `${task.estimateMinutes}m` : "30m");
  const minutes = parseDurationToMinutes(raw ?? undefined);
  if (minutes !== undefined && minutes >= 0) void plugin.setTaskEstimate(task.id, minutes);
}

function promptProgress(plugin: PersonalSchedulerPlugin, task: CalendarTask): void {
  const raw = window.prompt("Progress percent, 0-100", String(task.progressPercent ?? 0));
  if (raw === null) return;
  const progress = Number.parseFloat(raw.replace("%", "").trim());
  if (Number.isFinite(progress)) void plugin.setTaskProgress(task.id, progress);
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
  return `${minutes}m`;
}

function longTasksTouchingDate(model: CalendarViewModel, date: string): number {
  return model.longTaskProgress.filter((item) => item.task.spanStart && item.task.spanEnd && item.task.spanStart <= date && item.task.spanEnd >= date).length;
}
