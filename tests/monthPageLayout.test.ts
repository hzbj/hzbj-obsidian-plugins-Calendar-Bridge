import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("keeps the vertical long-task timeline exclusive to long-task month mode", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /if \(viewMode === "long"\)[\s\S]*renderGroupedPool[\s\S]*renderLongVerticalTimeline/);
  assert.match(source, /renderGroupedPool\(shell\.createDiv\(\{ cls: "cb-panel cb-task-pool" \}\), plugin, model, viewMode\);[\s\S]*renderPointMonthGrid/);
  assert.match(source, /renderPointMonthGrid\(/);
  assert.doesNotMatch(source, /function renderPointPool\(/);
  assert.doesNotMatch(source, /buildPointTimelineRows/);
});

test("renders long-task month ranges as vertical timeline bars", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const longCard = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));

  assert.doesNotMatch(longCard, /unscheduledReason/);
  assert.match(timeline, /cb-long-vertical-timeline/);
  assert.match(timeline, /cb-long-vertical-track/);
  assert.match(timeline, /for \(const row of rows\) renderLongVerticalTask\(track, plugin, row\)/);
  assert.match(source, /function renderLongDatePicker/);
  assert.doesNotMatch(timeline, /cb-timeline-row-track|cb-timeline-bar/);
});

test("renders vertical long-task timeline with non-overlapping lanes", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));

  assert.match(source, /function assignVerticalTimelineLanes/);
  assert.match(timeline, /cb-long-vertical-date-axis/);
  assert.match(timeline, /cb-long-vertical-track/);
  assert.match(timeline, /--cb-long-days/);
  assert.match(timeline, /--cb-long-lanes/);
  assert.match(source, /gridRow = `\$\{row\.startDay\} \/ \$\{row\.endDay \+ 1\}`/);
  assert.match(source, /gridColumn = String\(row\.lane\)/);
});

test("lets long-task month timelines collapse and expand past days", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const timeline = source.slice(source.indexOf("function renderLongVerticalTimeline"), source.indexOf("function setupTimelineDateTarget"));

  assert.match(source, /buildLongTimelineDisplay/);
  assert.match(source, /longTaskPastDaysExpanded === true/);
  assert.match(timeline, /renderLongPastDaysToggle/);
  assert.match(source, /function toggleLongTaskPastDays/);
  assert.match(source, /cb-long-past-toggle/);
  assert.match(source, /day\.isFoldedPast/);
});

test("lets long-task month pool include ordinary unscheduled candidates but not phase child tasks", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /function isTaskVisibleInPool/);
  assert.match(source, /task\.taskKind === "long" \|\| task\.triggerType !== "phase-note"/);
});
