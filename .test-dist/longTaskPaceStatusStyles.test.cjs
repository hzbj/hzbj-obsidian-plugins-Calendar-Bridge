// tests/longTaskPaceStatusStyles.test.ts
var import_node_assert = require("node:assert");
var import_node_fs = require("node:fs");
var import_node_test = require("node:test");
(0, import_node_test.test)("renders long-task pace status chips with status-specific highlight classes", () => {
  const monthPage = (0, import_node_fs.readFileSync)("src/ui/pages/MonthPage.ts", "utf8");
  import_node_assert.strict.match(monthPage, /cb-pace-status-\$\{row\.status\}/);
});
(0, import_node_test.test)("maps long-task pace status highlights to requested colors", () => {
  const css = (0, import_node_fs.readFileSync)("styles.css", "utf8");
  import_node_assert.strict.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-behind\s*\{[\s\S]*color:\s*var\(--text-error\)/);
  import_node_assert.strict.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-ahead\s*\{[\s\S]*color:\s*var\(--text-success\)/);
  import_node_assert.strict.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-on-track\s*\{[\s\S]*color:\s*var\(--text-accent\)/);
});
