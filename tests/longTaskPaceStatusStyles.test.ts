import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("renders long-task pace status chips with status-specific highlight classes", () => {
  const monthPage = readFileSync("src/ui/pages/MonthPage.ts", "utf8");

  assert.match(monthPage, /cb-pace-status-\$\{row\.status\}/);
});

test("maps long-task pace status highlights to requested colors", () => {
  const css = readFileSync("styles.css", "utf8");

  assert.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-behind\s*\{[\s\S]*color:\s*var\(--text-error\)/);
  assert.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-ahead\s*\{[\s\S]*color:\s*var\(--text-success\)/);
  assert.match(css, /\.cb-long-vertical-bar \.cb-chip\.cb-pace-status-on-track\s*\{[\s\S]*color:\s*var\(--text-accent\)/);
});
