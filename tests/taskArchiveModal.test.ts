import { strict as assert } from "node:assert";
import { test } from "node:test";
import { groupArchiveCandidates } from "../src/ui/TaskArchiveModal";

test("groups archive candidates by parent folder with counts", () => {
  const groups = groupArchiveCandidates([
    { filePath: "规划/阶段/腾讯创作大赛.md", fileName: "腾讯创作大赛.md", completedTopLevelCount: 1 },
    { filePath: "规划/代办/代办任务池.md", fileName: "代办任务池.md", completedTopLevelCount: 2 },
    { filePath: "规划/代办/循环任务池.md", fileName: "循环任务池.md", completedTopLevelCount: 5 },
    { filePath: "20260622.md", fileName: "20260622.md", completedTopLevelCount: 3 }
  ]);

  assert.deepEqual(groups.map((group) => ({
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
      folderPath: "规划/代办",
      folderName: "代办",
      completedTopLevelCount: 7,
      files: ["代办任务池.md", "循环任务池.md"]
    },
    {
      folderPath: "规划/阶段",
      folderName: "阶段",
      completedTopLevelCount: 1,
      files: ["腾讯创作大赛.md"]
    }
  ]);
});
