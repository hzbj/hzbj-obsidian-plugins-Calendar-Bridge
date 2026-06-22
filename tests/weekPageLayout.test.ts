import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("renders week unscheduled pool with source grouping, sorting, and priority display", () => {
  const source = readFileSync("src/ui/pages/WeekPage.ts", "utf8");

  assert.match(source, /buildSourceTaskGroups/);
  assert.match(source, /renderPool\(pool, plugin, model\.unifiedUnscheduledTasks\)/);
  assert.doesNotMatch(source, /unifiedUnscheduledTasks\.filter\(\(task\) => task\.taskKind !== "long"\)/);
  assert.match(source, /text: "Unscheduled tasks"/);
  assert.match(source, /text: "No unscheduled tasks\."/);
  assert.match(source, /function renderSourceGroup/);
  assert.match(source, /function renderSortToggle/);
  assert.match(source, /cb-priority-chip/);
  assert.match(source, /cb-priority-marker/);
  assert.match(source, /cb-week-task-list/);
  assert.match(source, /cb-week-priority cb-priority-marker/);
  assert.match(source, /cb-week-task-content/);
  assert.match(source, /function shortPriorityLabel/);
  assert.match(source, /priority === "medium"\) return "med"/);
  assert.match(source, /shortPriorityLabel\(task\)/);
  assert.match(source, /taskContentLabel\(task\)/);
  assert.match(source, /cleanTaskContentText\(task\.rawLine\)/);
  assert.doesNotMatch(source, /Before anchor/);
});

test("renders parent long-task labels on week unscheduled child tasks", () => {
  const source = readFileSync("src/ui/pages/WeekPage.ts", "utf8");

  assert.match(source, /function renderParentLongTaskChip/);
  assert.match(source, /renderParentLongTaskChip\(meta, task\)/);
  assert.match(source, /parentLongTaskText/);
});

test("renders week recurring task counts without scheduled recurring task names", () => {
  const source = readFileSync("src/ui/pages/WeekPage.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const dayRow = source.slice(source.indexOf("function renderDayRow"), source.indexOf("function renderPoolTask"));

  assert.match(dayRow, /recurringTaskCount/);
  assert.match(dayRow, /recurringTaskMinutes/);
  assert.match(dayRow, /cb-week-day-summary/);
  assert.match(dayRow, /renderWeekSummaryMetric/);
  assert.match(dayRow, /cb-week-day-metric-label/);
  assert.match(dayRow, /cb-week-day-metric-value/);
  assert.match(dayRow, /cb-week-day-total/);
  assert.match(dayRow, /cb-recurring-compact-summary/);
  assert.match(dayRow, /repeat/);
  assert.doesNotMatch(dayRow, /tasks\$\{recurringSummary\} \|/);
  assert.doesNotMatch(dayRow, /renderScheduledTaskName\([^)]*recurring/i);
  assert.match(css, /\.cb-week-day-summary/);
  assert.match(css, /\.cb-week-day-metric/);
  assert.match(css, /\.cb-recurring-compact-summary/);
  assert.doesNotMatch(dayRow, /cb-recurring-summary/);
});

test("opens the source note when week task titles are clicked", () => {
  const source = readFileSync("src/ui/pages/WeekPage.ts", "utf8");
  const title = source.slice(source.indexOf("function renderTaskTitle"), source.indexOf("function renderEstimateControl"));
  const scheduled = source.slice(source.indexOf("function renderScheduledTaskName"), source.indexOf("function renderTaskTitle"));

  assert.match(title, /plugin: PersonalSchedulerPlugin/);
  assert.match(title, /addEventListener\("click", \(\) => void plugin\.openTaskSourceNote\(task\.id\)\)/);
  assert.match(source, /renderTaskTitle\(card, plugin, task\)/);
  assert.match(scheduled, /openTaskSourceNote\(task\.id\)/);
});
