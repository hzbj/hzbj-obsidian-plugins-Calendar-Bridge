import type { App, CachedMetadata } from "obsidian";
import type { CalendarSettings, CalendarTask, TaskTriggerType } from "../models/types";
import { cleanTaskDisplayText, extractTaskMetadata } from "../utils/DataviewTaskDate";

export interface ScanTextOptions {
  triggerTags: string[];
  readLegacyEmojiDates: boolean;
  forceExtract: boolean;
  phaseId?: string;
  includedPathPrefixes?: string[];
  excludedPathPrefixes?: string[];
}

const CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/u;

export function scanMarkdownTasksFromText(filePath: string, content: string, options: ScanTextOptions): CalendarTask[] {
  if (!isIncludedPath(filePath, options.includedPathPrefixes ?? [])) return [];
  if (isExcludedPath(filePath, options.excludedPathPrefixes ?? [])) return [];

  const triggerType: TaskTriggerType = options.forceExtract ? "phase-note" : "inline";
  const tasks: CalendarTask[] = [];
  const indentStack: Array<{ indentLevel: number; task: CalendarTask }> = [];

  content.split(/\r?\n/u).forEach((line, lineNumber) => {
    const match = line.match(CHECKBOX_RE);
    if (!match) return;
    const metadata = extractTaskMetadata(line, options.readLegacyEmojiDates);
    // Long-vs-point classification is intentionally owned by the start:: field only.
    const taskKind = metadata.dates.start ? "long" : "point";
    const id = `${filePath}:${lineNumber}`;
    const indentLevel = countIndentColumns(line);
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indentLevel >= indentLevel) {
      indentStack.pop();
    }
    const parentLongTask = [...indentStack].reverse().find((item) => item.task.taskKind === "long")?.task;
    const task: CalendarTask = {
      id,
      text: cleanTaskDisplayText(line, options.triggerTags),
      filePath,
      lineNumber,
      rawLine: line,
      completed: match[2].toLowerCase() === "x",
      metadata: metadata.metadata,
      dates: metadata.dates,
      dateSources: metadata.dateSources,
      taskKind,
      indentLevel,
      parentLongTaskId: parentLongTask?.id,
      parentLongTaskText: parentLongTask?.text,
      createdDate: metadata.createdDate,
      scheduleDate: metadata.scheduleDate,
      spanStart: taskKind === "long" ? metadata.dates.start : undefined,
      spanEnd: taskKind === "long" ? metadata.dates.scheduled : undefined,
      estimateMinutes: metadata.estimateMinutes,
      plainEstimateMinutes: metadata.plainEstimateMinutes,
      progressPercent: metadata.progressPercent,
      plannedDate: metadata.plannedDate,
      durationMinutes: metadata.durationMinutes,
      priority: metadata.priority,
      recurrence: metadata.recurrence,
      project: metadata.project,
      context: metadata.context,
      dueDate: metadata.dates.due,
      dateSource: metadata.dateSource,
      triggerType,
      phaseId: options.phaseId
    };
    tasks.push(task);
    indentStack.push({ indentLevel, task });
  });

  return tasks;
}

function countIndentColumns(line: string): number {
  const indent = line.match(/^[\t ]*/u)?.[0] ?? "";
  return [...indent].reduce((columns, char) => columns + (char === "\t" ? 2 : 1), 0);
}

export class TaskScanner {
  constructor(private readonly app: App, private readonly getSettings: () => CalendarSettings) {}

  async scanAllMarkdownTasks(): Promise<CalendarTask[]> {
    const settings = this.getSettings();
    const tasks: CalendarTask[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!isIncludedPath(file.path, settings.includedPathPrefixes)) continue;
      if (isExcludedPath(file.path, settings.excludedPathPrefixes)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      const phaseInfo = getPhaseInfo(cache);
      const isPhaseFile = phaseInfo.isPhaseNote || isPhaseTaskFilePath(file.path);
      const content = await this.app.vault.cachedRead(file);
      tasks.push(...scanMarkdownTasksFromText(file.path, content, {
        triggerTags: settings.triggerTags,
        readLegacyEmojiDates: settings.readLegacyEmojiDates,
        forceExtract: isPhaseFile,
        phaseId: phaseInfo.phaseId,
        includedPathPrefixes: settings.includedPathPrefixes,
        excludedPathPrefixes: settings.excludedPathPrefixes
      }));
    }

    return tasks;
  }
}

function getPhaseInfo(cache: CachedMetadata | null): { isPhaseNote: boolean; phaseId?: string } {
  const frontmatter = cache?.frontmatter;
  if (!frontmatter) return { isPhaseNote: false };

  const tags = extractFrontmatterTags(cache);
  const isPhaseNote = frontmatter.phase === true || frontmatter.phase === "true" || tags.some((tag) => tag.toLowerCase() === "phase");
  const rawPhaseId = frontmatter["phase-id"];
  return {
    isPhaseNote,
    phaseId: typeof rawPhaseId === "string" && rawPhaseId.trim() ? rawPhaseId.trim() : undefined
  };
}

function extractFrontmatterTags(cache: CachedMetadata): string[] {
  const tags: string[] = [];
  const rawTags = [cache.frontmatter?.tags, cache.frontmatter?.tag];

  for (const raw of rawTags) {
    if (Array.isArray(raw)) {
      tags.push(...raw.filter((item): item is string => typeof item === "string"));
    } else if (typeof raw === "string") {
      tags.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
    }
  }

  return tags.map((tag) => tag.replace(/^#/, ""));
}

export function isPhaseTaskFilePath(filePath: string): boolean {
  return filePath.split("/").includes("阶段");
}

function isIncludedPath(filePath: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return true;
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}

function isExcludedPath(filePath: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}

function matchesPathPrefix(filePath: string, prefix: string): boolean {
  const normalized = prefix.trim();
  if (!normalized) return false;
  const folder = normalized.replace(/\/$/u, "");
  return filePath === folder || filePath.startsWith(`${folder}/`);
}
