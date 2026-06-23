import { strict as assert } from "node:assert";
import { test } from "node:test";
import { archiveCompletedTopLevelTasks } from "../src/services/TaskArchiveService";

test("moves completed top-level task blocks under an existing archive heading", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [ ] Keep active #task",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [ ] Incomplete child moves with parent",
    "  - [x] Done child moves with parent",
    "# 归档",
    "- [x] Old archived"
  ].join("\n"), "归档");

  assert.equal(archived.archivedCount, 1);
  assert.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "# 归档",
    "- [x] Old archived",
    "- [x] Done top #task [scheduled:: 2026-06-20]",
    "  - [ ] Incomplete child moves with parent",
    "  - [x] Done child moves with parent"
  ].join("\n"));
});

test("creates an archive heading when missing", () => {
  const archived = archiveCompletedTopLevelTasks([
    "# Plan",
    "- [x] Done top #task [context:: phone]",
    "  - [ ] Child moves too",
    "- [ ] Keep active #task"
  ].join("\n"), "归档");

  assert.equal(archived.archivedCount, 1);
  assert.equal(archived.content, [
    "# Plan",
    "- [ ] Keep active #task",
    "",
    "# 归档",
    "- [x] Done top #task [context:: phone]",
    "  - [ ] Child moves too"
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

test("does not re-archive completed blocks already under the archive heading", () => {
  const content = [
    "# Plan",
    "- [ ] Active top #task",
    "# 归档",
    "- [x] Old archived",
    "  - [ ] Old archived child"
  ].join("\n");
  const archived = archiveCompletedTopLevelTasks(content, "归档");

  assert.equal(archived.archivedCount, 0);
  assert.equal(archived.content, content);
});
