// tests/taskScanner.test.ts
var import_node_assert = require("node:assert");
var import_node_test = require("node:test");

// src/utils/DataviewTaskDate.ts
var INLINE_FIELD_RE = /\[([^\[\]\n:]+)::\s*([^\]\n]*)\]/gu;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
var LEGACY_EMOJI_DATE_RE = /\s*(?:📅|馃搮)\s*(\d{4}-\d{2}-\d{2})\s*/u;
var DATE_FIELDS = ["due", "scheduled", "start", "completion", "created"];
function extractTaskMetadata(line, readLegacyEmojiDates) {
  const metadata = {};
  const dates = {};
  const dateSources = {};
  for (const match of line.matchAll(INLINE_FIELD_RE)) {
    const key = normalizeFieldKey(match[1]);
    const value = match[2].trim();
    if (!metadata[key])
      metadata[key] = [];
    metadata[key].push(value);
    if (isDateField(key) && DATE_RE.test(value)) {
      dates[key] = value;
      dateSources[key] = "dataview";
    }
  }
  if (!dates.due && readLegacyEmojiDates) {
    const legacy = line.match(LEGACY_EMOJI_DATE_RE);
    if (legacy) {
      dates.due = legacy[1];
      dateSources.due = "emoji";
    }
  }
  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const scheduleSource = scheduleDate ? dateSources.scheduled ?? dateSources.due ?? dateSources.start ?? "none" : "none";
  const plainEstimateMinutes = extractPlainEstimateMinutes(line);
  const estimateMinutes = plainEstimateMinutes ?? firstParsedDuration(metadata.estimate);
  const durationMinutes = firstParsedDuration(metadata.duration);
  const spanEnd = getRangeEndDate(dates);
  const spanStart = dates.start && spanEnd ? dates.start : void 0;
  const progressPercent = parseProgressPercent(first(metadata.progress));
  return {
    metadata,
    dates,
    dateSources,
    createdDate: dates.created,
    scheduleDate,
    spanStart,
    spanEnd: spanStart ? spanEnd : void 0,
    estimateMinutes,
    plainEstimateMinutes,
    progressPercent,
    durationMinutes,
    priority: first(metadata.priority),
    recurrence: first(metadata.recurrence) ?? first(metadata.repeat),
    project: first(metadata.project),
    context: first(metadata.context),
    dateSource: scheduleSource
  };
}
function parseDurationToMinutes(raw) {
  if (!raw)
    return void 0;
  const value = raw.trim().toLowerCase().replace(/\s+/gu, "").replace(/minutes?|mins?/gu, "m");
  if (!value)
    return void 0;
  const numeric = value.match(/^(\d+(?:\.\d+)?)$/u);
  if (numeric)
    return Math.round(Number.parseFloat(numeric[1]));
  const compact = value.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/u);
  if (compact && (compact[1] || compact[2])) {
    const hours = compact[1] ? Number.parseFloat(compact[1]) : 0;
    const minutes = compact[2] ? Number.parseInt(compact[2], 10) : 0;
    return Math.round(hours * 60 + minutes);
  }
  return void 0;
}
function cleanTaskDisplayText(line, triggerTags) {
  const withoutCheckbox = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "");
  const withoutFields = withoutCheckbox.replace(INLINE_FIELD_RE, " ").replace(LEGACY_EMOJI_DATE_RE, " ");
  const tagSet = new Set(triggerTags.map((tag) => tag.toLowerCase()));
  return withoutFields.split(/\s+/u).filter((part) => {
    if (!part.startsWith("#"))
      return true;
    return !tagSet.has(part.slice(1).toLowerCase());
  }).filter((part) => !isPlainEstimateToken(part)).join(" ").replace(/\s+/gu, " ").trim();
}
function normalizeFieldKey(raw) {
  return raw.trim().toLowerCase();
}
function isDateField(key) {
  return DATE_FIELDS.includes(key);
}
function getRangeEndDate(dates) {
  if (!dates.start)
    return void 0;
  for (const candidate of [dates.due, dates.scheduled]) {
    if (candidate && dates.start < candidate)
      return candidate;
  }
  return void 0;
}
function first(values) {
  return values?.find((value) => value.trim().length > 0)?.trim();
}
function firstParsedDuration(values) {
  for (const value of values ?? []) {
    const parsed = parseDurationToMinutes(value);
    if (parsed !== void 0)
      return parsed;
  }
  return void 0;
}
function extractPlainEstimateMinutes(line) {
  const body = line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/u, "").replace(INLINE_FIELD_RE, " ");
  for (const part of body.split(/\s+/u)) {
    if (!isPlainEstimateToken(part))
      continue;
    const parsed = parseDurationToMinutes(part);
    if (parsed !== void 0)
      return parsed;
  }
  return void 0;
}
function isPlainEstimateToken(part) {
  return /^(?:(?:\d+(?:\.\d+)?)h)?(?:(?:\d+)m)?$/u.test(part.toLowerCase()) && /[hm]/iu.test(part);
}
function parseProgressPercent(raw) {
  if (!raw)
    return 0;
  const numeric = raw.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/u);
  if (!numeric)
    return 0;
  return Math.min(100, Math.max(0, Number.parseFloat(numeric[1])));
}

