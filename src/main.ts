import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_DATA, VIEW_TYPE_PERSONAL_SYSTEM } from "./models/constants";
import type { CalendarBridgeData, CalendarTask, ReviewPressureByDate } from "./models/types";
import { ReviewPressureScanner } from "./services/ReviewPressure";
import { TaskDateWriter } from "./services/TaskDateWriter";
import { TaskScanner } from "./services/TaskScanner";
import { PersonalSystemView } from "./ui/PersonalSystemView";
import { PersonalSystemSettingTab } from "./ui/settings/PersonalSystemSettingTab";
import { todayString } from "./utils/date";

export default class PersonalSchedulerPlugin extends Plugin {
  data: CalendarBridgeData = createDefaultData();
  calendarTasks: CalendarTask[] = [];
  reviewPressure: ReviewPressureByDate = {};
  taskScanner!: TaskScanner;
  taskDateWriter!: TaskDateWriter;
  reviewPressureScanner!: ReviewPressureScanner;

  async onload(): Promise<void> {
    this.data = mergeCalendarData(await this.loadData());
    this.taskScanner = new TaskScanner(this.app, () => this.data.settings);
    this.taskDateWriter = new TaskDateWriter(this.app);
    this.reviewPressureScanner = new ReviewPressureScanner(this.app, () => this.data.settings);
    await this.rescanTasks();

    this.registerView(VIEW_TYPE_PERSONAL_SYSTEM, (leaf) => new PersonalSystemView(leaf, this));
    this.addSettingTab(new PersonalSystemSettingTab(this));
    this.registerEvent(this.app.vault.on("modify", () => this.rescanTasks()));

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
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("No workspace leaf available.");
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_PERSONAL_SYSTEM, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async saveCalendarData(): Promise<void> {
    await this.saveData(this.data);
    await this.rescanTasks();
  }

  async rescanTasks(): Promise<void> {
    const [tasks, reviewPressure] = await Promise.all([
      this.taskScanner.scanAllMarkdownTasks(),
      this.reviewPressureScanner.scanReviewPressure()
    ]);
    this.calendarTasks = tasks;
    this.reviewPressure = reviewPressure;
    this.refreshViews();
  }

  async scheduleTaskDueDate(taskId: string, dueDate: string): Promise<void> {
    await this.scheduleTaskDate(taskId, dueDate);
  }

  async scheduleTaskDate(taskId: string, scheduledDate: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
    await this.taskDateWriter.setPointSchedule(
      target.file,
      target.lineNumber,
      scheduledDate,
      this.data.settings.defaultUnestimatedTaskMinutes,
      todayString()
    );
    await this.rescanTasks();
  }

  async scheduleTaskSpan(taskId: string, startDate: string, scheduledDate: string): Promise<void> {
    const target = this.resolveTaskRef(taskId);
    if (!target) return;
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
}

function createDefaultData(): CalendarBridgeData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA)) as CalendarBridgeData;
}

function mergeCalendarData(raw: unknown): CalendarBridgeData {
  const defaults = createDefaultData();
  if (!raw || typeof raw !== "object") return defaults;
  const partial = raw as Partial<CalendarBridgeData>;
  return {
    ...defaults,
    ...partial,
    settings: { ...defaults.settings, ...(partial.settings ?? {}) },
    ui: partial.ui ?? defaults.ui
  };
}
