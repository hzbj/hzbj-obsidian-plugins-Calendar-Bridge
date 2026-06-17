import type PersonalSchedulerPlugin from "../../main";

export function renderSettingsPage(container: HTMLElement, plugin: PersonalSchedulerPlugin): void {
  container.empty();
  const panel = container.createDiv({ cls: "cb-panel cb-settings" });
  panel.createEl("h2", { text: "Calendar Bridge 设置" });
  panel.createDiv({ cls: "cb-muted", text: "本插件只做日历排期桥接：任务创建归 Task-Maker，具体时间块归 time-blocks。" });

  addTextSetting(panel, "触发标签", plugin.data.settings.triggerTags.join(","), async (value) => {
    plugin.data.settings.triggerTags = splitCsv(value, ["task", "todo"]);
    await plugin.saveCalendarData();
  });
  addTextSetting(panel, "排除路径前缀", plugin.data.settings.excludedPathPrefixes.join(","), async (value) => {
    plugin.data.settings.excludedPathPrefixes = splitCsv(value, ["time-blocks-data/", ".obsidian/"]);
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "读取旧 emoji 日期", plugin.data.settings.readLegacyEmojiDates, async (value) => {
    plugin.data.settings.readLegacyEmojiDates = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "显示全部 Dataview 字段", plugin.data.settings.showAllDataviewFields, async (value) => {
    plugin.data.settings.showAllDataviewFields = value;
    await plugin.saveCalendarData();
  });
  addToggleSetting(panel, "启用 spaced-review 压力", plugin.data.settings.reviewPressureEnabled, async (value) => {
    plugin.data.settings.reviewPressureEnabled = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "复习基础分钟", plugin.data.settings.reviewBaseMinutes, async (value) => {
    plugin.data.settings.reviewBaseMinutes = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "每分钟文字量", plugin.data.settings.reviewCharsPerMinute, async (value) => {
    plugin.data.settings.reviewCharsPerMinute = value;
    await plugin.saveCalendarData();
  });
  addNumberSetting(panel, "未估时任务默认分钟", plugin.data.settings.defaultUnestimatedTaskMinutes, async (value) => {
    plugin.data.settings.defaultUnestimatedTaskMinutes = value;
    await plugin.saveCalendarData();
  });

  const weekRow = panel.createDiv({ cls: "cb-setting-row" });
  weekRow.createDiv({ cls: "cb-setting-label", text: "周起始日" });
  const week = weekRow.createEl("select");
  week.createEl("option", { value: "1", text: "周一" });
  week.createEl("option", { value: "0", text: "周日" });
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
  input.addEventListener("change", () => onChange(input.value));
}

function addNumberSetting(parent: HTMLElement, label: string, value: number, onChange: (value: number) => Promise<void>): void {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "number";
  input.min = "1";
  input.value = String(value);
  input.addEventListener("change", () => onChange(Math.max(1, Number.parseInt(input.value, 10) || value)));
}

function addToggleSetting(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => Promise<void>): void {
  const row = parent.createDiv({ cls: "cb-setting-row" });
  row.createDiv({ cls: "cb-setting-label", text: label });
  const input = row.createEl("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
}

function splitCsv(value: string, fallback: string[]): string[] {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}
