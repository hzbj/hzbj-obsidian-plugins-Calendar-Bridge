import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("renders week unscheduled pool with source grouping, sorting, and priority display", () => {
  const source = readFileSync("src/ui/pages/WeekPage.ts", "utf8");

  assert.match(source, /buildSourceTaskGroups/);
  assert.match(source, /function renderSourceGroup/);
  assert.match(source, /function renderSortToggle/);
  assert.match(source, /cb-priority-chip/);
  assert.match(source, /cb-priority-marker/);
  assert.match(source, /cb-week-task-list/);
  assert.match(source, /cb-week-priority cb-priority-marker/);
  assert.match(source, /cb-week-task-content/);
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
