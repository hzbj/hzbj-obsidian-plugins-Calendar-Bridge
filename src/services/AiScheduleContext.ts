import type { App, TFile } from "obsidian";
import type { CalendarSettings, CalendarTask, ReviewPressureByDate, TaskPriority } from "../models/types";
import { addDays } from "../utils/date";
import { normalizeTaskPriority } from "../utils/DataviewTaskDate";
import { buildMonthViewModel, normalizePriorityRank } from "./CalendarViewModel";

export const AI_SCHEDULE_CONTEXT_PATH = "Calendar-Bridge/ai-schedule-context.json";

export interface AiScheduleContextInput {
  anchorDate: string;
  tasks: CalendarTask[];
  reviewPressure: ReviewPressureByDate;
  settings: CalendarSettings;
}

export interface AiScheduleTaskSnapshot {
  id: string;
  text: string;
  filePath: string;
  lineNumber: number;
  taskKind: CalendarTask["taskKind"];
  priority?: TaskPriority;
  priorityRank: 1 | 2 | 3 | 4;
  estimateMinutes?: number;
  progressPercent: number;
  dates: CalendarTask["dates"];
  project?: string;
  context?: string;
  reason?: string;
}

export interface AiScheduleDailyLoad {
  date: string;
  taskMinutes: number;
  reviewMinutes: number;
  totalMinutes: number;
}

export interface AiScheduleContext {
  schemaVersion: 1;
  anchorDate: string;
  writePolicy: {
    mode: "confirm-before-write";
    targetFileRule: "choose-from-user-prompt-under-planning-folder";
  };
  settings: {
    defaultUnestimatedTaskMinutes: number;
    includedPathPrefixes: string[];
    excludedPathPrefixes: string[];
    scheduledDayFolder: string;
  };
  unscheduledTasks: AiScheduleTaskSnapshot[];
  overdueTasks: AiScheduleTaskSnapshot[];
  dailyLoadsByHorizon: Record<"7" | "14" | "30", AiScheduleDailyLoad[]>;
  longTaskProgress: Array<{
    task: AiScheduleTaskSnapshot;
    daysElapsed: number;
    daysLeft: number;
    totalDays: number;
    expectedProgressPercent: number;
    progressPercent: number;
    dailyProgressPressure: number;
    dailyEstimatedMinutes?: number;
    status: "ahead" | "on-track" | "behind";
  }>;
}

export type AiScheduleContextSyncResult = "created" | "updated" | "unchanged";

export function buildAiScheduleContext(input: AiScheduleContextInput): AiScheduleContext {
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
    unscheduledTasks: model.unifiedUnscheduledTasks.map((task) => taskSnapshot(task, task.unscheduledReason)),
    overdueTasks: model.overdueTasks.map((task) => taskSnapshot(task, task.overdueReason)),
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

export class AiScheduleContextExporter {
  constructor(private readonly app: App) {}

  async sync(input: AiScheduleContextInput): Promise<AiScheduleContextSyncResult> {
    const content = `${JSON.stringify(buildAiScheduleContext(input), null, 2)}\n`;
    await this.ensureFolder(AI_SCHEDULE_CONTEXT_PATH.split("/").slice(0, -1).join("/"));
    const existing = this.app.vault.getAbstractFileByPath(AI_SCHEDULE_CONTEXT_PATH);
    if (existing && "extension" in existing) {
      const file = existing as TFile;
      const current = await this.app.vault.read(file);
      if (current === content) return "unchanged";
      await this.app.vault.modify(file, content);
      return "updated";
    }
    await this.app.vault.create(AI_SCHEDULE_CONTEXT_PATH, content);
    return "created";
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}

function buildDailyLoads(input: AiScheduleContextInput, horizonDays: 7 | 14 | 30): AiScheduleDailyLoad[] {
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

function taskMinutesForDate(tasks: CalendarTask[], date: string, defaultUnestimatedTaskMinutes: number): number {
  return tasks
    .filter((task) => !task.completed && task.taskKind !== "long" && task.scheduleDate === date)
    .reduce((total, task) => total + (task.estimateMinutes ?? defaultUnestimatedTaskMinutes), 0);
}

function taskSnapshot(task: CalendarTask, reason?: string): AiScheduleTaskSnapshot {
  const priority = normalizeTaskPriority(task.priority);
  return {
    id: task.id,
    text: task.text,
    filePath: task.filePath,
    lineNumber: task.lineNumber,
    taskKind: task.taskKind,
    priority,
    priorityRank: normalizePriorityRank(task.priority),
    estimateMinutes: task.estimateMinutes,
    progressPercent: task.progressPercent,
    dates: task.dates,
    project: task.project,
    context: task.context,
    reason
  };
}
