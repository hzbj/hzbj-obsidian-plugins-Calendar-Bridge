import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { CalendarTask } from "../src/models/types";
import { isScheduledPointTask } from "../src/services/TaskPlanningGuards";

test("blocks only scheduled point tasks from long span planning", () => {
  assert.equal(isScheduledPointTask(task("point", { scheduled: "2026-06-20" })), true);
  assert.equal(isScheduledPointTask(task("long", { start: "2026-06-10", scheduled: "2026-06-20" })), false);
  assert.equal(isScheduledPointTask(task("point", {})), false);
});

function task(taskKind: CalendarTask["taskKind"], dates: CalendarTask["dates"]): CalendarTask {
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
    spanStart: taskKind === "long" ? dates.start : undefined,
    spanEnd: taskKind === "long" ? dates.scheduled : undefined,
    progressPercent: 0,
    dateSource: "none",
    triggerType: "inline"
  };
}
