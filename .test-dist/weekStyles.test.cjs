// tests/weekStyles.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("keeps week day columns shrinkable inside the outer day row", () => {
  const css = (0, import_node_fs.readFileSync)("styles.css", "utf8");
  const weekDayRow = css.slice(css.indexOf(".cb-week-day-row {"), css.indexOf(".cb-week-day-label {"));
  const pressurePane = css.slice(css.indexOf(".cb-week-pressure-pane {"), css.indexOf(".cb-task-pressure {"));
  import_node_assert.strict.match(weekDayRow, /grid-template-columns: minmax\(0, 0\.62fr\) minmax\(0, 1\.35fr\) minmax\(0, 1fr\)/);
  import_node_assert.strict.match(weekDayRow, /max-width: 100%/);
  import_node_assert.strict.doesNotMatch(weekDayRow, /minmax\(\d+px/);
  import_node_assert.strict.match(pressurePane, /overflow: hidden/);
  import_node_assert.strict.match(pressurePane, /max-width: 100%/);
});