// src/services/TaskScanner.ts
var CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/u;
function scanMarkdownTasksFromText(filePath, content, options) {
  if (!isIncludedPath(filePath, options.includedPathPrefixes ?? []))
    return [];
  if (isExcludedPath(filePath, options.excludedPathPrefixes ?? []))
    return [];
  const triggerType = options.forceExtract ? "phase-note" : "inline";
  const tasks = [];
  content.split(/\r?\n/u).forEach((line, lineNumber) => {
    const match = line.match(CHECKBOX_RE);
    if (!match)
      return;
    const metadata = extractTaskMetadata(line, options.readLegacyEmojiDates);
    const taskKind = metadata.dates.start ? "long" : "point";
    tasks.push({
      id: `${filePath}:${lineNumber}`,
      text: cleanTaskDisplayText(line, options.triggerTags),
      filePath,
      lineNumber,
      rawLine: line,
      completed: match[2].toLowerCase() === "x",
      metadata: metadata.metadata,
      dates: metadata.dates,
      dateSources: metadata.dateSources,
      taskKind,
      createdDate: metadata.createdDate,
      scheduleDate: metadata.scheduleDate,
      spanStart: taskKind === "long" ? metadata.dates.start : void 0,
      spanEnd: taskKind === "long" ? metadata.dates.due ?? metadata.dates.scheduled : void 0,
      estimateMinutes: metadata.estimateMinutes,
      plainEstimateMinutes: metadata.plainEstimateMinutes,
      progressPercent: metadata.progressPercent,
      durationMinutes: metadata.durationMinutes,
      priority: metadata.priority,
      recurrence: metadata.recurrence,
      project: metadata.project,
      context: metadata.context,
      dueDate: metadata.dates.due,
      dateSource: metadata.dateSource,
      triggerType,
      phaseId: options.phaseId
    });
  });
  return tasks;
}
function isPhaseTaskFilePath(filePath) {
  return filePath.split("/").includes("\u9636\u6BB5");
}
function isIncludedPath(filePath, prefixes) {
  if (prefixes.length === 0)
    return true;
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}
function isExcludedPath(filePath, prefixes) {
  return prefixes.some((prefix) => matchesPathPrefix(filePath, prefix));
}
function matchesPathPrefix(filePath, prefix) {
  const normalized = prefix.trim();
  if (!normalized)
    return false;
  const folder = normalized.replace(/\/$/u, "");
  return filePath === folder || filePath.startsWith(`${folder}/`);
}

