import { strict as assert } from "node:assert";
import { test } from "node:test";
import { archiveCompletedTopLevelTasks } from "../src/services/TaskArchiveService";

test("moves completed top-level tasks under an existing archive heading", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [ ] Keep active #task",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [x] Done child stays",
    "# 归档",
    "- [x] Old archived"
  ].join("\n"), "归档");

  assert.equal(archived.archivedCount, 1);
  assert.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "  - [x] Done child stays",
    "# 归档",
    "- [x] Old archived",
    "- [x] Done top #task [scheduled:: 2026-06-20]"
  ].join("\n"));
});

test("creates an archive heading when missing", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [x] Done top #task [context:: phone]",
    "- [ ] Keep active #task"
  ].join("\n"), "归档");

  assert.equal(archived.archivedCount, 1);
  assert.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "",
    "# 归档",
    "- [x] Done top #task [context:: phone]"
  ].join("\n"));
});

test("ignores incomplete tasks and completed subtasks", () => {
  const content = [
    "# Plan",
    "- [ ] Active top #task",
    "  - [x] Done child",
    "\t- [x] Done tab child"
  ].join("\n");
  const archived = archiveCompletedTopLevelTasks(content, "归档");

  assert.equal(archived.archivedCount, 0);
  assert.equal(archived.content, content);
});
