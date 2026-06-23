import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("renders archive and schedule-in-place controls in both settings surfaces", () => {
  const tab = readFileSync("src/ui/settings/PersonalSystemSettingTab.ts", "utf8");
  const page = readFileSync("src/ui/pages/SettingsPage.ts", "utf8");

  for (const source of [tab, page]) {
    assert.match(source, /Schedule-in-place folders/);
    assert.match(source, /scheduleInPlacePathPrefixes/);
    assert.match(source, /Archive heading/);
    assert.match(source, /archiveHeading/);
  }
});

test("renders a top-nav archive action next to settings", () => {
  const source = readFileSync("src/ui/PersonalSystemView.ts", "utf8");
  const nav = source.slice(source.indexOf("const nav"), source.indexOf("const page"));

  assert.match(nav, /text: "归档"/);
  assert.match(nav, /openTaskArchiveModal\(\)/);
  assert.match(nav, /addNavButton\(nav, "settings"/);
});

test("renders archive modal as collapsible parent-folder groups", () => {
  const source = readFileSync("src/ui/TaskArchiveModal.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");

  assert.match(source, /groupArchiveCandidates/);
  assert.match(source, /parentFolderPath/);
  assert.match(source, /collapsed = new Set<string>/);
  assert.match(source, /cb-archive-folder-header/);
  assert.match(source, /cb-archive-folder-rows/);
  assert.match(source, /selectedCountForGroup/);
  assert.match(css, /\.cb-archive-folder-group/);
  assert.match(css, /\.cb-archive-folder-header/);
  assert.match(css, /\.cb-archive-note-row\.is-selected/);
  assert.match(css, /\.modal:has\(\.cb-archive-modal\)/);
  assert.match(css, /box-sizing: border-box/);
  assert.match(css, /max-width: 100%/);
});
