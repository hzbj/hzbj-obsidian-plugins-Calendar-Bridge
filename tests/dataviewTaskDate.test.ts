import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cleanTaskContentText,
  cleanTaskDisplayText,
  extractTaskMetadata,
  parseDurationToMinutes,
  clearTaskScheduleDates,
  normalizeTaskPriority,
  setTaskPriority,
  setTaskEstimate,
  setTaskProgress,
  setPointTaskSchedule,
  setTaskScheduleDate,
  setTaskSpanDates
} from "../src/utils/DataviewTaskDate";

test("parses arbitrary Dataview inline fields and normalized task metadata", () => {
  const parsed = extractTaskMetadata(
    "- [ ] Review #task [due:: 2024-01-14] [scheduled:: 2024-01-15] [start:: 2024-01-13] [estimate:: 1h30m] [priority:: high] [project:: Home]",
    true
  );
  assert.deepEqual(parsed.metadata.due, ["2024-01-14"]);
  assert.deepEqual(parsed.metadata.project, ["Home"]);
  assert.equal(parsed.dates.due, "2024-01-14");
  assert.equal(parsed.dates.scheduled, "2024-01-15");
  assert.equal(parsed.dates.start, "2024-01-13");
  assert.equal(parsed.scheduleDate, "2024-01-15");
  assert.equal(parsed.spanStart, "2024-01-13");
  assert.equal(parsed.spanEnd, "2024-01-14");
  assert.equal(parsed.estimateMinutes, 90);
  assert.equal(parsed.priority, "high");
  assert.equal(parsed.dateSource, "dataview");
});

test("parses plain estimate, created date, and manual progress fields", () => {
  const parsed = extractTaskMetadata(
    "- [ ] 个人毕业照打包发送 1h #task [created:: 2026-06-17] [scheduled:: 2026-06-17] [due:: 2026-06-17] [progress:: 40%]",
    true
  );
  assert.equal(parsed.plainEstimateMinutes, 60);
  assert.equal(parsed.estimateMinutes, 60);
  assert.equal(parsed.createdDate, "2026-06-17");
  assert.equal(parsed.progressPercent, 40);
  assert.equal(parsed.dates.scheduled, "2026-06-17");
  assert.equal(parsed.dates.due, "2026-06-17");
});

test("parses legacy emoji date when compatibility is enabled", () => {
  const parsed = extractTaskMetadata("- [ ] Task #task 📅 2024-01-14", true);
  assert.equal(parsed.dates.due, "2024-01-14");
  assert.equal(parsed.scheduleDate, "2024-01-14");
  assert.equal(parsed.dateSource, "emoji");
});

test("prefers Dataview scheduled over due and legacy emoji dates", () => {
  const parsed = extractTaskMetadata("- [ ] Task #task [due:: 2024-01-14] [scheduled:: 2024-01-16] 📅 2024-01-15", true);
  assert.equal(parsed.dates.due, "2024-01-14");
  assert.equal(parsed.dates.scheduled, "2024-01-16");
  assert.equal(parsed.scheduleDate, "2024-01-16");
  assert.equal(parsed.dateSource, "dataview");
});

test("parses common estimate formats", () => {
  assert.equal(parseDurationToMinutes("60"), 60);
  assert.equal(parseDurationToMinutes("60m"), 60);
  assert.equal(parseDurationToMinutes("60 min"), 60);
  assert.equal(parseDurationToMinutes("1h"), 60);
  assert.equal(parseDurationToMinutes("1 h"), 60);
  assert.equal(parseDurationToMinutes("1h30m"), 90);
  assert.equal(parseDurationToMinutes("1 h 30 m"), 90);
  assert.equal(parseDurationToMinutes("1.5h"), 90);
});

test("writes scheduled date without disturbing task content", () => {
  assert.equal(
    setTaskScheduleDate("- [ ] Check NAS #task ⏰ 21:00 [priority:: high]", "2024-01-14"),
    "- [ ] Check NAS #task ⏰ 21:00 [priority:: high] [scheduled:: 2024-01-14]"
  );
});

test("writes point task schedule with plain estimate, created, scheduled, and due fields", () => {
  assert.equal(
    setPointTaskSchedule("- [ ] 个人毕业照打包发送 #task [priority:: high]", "2026-06-17", 60, "2026-06-17"),
    "- [ ] 个人毕业照打包发送 #task 1h [priority:: high] [created:: 2026-06-17] [scheduled:: 2026-06-17] [due:: 2026-06-17]"
  );
});

test("point task schedule preserves existing created and estimate values", () => {
  assert.equal(
    setPointTaskSchedule(
      "- [ ] 个人毕业照打包发送 45m #task [created:: 2026-06-10] [scheduled:: 2026-06-12] [due:: 2026-06-12] [context:: phone]",
      "2026-06-17",
      60,
      "2026-06-17"
    ),
    "- [ ] 个人毕业照打包发送 45m #task [created:: 2026-06-10] [context:: phone] [scheduled:: 2026-06-17] [due:: 2026-06-17]"
  );
});

test("point task schedule clears stale start field and writes only point date fields", () => {
  const updated = setPointTaskSchedule(
    "- [ ] Point #task [start:: 2026-06-10] [scheduled:: 2026-06-12] [due:: 2026-06-12] [context:: desk]",
    "2026-06-17",
    30,
    "2026-06-17"
  );

  assert.equal(updated, "- [ ] Point #task 30m [context:: desk] [created:: 2026-06-17] [scheduled:: 2026-06-17] [due:: 2026-06-17]");
});

