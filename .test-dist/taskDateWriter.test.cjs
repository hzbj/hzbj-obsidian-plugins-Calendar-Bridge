// tests/taskDateWriter.test.ts
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
function setPointTaskSchedule(line, scheduledDate, defaultEstimateMinutes, createdDate) {
  const parsed = extractTaskMetadata(line, false);
  let updated = removeFields(line, ["start", "scheduled", "due"]);
  if (parsed.plainEstimateMinutes === void 0 && parsed.estimateMinutes === void 0) {
    updated = insertPlainEstimate(updated, defaultEstimateMinutes);
  }
  if (!parsed.createdDate) {
    updated = appendField(updated, "created", createdDate);
  }
  return appendField(appendField(updated, "scheduled", scheduledDate), "due", scheduledDate);
}
function removeFields(line, fields) {
  const fieldSet = new Set(fields.map(normalizeFieldKey));
  return line.replace(INLINE_FIELD_RE, (full, rawKey) => fieldSet.has(normalizeFieldKey(rawKey)) ? " " : full).replace(/[ \t]+$/u, "").replace(/[ \t]{2,}(?=\[[^\]]+::)/gu, " ");
}
function appendField(line, field, value) {
  return `${line.replace(/[ \t]+$/u, "")} [${field}:: ${value}]`;
}
function insertPlainEstimate(line, estimateMinutes) {
  const estimate = formatDuration(estimateMinutes);
  const firstField = line.search(INLINE_FIELD_RE);
  if (firstField < 0)
    return `${line.replace(/[ \t]+$/u, "")} ${estimate}`;
  const before = line.slice(0, firstField).replace(/[ \t]+$/u, "");
  const after = line.slice(firstField).replace(/^[ \t]+/u, "");
  return `${before} ${estimate} ${after}`;
}
function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded >= 60 && rounded % 60 === 0)
    return `${rounded / 60}h`;
  if (rounded >= 60)
    return `${Math.floor(rounded / 60)}h${rounded % 60}m`;
  return `${rounded}m`;
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

// src/services/TaskDateWriter.ts
function buildScheduledDayFilePath(folderPath, scheduledDate) {
  const folder = folderPath.trim().replace(/\\/gu, "/").replace(/\/+$/u, "") || "Calendar/Scheduled";
  const fileName = `${scheduledDate.replace(/-/gu, "")}.md`;
  return `${folder}/${fileName}`.replace(/\/{2,}/gu, "/");
}
function moveTaskLineToScheduledDayContent(input) {
  const sourceLines = input.sourceContent.split(/\r?\n/u);
  if (input.sourceLineNumber < 0 || input.sourceLineNumber >= sourceLines.length || sourceLines[input.sourceLineNumber] === void 0) {
    throw new Error(`Task line ${input.sourceLineNumber} is outside source content`);
  }
  const [rawLine] = sourceLines.splice(input.sourceLineNumber, 1);
  const scheduledLine = setPointTaskSchedule(rawLine, input.scheduledDate, input.defaultEstimateMinutes, input.createdDate);
  const sourceContent = sourceLines.join("\n");
  const targetBase = input.targetContent.trimEnd();
  const targetContent = `${targetBase ? `${targetBase}
` : ""}${scheduledLine}
`;
  return { sourceContent, targetContent };
}

// tests/taskDateWriter.test.ts
(0, import_node_test.test)("builds YYYYMMDD daily file paths under configured scheduled folder", () => {
  import_node_assert.strict.equal(
    buildScheduledDayFilePath("Calendar/Scheduled", "2026-06-18"),
    "Calendar/Scheduled/20260618.md"
  );
  import_node_assert.strict.equal(
    buildScheduledDayFilePath("Calendar/Scheduled/", "2026-06-18"),
    "Calendar/Scheduled/20260618.md"
  );
});
(0, import_node_test.test)("moves a point task line into daily file content with scheduled fields", () => {
  const moved = moveTaskLineToScheduledDayContent({
    sourceContent: "# Inbox\n- [ ] First #task\n- [ ] Move me #task [context:: phone]\n- [ ] Last #task\n",
    sourceLineNumber: 2,
    targetContent: "# 20260618\u65E5\n",
    scheduledDate: "2026-06-18",
    defaultEstimateMinutes: 30,
    createdDate: "2026-06-18"
  });
  import_node_assert.strict.equal(moved.sourceContent, "# Inbox\n- [ ] First #task\n- [ ] Last #task\n");
  import_node_assert.strict.equal(
    moved.targetContent,
    "# 20260618\u65E5\n- [ ] Move me #task 30m [context:: phone] [created:: 2026-06-18] [scheduled:: 2026-06-18] [due:: 2026-06-18]\n"
  );
});
