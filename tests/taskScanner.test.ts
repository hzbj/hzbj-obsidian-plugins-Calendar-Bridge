import { strict as assert } from "node:assert";
import { test } from "node:test";
import { scanMarkdownTasksFromText } from "../src/services/TaskScanner";

test("scans only trigger-tagged checkbox tasks outside phase notes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Plain checkbox\n- [ ] Task #task [scheduled:: 2024-01-14] [estimate:: 45m] [priority:: high]\n- [ ] Todo #todo\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.deepEqual(tasks.map((item) => item.text), ["Task", "Todo"]);
  assert.equal(tasks[0].dates.scheduled, "2024-01-14");
  assert.equal(tasks[0].scheduleDate, "2024-01-14");
  assert.equal(tasks[0].estimateMinutes, 45);
  assert.deepEqual(tasks[0].metadata.priority, ["high"]);
  assert.equal(tasks[0].id, "Tasks.md:1");
});

test("force scans all checkbox tasks in Task-Maker phase notes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Phase.md",
    "- [ ] Phase task without trigger\n- [x] Completed phase task\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "pm" }
  );

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].triggerType, "phase-note");
  assert.equal(tasks[0].phaseId, "pm");
  assert.equal(tasks[1].completed, true);
});

test("classifies start plus due tasks as long tasks and scheduled-only tasks as point tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Long task #task [start:: 2026-06-10] [due:: 2026-06-20] [progress:: 25%]\n- [ ] Point task #task [scheduled:: 2026-06-17]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.equal(tasks[0].taskKind, "long");
  assert.equal(tasks[0].spanStart, "2026-06-10");
  assert.equal(tasks[0].spanEnd, "2026-06-20");
  assert.equal(tasks[0].progressPercent, 25);
  assert.equal(tasks[1].taskKind, "point");
  assert.equal(tasks[1].scheduleDate, "2026-06-17");
  assert.equal(tasks[1].spanStart, undefined);
});

test("ignores configured excluded path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "time-blocks-data/2024-01.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, excludedPathPrefixes: ["time-blocks-data/"] }
  );

  assert.equal(tasks.length, 0);
});