// tests/taskScanner.test.ts
(0, import_node_test.test)("scans ordinary checkbox tasks outside phase notes for the unified unscheduled pool", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Plain checkbox\n- [ ] Task #task [scheduled:: 2024-01-14] [estimate:: 45m] [priority:: high]\n- [ ] Todo #todo\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => item.text), ["Plain checkbox", "Task", "Todo"]);
  import_node_assert.strict.equal(tasks[1].dates.scheduled, "2024-01-14");
  import_node_assert.strict.equal(tasks[1].scheduleDate, "2024-01-14");
  import_node_assert.strict.equal(tasks[1].estimateMinutes, 45);
  import_node_assert.strict.deepEqual(tasks[1].metadata.priority, ["high"]);
  import_node_assert.strict.equal(tasks[1].id, "Tasks.md:1");
});
(0, import_node_test.test)("force scans all checkbox tasks in Task-Maker phase notes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Phase.md",
    "- [ ] Phase task without trigger\n- [x] Completed phase task\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "pm" }
  );
  import_node_assert.strict.equal(tasks.length, 2);
  import_node_assert.strict.equal(tasks[0].triggerType, "phase-note");
  import_node_assert.strict.equal(tasks[0].phaseId, "pm");
  import_node_assert.strict.equal(tasks[1].completed, true);
});
(0, import_node_test.test)("classifies tasks by start field only", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    [
      "- [ ] Long task #task [start:: 2026-06-10] [due:: 2026-06-20] [progress:: 25%]",
      "- [ ] Started without end #task [start:: 2026-06-12]",
      "- [ ] Due-only point #task [due:: 2026-06-20]",
      "- [ ] Scheduled point #task [scheduled:: 2026-06-17]",
      "- [ ] Explicit type ignored #task [type:: long] [kind:: long] [task-kind:: long] [due:: 2026-06-21]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.equal(tasks[0].taskKind, "long");
  import_node_assert.strict.equal(tasks[0].spanStart, "2026-06-10");
  import_node_assert.strict.equal(tasks[0].spanEnd, "2026-06-20");
  import_node_assert.strict.equal(tasks[0].progressPercent, 25);
  import_node_assert.strict.equal(tasks[1].taskKind, "long");
  import_node_assert.strict.equal(tasks[1].spanStart, "2026-06-12");
  import_node_assert.strict.equal(tasks[1].spanEnd, void 0);
  import_node_assert.strict.equal(tasks[2].taskKind, "point");
  import_node_assert.strict.equal(tasks[2].spanStart, void 0);
  import_node_assert.strict.equal(tasks[3].taskKind, "point");
  import_node_assert.strict.equal(tasks[3].scheduleDate, "2026-06-17");
  import_node_assert.strict.equal(tasks[3].spanStart, void 0);
  import_node_assert.strict.equal(tasks[4].taskKind, "point");
  import_node_assert.strict.equal(tasks[4].spanStart, void 0);
});
(0, import_node_test.test)("ignores explicit long task fields without start", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Long task #task [type:: long]\n- [ ] Long with due #task [kind:: long] [due:: 2026-06-20]\n- [ ] Other long #task [task-kind:: long] [start:: 2026-06-10]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => item.taskKind), ["point", "point", "long"]);
  import_node_assert.strict.deepEqual(tasks.map((item) => item.spanStart), [void 0, void 0, "2026-06-10"]);
  import_node_assert.strict.deepEqual(tasks.map((item) => item.spanEnd), [void 0, void 0, void 0]);
});
(0, import_node_test.test)("does not use task section headings to classify long tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "Phase.md",
    [
      "## Long tasks",
      "- [ ] Heading only [priority:: P1] [progress:: 20%]",
      "- [ ] Started task [start:: 2026-06-10] [due:: 2026-06-20]",
      "## Point tasks",
      "- [ ] Point task [priority:: P2]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "phase-a" }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => ({ text: item.text, kind: item.taskKind })), [
    { text: "Heading only", kind: "point" },
    { text: "Started task", kind: "long" },
    { text: "Point task", kind: "point" }
  ]);
  import_node_assert.strict.equal(tasks[0].spanStart, void 0);
  import_node_assert.strict.equal(tasks[0].spanEnd, void 0);
  import_node_assert.strict.equal(tasks[0].priority, "P1");
  import_node_assert.strict.equal(tasks[0].progressPercent, 20);
});
(0, import_node_test.test)("does not use phase-note nesting to classify long tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "\u89C4\u5212/\u9636\u6BB5/\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md",
    [
      "---",
      "phase: true",
      "phase-id: youxi",
      "---",
      "- [ ] Character design",
      "  - [ ] Collect references",
      "- [ ] Architecture review [start:: 2026-06-10]"
    ].join("\n"),
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: true, phaseId: "youxi" }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => ({ text: item.text, kind: item.taskKind, phaseId: item.phaseId })), [
    { text: "Character design", kind: "point", phaseId: "youxi" },
    { text: "Collect references", kind: "point", phaseId: "youxi" },
    { text: "Architecture review", kind: "long", phaseId: "youxi" }
  ]);
});
(0, import_node_test.test)("recognizes files inside phase folders as phase task files", () => {
  import_node_assert.strict.equal(isPhaseTaskFilePath("\u89C4\u5212/\u9636\u6BB5/\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md"), true);
  import_node_assert.strict.equal(isPhaseTaskFilePath("\u89C4\u5212/\u4EE3\u529E/\u672A\u6392\u671F\u4EFB\u52A1\u6C60.md"), false);
  import_node_assert.strict.equal(isPhaseTaskFilePath("\u89C4\u5212/\u65E5/20260617.md"), false);
});
(0, import_node_test.test)("auto-detects existing long task ranges without trigger tags", () => {
  const tasks = scanMarkdownTasksFromText(
    "\u89C4\u5212/\u9636\u6BB5/\u817E\u8BAF\u521B\u4F5C\u5927\u8D5B.md",
    "- [ ] Character design 30m [start:: 2026-06-10] [due:: 2026-06-19]\n- [ ] Same-day started task [start:: 2026-06-17] [due:: 2026-06-17]\n- [ ] Legacy span end [start:: 2026-06-20] [scheduled:: 2026-06-25]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => item.text), ["Character design", "Same-day started task", "Legacy span end"]);
  import_node_assert.strict.deepEqual(tasks.map((item) => item.taskKind), ["long", "long", "long"]);
  import_node_assert.strict.deepEqual(tasks.map((item) => item.spanStart), ["2026-06-10", "2026-06-17", "2026-06-20"]);
  import_node_assert.strict.deepEqual(tasks.map((item) => item.spanEnd), ["2026-06-19", "2026-06-17", "2026-06-25"]);
});
(0, import_node_test.test)("ignores configured excluded path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "time-blocks-data/2024-01.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, excludedPathPrefixes: ["time-blocks-data/"] }
  );
  import_node_assert.strict.equal(tasks.length, 0);
});
(0, import_node_test.test)("keeps full-vault scan behavior when included prefixes are empty", () => {
  const tasks = scanMarkdownTasksFromText(
    "Areas/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: [] }
  );
  import_node_assert.strict.equal(tasks.length, 1);
});
(0, import_node_test.test)("scans only configured included path prefixes when present", () => {
  const included = scanMarkdownTasksFromText(
    "Areas/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: ["Areas/"] }
  );
  const outside = scanMarkdownTasksFromText(
    "Archive/Work.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, includedPathPrefixes: ["Areas/"] }
  );
  import_node_assert.strict.equal(included.length, 1);
  import_node_assert.strict.equal(outside.length, 0);
});
(0, import_node_test.test)("excluded path prefixes override included path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Areas/Archive/Work.md",
    "- [ ] Task #task",
    {
      triggerTags: ["task"],
      readLegacyEmojiDates: true,
      forceExtract: false,
      includedPathPrefixes: ["Areas/"],
      excludedPathPrefixes: ["Areas/Archive/"]
    }
  );
  import_node_assert.strict.equal(tasks.length, 0);
});
