// tests/taskArchiveService.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/services/TaskArchiveService.ts
var TOP_LEVEL_COMPLETED_TASK_RE = /^[-*]\s+\[[xX]\]\s+/u;
var CHECKBOX_TASK_RE = /^(\s*)[-*]\s+\[([ xX])\]\s+/u;
function archiveCompletedTopLevelTasks(content, rawHeading) {
  const heading = normalizeArchiveHeading(rawHeading);
  const lines = content.split(/\r?\n/u);
  const originalHeadingInfo = findHeading(lines, heading);
  const originalArchiveStart = originalHeadingInfo ? originalHeadingInfo.index + 1 : -1;
  const originalArchiveEnd = originalHeadingInfo ? findHeadingSectionEnd(lines, originalHeadingInfo.index, originalHeadingInfo.level) : -1;
  const moved = [];
  let archivedCount = 0;
  const kept = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (index >= originalArchiveStart && index < originalArchiveEnd) {
      kept.push(line);
      index += 1;
      continue;
    }
    if (!isCompletedTopLevelTask(line)) {
      kept.push(line);
      index += 1;
      continue;
    }
    const blockEnd = findTaskBlockEnd(lines, index, 0);
    moved.push(...lines.slice(index, blockEnd));
    archivedCount += 1;
    index = blockEnd;
  }
  if (moved.length === 0)
    return { content, archivedCount: 0 };
  const headingInfo = findHeading(kept, heading);
  if (!headingInfo) {
    const base = trimTrailingBlankLines(kept);
    return {
      content: [...base, "", `# ${heading}`, ...moved].join("\n"),
      archivedCount
    };
  }
  const insertIndex = findHeadingSectionEnd(kept, headingInfo.index, headingInfo.level);
  const before = trimTrailingBlankLines(kept.slice(0, insertIndex));
  const after = kept.slice(insertIndex);
  return {
    content: [...before, ...moved, ...after].join("\n"),
    archivedCount
  };
}
function normalizeArchiveHeading(raw) {
  return raw.trim().replace(/^#+\s*/u, "").trim() || "\u5F52\u6863";
}
function isCompletedTopLevelTask(line) {
  return TOP_LEVEL_COMPLETED_TASK_RE.test(line);
}
function findTaskBlockEnd(lines, taskIndex, parentIndent) {
  for (let index = taskIndex + 1; index < lines.length; index += 1) {
    if (/^(#{1,6})\s+/u.test(lines[index]))
      return index;
    const task = lines[index].match(CHECKBOX_TASK_RE);
    if (task && countIndentColumns(task[1]) <= parentIndent)
      return index;
  }
  return lines.length;
}
function countIndentColumns(indent) {
  return [...indent].reduce((columns, char) => columns + (char === "	" ? 2 : 1), 0);
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
(0, import_node_test.test)("moves completed top-level task blocks under an existing archive heading", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [ ] Keep active #task",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [ ] Incomplete child moves with parent",
    "  - [x] Done child moves with parent",
    "# \u5F52\u6863",
    "- [x] Old archived"
  ].join("\n"), "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 1);
  import_node_assert.strict.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "# \u5F52\u6863",
    "- [x] Old archived",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [ ] Incomplete child moves with parent",
    "  - [x] Done child moves with parent"
  ].join("\n"));
});
(0, import_node_test.test)("creates an archive heading when missing", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [x] Done top #task [context:: phone]",
    "  - [ ] Child moves too",
    "- [ ] Keep active #task"
  ].join("\n"), "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 1);
  import_node_assert.strict.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "",
    "# \u5F52\u6863",
    "- [x] Done top #task [context:: phone]",
    "  - [ ] Child moves too"
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
(0, import_node_test.test)("does not re-archive completed blocks already under the archive heading", () => {
  const content = [
    "# Plan",
    "- [ ] Active top #task",
    "# \u5F52\u6863",
    "- [x] Old archived",
    "  - [ ] Old archived child"
  ].join("\n");
  const archived = archiveCompletedTopLevelTasks(content, "\u5F52\u6863");
  import_node_assert.strict.equal(archived.archivedCount, 0);
  import_node_assert.strict.equal(archived.content, content);
});
