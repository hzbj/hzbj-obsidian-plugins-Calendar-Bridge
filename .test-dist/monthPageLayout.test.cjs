// tests/monthPageLayout.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("keeps the bar timeline exclusive to long-task month mode", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(source, /if \(viewMode === "long"\)[\s\S]*renderGroupedPool[\s\S]*renderTimeline/);
  import_node_assert.strict.match(source, /renderGroupedPool\(shell\.createDiv\(\{ cls: "cb-panel cb-task-pool" \}\), plugin, model, viewMode\);[\s\S]*renderPointMonthGrid/);
  import_node_assert.strict.match(source, /renderPointMonthGrid\(/);
  import_node_assert.strict.doesNotMatch(source, /function renderPointPool\(/);
  import_node_assert.strict.doesNotMatch(source, /buildPointTimelineRows/);
});
(0, import_node_test.test)("keeps long-task month cards and timeline rows compact", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  const longCard = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const timelineRow = source.slice(source.indexOf("function renderTimelineRow"), source.indexOf("function setupTimelineDateTarget"));
  import_node_assert.strict.doesNotMatch(longCard, /unscheduledReason/);
  import_node_assert.strict.doesNotMatch(timelineRow, /fullStartDate.*fullEndDate/);
  import_node_assert.strict.doesNotMatch(timelineRow, /row\.overdue \? "overdue"/);
});
(0, import_node_test.test)("lets long-task month pool include ordinary unscheduled candidates but not phase child tasks", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(source, /function isTaskVisibleInPool/);
  import_node_assert.strict.match(source, /task\.taskKind === "long" \|\| task\.triggerType !== "phase-note"/);
});
