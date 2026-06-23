import { strict as assert } from "node:assert";
import { test } from "node:test";
import { matchesAnyPathPrefix, normalizeCalendarPathSettings, normalizePathSetting, splitPathCsv } from "../src/utils/pathSettings";
import type { CalendarSettings } from "../src/models/types";

test("repairs mojibake path prefixes before scanning and saving settings", () => {
  assert.equal(normalizePathSetting("瑙勫垝/"), "规划/");
  assert.deepEqual(splitPathCsv("瑙勫垝/, .trash/", []), ["规划/", ".trash/"]);
});

test("normalizes calendar path settings in place", () => {
  const settings = {
    includedPathPrefixes: ["瑙勫垝/"],
    excludedPathPrefixes: ["time-blocks-data/", ".obsidian/"],
    scheduledDayFolder: "Calendar\\Scheduled"
  } as CalendarSettings;

  normalizeCalendarPathSettings(settings);

  assert.deepEqual(settings.includedPathPrefixes, ["规划/"]);
  assert.deepEqual(settings.excludedPathPrefixes, ["time-blocks-data/", ".obsidian/"]);
  assert.equal(settings.scheduledDayFolder, "Calendar/Scheduled");
  assert.equal(settings.archiveHeading, "归档");
  assert.deepEqual(settings.scheduleInPlacePathPrefixes, ["规划/阶段"]);
});

test("matches normalized schedule-in-place path prefixes", () => {
  assert.equal(matchesAnyPathPrefix("规划/阶段/Project.md", ["规划/阶段"]), true);
  assert.equal(matchesAnyPathPrefix("规划/阶段", ["规划/阶段"]), true);
  assert.equal(matchesAnyPathPrefix("规划/代办/Inbox.md", ["规划/阶段"]), false);
});
