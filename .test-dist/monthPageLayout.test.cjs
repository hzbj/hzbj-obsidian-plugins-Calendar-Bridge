// tests/monthPageLayout.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("keeps the vertical long-task timeline exclusive to long-task month mode", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(source, /if \(viewMode === "long"\)[\s\S]*renderGroupedPool[\s\S]*renderLongVerticalTimeline/);
  import_node_assert.strict.match(source, /renderGroupedPool\(shell\.createDiv\(\{ cls: "cb-panel cb-task-pool" \}\), plugin, model, viewMode\);[\s\S]*renderPointMonthGrid/);
  import_node_assert.strict.match(source, /renderPointMonthGrid\(/);
  import_node_assert.strict.doesNotMatch(source, /function renderPointPool\(/);
  import_node_assert.strict.doesNotMatch(source, /buildPointTimelineRows/);
});
(0, import_node_test.test)("renders long-task month ranges as vertical timeline bars", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  const longCard = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));
  import_node_assert.strict.doesNotMatch(longCard, /unscheduledReason/);
  import_node_assert.strict.match(timeline, /cb-long-vertical-timeline/);
  import_node_assert.strict.match(timeline, /cb-long-vertical-track/);
  import_node_assert.strict.match(timeline, /for \(const row of rows\) renderLongVerticalTask\(track, plugin, row\)/);
  import_node_assert.strict.match(source, /function renderLongDatePicker/);
  import_node_assert.strict.doesNotMatch(timeline, /cb-timeline-row-track|cb-timeline-bar/);
});
(0, import_node_test.test)("renders vertical long-task timeline with non-overlapping lanes", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));
  import_node_assert.strict.match(source, /function assignVerticalTimelineLanes/);
  import_node_assert.strict.match(timeline, /cb-long-vertical-date-axis/);
  import_node_assert.strict.match(timeline, /cb-long-vertical-track/);
  import_node_assert.strict.match(timeline, /--cb-long-days/);
  import_node_assert.strict.match(timeline, /--cb-long-lanes/);
  import_node_assert.strict.match(source, /gridRow = `\$\{row\.startDay\} \/ \$\{row\.endDay \+ 1\}`/);
  import_node_assert.strict.match(source, /gridColumn = String\(row\.lane\)/);
});
(0, import_node_test.test)("lets long-task month timelines collapse and expand past days", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));
  import_node_assert.strict.match(source, /buildLongTimelineDisplay/);
  import_node_assert.strict.match(source, /longTaskPastDaysExpanded === true/);
  import_node_assert.strict.match(timeline, /renderLongPastDaysToggle/);
  import_node_assert.strict.match(source, /function toggleLongTaskPastDays/);
  import_node_assert.strict.match(source, /cb-long-past-toggle/);
  import_node_assert.strict.match(source, /day\.isFoldedPast/);
});
(0, import_node_test.test)("lets long-task month pool include ordinary unscheduled candidates but not phase child tasks", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(source, /function isTaskVisibleInPool/);
  import_node_assert.strict.match(source, /task\.taskKind === "long" \|\| task\.triggerType !== "phase-note"/);
});
(0, import_node_test.test)("renders parent long-task labels in point pools and child tasks inside long-task bars", () => {
  const source = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(source, /function renderParentLongTaskChip/);
  import_node_assert.strict.match(source, /renderParentLongTaskChip\(meta, task\)/);
  import_node_assert.strict.match(source, /function renderLongTaskChildren/);
  import_node_assert.strict.match(source, /renderLongTaskChildren\(bar, row\.childTasks\)/);
  import_node_assert.strict.match(source, /function childTaskScheduleLabel/);
});
