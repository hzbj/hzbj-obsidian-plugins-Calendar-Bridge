import type { CalendarSettings } from "../models/types";

const MOJIBAKE_PATH_REPAIRS: Array<[string, string]> = [
  ["瑙勫垝", "规划"],
  ["闃舵", "阶段"],
  ["浠ｅ姙", "代办"],
  ["鏃?", "日"]
];

export function normalizePathSetting(value: string): string {
  let normalized = value.trim().replace(/\\/gu, "/");
  for (const [broken, fixed] of MOJIBAKE_PATH_REPAIRS) {
    normalized = normalized.split(broken).join(fixed);
  }
  return normalized.replace(/\/{2,}/gu, "/");
}

export function splitPathCsv(value: string, fallback: string[]): string[] {
  const parsed = value.split(",").map(normalizePathSetting).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback.map(normalizePathSetting);
}

export function normalizeCalendarPathSettings(settings: CalendarSettings): void {
  settings.includedPathPrefixes = settings.includedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.excludedPathPrefixes = settings.excludedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.scheduledDayFolder = normalizePathSetting(settings.scheduledDayFolder) || "Calendar/Scheduled";
}
