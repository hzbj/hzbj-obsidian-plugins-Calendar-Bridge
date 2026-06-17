import type { CalendarBridgeData } from "./types";

export const VIEW_TYPE_PERSONAL_SYSTEM = "personal-scheduler-view";
export const DATAVIEW_DUE_FIELD = "due";
export const DATAVIEW_SCHEDULED_FIELD = "scheduled";
export const DATAVIEW_START_FIELD = "start";
export const DATAVIEW_ESTIMATE_FIELD = "estimate";
export const LEGACY_DATE_TOKEN = "📅";

export const DEFAULT_DATA: CalendarBridgeData = {
  version: 1,
  settings: {
    triggerTags: ["task", "todo"],
    weekStartsOn: 1,
    readLegacyEmojiDates: true,
    excludedPathPrefixes: ["time-blocks-data/", ".obsidian/"],
    primaryScheduleField: "scheduled",
    estimateField: "estimate",
    showAllDataviewFields: true,
    reviewPressureEnabled: true,
    reviewBaseMinutes: 2,
    reviewCharsPerMinute: 800,
    defaultUnestimatedTaskMinutes: 30,
    monthHeatmapMode: "task-estimate-plus-review"
  },
  ui: {}
};
