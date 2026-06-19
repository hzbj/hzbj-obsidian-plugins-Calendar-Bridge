import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isPhaseTaskFilePath, scanMarkdownTasksFromText } from "../src/services/TaskScanner";

test("scans ordinary checkbox tasks outside phase notes for the unified unscheduled pool", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Plain checkbox\n- [ ] Task #task [scheduled:: 2024-01-14] [estimate:: 45m] [priority:: high]\n- [ ] Todo #todo\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.deepEqual(tasks.map((item) => item.text), ["Plain checkbox", "Task", "Todo"]);
  assert.equal(tasks[1].dates.scheduled, "2024-01-14");
  assert.equal(tasks[1].scheduleDate, "2024-01-14");
  assert.equal(tasks[1].estimateMinutes, 45);
  assert.deepEqual(tasks[1].metadata.priority, ["high"]);
  assert.equal(tasks[1].id, "Tasks.md:1");
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

test("classifies tasks by start field only", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    [
      "- [ ] Long task #task [start:: 2026-06-10] [due:: 2026-06-20] [progress:: 25%]",
      "- [ ] Started without end #task [start:: 2026-06-12]",
      "- [ ] Due-only point #task [due:: 2026-06-20]",
      "- [ ] Scheduled point #task [scheduled:: 2026-06-17]",
      "- [ ] Explicit type ignored #task [type:: long] [kind:: long] [task-kind:: long] [due:: 2026-06-21]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.equal(tasks[0].taskKind, "long");
  assert.equal(tasks[0].spanStart, "2026-06-10");
  assert.equal(tasks[0].spanEnd, "2026-06-20");
  assert.equal(tasks[0].progressPercent, 25);
  assert.equal(tasks[1].taskKind, "long");
  assert.equal(tasks[1].spanStart, "2026-06-12");
  assert.equal(tasks[1].spanEnd, undefined);
  assert.equal(tasks[2].taskKind, "point");
  assert.equal(tasks[2].spanStart, undefined);
  assert.equal(tasks[3].taskKind, "point");
  assert.equal(tasks[3].scheduleDate, "2026-06-17");
  assert.equal(tasks[3].spanStart, undefined);
  assert.equal(tasks[4].taskKind, "point");
  assert.equal(tasks[4].spanStart, undefined);
});

test("ignores explicit long task fields without start", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Long task #task [type:: long]\n- [ ] Long with due #task [kind:: long] [due:: 2026-06-20]\n- [ ] Other long #task [task-kind:: long] [start:: 2026-06-10]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.deepEqual(tasks.map((item) => item.taskKind), ["point", "point", "long"]);
  assert.deepEqual(tasks.map((item) => item.spanStart), [undefined, undefined, "2026-06-10"]);
  assert.deepEqual(tasks.map((item) => item.spanEnd), [undefined, undefined, undefined]);
});

test("does not use task section headings to classify long tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "Phase.md",
    [
      "## Long tasks",
      "- [ ] Heading only [priority:: P1] [progress:: 20%]",
      "- [ ] Started task [start:: 2026-06-10] [due:: 2026-06-20]",
      "## Point tasks",
      "- [ ] Point task [priority:: P2]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "phase-a" }
  );

  assert.deepEqual(tasks.map((item) => ({ text: item.text, kind: item.taskKind })), [
    { text: "Heading only", kind: "point" },
    { text: "Started task", kind: "long" },
    { text: "Point task", kind: "point" }
  ]);
  assert.equal(tasks[0].spanStart, undefined);
  assert.equal(tasks[0].spanEnd, undefined);
  assert.equal(tasks[0].priority, "P1");
  assert.equal(tasks[0].progressPercent, 20);
});

test("does not use phase-note nesting to classify long tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "规划/阶段/腾讯创作大赛.md",
    [
      "---",
      "phase: true",
      "phase-id: youxi",
      "---",
      "- [ ] Character design",
      "  - [ ] Collect references",
      "- [ ] Architecture review [start:: 2026-06-10]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "youxi" }
  );

  assert.deepEqual(tasks.map((item) => ({ text: item.text, kind: item.taskKind, phaseId: item.phaseId })), [
    { text: "Character design", kind: "point", phaseId: "youxi" },
    { text: "Collect references", kind: "point", phaseId: "youxi" },
    { text: "Architecture review", kind: "long", phaseId: "youxi" }
  ]);
});

