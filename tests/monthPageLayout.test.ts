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

test("renders parent long-task labels in point pools and child tasks inside long-task bars", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /function renderParentLongTaskChip/);
  assert.match(source, /renderParentLongTaskChip\(meta, task\)/);
  assert.match(source, /function renderLongTaskChildren/);
  assert.match(source, /renderLongTaskChildren\(bar, plugin, row\.childTasks\)/);
  assert.match(source, /function childTaskScheduleLabel/);
});

test("renders scheduled child long tasks as draggable cards inside parent bars", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");

  assert.match(source, /function renderChildLongTaskCard/);
  assert.match(source, /renderChildLongTaskCard\(list, plugin, child, schedule\)/);
  assert.match(source, /item\.draggable = true/);
  assert.match(source, /setDragTask\(event, task\.id\)/);
  assert.match(css, /\.cb-long-child-card/);
  assert.match(css, /\.cb-long-child-card-header/);
  assert.match(css, /\.cb-long-child-card-range/);
});

test("keeps child long task drag ids from bubbling into the parent bar", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const childCard = source.slice(source.indexOf("function renderChildLongTaskCard"), source.indexOf("function renderParentLongTaskChip"));

  assert.match(childCard, /event\.stopPropagation\(\)/);
  assert.match(childCard, /setDragTask\(event, task\.id\)/);
});

test("keeps child long task titles readable beside range labels", () => {
  const css = readFileSync("styles.css", "utf8");

  assert.match(css, /\.cb-long-child-card-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.cb-long-child-card-title\s*\{[^}]*white-space:\s*normal/s);
  assert.match(css, /\.cb-long-child-card-title\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.cb-long-child-card-range\s*\{[^}]*justify-self:\s*start/s);
});

test("opens the source note when month task titles are clicked", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const title = source.slice(source.indexOf("function renderTaskTitle"), source.indexOf("function renderLongVerticalTimeline"));
  const pointPool = source.slice(source.indexOf("function renderPointPoolTask"), source.indexOf("function renderLongPoolTask"));
  const longPool = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const longBar = source.slice(source.indexOf("function renderLongVerticalTask"), source.indexOf("function renderLongTaskChildren"));
  const childCard = source.slice(source.indexOf("function renderChildLongTaskCard"), source.indexOf("function renderParentLongTaskChip"));

  assert.match(title, /plugin: PersonalSchedulerPlugin/);
  assert.match(title, /addEventListener\("click", \(\) => void plugin\.openTaskSourceNote\(task\.id\)\)/);
  assert.match(pointPool, /renderTaskTitle\(card, plugin, task\)/);
  assert.match(longPool, /renderTaskTitle\(card, plugin, task\)/);
  assert.match(longBar, /renderTaskTitle\(bar, plugin, row\.task\)/);
  assert.match(childCard, /openTaskSourceNote\(task\.id\)/);
});
