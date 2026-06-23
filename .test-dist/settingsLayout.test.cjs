// tests/settingsLayout.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("renders archive and schedule-in-place controls in both settings surfaces", () => {
  const tab = (0, import_node_fs.readFileSync)("src/ui/settings/PersonalSystemSettingTab.ts", "utf8");
  const page = (0, import_node_fs.readFileSync)("src/ui/pages/SettingsPage.ts", "utf8");
  for (const source of [tab, page]) {
    import_node_assert.strict.match(source, /Schedule-in-place folders/);
    import_node_assert.strict.match(source, /scheduleInPlacePathPrefixes/);
    import_node_assert.strict.match(source, /Archive heading/);
    import_node_assert.strict.match(source, /archiveHeading/);
  }
});
(0, import_node_test.test)("renders a top-nav archive action next to settings", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/PersonalSystemView.ts", "utf8");
  const nav = source.slice(source.indexOf("const nav"), source.indexOf("const page"));
  import_node_assert.strict.match(nav, /text: "归档"/);
  import_node_assert.strict.match(nav, /openTaskArchiveModal\(\)/);
  import_node_assert.strict.match(nav, /addNavButton\(nav, "settings"/);
});
(0, import_node_test.test)("renders archive modal as collapsible parent-folder groups", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/TaskArchiveModal.ts", "utf8");
  const css = (0, import_node_fs.readFileSync)("styles.css", "utf8");
  import_node_assert.strict.match(source, /groupArchiveCandidates/);
  import_node_assert.strict.match(source, /parentFolderPath/);
  import_node_assert.strict.match(source, /collapsed = new Set<string>/);
  import_node_assert.strict.match(source, /cb-archive-folder-header/);
  import_node_assert.strict.match(source, /cb-archive-folder-rows/);
  import_node_assert.strict.match(source, /selectedCountForGroup/);
  import_node_assert.strict.match(css, /\.cb-archive-folder-group/);
  import_node_assert.strict.match(css, /\.cb-archive-folder-header/);
  import_node_assert.strict.match(css, /\.cb-archive-note-row\.is-selected/);
  import_node_assert.strict.match(css, /\.modal:has\(\.cb-archive-modal\)/);
  import_node_assert.strict.match(css, /box-sizing: border-box/);
  import_node_assert.strict.match(css, /max-width: 100%/);
});
