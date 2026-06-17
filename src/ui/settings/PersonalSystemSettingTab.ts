import { PluginSettingTab, Setting } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";

export class PersonalSystemSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: PersonalSchedulerPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar Bridge" });

    new Setting(containerEl)
      .setName("触发标签")
      .setDesc("按 Task-Maker 语义扫描这些 checkbox 标签，使用逗号分隔。")
      .addText((text) => text
        .setValue(this.plugin.data.settings.triggerTags.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.triggerTags = splitCsv(value, ["task", "todo"]);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("读取旧 emoji 日期")
      .setDesc("兼容读取 📅 YYYY-MM-DD；重新排期写入 [scheduled:: YYYY-MM-DD]。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.data.settings.readLegacyEmojiDates)
        .onChange(async (value) => {
          this.plugin.data.settings.readLegacyEmojiDates = value;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("周起始日")
      .setDesc("月视图与周视图共用。")
      .addDropdown((dropdown) => dropdown
        .addOption("1", "周一")
        .addOption("0", "周日")
        .setValue(String(this.plugin.data.settings.weekStartsOn))
        .onChange(async (value) => {
          this.plugin.data.settings.weekStartsOn = value === "0" ? 0 : 1;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("排除路径前缀")
      .setDesc("不会扫描这些路径下的 Markdown，使用逗号分隔。")
      .addText((text) => text
        .setValue(this.plugin.data.settings.excludedPathPrefixes.join(","))
        .onChange(async (value) => {
          this.plugin.data.settings.excludedPathPrefixes = splitCsv(value, ["time-blocks-data/", ".obsidian/"]);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("spaced-review 压力")
      .setDesc("只读 spaced-review 笔记，用复习数量和正文长度折算日负载。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.data.settings.reviewPressureEnabled)
        .onChange(async (value) => {
          this.plugin.data.settings.reviewPressureEnabled = value;
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("复习基础分钟")
      .setDesc("每篇复习笔记的固定估时。")
      .addText((text) => text
        .setValue(String(this.plugin.data.settings.reviewBaseMinutes))
        .onChange(async (value) => {
          this.plugin.data.settings.reviewBaseMinutes = positiveInt(value, 2);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("每分钟文字量")
      .setDesc("正文字符数除以此值，再加基础分钟。")
      .addText((text) => text
        .setValue(String(this.plugin.data.settings.reviewCharsPerMinute))
        .onChange(async (value) => {
          this.plugin.data.settings.reviewCharsPerMinute = positiveInt(value, 800);
          await this.plugin.saveCalendarData();
        }));

    new Setting(containerEl)
      .setName("未估时任务默认分钟")
      .setDesc("用于月视图热力和周汇总。")
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
