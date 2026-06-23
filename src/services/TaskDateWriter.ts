import type { App, TFile } from "obsidian";
import {
  clearTaskPlannedDate,
  clearTaskScheduleDates,
  setPointTaskSchedule,
  setTaskEstimate,
  setTaskPlannedDate,
  setTaskPriority,
  setTaskProgress,
  setTaskScheduleDate,
  setTaskSpanDates
} from "../utils/DataviewTaskDate";

export interface MoveTaskLineInput {
  sourceContent: string;
  sourceLineNumber: number;
  targetContent: string;
  scheduledDate: string;
  defaultEstimateMinutes: number;
  createdDate: string;
}

export interface MoveTaskLineResult {
  sourceContent: string;
  targetContent: string;
}

const CHECKBOX_TASK_RE = /^(\s*)[-*]\s+\[[ xX]\]\s+/u;

export function buildScheduledDayFilePath(folderPath: string, scheduledDate: string): string {
  const folder = folderPath.trim().replace(/\\/gu, "/").replace(/\/+$/u, "") || "Calendar/Scheduled";
  const fileName = `${scheduledDate.replace(/-/gu, "")}.md`;
  return `${folder}/${fileName}`.replace(/\/{2,}/gu, "/");
}

export function moveTaskLineToScheduledDayContent(input: MoveTaskLineInput): MoveTaskLineResult {
  const sourceLines = input.sourceContent.split(/\r?\n/u);
  if (input.sourceLineNumber < 0 || input.sourceLineNumber >= sourceLines.length || sourceLines[input.sourceLineNumber] === undefined) {
    throw new Error(`Task line ${input.sourceLineNumber} is outside source content`);
  }
  const [rawLine] = sourceLines.splice(input.sourceLineNumber, 1);
  const scheduledLine = setPointTaskSchedule(rawLine, input.scheduledDate, input.defaultEstimateMinutes, input.createdDate);
  const sourceContent = sourceLines.join("\n");
  const targetBase = input.targetContent.trimEnd();
  const targetContent = `${targetBase ? `${targetBase}\n` : ""}${scheduledLine}\n`;
  return { sourceContent, targetContent };
}

export function insertChildTaskContent(sourceContent: string, parentLineNumber: number, rawChildContent: string): string {
  const childContent = normalizeChildTaskContent(rawChildContent);
  if (!childContent) throw new Error("Child task content is empty");

  const lines = sourceContent.split(/\r?\n/u);
  if (parentLineNumber < 0 || parentLineNumber >= lines.length || lines[parentLineNumber] === undefined) {
    throw new Error(`Task line ${parentLineNumber} is outside source content`);
  }
  const parent = lines[parentLineNumber].match(CHECKBOX_TASK_RE);
  if (!parent) throw new Error(`Line ${parentLineNumber} is not a task line`);

  const parentIndent = countIndentColumns(parent[1]);
  const blockEnd = findTaskBlockEnd(lines, parentLineNumber, parentIndent);
  const insertIndex = blockEnd === lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : blockEnd;
  const childIndent = `${parent[1]}  `;
  lines.splice(insertIndex, 0, `${childIndent}- [ ] ${childContent}`);
  return lines.join("\n");
}

export class TaskDateWriter {
  constructor(private readonly app: App) {}

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

  async setPlannedDate(file: TFile, lineNumber: number, plannedDate: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskPlannedDate(line, plannedDate));
  }

  async clearPlannedDate(file: TFile, lineNumber: number): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => clearTaskPlannedDate(line));
  }

  async setPriority(file: TFile, lineNumber: number, priority: string): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => setTaskPriority(line, priority));
  }

  async clearSchedule(file: TFile, lineNumber: number): Promise<void> {
    await this.replaceTaskLine(file, lineNumber, (line) => clearTaskScheduleDates(line));
  }

  async addChildTask(file: TFile, parentLineNumber: number, rawChildContent: string): Promise<void> {
    const content = await this.app.vault.read(file);
    await this.app.vault.modify(file, insertChildTaskContent(content, parentLineNumber, rawChildContent));
  }

  async movePointTaskToScheduledDay(
    file: TFile,
    lineNumber: number,
    scheduledDayFolder: string,
    scheduledDate: string,
    defaultEstimateMinutes: number,
    createdDate: string
  ): Promise<void> {
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

  private async replaceTaskLine(file: TFile, lineNumber: number, replace: (line: string) => string): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/u);
    if (lineNumber < 0 || lineNumber >= lines.length) {
      throw new Error(`Task line ${lineNumber} is outside ${file.path}`);
    }
    lines[lineNumber] = replace(lines[lineNumber]);
    await this.app.vault.modify(file, lines.join("\n"));
  }

  private async ensureFile(path: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && "extension" in existing) return existing as TFile;
    return this.app.vault.create(path, `# ${path.split("/").pop()?.replace(/\.md$/u, "") ?? "Scheduled"}\n`);
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

function findTaskBlockEnd(lines: string[], taskIndex: number, parentIndent: number): number {
  for (let index = taskIndex + 1; index < lines.length; index += 1) {
    if (/^(#{1,6})\s+/u.test(lines[index])) return index;
    const task = lines[index].match(CHECKBOX_TASK_RE);
    if (task && countIndentColumns(task[1]) <= parentIndent) return index;
  }
  return lines.length;
}

function countIndentColumns(indent: string): number {
  return [...indent].reduce((columns, char) => columns + (char === "\t" ? 2 : 1), 0);
}

function normalizeChildTaskContent(raw: string): string {
  return raw.replace(/\s+/gu, " ").trim();
}
