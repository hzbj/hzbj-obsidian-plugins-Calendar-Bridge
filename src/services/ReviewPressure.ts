import type { App } from "obsidian";
import type { CalendarSettings, ReviewNote, ReviewPressureByDate } from "../models/types";
import { todayString } from "../utils/date";

export interface ReviewPressureOptions {
  today: string;
  baseMinutes: number;
  charsPerMinute: number;
}

export function parseReviewFrontmatter(filePath: string, content: string): ReviewNote | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match) return null;

  const frontmatter = parseSimpleYaml(match[1]);
  const knowledgeType = frontmatter["知识类型"];
  const status = frontmatter["复习状态"];
  const nextReview = frontmatter["下次复习"];
  const description = frontmatter.description;

  if (!knowledgeType && !nextReview) return null;

  return {
    filePath,
    knowledgeType,
    status,
    nextReview,
    description,
    contentChars: countContentChars(match[2])
  };
}

export function buildReviewPressureByDate(notes: Array<ReviewNote | null | undefined>, options: ReviewPressureOptions): ReviewPressureByDate {
  const pressure: ReviewPressureByDate = {};
  const charsPerMinute = Math.max(1, options.charsPerMinute);

  for (const note of notes) {
    if (!note || note.knowledgeType !== "内化" || note.status === "暂停" || !note.nextReview) continue;
    const date = note.nextReview < options.today ? options.today : note.nextReview;
    const minutes = Math.max(1, options.baseMinutes) + Math.ceil(note.contentChars / charsPerMinute);
    const current = pressure[date] ?? { count: 0, minutes: 0, chars: 0 };
    pressure[date] = {
      count: current.count + 1,
      minutes: current.minutes + minutes,
      chars: current.chars + note.contentChars
    };
  }

  return pressure;
}

export class ReviewPressureScanner {
  constructor(private readonly app: App, private readonly getSettings: () => CalendarSettings) {}

  async scanReviewPressure(): Promise<ReviewPressureByDate> {
    const settings = this.getSettings();
    if (!settings.reviewPressureEnabled) return {};

    const notes: ReviewNote[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (isExcludedPath(file.path, settings.excludedPathPrefixes)) continue;
      const content = await this.app.vault.cachedRead(file);
      const note = parseReviewFrontmatter(file.path, content);
      if (note) notes.push(note);
    }

    return buildReviewPressureByDate(notes, {
      today: todayString(),
      baseMinutes: settings.reviewBaseMinutes,
      charsPerMinute: settings.reviewCharsPerMinute
    });
  }
}

function parseSimpleYaml(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/u)) {
    const match = line.match(/^([^:#][^:]*):\s*(.*?)\s*$/u);
    if (!match) continue;
    values[match[1].trim()] = String(match[2]).replace(/^["']|["']$/gu, "").trim();
  }
  return values;
}

function countContentChars(body: string): number {
  return body.replace(/\s+/gu, "").length;
}

function isExcludedPath(filePath: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => filePath === prefix.replace(/\/$/u, "") || filePath.startsWith(prefix));
}
