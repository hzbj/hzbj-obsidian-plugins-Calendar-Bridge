import { PluginSettingTab, Setting } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";
import { normalizePathSetting, splitPathCsv } from "../../utils/pathSettings";

export class PersonalSystemSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: PersonalSchedulerPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar Bridge" });

    new Setting(containerEl)
      .setName("Task folders")
      .setDesc("Only scan tasks from these folders. Separate multiple folders with commas; leave empty to scan the whole vault.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.includedPathPrefixes.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.includedPathPrefixes = splitPathCsv(value, []);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Trigger tags")
      .setDesc("Scan checkbox lines with these tags. Separate multiple tags with commas.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.triggerTags.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.triggerTags = splitCsv(value, ["task", "todo"]);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Read legacy emoji dates")
      .setDesc("Read legacy date tokens, but write Dataview fields when rescheduling.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.data.settings.readLegacyEmojiDates)
        .onChange(async (value) => {
          this.plugin.data.settings.readLegacyEmojiDates = value;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Week starts on")
      .setDesc("Shared by month and week views.")
      .addDropdown((dropdown) => dropdown
        .addOption("1", "Monday")
        .addOption("0", "Sunday")
        .setValue(String(this.plugin.data.settings.weekStartsOn))
        .onChange(async (value) => {
          this.plugin.data.settings.weekStartsOn = value === "0" ? 0 : 1;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc("Do not scan Markdown files under these folders. Separate multiple folders with commas.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.excludedPathPrefixes.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.excludedPathPrefixes = splitPathCsv(value, ["time-blocks-data/", ".obsidian/", ".trash/"]);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Scheduled day folder")
      .setDesc("Point tasks scheduled from the month view move into YYYYMMDD.md files in this folder.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.scheduledDayFolder)
        .onChange(async (value) => {
          this.plugin.data.settings.scheduledDayFolder = normalizePathSetting(value) || "Calendar/Scheduled";
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Schedule-in-place folders")
      .setDesc("Tasks in these folders keep their original note when scheduled. Separate multiple folders with commas.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.scheduleInPlacePathPrefixes.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.scheduleInPlacePathPrefixes = splitPathCsv(value, ["规划/阶段"]);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Archive heading")
      .setDesc("Completed top-level tasks are moved under this heading in the same note.")
      .addText((text) => text
        .setValue(this.plugin.data.settings.archiveHeading)
        .onChange(async (value) => {
          this.plugin.data.settings.archiveHeading = value.trim() || "归档";
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("spaced-review pressure")
      .setDesc("Read spaced-review notes and include review pressure in calendar load.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.data.settings.reviewPressureEnabled)
        .onChange(async (value) => {
          this.plugin.data.settings.reviewPressureEnabled = value;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Review base minutes")
      .setDesc("Fixed estimated minutes per review note.")
      .addText((text) => text
        .setValue(String(this.plugin.data.settings.reviewBaseMinutes))
        .onChange(async (value) => {
          this.plugin.data.settings.reviewBaseMinutes = positiveInt(value, 2);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Review chars per minute")
      .setDesc("Body character count is divided by this value and added to the base minutes.")
      .addText((text) => text
        .setValue(String(this.plugin.data.settings.reviewCharsPerMinute))
        .onChange(async (value) => {
          this.plugin.data.settings.reviewCharsPerMinute = positiveInt(value, 800);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("Default task estimate minutes")
      .setDesc("Used for heatmap and weekly pressure when a point task has no estimate.")
      .addText((text) => text
        .setValue(String(this.plugin.data.settings.defaultUnestimatedTaskMinutes))
        .onChange(async (value) => {
          this.plugin.data.settings.defaultUnestimatedTaskMinutes = positiveInt(value, 30);
          await this.plugin.saveCalendarData();
        }));
  }
}

function splitCsv(value: string, fallback: string[]): string[] {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function positiveInt(value: string, fallback: number): number {
  return Math.max(1, Number.parseInt(value, 10) || fallback);
}
