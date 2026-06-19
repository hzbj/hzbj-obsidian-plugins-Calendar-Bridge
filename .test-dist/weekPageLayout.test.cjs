// tests/weekPageLayout.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("renders week unscheduled pool with source grouping, sorting, and priority display", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/WeekPage.ts", "utf8");
  import_node_assert.strict.match(source, /buildSourceTaskGroups/);
  import_node_assert.strict.match(source, /function renderSourceGroup/);
  import_node_assert.strict.match(source, /function renderSortToggle/);
  import_node_assert.strict.match(source, /cb-priority-chip/);
  import_node_assert.strict.match(source, /cb-priority-marker/);
  import_node_assert.strict.match(source, /cb-week-task-list/);
  import_node_assert.strict.match(source, /cb-week-priority cb-priority-marker/);
  import_node_assert.strict.match(source, /cb-week-task-content/);
  import_node_assert.strict.match(source, /taskContentLabel\(task\)/);
  import_node_assert.strict.match(source, /cleanTaskContentText\(task\.rawLine\)/);
  import_node_assert.strict.doesNotMatch(source, /Before anchor/);
});
(0, import_node_test.test)("renders parent long-task labels on week unscheduled child tasks", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/WeekPage.ts", "utf8");
  import_node_assert.strict.match(source, /function renderParentLongTaskChip/);
  import_node_assert.strict.match(source, /renderParentLongTaskChip\(meta, task\)/);
  import_node_assert.strict.match(source, /parentLongTaskText/);
});
