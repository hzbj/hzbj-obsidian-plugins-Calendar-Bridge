import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Notice } from "obsidian";
import PersonalSchedulerPlugin from "../src/main";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "../src/models/constants";

test("plugin registration survives a startup scan failure", async () => {
  const notices = (Notice as unknown as { messages: string[] }).messages;
  notices.length = 0;
  const PluginCtor = PersonalSchedulerPlugin as unknown as { new (): PersonalSchedulerPlugin };
  const plugin = new PluginCtor();
  const layoutReadyCallbacks: Array<() => void> = [];
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
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(errors.length, 1);
  assert.equal(notices.length, 1);
});
