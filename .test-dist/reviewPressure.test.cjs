// tests/reviewPressure.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/services/ReviewPressure.ts
function parseReviewFrontmatter(filePath, content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match)
    return null;
  const frontmatter = parseSimpleYaml(match[1]);
  const knowledgeType = frontmatter["\u77E5\u8BC6\u7C7B\u578B"];
  const status = frontmatter["\u590D\u4E60\u72B6\u6001"];
  const nextReview = frontmatter["\u4E0B\u6B21\u590D\u4E60"];
  const description = frontmatter.description;
  if (!knowledgeType && !nextReview)
    return null;
  return {
    filePath,
    knowledgeType,
    status,
    nextReview,
    description,
    contentChars: countContentChars(match[2])
  };
}
function buildReviewPressureByDate(notes, options) {
  const pressure = {};
  const charsPerMinute = Math.max(1, options.charsPerMinute);
  for (const note of notes) {
    if (!note || note.knowledgeType !== "\u5185\u5316" || note.status === "\u6682\u505C" || !note.nextReview)
      continue;
    const date = note.nextReview < options.today ? options.today : note.nextReview;
    const minutes = Math.max(1, options.baseMinutes) + Math.ceil(note.contentChars / charsPerMinute);
    const current = pressure[date] ?? { count: 0, minutes: 0, chars: 0 };
    pressure[date] = {
      count: current.count + 1,
      minutes: current.minutes + minutes,
      chars: current.chars + note.contentChars
    };
  }
  return pressure;
}
function parseSimpleYaml(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/u)) {
    const match = line.match(/^([^:#][^:]*):\s*(.*?)\s*$/u);
    if (!match)
      continue;
    values[match[1].trim()] = String(match[2]).replace(/^["']|["']$/gu, "").trim();
  }
  return values;
}
function countContentChars(body) {
  return body.replace(/\s+/gu, "").length;
}

// tests/reviewPressure.test.ts
(0, import_node_test.test)("parses spaced-review frontmatter fields from markdown", () => {
  const note = parseReviewFrontmatter("Review/A.md", "---\n\u77E5\u8BC6\u7C7B\u578B: \u5185\u5316\n\u590D\u4E60\u72B6\u6001: \u8FDB\u884C\u4E2D\n\u4E0B\u6B21\u590D\u4E60: 2024-01-15\ndescription: alpha\n---\n\u6B63\u6587");
  import_node_assert.strict.equal(note?.knowledgeType, "\u5185\u5316");
  import_node_assert.strict.equal(note?.status, "\u8FDB\u884C\u4E2D");
  import_node_assert.strict.equal(note?.nextReview, "2024-01-15");
  import_node_assert.strict.equal(note?.contentChars, 2);
});
(0, import_node_test.test)("skips paused notes and assigns overdue pressure to today", () => {
  const notes = [
    parseReviewFrontmatter("Review/A.md", "---\n\u77E5\u8BC6\u7C7B\u578B: \u5185\u5316\n\u4E0B\u6B21\u590D\u4E60: 2024-01-14\n---\n" + "a".repeat(1600)),
    parseReviewFrontmatter("Review/B.md", "---\n\u77E5\u8BC6\u7C7B\u578B: \u5185\u5316\n\u590D\u4E60\u72B6\u6001: \u6682\u505C\n\u4E0B\u6B21\u590D\u4E60: 2024-01-15\n---\n" + "b".repeat(1600)),
    parseReviewFrontmatter("Review/C.md", "---\n\u77E5\u8BC6\u7C7B\u578B: \u5185\u5316\n\u4E0B\u6B21\u590D\u4E60: 2024-01-18\n---\n" + "c".repeat(800))
  ].filter(Boolean);
  const pressure = buildReviewPressureByDate(notes, {
    today: "2024-01-15",
    baseMinutes: 2,
    charsPerMinute: 800
  });
  import_node_assert.strict.equal(pressure["2024-01-15"].count, 1);
  import_node_assert.strict.equal(pressure["2024-01-15"].minutes, 4);
  import_node_assert.strict.equal(pressure["2024-01-18"].count, 1);
  import_node_assert.strict.equal(pressure["2024-01-18"].minutes, 3);
  import_node_assert.strict.equal(pressure["2024-01-15"].minutes > pressure["2024-01-18"].minutes, true);
});