test("replaces existing scheduled date while preserving other metadata", () => {
  assert.equal(
    setTaskScheduleDate("\t- [ ] Check NAS #task [scheduled:: 2024-01-13] [due:: 2024-01-12] ⏰ 21:00", "2024-01-14"),
    "\t- [ ] Check NAS #task [due:: 2024-01-12] ⏰ 21:00 [scheduled:: 2024-01-14]"
  );
});

test("writes span dates and estimate without removing other fields", () => {
  assert.equal(
    setTaskSpanDates("- [ ] A  B #task [start:: 2024-01-10] [estimate:: 30m] [context:: phone]", "2024-01-14", "2024-01-18"),
    "- [ ] A  B #task #长任务 [estimate:: 30m] [context:: phone] [start:: 2024-01-14] [due:: 2024-01-18]"
  );
  assert.equal(
    setTaskSpanDates("- [ ] A #task [scheduled:: 2024-01-12] [context:: phone]", "2024-01-14", "2024-01-18"),
    "- [ ] A #task #长任务 [context:: phone] [start:: 2024-01-14] [due:: 2024-01-18]"
  );
  assert.equal(
    setTaskEstimate("- [ ] A  B #task [estimate:: 30m] [scheduled:: 2024-01-18]", 75),
    "- [ ] A  B #task [scheduled:: 2024-01-18] [estimate:: 75m]"
  );
});

test("long task span syncs the long-task tag without duplicating it", () => {
  assert.equal(
    setTaskSpanDates("- [ ] A #task #keep #长任务 [context:: phone]", "2024-01-14", "2024-01-18"),
    "- [ ] A #task #keep #长任务 [context:: phone] [start:: 2024-01-14] [due:: 2024-01-18]"
  );
});

test("estimate and progress writeback preserve unrelated Dataview fields", () => {
  assert.equal(
    setTaskEstimate("- [ ] A #task [context:: phone] [estimate:: 30m] [progress:: 40%]", 75),
    "- [ ] A #task [context:: phone] [progress:: 40%] [estimate:: 75m]"
  );
  assert.equal(
    setTaskProgress("- [ ] A #task [context:: phone] [estimate:: 75m] [progress:: 40%]", 65),
    "- [ ] A #task [context:: phone] [estimate:: 75m] [progress:: 65%]"
  );
});

test("clears all schedule dates while preserving estimate and other metadata", () => {
  assert.equal(
    clearTaskScheduleDates("- [ ] A #task [due:: 2024-01-10] [start:: 2024-01-11] [scheduled:: 2024-01-12] [estimate:: 75m] 📅 2024-01-09 [context:: phone]"),
    "- [ ] A #task [estimate:: 75m] [context:: phone]"
  );
});

test("clearing schedule removes only the long-task sync tag", () => {
  assert.equal(
    clearTaskScheduleDates("- [ ] A #task #keep #长任务 [start:: 2024-01-11] [due:: 2024-01-12] [context:: phone]"),
    "- [ ] A #task #keep [context:: phone]"
  );
});

test("clearing schedule preserves priority, progress, estimate, and unrelated Dataview fields", () => {
  assert.equal(
    clearTaskScheduleDates("- [ ] Long #task [start:: 2026-06-10] [due:: 2026-06-20] [scheduled:: 2026-06-12] [priority:: P1] [progress:: 40%] [estimate:: 90m] [context:: desk] 📅 2026-06-11"),
    "- [ ] Long #task [priority:: P1] [progress:: 40%] [estimate:: 90m] [context:: desk]"
  );
});

test("normalizes and writes task priority without disturbing unrelated fields", () => {
  assert.equal(normalizeTaskPriority("highest"), "highest");
  assert.equal(normalizeTaskPriority("P1"), "highest");
  assert.equal(normalizeTaskPriority("1"), "highest");
  assert.equal(normalizeTaskPriority("high"), "high");
  assert.equal(normalizeTaskPriority("P2"), "high");
  assert.equal(normalizeTaskPriority("2"), "high");
  assert.equal(normalizeTaskPriority("normal"), "medium");
  assert.equal(normalizeTaskPriority("medium"), "medium");
  assert.equal(normalizeTaskPriority("P3"), "medium");
  assert.equal(normalizeTaskPriority("3"), "medium");
  assert.equal(normalizeTaskPriority("low"), "low");
  assert.equal(normalizeTaskPriority("lowest"), "low");
  assert.equal(normalizeTaskPriority("P4"), "low");
  assert.equal(normalizeTaskPriority("4"), "low");
  assert.equal(normalizeTaskPriority("unknown"), undefined);
  assert.equal(
    setTaskPriority("- [ ] A #task [context:: phone] [priority:: P1] [progress:: 40%]", "highest"),
    "- [ ] A #task [context:: phone] [progress:: 40%] [priority:: highest]"
  );
});

test("clean display text removes trigger tags and Dataview fields", () => {
  assert.equal(
    cleanTaskDisplayText("- [ ] A  B #task [scheduled:: 2024-01-18] [estimate:: 75m] #keep", ["task", "todo"]),
    "A B #keep"
  );
  assert.equal(
    cleanTaskDisplayText("- [ ] Long #task #长任务 #keep [start:: 2024-01-18] [due:: 2024-01-20]", ["task", "todo"]),
    "Long #keep"
  );
});

test("clean content text removes all tags, fields, dates, and plain estimates", () => {
  assert.equal(
    cleanTaskContentText("- [ ] A  B #task #T/phase-ui 45m [scheduled:: 2024-01-18] [priority:: P1] 馃搮 2024-01-18"),
    "A B"
  );
});
