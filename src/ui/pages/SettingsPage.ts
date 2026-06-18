import type PersonalSchedulerPlugin from "../../main";
import { normalizePathSetting, splitPathCsv } from "../../utils/pathSettings";

export function renderSettingsPage(container: HTMLElement, plugin: PersonalSchedulerPlugin): void {
  container.empty();
  const panel = container.createDiv({ cls: "cb-panel cb-settings" });
  panel.createEl("h2", { text: "Calendar Bridge Settings" });
  panel.createDiv({
    cls: "cb-muted",
    text: "Calendar Bridge scans Markdown tasks and writes Dataview fields for calendar planning."
  });

  addTextSetting(panel, "Task folders", plugin.data.settings.includedPathPrefixes.join(","), async (value) => {
    plugin.data.settings.includedPathPrefixes = splitPathCsv(value, []);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Trigger tags", plugin.data.settings.triggerTags.join(","), async (value) => {
    plugin.data.settings.triggerTags = splitCsv(value, ["task", "todo"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Excluded folders", plugin.data.settings.excludedPathPrefixes.join(","), async (value) => {
    plugin.data.settings.excludedPathPrefixes = splitPathCsv(value, ["time-blocks-data/", ".obsidian/", ".trash/"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "Scheduled day folder", plugin.data.settings.scheduledDayFolder, async (value) => {
    plugin.data.settings.scheduledDayFolder = normalizePathSetting(value) || "Calendar/Scheduled";
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Read legacy emoji dates", plugin.data.settings.readLegacyEmojiDates, async (value) => {
    plugin.data.settings.readLegacyEmojiDates = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Show all Dataview fields", plugin.data.settings.showAllDataviewFields, async (value) => {
    plugin.data.settings.showAllDataviewFields = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "Enable spaced-review pressure", plugin.data.settings.reviewPressureEnabled, async (value) => {
    plugin.data.settings.reviewPressureEnabled = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Review base minutes", plugin.data.settings.reviewBaseMinutes, async (value) => {
    plugin.data.settings.reviewBaseMinutes = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Review chars per minute", plugin.data.settings.reviewCharsPerMinute, async (value) => {
    plugin.data.settings.reviewCharsPerMinute = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "Default task estimate minutes", plugin.data.settings.defaultUnestimatedTaskMinutes, async (value) => {
    plugin.data.settings.defaultUnestimatedTaskMinutes = value;
    await plugin.saveCalendarData();
  });

  const weekRow = panel.createDiv({ cls: "cb-setting-row" });
  weekRow.createDiv({ cls: "cb-setting-label", text: "Week starts on" });
  const week = weekRow.createEl("select");
  week.createEl("option", { value: "1", text: "Monday" });
  week.createEl("option", { value: "0", text: "Sunday" });
  week.value = String(plugin.data.settings.weekStartsOn);
  week.addEventListener("change", async () => {
    plugin.data.settings.weekStartsOn = week.value === "0" ? 0 : 1;
    await plugin.saveCalendarData();
  });
}

function addTextSetting(parent: HTMLElement, label: string, value: string, onChange: (value: string) => Promise<void>): void {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("change", () => void onChange(input.value));
}

function addNumberSetting(parent: HTMLElement, label: string, value: number, onChange: (value: number) => Promise<void>): void {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "number";
  input.min = "1";
  input.value = String(value);
  input.addEventListener("change", () => void onChange(Math.max(1, Number.parseInt(input.value, 10) || value)));
}

function addToggleSetting(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => Promise<void>): void {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => void onChange(input.checked));
}

function splitCsv(value: string, fallback: string[]): string[] {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}
