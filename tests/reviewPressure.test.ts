import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildReviewPressureByDate, parseReviewFrontmatter } from "../src/services/ReviewPressure";

test("parses spaced-review frontmatter fields from markdown", () => {
  const note = parseReviewFrontmatter("Review/A.md", "---\n知识类型: 内化\n复习状态: 进行中\n下次复习: 2024-01-15\ndescription: alpha\n---\n正文");
  assert.equal(note?.knowledgeType, "内化");
  assert.equal(note?.status, "进行中");
  assert.equal(note?.nextReview, "2024-01-15");
  assert.equal(note?.contentChars, 2);
});

test("skips paused notes and assigns overdue pressure to today", () => {
  const notes = [
    parseReviewFrontmatter("Review/A.md", "---\n知识类型: 内化\n下次复习: 2024-01-14\n---\n" + "a".repeat(1600)),
    parseReviewFrontmatter("Review/B.md", "---\n知识类型: 内化\n复习状态: 暂停\n下次复习: 2024-01-15\n---\n" + "b".repeat(1600)),
    parseReviewFrontmatter("Review/C.md", "---\n知识类型: 内化\n下次复习: 2024-01-18\n---\n" + "c".repeat(800))
  ].filter(Boolean);

  const pressure = buildReviewPressureByDate(notes, {
    today: "2024-01-15",
    baseMinutes: 2,
    charsPerMinute: 800
  });

  assert.equal(pressure["2024-01-15"].count, 1);
  assert.equal(pressure["2024-01-15"].minutes, 4);
  assert.equal(pressure["2024-01-18"].count, 1);
  assert.equal(pressure["2024-01-18"].minutes, 3);
  assert.equal(pressure["2024-01-15"].minutes > pressure["2024-01-18"].minutes, true);
});
