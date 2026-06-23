export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export class Component {
  registerEvent(eventRef: unknown): void {
    void eventRef;
  }
}

export class Plugin extends Component {
  app: any;
  manifest: any;
  registeredViews: string[] = [];
  commands: string[] = [];
  ribbonIcons: string[] = [];
  settingTabs: unknown[] = [];

  async loadData(): Promise<unknown> {
    return undefined;
  }

  async saveData(data: unknown): Promise<void> {
    void data;
  }

  registerView(type: string, viewCreator: unknown): void {
    void viewCreator;
    this.registeredViews.push(type);
  }

  addSettingTab(tab: unknown): void {
    this.settingTabs.push(tab);
  }

  addRibbonIcon(icon: string, title: string, callback: unknown): void {
    void title;
    void callback;
    this.ribbonIcons.push(icon);
  }

  addCommand(command: { id: string }): void {
    this.commands.push(command.id);
  }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {};
  }
}

export class ItemView {
  leaf: unknown;
  containerEl: { children: any[] };

  constructor(leaf: unknown) {
    this.leaf = leaf;
    this.containerEl = { children: [{}, {}] };
  }
}

export class Modal {
  app: any;
  contentEl: any;

  constructor(app: any) {
    this.app = app;
    this.contentEl = {
      empty: () => undefined,
      createEl: () => ({
        addEventListener: () => undefined
      }),
      createDiv: () => ({
        createEl: () => ({
          addEventListener: () => undefined
        }),
        createDiv: () => undefined
      })
    };
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {}

  onClose(): void {}
}

export class TFile {
  path: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    this.extension = "md";
  }
}

export class Setting {
  constructor(containerEl: unknown) {
    void containerEl;
  }

  setName(): this {
    return this;
  }

  setDesc(): this {
    return this;
  }

  addText(): this {
    return this;
  }

  addToggle(): this {
    return this;
  }

  addDropdown(): this {
    return this;
  }
}
