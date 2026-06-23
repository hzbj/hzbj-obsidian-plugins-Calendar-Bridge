// tests/pathSettings.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/utils/pathSettings.ts
var MOJIBAKE_PATH_REPAIRS = [
  ["\u7459\u52EB\u579D", "\u89C4\u5212"],
  ["\u95C3\u8235\uE18C", "\u9636\u6BB5"],
  ["\u6D60\uFF45\u59D9", "\u4EE3\u529E"],
  ["\u93C3?", "\u65E5"]
];
function normalizePathSetting(value) {
  let normalized = value.trim().replace(/\\/gu, "/");
  for (const [broken, fixed] of MOJIBAKE_PATH_REPAIRS) {
    normalized = normalized.split(broken).join(fixed);
  }
  return normalized.replace(/\/{2,}/gu, "/");
}
function splitPathCsv(value, fallback) {
  const parsed = value.split(",").map(normalizePathSetting).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback.map(normalizePathSetting);
}
function normalizeCalendarPathSettings(settings) {
  settings.includedPathPrefixes = settings.includedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.excludedPathPrefixes = settings.excludedPathPrefixes.map(normalizePathSetting).filter(Boolean);
  settings.scheduledDayFolder = normalizePathSetting(settings.scheduledDayFolder) || "Calendar/Scheduled";
  settings.archiveHeading = settings.archiveHeading?.trim() || "\u5F52\u6863";
  settings.scheduleInPlacePathPrefixes = (settings.scheduleInPlacePathPrefixes ?? ["\u89C4\u5212/\u9636\u6BB5"]).map(normalizePathSetting).filter(Boolean);
}
function matchesAnyPathPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}
function matchesPathPrefix(filePath, prefix) {
  const normalizedFilePath = normalizePathSetting(filePath);
  const normalizedPrefix = normalizePathSetting(prefix);
  if (!normalizedPrefix)
    return false;
  const folder = normalizedPrefix.replace(/\/$/u, "");
  return normalizedFilePath === folder || normalizedFilePath.startsWith(`${folder}/`);
}

// tests/pathSettings.test.ts
(0, import_node_test.test)("repairs mojibake path prefixes before scanning and saving settings", () => {
  import_node_assert.strict.equal(normalizePathSetting("\u7459\u52EB\u579D/"), "\u89C4\u5212/");
  import_node_assert.strict.deepEqual(splitPathCsv("\u7459\u52EB\u579D/, .trash/", []), ["\u89C4\u5212/", ".trash/"]);
});
(0, import_node_test.test)("normalizes calendar path settings in place", () => {
  const settings = {
    includedPathPrefixes: ["\u7459\u52EB\u579D/"],
    excludedPathPrefixes: ["time-blocks-data/", ".obsidian/"],
    scheduledDayFolder: "Calendar\\Scheduled"
  };
  normalizeCalendarPathSettings(settings);
  import_node_assert.strict.deepEqual(settings.includedPathPrefixes, ["\u89C4\u5212/"]);
  import_node_assert.strict.deepEqual(settings.excludedPathPrefixes, ["time-blocks-data/", ".obsidian/"]);
  import_node_assert.strict.equal(settings.scheduledDayFolder, "Calendar/Scheduled");
  import_node_assert.strict.equal(settings.archiveHeading, "\u5F52\u6863");
  import_node_assert.strict.deepEqual(settings.scheduleInPlacePathPrefixes, ["\u89C4\u5212/\u9636\u6BB5"]);
});
(0, import_node_test.test)("matches normalized schedule-in-place path prefixes", () => {
  import_node_assert.strict.equal(matchesAnyPathPrefix("\u89C4\u5212/\u9636\u6BB5/Project.md", ["\u89C4\u5212/\u9636\u6BB5"]), true);
  import_node_assert.strict.equal(matchesAnyPathPrefix("\u89C4\u5212/\u9636\u6BB5", ["\u89C4\u5212/\u9636\u6BB5"]), true);
  import_node_assert.strict.equal(matchesAnyPathPrefix("\u89C4\u5212/\u4EE3\u529E/Inbox.md", ["\u89C4\u5212/\u9636\u6BB5"]), false);
});
