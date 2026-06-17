import type { App, CachedMetadata } from "obsidian";
import type { CalendarSettings, CalendarTask, TaskTriggerType } from "../models/types";
import { cleanTaskDisplayText, extractTaskMetadata } from "../utils/DataviewTaskDate";

export interface ScanTextOptions {
  triggerTags: string[];
  readLegacyEmojiDates: boolean;
  forceExtract: boolean;
  phaseId?: string;
  excludedPathPrefixes?: string[];
}

const CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/u;

export function scanMarkdownTasksFromText(filePath: string, content: string, options: ScanTextOptions): CalendarTask[] {
  if (isExcludedPath(filePath, options.excludedPathPrefixes ?? [])) return [];

  const triggerType: TaskTriggerType = options.forceExtract ? "phase-note" : "inline";
  return content.split(/\r?\n/u).flatMap((line, lineNumber) => {
    const match = line.match(CHECKBOX_RE);
    if (!match) return [];
    const taskBody = match[4];
    if (!options.forceExtract && !hasTriggerTag(taskBody, options.triggerTags)) return [];

    const metadata = extractTaskMetadata(line, options.readLegacyEmojiDates);
    return [{
      id: `${filePath}:${lineNumber}`,
      text: cleanTaskDisplayText(line, options.triggerTags),
      filePath,
      lineNumber,
      rawLine: line,
      completed: match[2].toLowerCase() === "x",
      metadata: metadata.metadata,
      dates: metadata.dates,
      dateSources: metadata.dateSources,
      taskKind: metadata.spanStart && metadata.spanEnd ? "long" : "point",
      createdDate: metadata.createdDate,
      scheduleDate: metadata.scheduleDate,
      spanStart: metadata.spanStart,
      spanEnd: metadata.spanEnd,
      estimateMinutes: metadata.estimateMinutes,
      plainEstimateMinutes: metadata.plainEstimateMinutes,
      progressPercent: metadata.progressPercent,
      durationMinutes: metadata.durationMinutes,
      priority: metadata.priority,
      recurrence: metadata.recurrence,
      project: metadata.project,
      context: metadata.context,
      dueDate: metadata.dates.due,
      dateSource: metadata.dateSource,
      triggerType,
      phaseId: options.phaseId
    }];
  });
}

export class TaskScanner {
  constructor(private readonly app: App, private readonly getSettings: () => CalendarSettings) {}

  async scanAllMarkdownTasks(): Promise<CalendarTask[]> {
    const settings = this.getSettings();
    const tasks: CalendarTask[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isExcludedPath(file.path, settings.excludedPathPrefixes)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      const phaseInfo = getPhaseInfo(cache);
      const content = await this.app.vault.cachedRead(file);
      tasks.push(...scanMarkdownTasksFromText(file.path, content, {
        triggerTags: settings.triggerTags,
        readLegacyEmojiDates: settings.readLegacyEmojiDates,
        forceExtract: phaseInfo.isPhaseNote,
        phaseId: phaseInfo.phaseId,
        excludedPathPrefixes: settings.excludedPathPrefixes
      }));
    }

    return tasks;
  }
}

function hasTriggerTag(content: string, triggerTags: string[]): boolean {
  for (const tag of triggerTags) {
    const hashTag = `#${tag}`;
    let searchFrom = 0;
    while (true) {
      const index = content.indexOf(hashTag, searchFrom);
      if (index < 0) break;
      const before = index === 0 ? " " : content[index - 1];
      const after = content[index + hashTag.length] ?? " ";
      if (/\s/u.test(before) && (/\s/u.test(after) || after === "#")) return true;
      searchFrom = index + hashTag.length;
    }
  }
  return false;
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

function isExcludedPath(filePath: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => filePath === prefix.replace(/\/$/u, "") || filePath.startsWith(prefix));
}
