import { Modal, Notice, type App } from "obsidian";

export interface TaskArchiveCandidate {
  filePath: string;
  fileName: string;
  completedTopLevelCount: number;
}

export interface TaskArchiveCandidateGroup {
  folderPath: string;
  folderName: string;
  candidates: TaskArchiveCandidate[];
  completedTopLevelCount: number;
}

interface TaskArchiveModalOptions {
  candidates: TaskArchiveCandidate[];
  onArchive: (filePaths: string[]) => Promise<number>;
}

export class TaskArchiveModal extends Modal {
  private readonly selected = new Set<string>();
  private readonly collapsed = new Set<string>();

  constructor(app: App, private readonly options: TaskArchiveModalOptions) {
    super(app);
    for (const candidate of options.candidates) {
      this.selected.add(candidate.filePath);
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cb-archive-modal");
    contentEl.createEl("h2", { text: "归档已完成任务" });

    if (this.options.candidates.length === 0) {
      contentEl.createDiv({ cls: "cb-empty", text: "没有可归档的已完成顶层任务。" });
      return;
    }

    this.renderSummary(contentEl);
    this.renderCandidateGroups(contentEl);

    const actions = contentEl.createDiv({ cls: "cb-menu-actions" });
    actions.createEl("button", { text: "归档" }).addEventListener("click", () => void this.archiveSelected());
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async archiveSelected(): Promise<void> {
    const filePaths = [...this.selected];
    if (filePaths.length === 0) {
      new Notice("请选择要归档的笔记。");
      return;
    }
    const archivedCount = await this.options.onArchive(filePaths);
    new Notice(`已归档 ${archivedCount} 个任务。`);
    this.close();
  }

  private renderSummary(parent: HTMLElement): void {
    const selectedCount = this.selected.size;
    const totalCount = this.options.candidates.length;
    const selectedTasks = this.options.candidates
      .filter((candidate) => this.selected.has(candidate.filePath))
      .reduce((sum, candidate) => sum + candidate.completedTopLevelCount, 0);
    parent.createDiv({
      cls: "cb-archive-summary",
      text: `${selectedCount}/${totalCount} notes selected · ${selectedTasks} completed tasks`
    });
  }

  private renderCandidateGroups(parent: HTMLElement): void {
    const list = parent.createDiv({ cls: "cb-archive-note-list" });
    for (const group of groupArchiveCandidates(this.options.candidates)) {
      this.renderCandidateGroup(list, group);
    }
  }

  private renderCandidateGroup(parent: HTMLElement, group: TaskArchiveCandidateGroup): void {
    const section = parent.createDiv({ cls: "cb-archive-folder-group" });
    const header = section.createDiv({ cls: "cb-archive-folder-header" });
    const groupCheckbox = header.createEl("input");
    groupCheckbox.type = "checkbox";
    groupCheckbox.checked = group.candidates.every((candidate) => this.selected.has(candidate.filePath));
    groupCheckbox.addEventListener("click", (event) => event.stopPropagation());
    groupCheckbox.addEventListener("change", () => {
      for (const candidate of group.candidates) {
        if (groupCheckbox.checked) this.selected.add(candidate.filePath);
        else this.selected.delete(candidate.filePath);
      }
      this.onOpen();
    });

    header.createSpan({ cls: "cb-archive-folder-caret", text: this.collapsed.has(group.folderPath) ? ">" : "v" });
    const title = header.createDiv({ cls: "cb-archive-folder-title" });
    title.createDiv({ cls: "cb-archive-folder-name", text: group.folderName });
    title.createDiv({ cls: "cb-archive-folder-path", text: group.folderPath });
    header.createDiv({
      cls: "cb-archive-folder-count",
      text: `${this.selectedCountForGroup(group)}/${group.candidates.length} notes · ${group.completedTopLevelCount} tasks`
    });
    header.addEventListener("click", () => {
      if (this.collapsed.has(group.folderPath)) this.collapsed.delete(group.folderPath);
      else this.collapsed.add(group.folderPath);
      this.onOpen();
    });

    if (this.collapsed.has(group.folderPath)) return;
    const rows = section.createDiv({ cls: "cb-archive-folder-rows" });
    for (const candidate of group.candidates) {
      this.renderCandidateRow(rows, candidate);
    }
  }

  private renderCandidateRow(parent: HTMLElement, candidate: TaskArchiveCandidate): void {
    const row = parent.createDiv({ cls: "cb-archive-note-row" });
    row.toggleClass("is-selected", this.selected.has(candidate.filePath));
    const checkbox = row.createEl("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.selected.has(candidate.filePath);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) this.selected.add(candidate.filePath);
      else this.selected.delete(candidate.filePath);
      this.onOpen();
    });

    const text = row.createDiv({ cls: "cb-archive-note-text" });
    text.createDiv({ cls: "cb-archive-note-title", text: candidate.fileName });
    text.createDiv({ cls: "cb-archive-note-path", text: candidate.filePath });
    row.createDiv({ cls: "cb-archive-note-count", text: `${candidate.completedTopLevelCount}` });
  }

  private selectedCountForGroup(group: TaskArchiveCandidateGroup): number {
    return group.candidates.filter((candidate) => this.selected.has(candidate.filePath)).length;
  }
}

export function groupArchiveCandidates(candidates: TaskArchiveCandidate[]): TaskArchiveCandidateGroup[] {
  const groups = new Map<string, TaskArchiveCandidate[]>();
  for (const candidate of candidates) {
    const folderPath = parentFolderPath(candidate.filePath);
    const group = groups.get(folderPath) ?? [];
    group.push(candidate);
    groups.set(folderPath, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === "Vault root" && right !== "Vault root") return -1;
      if (right === "Vault root" && left !== "Vault root") return 1;
      return left.localeCompare(right);
    })
    .map(([folderPath, groupCandidates]) => ({
      folderPath,
      folderName: folderName(folderPath),
      candidates: [...groupCandidates].sort((left, right) => left.fileName.localeCompare(right.fileName)),
      completedTopLevelCount: groupCandidates.reduce((sum, candidate) => sum + candidate.completedTopLevelCount, 0)
    }));
}

function parentFolderPath(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  return index < 0 ? "Vault root" : filePath.slice(0, index);
}

function folderName(folderPath: string): string {
  if (folderPath === "Vault root") return folderPath;
  return folderPath.split("/").pop() ?? folderPath;
}