test("assigns indented descendants to the nearest parent long task", () => {
  const tasks = scanMarkdownTasksFromText(
    "Plans.md",
    [
      "- [ ] Parent A [start:: 2026-06-10] [due:: 2026-06-20]",
      "  - [ ] Child point",
      "    - [ ] Grandchild point [scheduled:: 2026-06-13]",
      "  - [ ] Child long [start:: 2026-06-14] [due:: 2026-06-16]",
      "    - [ ] Nested under child long",
      "- [ ] Peer point",
      "  - [ ] No parent long child",
      "- [ ] Parent B [start:: 2026-07-01] [due:: 2026-07-10]",
      "\t- [ ] Tab child"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.deepEqual(tasks.map((item) => ({
    id: item.id,
    indentLevel: item.indentLevel,
    parentLongTaskId: item.parentLongTaskId,
    parentLongTaskText: item.parentLongTaskText,
    taskKind: item.taskKind
  })), [
    { id: "Plans.md:0", indentLevel: 0, parentLongTaskId: undefined, parentLongTaskText: undefined, taskKind: "long" },
    { id: "Plans.md:1", indentLevel: 2, parentLongTaskId: "Plans.md:0", parentLongTaskText: "Parent A", taskKind: "point" },
    { id: "Plans.md:2", indentLevel: 4, parentLongTaskId: "Plans.md:0", parentLongTaskText: "Parent A", taskKind: "point" },
    { id: "Plans.md:3", indentLevel: 2, parentLongTaskId: "Plans.md:0", parentLongTaskText: "Parent A", taskKind: "long" },
    { id: "Plans.md:4", indentLevel: 4, parentLongTaskId: "Plans.md:3", parentLongTaskText: "Child long", taskKind: "point" },
    { id: "Plans.md:5", indentLevel: 0, parentLongTaskId: undefined, parentLongTaskText: undefined, taskKind: "point" },
    { id: "Plans.md:6", indentLevel: 2, parentLongTaskId: undefined, parentLongTaskText: undefined, taskKind: "point" },
    { id: "Plans.md:7", indentLevel: 0, parentLongTaskId: undefined, parentLongTaskText: undefined, taskKind: "long" },
    { id: "Plans.md:8", indentLevel: 2, parentLongTaskId: "Plans.md:7", parentLongTaskText: "Parent B", taskKind: "point" }
  ]);
});

test("recognizes files inside phase folders as phase task files", () => {
  assert.equal(isPhaseTaskFilePath("规划/阶段/腾讯创作大赛.md"), true);
  assert.equal(isPhaseTaskFilePath("规划/代办/未排期任务池.md"), false);
  assert.equal(isPhaseTaskFilePath("规划/日/20260617.md"), false);
});

test("auto-detects existing long task ranges without trigger tags", () => {
  const tasks = scanMarkdownTasksFromText(
    "规划/阶段/腾讯创作大赛.md",
    "- [ ] Character design 30m [start:: 2026-06-10] [due:: 2026-06-19]\n- [ ] Same-day started task [start:: 2026-06-17] [due:: 2026-06-17]\n- [ ] Legacy span end [start:: 2026-06-20] [scheduled:: 2026-06-25]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );

  assert.deepEqual(tasks.map((item) => item.text), ["Character design", "Same-day started task", "Legacy span end"]);
  assert.deepEqual(tasks.map((item) => item.taskKind), ["long", "long", "long"]);
  assert.deepEqual(tasks.map((item) => item.spanStart), ["2026-06-10", "2026-06-17", "2026-06-20"]);
  assert.deepEqual(tasks.map((item) => item.spanEnd), ["2026-06-19", "2026-06-17", "2026-06-25"]);
});

test("ignores configured excluded path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "time-blocks-data/2024-01.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, excludedPathPrefixes: ["time-blocks-data/"] }
  );

  assert.equal(tasks.length, 0);
});

test("keeps full-vault scan behavior when included prefixes are empty", () => {
  const tasks = scanMarkdownTasksFromText(
    "Areas/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: [] }
  );

  assert.equal(tasks.length, 1);
});

test("scans only configured included path prefixes when present", () => {
  const included = scanMarkdownTasksFromText(
    "Areas/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: ["Areas/"] }
  );
  const outside = scanMarkdownTasksFromText(
    "Archive/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: ["Areas/"] }
  );

  assert.equal(included.length, 1);
  assert.equal(outside.length, 0);
});

test("excluded path prefixes override included path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Areas/Archive/Work.md",
    "- [ ] Task #task",
    {
      triggerTags: ["task"],
      readLegacyEmojiDates: true,
      forceExtract: false,
      includedPathPrefixes: ["Areas/"],
      excludedPathPrefixes: ["Areas/Archive/"]
    }
  );

  assert.equal(tasks.length, 0);
});
