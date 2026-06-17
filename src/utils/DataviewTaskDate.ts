import type { DateField, DateSource, TaskDateMap, TaskDateSourceMap } from "../models/types";

export interface ExtractedTaskMetadata {
  metadata: Record<string, string[]>;
  dates: TaskDateMap;
  dateSources: TaskDateSourceMap;
  createdDate?: string;
  scheduleDate?: string;
  spanStart?: string;
  spanEnd?: string;
  estimateMinutes?: number;
  plainEstimateMinutes?: number;
  progressPercent: number;
  durationMinutes?: number;
  priority?: string;
  recurrence?: string;
  project?: string;
  context?: string;
  dateSource: DateSource;
}

export interface ExtractedTaskDate {
  dueDate?: string;
  dateSource: DateSource;
}

const INLINE_FIELD_RE = /\[([^\[\]\n:]+)::\s*([^\]\n]*)\]/gu;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const LEGACY_EMOJI_DATE_RE = /\s*(?:📅|馃搮)\s*(\d{4}-\d{2}-\d{2})\s*/u;
const DATE_FIELDS: DateField[] = ["due", "scheduled", "start", "completion", "created"];

export function extractTaskMetadata(line: string, readLegacyEmojiDates: boolean): ExtractedTaskMetadata {
  const metadata: Record<string, string[]> = {};
  const dates: TaskDateMap = {};
  const dateSources: TaskDateSourceMap = {};

  for (const match of line.matchAll(INLINE_FIELD_RE)) {
    const key = normalizeFieldKey(match[1]);
    const value = match[2].trim();
    if (!metadata[key]) metadata[key] = [];
    metadata[key].push(value);
    if (isDateField(key) && DATE_RE.test(value)) {
      dates[key] = value;
      dateSources[key] = "dataview";
    }
  }

  if (!dates.due && readLegacyEmojiDates) {
    const legacy = line.match(LEGACY_EMOJI_DATE_RE);
    if (legacy) {
      dates.due = legacy[1];
      dateSources.due = "emoji";
    }
  }

  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const scheduleSource = scheduleDate
    ? dateSources.scheduled ?? dateSources.due ?? dateSources.start ?? "none"
    : "none";
  const plainEstimateMinutes = extractPlainEstimateMinutes(line);
  const estimateMinutes = plainEstimateMinutes ?? firstParsedDuration(metadata.estimate);
  const durationMinutes = firstParsedDuration(metadata.duration);
  const spanStart = dates.start && dates.due ? dates.start : undefined;
  const progressPercent = parseProgressPercent(first(metadata.progress));

  return {
    metadata,
    dates,
    dateSources,
    createdDate: dates.created,
    scheduleDate,
    spanStart,
    spanEnd: spanStart ? dates.due : undefined,
    estimateMinutes,
    plainEstimateMinutes,
    progressPercent,
    durationMinutes,
    priority: first(metadata.priority),
    recurrence: first(metadata.recurrence) ?? first(metadata.repeat),
    project: first(metadata.project),
    context: first(metadata.context),
    dateSource: scheduleSource
  };
}

export function extractTaskDate(line: string, readLegacyEmojiDates: boolean): ExtractedTaskDate {
  const parsed = extractTaskMetadata(line, readLegacyEmojiDates);
  return { dueDate: parsed.dates.due, dateSource: parsed.dateSources.due ?? "none" };
}

export function parseDurationToMinutes(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase().replace(/\s+/gu, "").replace(/minutes?|mins?/gu, "m");
  if (!value) return undefined;

  const numeric = value.match(/^(\d+(?:\.\d+)?)$/u);
  if (numeric) return Math.round(Number.parseFloat(numeric[1]));

  const compact = value.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/u);
  if (compact && (compact[1] || compact[2])) {
    const hours = compact[1] ? Number.parseFloat(compact[1]) : 0;
    const minutes = compact[2] ? Number.parseInt(compact[2], 10) : 0;
    return Math.round(hours * 60 + minutes);
  }

  return undefined;
}

export function setTaskScheduleDate(line: string, scheduledDate: string): string {
  return appendField(removeFields(line, ["scheduled"]), "scheduled", scheduledDate);
}

