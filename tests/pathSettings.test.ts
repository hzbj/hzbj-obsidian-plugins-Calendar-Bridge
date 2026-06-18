import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalizeCalendarPathSettings, normalizePathSetting, splitPathCsv } from "../src/utils/pathSettings";
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
});
