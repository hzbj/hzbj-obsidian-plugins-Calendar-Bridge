// tests/taskArchiveModal.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/ui/TaskArchiveModal.ts
function groupArchiveCandidates(candidates) {
  const groups = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const folderPath = parentFolderPath(candidate.filePath);
    const group = groups.get(folderPath) ?? [];
    group.push(candidate);
    groups.set(folderPath, group);
  }
  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "Vault root" && right !== "Vault root")
      return -1;
    if (right === "Vault root" && left !== "Vault root")
      return 1;
    return left.localeCompare(right);
  }).map(([folderPath, groupCandidates]) => ({
    folderPath,
    folderName: folderName(folderPath),
    candidates: [...groupCandidates].sort((left, right) => left.fileName.localeCompare(right.fileName)),
    completedTopLevelCount: groupCandidates.reduce((sum, candidate) => sum + candidate.completedTopLevelCount, 0)
  }));
}
function parentFolderPath(filePath) {
  const index = filePath.lastIndexOf("/");
  return index < 0 ? "Vault root" : filePath.slice(0, index);
}
function folderName(folderPath) {
  if (folderPath === "Vault root")
    return folderPath;
  return folderPath.split("/").pop() ?? folderPath;
}

// tests/taskArchiveModal.test.ts
(0, import_node_test.test)("groups archive candidates by parent folder with counts", () => {
  const groups = groupArchiveCandidates([
    { filePath: "\u89C4\u5212/\u9636\u6BB5/\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md", fileName: "\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md", completedTopLevelCount: 1 },
    { filePath: "\u89C4\u5212/\u4EE3\u529E/\u4EE3\u529E\u4EFB\u52A1\u6C60.md", fileName: "\u4EE3\u529E\u4EFB\u52A1\u6C60.md", completedTopLevelCount: 2 },
    { filePath: "\u89C4\u5212/\u4EE3\u529E/\u5FAA\u73AF\u4EFB\u52A1\u6C60.md", fileName: "\u5FAA\u73AF\u4EFB\u52A1\u6C60.md", completedTopLevelCount: 5 },
    { filePath: "20260622.md", fileName: "20260622.md", completedTopLevelCount: 3 }
  ]);
  import_node_assert.strict.deepEqual(groups.map((group) => ({
    folderPath: group.folderPath,
    folderName: group.folderName,
    completedTopLevelCount: group.completedTopLevelCount,
    files: group.candidates.map((candidate) => candidate.fileName)
  })), [
    {
      folderPath: "Vault root",
      folderName: "Vault root",
      completedTopLevelCount: 3,
      files: ["20260622.md"]
    },
    {
      folderPath: "\u89C4\u5212/\u4EE3\u529E",
      folderName: "\u4EE3\u529E",
      completedTopLevelCount: 7,
      files: ["\u4EE3\u529E\u4EFB\u52A1\u6C60.md", "\u5FAA\u73AF\u4EFB\u52A1\u6C60.md"]
    },
    {
      folderPath: "\u89C4\u5212/\u9636\u6BB5",
      folderName: "\u9636\u6BB5",
      completedTopLevelCount: 1,
      files: ["\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md"]
    }
  ]);
});
