import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("keeps week day columns shrinkable inside the outer day row", () => {
  const css = readFileSync("styles.css", "utf8");
  const weekDayRow = css.slice(css.indexOf(".cb-week-day-row {"), css.indexOf(".cb-week-day-label {"));
  const pressurePane = css.slice(css.indexOf(".cb-week-pressure-pane {"), css.indexOf(".cb-task-pressure {"));
  const dayLabel = css.slice(css.indexOf(".cb-week-day-label {"), css.indexOf(".cb-week-pressure-pane {"));

  assert.match(weekDayRow, /grid-template-columns: minmax\(0, 0\.62fr\) minmax\(0, 1\.35fr\) minmax\(0, 1fr\)/);
  assert.match(weekDayRow, /max-width: 100%/);
  assert.doesNotMatch(weekDayRow, /minmax\(\d+px/);
  assert.match(dayLabel, /\.cb-week-day-summary/);
  assert.match(dayLabel, /display:\s*flex/);
  assert.match(dayLabel, /flex-wrap:\s*wrap/);
  assert.match(dayLabel, /\.cb-week-day-metric/);
  assert.match(dayLabel, /display:\s*inline-flex/);
  assert.match(dayLabel, /white-space:\s*nowrap/);
  assert.doesNotMatch(dayLabel, /overflow-wrap:\s*anywhere/);
  assert.match(pressurePane, /overflow: hidden/);
  assert.match(pressurePane, /max-width: 100%/);
});
