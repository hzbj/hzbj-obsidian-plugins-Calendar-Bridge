import type { App, TFile } from "obsidian";

export interface ArchiveCompletedTasksResult {
  content: string;
  archivedCount: number;
}

const TOP_LEVEL_COMPLETED_TASK_RE = /^[-*]\s+\[[xX]\]\s+/u;

export function archiveCompletedTopLevelTasks(content: string, rawHeading: string): ArchiveCompletedTasksResult {
  const heading = normalizeArchiveHeading(rawHeading);
  const lines = content.split(/\r?\n/u);
  const originalHeadingInfo = findHeading(lines, heading);
  const originalArchiveStart = originalHeadingInfo ? originalHeadingInfo.index + 1 : -1;
  const originalArchiveEnd = originalHeadingInfo ? findHeadingSectionEnd(lines, originalHeadingInfo.index, originalHeadingInfo.level) : -1;
  const moved: string[] = [];
  const kept = lines.filter((line, index) => {
    if (index >= originalArchiveStart && index < originalArchiveEnd) return true;
    if (!TOP_LEVEL_COMPLETED_TASK_RE.test(line)) return true;
    moved.push(line);
    return false;
  });

  if (moved.length === 0) return { content, archivedCount: 0 };

  const headingInfo = findHeading(kept, heading);
  if (!headingInfo) {
    const base = trimTrailingBlankLines(kept);
    return {
      content: [...base, "", `# ${heading}`, ...moved].join("\n"),
      archivedCount: moved.length
    };
  }

  const insertIndex = findHeadingSectionEnd(kept, headingInfo.index, headingInfo.level);
  const before = trimTrailingBlankLines(kept.slice(0, insertIndex));
  const after = kept.slice(insertIndex);
  return {
    content: [...before, ...moved, ...after].join("\n"),
    archivedCount: moved.length
  };
}

export class TaskArchiveService {
  constructor(private readonly app: App) {}

  async archiveCompletedTopLevelTasks(file: TFile, heading: string): Promise<number> {
    const content = await this.app.vault.read(file);
    const archived = archiveCompletedTopLevelTasks(content, heading);
    if (archived.archivedCount === 0 || archived.content === content) return archived.archivedCount;
    await this.app.vault.modify(file, archived.content);
    return archived.archivedCount;
  }
}

function normalizeArchiveHeading(raw: string): string {
  return raw.trim().replace(/^#+\s*/u, "").trim() || "归档";
}

function findHeading(lines: string[], heading: string): { index: number; level: number } | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match) continue;
    if (match[2].trim() === heading) return { index, level: match[1].length };
  }
  return undefined;
}

function findHeadingSectionEnd(lines: string[], headingIndex: number, headingLevel: number): number {
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/u);
    if (match && match[1].length <= headingLevel) return index;
  }
  return lines.length;
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  return trimmed;
}
