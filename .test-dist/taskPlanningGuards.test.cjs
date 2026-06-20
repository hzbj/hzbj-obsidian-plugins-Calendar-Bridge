// tests/taskPlanningGuards.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/services/TaskPlanningGuards.ts
function isScheduledPointTask(task2) {
  return task2?.taskKind === "point" && Boolean(task2.dates.scheduled);
}

// tests/taskPlanningGuards.test.ts
(0, import_node_test.test)("blocks only scheduled point tasks from long span planning", () => {
  import_node_assert.strict.equal(isScheduledPointTask(task("point", { scheduled: "2026-06-20" })), true);
  import_node_assert.strict.equal(isScheduledPointTask(task("long", { start: "2026-06-10", scheduled: "2026-06-20" })), false);
  import_node_assert.strict.equal(isScheduledPointTask(task("point", {})), false);
});
function task(taskKind, dates) {
  return {
    id: "Tasks.md:1",
    text: "Task",
    filePath: "Tasks.md",
    lineNumber: 1,
    rawLine: "- [ ] Task",
    completed: false,
    metadata: {},
    dates,
    taskKind,
    indentLevel: 0,
    spanStart: taskKind === "long" ? dates.start : void 0,
    spanEnd: taskKind === "long" ? dates.scheduled : void 0,
    progressPercent: 0,
    dateSource: "none",
    triggerType: "inline"
  };
}
