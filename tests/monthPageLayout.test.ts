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

test("renders month recurring task counts separately from concrete task counts", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const grid = source.slice(source.indexOf("function renderPointMonthGrid"), source.indexOf("function renderWeekdayHeader"));
  const css = readFileSync("styles.css", "utf8");

  assert.match(grid, /recurringTaskCount/);
  assert.match(grid, /`\$\{load\.taskCount\}\/\$\{load\.recurringTaskCount\}`/);
  assert.match(grid, /cb-day-load-breakdown/);
  assert.match(grid, /cb-day-load-task/);
  assert.match(grid, /cb-day-load-repeat/);
  assert.match(grid, /renderDayLoadMetric/);
  assert.match(grid, /cb-day-load-label/);
  assert.match(grid, /cb-day-load-value/);
  assert.match(grid, /cb-day-load-summary/);
  assert.match(grid, /recurringTaskMinutes/);
  assert.doesNotMatch(grid, /cb-recurring-task-count/);
  assert.doesNotMatch(css, /cb-recurring-task-count/);
  assert.match(css, /\.cb-day-load-breakdown/);
  assert.match(css, /\.cb-day-load-repeat/);
  assert.match(css, /\.cb-day-load-label/);
  assert.match(css, /\.cb-day-load-value/);
});

