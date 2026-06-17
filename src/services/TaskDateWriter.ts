import { TFile, type App } from "obsidian";
import {
  clearTaskScheduleDates,
  setPointTaskSchedule,
  setTaskDueDate,
  setTaskEstimate,
  setTaskProgress,
  setTaskScheduleDate,
  setTaskSpanDates
} from "../utils/DataviewTaskDate";

export class TaskDateWriter {
  constructor(private readonly app: App) {}

  async setDueDate(file: TFile, lineNumber: number, dueDate: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskDueDate(line, dueDate));
  }

  async setScheduleDate(file: TFile, lineNumber: number, scheduledDate: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskScheduleDate(line, scheduledDate));
  }

  async setPointSchedule(file: TFile, lineNumber: number, scheduledDate: string, defaultEstimateMinutes: number, createdDate: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setPointTaskSchedule(line, scheduledDate, defaultEstimateMinutes, createdDate));
  }

  async setSpanDates(file: TFile, lineNumber: number, startDate: string, scheduledDate: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskSpanDates(line, startDate, scheduledDate));
  }

  async setEstimate(file: TFile, lineNumber: number, estimateMinutes: number): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskEstimate(line, estimateMinutes));
  }

  async setProgress(file: TFile, lineNumber: number, progressPercent: number): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskProgress(line, progressPercent));
  }

  async clearSchedule(file: TFile, lineNumber: number): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => clearTaskScheduleDates(line));
  }

  private async replaceTaskLine(file: TFile, lineNumber: number, replace: (line: string) => string): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/u);
    if (lineNumber < 0 || lineNumber >= lines.length) {
      throw new Error(`Task line ${lineNumber} is outside ${file.path}`);
    }
    lines[lineNumber] = replace(lines[lineNumber]);
    await this.app.vault.modify(file, lines.join("\n"));
  }
}
