import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildScheduledDayFilePath,
  moveTaskLineToScheduledDayContent
} from "../src/services/TaskDateWriter";

test("builds YYYYMMDD daily file paths under configured scheduled folder", () => {
  assert.equal(
    buildScheduledDayFilePath("Calendar/Scheduled", "2026-06-18"),
    "Calendar/Scheduled/20260618.md"
  );
  assert.equal(
    buildScheduledDayFilePath("Calendar/Scheduled/", "2026-06-18"),
    "Calendar/Scheduled/20260618.md"
  );
});

test("moves a point task line into daily file content with scheduled fields", () => {
  const moved = moveTaskLineToScheduledDayContent({
    sourceContent: "# Inbox\n- [ ] First #task\n- [ ] Move me #task [context:: phone]\n- [ ] Last #task\n",
    sourceLineNumber: 2,
    targetContent: "# 20260618日\n",
    scheduledDate: "2026-06-18",
    defaultEstimateMinutes: 30,
    createdDate: "2026-06-18"
  });

  assert.equal(moved.sourceContent, "# Inbox\n- [ ] First #task\n- [ ] Last #task\n");
  assert.equal(
    moved.targetContent,
    "# 20260618日\n- [ ] Move me #task 30m [context:: phone] [created:: 2026-06-18] [scheduled:: 2026-06-18]\n"
  );
});
