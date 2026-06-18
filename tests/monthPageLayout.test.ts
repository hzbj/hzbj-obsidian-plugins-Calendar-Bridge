import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("keeps the bar timeline exclusive to long-task month mode", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /if \(viewMode === "long"\)[\s\S]*renderGroupedPool[\s\S]*renderTimeline/);
  assert.match(source, /renderGroupedPool\(shell\.createDiv\(\{ cls: "cb-panel cb-task-pool" \}\), plugin, model, viewMode\);[\s\S]*renderPointMonthGrid/);
  assert.match(source, /renderPointMonthGrid\(/);
  assert.doesNotMatch(source, /function renderPointPool\(/);
  assert.doesNotMatch(source, /buildPointTimelineRows/);
});

test("keeps long-task month cards and timeline rows compact", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const longCard = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const timelineRow = source.slice(source.indexOf("function renderTimelineRow"), source.indexOf("function setupTimelineDateTarget"));

  assert.doesNotMatch(longCard, /unscheduledReason/);
  assert.doesNotMatch(timelineRow, /fullStartDate.*fullEndDate/);
  assert.doesNotMatch(timelineRow, /row\.overdue \? "overdue"/);
});

test("lets long-task month pool include ordinary unscheduled candidates but not phase child tasks", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /function isTaskVisibleInPool/);
  assert.match(source, /task\.taskKind === "long" \|\| task\.triggerType !== "phase-note"/);
});
