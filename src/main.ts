import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_DATA, VIEW_TYPE_PERSONAL_SYSTEM } from "./models/constants";
import type { CalendarBridgeData, CalendarTask, ReviewPressureByDate } from "./models/types";
import { AI_SCHEDULE_CONTEXT_PATH, AiScheduleContextExporter } from "./services/AiScheduleContext";
import { ReviewPressureScanner } from "./services/ReviewPressure";
import { TaskDateWriter } from "./services/TaskDateWriter";
import { TaskScanner } from "./services/TaskScanner";
import { PersonalSystemView } from "./ui/PersonalSystemView";
import { PersonalSystemSettingTab } from "./ui/settings/PersonalSystemSettingTab";
import { todayString } from "./utils/date";
import { normalizeCalendarPathSettings } from "./utils/pathSettings";

export default class PersonalSchedulerPlugin extends Plugin {
  data: CalendarBridgeData = createDefaultData();
  calendarTasks: CalendarTask[] = [];
  reviewPressure: ReviewPressureByDate = {};
  taskScanner!: TaskScanner;
  taskDateWriter!: TaskDateWriter;
  reviewPressureScanner!: ReviewPressureScanner;
  aiScheduleContextExporter!: AiScheduleContextExporter;
  private rescanInFlight: Promise<void> | null = null;
  private rescanQueued = false;
  private scheduledRescanHandle: ReturnType<typeof setTimeout> | null = null;

  async onload(): Promise<void> {
    this.data = mergeCalendarData(await this.loadData());
    this.taskScanner = new TaskScanner(this.app, () => this.data.settings);
    this.taskDateWriter = new TaskDateWriter(this.app);
    this.reviewPressureScanner = new ReviewPressureScanner(this.app, () => this.data.settings);
    this.aiScheduleContextExporter = new AiScheduleContextExporter(this.app);

    this.registerView(VIEW_TYPE_PERSONAL_SYSTEM, (leaf) => new PersonalSystemView(leaf, this));
    this.addSettingTab(new PersonalSystemSettingTab(this));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path === AI_SCHEDULE_CONTEXT_PATH) return;
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

    // Startup scanning touches vault files; schedule it after Obsidian has yielded to UI input.
    this.app.workspace.onLayoutReady(() => {
      this.scheduleRescan(1000);
    });
  }

  async activateView(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM);
    // Open in the main editor area so mobile/tablet sidebars do not constrain the calendar view.
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_PERSONAL_SYSTEM, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async saveCalendarData(): Promise<void> {
    normalizeCalendarPathSettings(this.data.settings);
    await this.saveData(this.data);
    await this.rescanTasks();
  }

  async rescanTasks(): Promise<void> {
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

  private async runSingleRescan(): Promise<void> {
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

  private scheduleRescan(delayMs = 300): void {
    if (this.scheduledRescanHandle) return;
    this.scheduledRescanHandle = globalThis.setTimeout(() => {
      this.scheduledRescanHandle = null;
      void this.rescanTasks().catch((error: unknown) => this.reportStartupScanFailure(error));
    }, delayMs);
  }

  private clearScheduledRescan(): void {
    if (!this.scheduledRescanHandle) return;
    globalThis.clearTimeout(this.scheduledRescanHandle);
    this.scheduledRescanHandle = null;
  }

  async scheduleTaskDueDate(taskId: string, dueDate: string): Promise<void> {
    await this.scheduleTaskDate(taskId, dueDate);
  }

  async scheduleTaskDate(taskId: string, scheduledDate: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    const task = this.calendarTasks.find((item) => item.id === taskId);
    if (task?.spanStart && task.spanEnd) {
      new Notice("Tasks with a long range must be edited in long task mode.");
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

  async scheduleTaskSpan(taskId: string, startDate: string, scheduledDate: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    const task = this.calendarTasks.find((item) => item.id === taskId);
    if (task?.dates.scheduled) {
      new Notice("Scheduled point tasks cannot be planned as long tasks.");
      return;
    }
    const begin = startDate <= scheduledDate ? startDate : scheduledDate;
    const end = startDate <= scheduledDate ? scheduledDate : startDate;
    await this.taskDateWriter.setSpanDates(target.file, target.lineNumber, begin, end);
    await this.rescanTasks();
  }

  async setTaskEstimate(taskId: string, estimateMinutes: number): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    await this.taskDateWriter.setEstimate(target.file, target.lineNumber, estimateMinutes);
    await this.rescanTasks();
  }

  async setTaskProgress(taskId: string, progressPercent: number): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    await this.taskDateWriter.setProgress(target.file, target.lineNumber, progressPercent);
    await this.rescanTasks();
  }

  async setTaskPriority(taskId: string, priority: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    await this.taskDateWriter.setPriority(target.file, target.lineNumber, priority);
    await this.rescanTasks();
  }

  async unscheduleTask(taskId: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    await this.taskDateWriter.clearSchedule(target.file, target.lineNumber);
    await this.rescanTasks();
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM)) {
      const view = leaf.view;
      if (view instanceof PersonalSystemView) view.render();
    }
  }

  private resolveTaskRef(taskId: string): { file: TFile; lineNumber: number } | null {
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

  private reportStartupScanFailure(error: unknown): void {
    console.error("Calendar Bridge startup task scan failed.", error);
    new Notice("Calendar Bridge loaded, but startup task scan failed. Run Rescan after Obsidian finishes loading.");
  }
}

function createDefaultData(): CalendarBridgeData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA)) as CalendarBridgeData;
}

function mergeCalendarData(raw: unknown): CalendarBridgeData {
  const defaults = createDefaultData();
  if (!raw || typeof raw !== "object") return defaults;
  const partial = raw as Partial<CalendarBridgeData>;
  const merged = {
    ...defaults,
    ...partial,
    settings: { ...defaults.settings, ...(partial.settings ?? {}) },
    ui: { ...defaults.ui, ...(partial.ui ?? {}) }
  };
  normalizeCalendarPathSettings(merged.settings);
  return merged;
}
