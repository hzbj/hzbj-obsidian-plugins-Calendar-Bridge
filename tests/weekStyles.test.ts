import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("keeps week day columns shrinkable inside the outer day row", () => {
  const css = readFileSync("styles.css", "utf8");
  const weekDayRow = css.slice(css.indexOf(".cb-week-day-row {"), css.indexOf(".cb-week-day-label {"));
  const pressurePane = css.slice(css.indexOf(".cb-week-pressure-pane {"), css.indexOf(".cb-task-pressure {"));

  assert.match(weekDayRow, /grid-template-columns: minmax\(0, 0\.62fr\) minmax\(0, 1\.35fr\) minmax\(0, 1fr\)/);
  assert.match(weekDayRow, /max-width: 100%/);
  assert.doesNotMatch(weekDayRow, /minmax\(\d+px/);
  assert.match(pressurePane, /overflow: hidden/);
  assert.match(pressurePane, /max-width: 100%/);
});
