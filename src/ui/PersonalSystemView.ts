import { ItemView, type WorkspaceLeaf } from "obsidian";
import type PersonalSchedulerPlugin from "../main";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "../models/constants";
import { todayString } from "../utils/date";
import { renderMonthPage } from "./pages/MonthPage";
import { renderSettingsPage } from "./pages/SettingsPage";
import { renderWeekPage } from "./pages/WeekPage";

type PageId = "month" | "week" | "settings";

export class PersonalSystemView extends ItemView {
  private currentPage: PageId = "month";
  private anchorDate = todayString();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: PersonalSchedulerPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PERSONAL_SYSTEM;
  }

  getDisplayText(): string {
    return "Calendar Bridge";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("ps-root");

    const nav = root.createDiv({ cls: "ps-top-nav" });
    this.addNavButton(nav, "month", "月视图");
    this.addNavButton(nav, "week", "周视图");
    nav.createEl("button", { cls: "ps-nav-button", text: "归档" }).addEventListener("click", () => this.plugin.openTaskArchiveModal());
    this.addNavButton(nav, "settings", "设置");

    const page = root.createDiv({ cls: "ps-page" });
    const context = {
      anchorDate: this.anchorDate,
      setAnchorDate: (date: string) => {
        this.anchorDate = date;
        this.render();
      }
    };

    if (this.currentPage === "month") renderMonthPage(page, this.plugin, context);
    else if (this.currentPage === "week") renderWeekPage(page, this.plugin, context);
    else renderSettingsPage(page, this.plugin);
  }

  private addNavButton(nav: HTMLElement, page: PageId, label: string): void {
    const button = nav.createEl("button", { cls: "ps-nav-button", text: label });
    button.toggleClass("is-active", page === this.currentPage);
    button.addEventListener("click", () => {
      this.currentPage = page;
      this.render();
    });
  }
}
