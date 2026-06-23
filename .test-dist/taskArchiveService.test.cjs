// tests/taskArchiveService.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/services/TaskArchiveService.ts
var TOP_LEVEL_COMPLETED_TASK_RE = /^[-*]\s+\[[xX]\]\s+/u;
function archiveCompletedTopLevelTasks(content, rawHeading) {
  const heading = normalizeArchiveHeading(rawHeading);
  const lines = content.split(/\r?\n/u);
  const originalHeadingInfo = findHeading(lines, heading);
  const originalArchiveStart = originalHeadingInfo ? originalHeadingInfo.index + 1 : -1;
  const originalArchiveEnd = originalHeadingInfo ? findHeadingSectionEnd(lines, originalHeadingInfo.index, originalHeadingInfo.level) : -1;
  const moved = [];
  const kept = lines.filter((line, index) => {
    if (index >= originalArchiveStart && index < originalArchiveEnd)
      return true;
    if (!TOP_LEVEL_COMPLETED_TASK_RE.test(line))
      return true;
    moved.push(line);
    return false;
  });
  if (moved.length === 0)
    return { content, archivedCount: 0 };
  const headingInfo = findHeading(kept, heading);
  if (!headingInfo) {
    const base = trimTrailingBlankLines(kept);
    return {
      content: [...base, "", `# ${heading}`, ...moved].join("\n"),
      archivedCount: moved.length
    };
  }
  const insertIndex = findHeadingSectionEnd(kept, headingInfo.index, headingInfo.level);
  const before = trimTrailingBlankLines(kept.slice(0, insertIndex));
  const after = kept.slice(insertIndex);
  return {
    content: [...before, ...moved, ...after].join("\n"),
    archivedCount: moved.length
  };
}
function normalizeArchiveHeading(raw) {
  return raw.trim().replace(/^#+\s*/u, "").trim() || "\u5F52\u6863";
}
function findHeading(lines, heading) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match)
      continue;
    if (match[2].trim() === heading)
      return { index, level: match[1].length };
  }
  return void 0;
}
function findHeadingSectionEnd(lines, headingIndex, headingLevel) {
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/u);
    if (match && match[1].length <= headingLevel)
      return index;
  }
  return lines.length;
}
function trimTrailingBlankLines(lines) {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  return trimmed;
}

// tests/taskArchiveService.test.ts
(0, import_node_test.test)("moves completed top-level tasks under an existing archive heading", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [ ] Keep active #task",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [x] Done child stays",
    "# \u5F52\u6863",
    "- [x] Old archived"
  ].join("\n"), "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 1);
  import_node_assert.strict.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "  - [x] Done child stays",
    "# \u5F52\u6863",
    "- [x] Old archived",
    "- [x] Done top #task [scheduled:: 2026-06-20]"
  ].join("\n"));
});
(0, import_node_test.test)("creates an archive heading when missing", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [x] Done top #task [context:: phone]",
    "- [ ] Keep active #task"
  ].join("\n"), "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 1);
  import_node_assert.strict.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "",
    "# \u5F52\u6863",
    "- [x] Done top #task [context:: phone]"
  ].join("\n"));
});
(0, import_node_test.test)("ignores incomplete tasks and completed subtasks", () => {
  const content = [
    "# Plan",
    "- [ ] Active top #task",
    "  - [x] Done child",
    "	- [x] Done tab child"
  ].join("\n");
  const archived = archiveCompletedTopLevelTasks(content, "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 0);
  import_node_assert.strict.equal(archived.content, content);
});