test("maps month heat scores to continuous green orange red variables", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");

  assert.match(source, /const MONTH_HEAT_MAX_MINUTES = 14 \* 60/);
  assert.match(source, /const MONTH_HEAT_MID_MINUTES = MONTH_HEAT_MAX_MINUTES \/ 2/);
  assert.match(source, /const MONTH_HEAT_GREEN = \{ r: 54, g: 147, b: 95 \}/);
  assert.match(source, /const MONTH_HEAT_ORANGE = \{ r: 208, g: 129, b: 36 \}/);
  assert.match(source, /const MONTH_HEAT_RED = \{ r: 191, g: 75, b: 69 \}/);
  assert.match(source, /applyMonthHeatStyle\(cell, load\.heatScore\)/);
  assert.match(source, /function monthHeatStyle/);
  assert.match(source, /interpolateHeatColor\(MONTH_HEAT_GREEN, MONTH_HEAT_ORANGE/);
  assert.match(source, /interpolateHeatColor\(MONTH_HEAT_ORANGE, MONTH_HEAT_RED/);
  assert.match(source, /Math\.min\(minutes, MONTH_HEAT_MAX_MINUTES\)/);
  assert.match(source, /--cb-heat-r/);
  assert.match(source, /--cb-heat-alpha/);
  assert.doesNotMatch(source, /monthHeatLevel/);
  assert.doesNotMatch(source, /is-heat-\$\{/);
  assert.doesNotMatch(source, /minutes <= 120/);
  assert.doesNotMatch(source, /minutes <= 240/);
  assert.match(css, /--cb-heat-r:\s*0/);
  assert.match(css, /--cb-heat-g:\s*0/);
  assert.match(css, /--cb-heat-b:\s*0/);
  assert.match(css, /--cb-heat-alpha:\s*0/);
  assert.match(css, /rgba\(var\(--cb-heat-r\), var\(--cb-heat-g\), var\(--cb-heat-b\), var\(--cb-heat-alpha\)\)/);
  assert.doesNotMatch(css, /\.cb-day-cell\.is-heat-low/);
  assert.doesNotMatch(css, /\.cb-day-cell\.is-heat-medium/);
  assert.doesNotMatch(css, /\.cb-day-cell\.is-heat-high/);
});

test("renders long-task planned and child-entry controls only in the task menu", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const menu = source.slice(source.indexOf("function openTaskMenu"), source.indexOf("async function applyTaskMenu"));

  assert.match(menu, /if \(task\.taskKind === "long"\)/);
  assert.match(menu, /task\.plannedDate === todayString\(\)/);
  assert.match(menu, /Planned today/);
  assert.match(menu, /Child task/);
  assert.match(menu, /Add child/);
  assert.match(source, /function addChildTaskFromMenu/);
  assert.match(source, /plugin\.addLongTaskChild/);
});

test("keeps long-task context menu controls wide and single-line", () => {
  const css = readFileSync("styles.css", "utf8");
  const menu = css.slice(css.indexOf(".cb-task-context-menu"), css.indexOf(".modal:has(.cb-archive-modal)"));

  assert.match(menu, /width:\s*min\(480px,\s*calc\(100vw - 24px\)\)/);
  assert.match(menu, /grid-template-columns:\s*112px minmax\(0,\s*1fr\)/);
  assert.match(menu, /input\[type="checkbox"\][\s\S]*width:\s*18px/);
  assert.match(menu, /input\[type="checkbox"\][\s\S]*height:\s*18px/);
  assert.match(menu, /\.cb-menu-actions\s*\{[\s\S]*display:\s*grid/);
  assert.match(menu, /grid-template-columns:\s*auto auto minmax\(max-content,\s*1fr\) auto/);
  assert.match(menu, /white-space:\s*nowrap/);
});

test("filters scheduled daily files only for month long-task mode", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const render = source.slice(source.indexOf("export function renderMonthPage"), source.indexOf("function renderGroupedPool"));

  assert.match(render, /const viewMode: MonthTaskViewMode = plugin\.data\.ui\.monthTaskViewMode \?\? "point"/);
  assert.match(render, /viewMode === "long"[\s\S]*isScheduledDayFilePath\(task\.filePath, plugin\.data\.settings\.scheduledDayFolder\)/);
  assert.match(render, /: plugin\.calendarTasks/);
  assert.match(source, /export function isScheduledDayFilePath/);
  assert.match(source, /\^\\d\{8\}\\\.md\$/);
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

test("uses the long-task red frame for behind pace status", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const task = source.slice(source.indexOf("function renderLongVerticalTask"), source.indexOf("function renderLongTaskChildren"));

  assert.match(task, /toggleClass\("is-behind", row\.status === "behind"\)/);
  assert.doesNotMatch(task, /toggleClass\("is-overdue"/);
  assert.match(css, /\.cb-long-vertical-bar\.is-behind\s*\{/);
  assert.match(css, /\.cb-long-vertical-bar\.is-behind\s*\{[^}]*var\(--text-error\)/s);
  assert.doesNotMatch(css, /\.cb-long-vertical-bar\.is-overdue\s*\{/);
});

test("uses a green frame only on planned long-task timeline bars", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const poolTask = source.slice(source.indexOf("function renderLongPoolTask"), source.indexOf("function renderTaskTitle"));
  const timelineTask = source.slice(source.indexOf("function renderLongVerticalTask"), source.indexOf("function renderLongTaskChildren"));

  assert.doesNotMatch(poolTask, /is-planned-today/);
  assert.match(timelineTask, /toggleClass\("is-planned-today", isPlannedToday\(row\.task\)\)/);
  assert.match(css, /\.cb-long-vertical-bar\.is-planned-today\s*\{/);
  assert.match(css, /\.cb-long-vertical-bar\.is-planned-today\s*\{[^}]*var\(--text-success\)/s);
  assert.doesNotMatch(css, /\.cb-long-task-card\.is-planned-today/);
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

test("lets long-task month pool include every unscheduled candidate", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /function isTaskVisibleInPool/);
  assert.match(source, /text: "Unscheduled tasks"/);
  assert.doesNotMatch(source, /Unscheduled long tasks/);
  assert.doesNotMatch(source, /Unscheduled point tasks/);
  assert.match(source, /return true/);
  assert.doesNotMatch(source, /triggerType !== "phase-note"/);
});

test("renders parent long-task labels in point pools and child tasks inside long-task bars", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(source, /function renderParentLongTaskChip/);
  assert.match(source, /renderParentLongTaskChip\(meta, task\)/);
  assert.match(source, /function renderLongTaskChildren/);
  assert.match(source, /renderLongTaskChildren\(bar, plugin, row\.childTasks\)/);
  assert.match(source, /function childTaskScheduleLabel/);
});

test("renders recurring long-task children as compact child rows", () => {
  const source = readFileSync("src/ui/pages/MonthPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const children = source.slice(source.indexOf("function renderLongTaskChildren"), source.indexOf("function renderChildLongTaskCard"));

  assert.match(children, /isRecurringTask\(child\)/);
  assert.match(children, /renderRecurringChildTask\(list, child\)/);
  assert.match(source, /function recurringCycleLabel/);
  assert.match(source, /function recurringRefreshLabel/);
  assert.match(source, /function weekdayLabel/);
  assert.match(source, /cb-long-child-cycle/);
  assert.match(source, /cb-long-child-refresh/);
  assert.match(source, /刷新：/);
  assert.match(css, /\.cb-long-child-recurring/);
  assert.match(css, /\.cb-long-child-cycle/);
  assert.match(css, /\.cb-long-child-refresh/);
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

test("lets compressed long-task bars scroll vertically", () => {
  const css = readFileSync("styles.css", "utf8");
  const bar = css.slice(css.indexOf(".cb-long-vertical-bar {"), css.indexOf(".cb-long-vertical-bar.is-behind {"));

  assert.match(bar, /overflow-y:\s*auto/);
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
