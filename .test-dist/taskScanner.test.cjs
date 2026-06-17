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
  const spanStart = dates.start && dates.due ? dates.start : void 0;
  const progressPercent = parseProgressPercent(first(metadata.progress));
  return {
    metadata,
    dates,
    dateSources,
    createdDate: dates.created,
    scheduleDate,
    spanStart,
    spanEnd: spanStart ? dates.due : void 0,
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
  if (isExcludedPath(filePath, options.excludedPathPrefixes ?? []))
    return [];
  const triggerType = options.forceExtract ? "phase-note" : "inline";
  return content.split(/\r?\n/u).flatMap((line, lineNumber) => {
    const match = line.match(CHECKBOX_RE);
    if (!match)
      return [];
    const taskBody = match[4];
    if (!options.forceExtract && !hasTriggerTag(taskBody, options.triggerTags))
      return [];
    const metadata = extractTaskMetadata(line, options.readLegacyEmojiDates);
    return [{
      id: `${filePath}:${lineNumber}`,
      text: cleanTaskDisplayText(line, options.triggerTags),
      filePath,
      lineNumber,
      rawLine: line,
      completed: match[2].toLowerCase() === "x",
      metadata: metadata.metadata,
      dates: metadata.dates,
      dateSources: metadata.dateSources,
      taskKind: metadata.spanStart && metadata.spanEnd ? "long" : "point",
      createdDate: metadata.createdDate,
      scheduleDate: metadata.scheduleDate,
      spanStart: metadata.spanStart,
      spanEnd: metadata.spanEnd,
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
    }];
  });
}
function hasTriggerTag(content, triggerTags) {
  for (const tag of triggerTags) {
    const hashTag = `#${tag}`;
    let searchFrom = 0;
    while (true) {
      const index = content.indexOf(hashTag, searchFrom);
      if (index < 0)
        break;
      const before = index === 0 ? " " : content[index - 1];
      const after = content[index + hashTag.length] ?? " ";
      if (/\s/u.test(before) && (/\s/u.test(after) || after === "#"))
        return true;
      searchFrom = index + hashTag.length;
    }
  }
  return false;
}
function isExcludedPath(filePath, prefixes) {
  return prefixes.some((prefix) => filePath === prefix.replace(/\/$/u, "") || filePath.startsWith(prefix));
}

// tests/taskScanner.test.ts
(0, import_node_test.test)("scans only trigger-tagged checkbox tasks outside phase notes", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Plain checkbox\n- [ ] Task #task [scheduled:: 2024-01-14] [estimate:: 45m] [priority:: high]\n- [ ] Todo #todo\n",
    { triggerTags: ["task", "todo"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.deepEqual(tasks.map((item) => item.text), ["Task", "Todo"]);
  import_node_assert.strict.equal(tasks[0].dates.scheduled, "2024-01-14");
  import_node_assert.strict.equal(tasks[0].scheduleDate, "2024-01-14");
  import_node_assert.strict.equal(tasks[0].estimateMinutes, 45);
  import_node_assert.strict.deepEqual(tasks[0].metadata.priority, ["high"]);
  import_node_assert.strict.equal(tasks[0].id, "Tasks.md:1");
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
(0, import_node_test.test)("classifies start plus due tasks as long tasks and scheduled-only tasks as point tasks", () => {
  const tasks = scanMarkdownTasksFromText(
    "Tasks.md",
    "- [ ] Long task #task [start:: 2026-06-10] [due:: 2026-06-20] [progress:: 25%]\n- [ ] Point task #task [scheduled:: 2026-06-17]\n",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false }
  );
  import_node_assert.strict.equal(tasks[0].taskKind, "long");
  import_node_assert.strict.equal(tasks[0].spanStart, "2026-06-10");
  import_node_assert.strict.equal(tasks[0].spanEnd, "2026-06-20");
  import_node_assert.strict.equal(tasks[0].progressPercent, 25);
  import_node_assert.strict.equal(tasks[1].taskKind, "point");
  import_node_assert.strict.equal(tasks[1].scheduleDate, "2026-06-17");
  import_node_assert.strict.equal(tasks[1].spanStart, void 0);
});
(0, import_node_test.test)("ignores configured excluded path prefixes", () => {
  const tasks = scanMarkdownTasksFromText(
    "time-blocks-data/2024-01.md",
    "- [ ] Task #task",
    { triggerTags: ["task"], readLegacyEmojiDates: true, forceExtract: false, excludedPathPrefixes: ["time-blocks-data/"] }
  );
  import_node_assert.strict.equal(tasks.length, 0);
});
