import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Notice, TFile } from "obsidian";
import PersonalSchedulerPlugin from "../src/main";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "../src/models/constants";

test("plugin registration survives a startup scan failure", async () => {
  const notices = (Notice as unknown as { messages: string[] }).messages;
  notices.length = 0;
  const PluginCtor = PersonalSchedulerPlugin as unknown as { new (): PersonalSchedulerPlugin };
  const plugin = new PluginCtor();
  const layoutReadyCallbacks: Array<() => void> = [];
  const timeoutCallbacks: Array<() => void> = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    timeoutCallbacks.push(callback);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  (plugin as any).app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Inbox.md" }],
      cachedRead: async () => {
        throw new Error("metadata cache is still warming up");
      },
      on: () => ({})
    },
    metadataCache: {
      getFileCache: () => null
    },
    workspace: {
      getLeavesOfType: () => [],
      onLayoutReady: (callback: () => void) => {
        layoutReadyCallbacks.push(callback);
      }
    }
  };

  await assert.doesNotReject(() => plugin.onload());

  assert.deepEqual((plugin as any).registeredViews, [VIEW_TYPE_PERSONAL_SYSTEM]);
  assert.deepEqual((plugin as any).commands, ["open-calendar-bridge", "rescan-calendar-bridge-tasks"]);
  assert.equal((plugin as any).settingTabs.length, 1);
  assert.equal(layoutReadyCallbacks.length, 1);

  const originalConsoleError = console.error;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    layoutReadyCallbacks[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(timeoutCallbacks.length, 1);
    assert.equal(errors.length, 0);
    assert.equal(notices.length, 0);

    timeoutCallbacks[0]();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.error = originalConsoleError;
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(errors.length, 1);
  assert.equal(notices.length, 1);
});

test("activating the calendar opens a main workspace tab", async () => {
  const PluginCtor = PersonalSchedulerPlugin as unknown as { new (): PersonalSchedulerPlugin };
  const plugin = new PluginCtor();
  const calls: string[] = [];
  const leaf = {
    setViewState: async (state: { type: string; active: boolean }) => {
      calls.push(`setViewState:${state.type}:${state.active}`);
    }
  };
  (plugin as any).app = {
    workspace: {
      getLeavesOfType: () => [],
      detachLeavesOfType: (viewType: string) => {
        calls.push(`detachLeavesOfType:${viewType}`);
      },
      getLeaf: (location: string) => {
        calls.push(`getLeaf:${location}`);
        return leaf;
      },
      getRightLeaf: () => {
        calls.push("getRightLeaf");
        return leaf;
      },
      revealLeaf: (target: unknown) => {
        assert.equal(target, leaf);
        calls.push("revealLeaf");
      }
    }
  };

  await plugin.activateView();

  assert.deepEqual(calls, [
    `detachLeavesOfType:${VIEW_TYPE_PERSONAL_SYSTEM}`,
    "getLeaf:tab",
    `setViewState:${VIEW_TYPE_PERSONAL_SYSTEM}:true`,
    "revealLeaf"
  ]);
});

test("activating the calendar moves an existing sidebar view into a main workspace tab", async () => {
  const PluginCtor = PersonalSchedulerPlugin as unknown as { new (): PersonalSchedulerPlugin };
  const plugin = new PluginCtor();
  const calls: string[] = [];
  const existingLeaf = {};
  const newLeaf = {
    setViewState: async (state: { type: string; active: boolean }) => {
      calls.push(`setViewState:${state.type}:${state.active}`);
    }
  };
  (plugin as any).app = {
    workspace: {
      getLeavesOfType: () => [existingLeaf],
      detachLeavesOfType: (viewType: string) => {
        calls.push(`detachLeavesOfType:${viewType}`);
      },
      getLeaf: (location: string) => {
        calls.push(`getLeaf:${location}`);
        return newLeaf;
      },
      revealLeaf: (target: unknown) => {
        assert.equal(target, newLeaf);
        calls.push("revealLeaf");
      }
    }
  };

  await plugin.activateView();

  assert.deepEqual(calls, [
    `detachLeavesOfType:${VIEW_TYPE_PERSONAL_SYSTEM}`,
    "getLeaf:tab",
    `setViewState:${VIEW_TYPE_PERSONAL_SYSTEM}:true`,
    "revealLeaf"
  ]);
});

test("opening a task source jumps to the task note line", async () => {
  const PluginCtor = PersonalSchedulerPlugin as unknown as { new (): PersonalSchedulerPlugin };
  const plugin = new PluginCtor();
  const file = new TFile();
  (file as unknown as { path: string }).path = "Inbox.md";
  const opened: Array<{ file: TFile; state: unknown }> = [];
  const leaf = {
    openFile: async (target: TFile, state: unknown) => {
      opened.push({ file: target, state });
    }
  };
  (plugin as any).app = {
    vault: {
      getAbstractFileByPath: (path: string) => path === "Inbox.md" ? file : null
    },
    workspace: {
      getLeaf: (location: string) => {
        assert.equal(location, false);
        return leaf;
      },
      revealLeaf: (target: unknown) => {
        assert.equal(target, leaf);
      }
    }
  };

  await plugin.openTaskSourceNote("Inbox.md:12");

  assert.deepEqual(opened, [{
    file,
    state: { active: true, eState: { line: 11 } }
  }]);
});