export function setPointTaskSchedule(line: string, scheduledDate: string, defaultEstimateMinutes: number, createdDate: string): string {
  const parsed = extractTaskMetadata(line, false);
  let updated = removeFields(line, ["scheduled", "due"]);
  if (parsed.plainEstimateMinutes === undefined && parsed.estimateMinutes === undefined) {
    updated = insertPlainEstimate(updated, defaultEstimateMinutes);
  }
  if (!parsed.createdDate) {
    updated = appendField(updated, "created", createdDate);
  }
  return appendField(appendField(updated, "scheduled", scheduledDate), "due", scheduledDate);
}

export function setTaskSpanDates(line: string, startDate: string, scheduledDate: string): string {
  return appendField(appendField(removeFields(line, ["start", "scheduled", "due"]), "start", startDate), "due", scheduledDate);
}

export function setTaskEstimate(line: string, estimateMinutes: number): string {
  return appendField(removeFields(line, ["estimate"]), "estimate", `${Math.max(0, Math.round(estimateMinutes))}m`);
}

export function setTaskProgress(line: string, progressPercent: number): string {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  return appendField(removeFields(line, ["progress"]), "progress", `${clamped}%`);
}

export function clearTaskScheduleDates(line: string): string {
  return removeFields(line, ["due", "scheduled", "start"]).replace(LEGACY_EMOJI_DATE_RE, " ").replace(/[ \t]+$/u, "");
}

export function setTaskDueDate(line: string, dueDate: string): string {
  return appendField(removeFields(line, ["due"]), "due", dueDate);
}

export function cleanTaskDisplayText(line: string, triggerTags: string[]): string {
  const withoutCheckbox = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "");
  const withoutFields = withoutCheckbox.replace(INLINE_FIELD_RE, " ").replace(LEGACY_EMOJI_DATE_RE, " ");
  const tagSet = new Set(triggerTags.map((tag) => tag.toLowerCase()));
  return withoutFields
    .split(/\s+/u)
    .filter((part) => {
      if (!part.startsWith("#")) return true;
      return !tagSet.has(part.slice(1).toLowerCase());
    })
    .filter((part) => !isPlainEstimateToken(part))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

function removeFields(line: string, fields: string[]): string {
  const fieldSet = new Set(fields.map(normalizeFieldKey));
  return line
    .replace(INLINE_FIELD_RE, (full, rawKey: string) => fieldSet.has(normalizeFieldKey(rawKey)) ? " " : full)
    .replace(/[ \t]+$/u, "")
    .replace(/[ \t]{2,}(?=\[[^\]]+::)/gu, " ");
}

function appendField(line: string, field: string, value: string): string {
  return `${line.replace(/[ \t]+$/u, "")} [${field}:: ${value}]`;
}

function insertPlainEstimate(line: string, estimateMinutes: number): string {
  const estimate = formatDuration(estimateMinutes);
  const firstField = line.search(INLINE_FIELD_RE);
  if (firstField < 0) return `${line.replace(/[ \t]+$/u, "")} ${estimate}`;
  const before = line.slice(0, firstField).replace(/[ \t]+$/u, "");
  const after = line.slice(firstField).replace(/^[ \t]+/u, "");
  return `${before} ${estimate} ${after}`;
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded >= 60 && rounded % 60 === 0) return `${rounded / 60}h`;
  if (rounded >= 60) return `${Math.floor(rounded / 60)}h${rounded % 60}m`;
  return `${rounded}m`;
}

function normalizeFieldKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function isDateField(key: string): key is DateField {
  return DATE_FIELDS.includes(key as DateField);
}

function first(values: string[] | undefined): string | undefined {
  return values?.find((value) => value.trim().length > 0)?.trim();
}

function firstParsedDuration(values: string[] | undefined): number | undefined {
  for (const value of values ?? []) {
    const parsed = parseDurationToMinutes(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function extractPlainEstimateMinutes(line: string): number | undefined {
  const body = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "").replace(INLINE_FIELD_RE, " ");
  for (const part of body.split(/\s+/u)) {
    if (!isPlainEstimateToken(part)) continue;
    const parsed = parseDurationToMinutes(part);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function isPlainEstimateToken(part: string): boolean {
  return /^(?:(?:\d+(?:\.\d+)?)h)?(?:(?:\d+)m)?$/u.test(part.toLowerCase()) && /[hm]/iu.test(part);
}

function parseProgressPercent(raw: string | undefined): number {
  if (!raw) return 0;
  const numeric = raw.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/u);
  if (!numeric) return 0;
  return Math.min(100, Math.max(0, Number.parseFloat(numeric[1])));
}
