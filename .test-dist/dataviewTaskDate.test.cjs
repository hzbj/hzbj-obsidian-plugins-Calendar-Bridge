// tests/dataviewTaskDate.test.ts
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
function setTaskScheduleDate(line, scheduledDate) {
  return appendField(removeFields(line, ["scheduled"]), "scheduled", scheduledDate);
}
function setPointTaskSchedule(line, scheduledDate, defaultEstimateMinutes, createdDate) {
  const parsed = extractTaskMetadata(line, false);
  let updated = removeFields(line, ["scheduled", "due"]);
  if (parsed.plainEstimateMinutes === void 0 && parsed.estimateMinutes === void 0) {
    updated = insertPlainEstimate(updated, defaultEstimateMinutes);
  }
  if (!parsed.createdDate) {
    updated = appendField(updated, "created", createdDate);
  }
  return appendField(appendField(updated, "scheduled", scheduledDate), "due", scheduledDate);
}
function setTaskSpanDates(line, startDate, scheduledDate) {
  return appendField(appendField(removeFields(line, ["start", "scheduled", "due"]), "start", startDate), "due", scheduledDate);
}
function setTaskEstimate(line, estimateMinutes) {
  return appendField(removeFields(line, ["estimate"]), "estimate", `${Math.max(0, Math.round(estimateMinutes))}m`);
}
function clearTaskScheduleDates(line) {
  return removeFields(line, ["due", "scheduled", "start"]).replace(LEGACY_EMOJI_DATE_RE, " ").replace(/[ \t]+$/u, "");
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

// tests/dataviewTaskDate.test.ts
(0, import_node_test.test)("parses arbitrary Dataview inline fields and normalized task metadata", () => {
  const parsed = extractTaskMetadata(
    "- [ ] Review #task [due:: 2024-01-14] [scheduled:: 2024-01-15] [start:: 2024-01-13] [estimate:: 1h30m] [priority:: high] [project:: Home]",
    true
  );
  import_node_assert.strict.deepEqual(parsed.metadata.due, ["2024-01-14"]);
  import_node_assert.strict.deepEqual(parsed.metadata.project, ["Home"]);
  import_node_assert.strict.equal(parsed.dates.due, "2024-01-14");
  import_node_assert.strict.equal(parsed.dates.scheduled, "2024-01-15");
  import_node_assert.strict.equal(parsed.dates.start, "2024-01-13");
  import_node_assert.strict.equal(parsed.scheduleDate, "2024-01-15");
  import_node_assert.strict.equal(parsed.spanStart, "2024-01-13");
  import_node_assert.strict.equal(parsed.spanEnd, "2024-01-14");
  import_node_assert.strict.equal(parsed.estimateMinutes, 90);
  import_node_assert.strict.equal(parsed.priority, "high");
  import_node_assert.strict.equal(parsed.dateSource, "dataview");
});
(0, import_node_test.test)("parses plain estimate, created date, and manual progress fields", () => {
  const parsed = extractTaskMetadata(
    "- [ ] \u4E2A\u4EBA\u6BD5\u4E1A\u7167\u6253\u5305\u53D1\u9001 1h #task [created:: 2026-06-17] [scheduled:: 2026-06-17] [due:: 2026-06-17] [progress:: 40%]",
    true
  );
  import_node_assert.strict.equal(parsed.plainEstimateMinutes, 60);
  import_node_assert.strict.equal(parsed.estimateMinutes, 60);
  import_node_assert.strict.equal(parsed.createdDate, "2026-06-17");
  import_node_assert.strict.equal(parsed.progressPercent, 40);
  import_node_assert.strict.equal(parsed.dates.scheduled, "2026-06-17");
  import_node_assert.strict.equal(parsed.dates.due, "2026-06-17");
});
(0, import_node_test.test)("parses legacy emoji date when compatibility is enabled", () => {
  const parsed = extractTaskMetadata("- [ ] Task #task \u{1F4C5} 2024-01-14", true);
  import_node_assert.strict.equal(parsed.dates.due, "2024-01-14");
  import_node_assert.strict.equal(parsed.scheduleDate, "2024-01-14");
  import_node_assert.strict.equal(parsed.dateSource, "emoji");
});
(0, import_node_test.test)("prefers Dataview scheduled over due and legacy emoji dates", () => {
  const parsed = extractTaskMetadata("- [ ] Task #task [due:: 2024-01-14] [scheduled:: 2024-01-16] \u{1F4C5} 2024-01-15", true);
  import_node_assert.strict.equal(parsed.dates.due, "2024-01-14");
  import_node_assert.strict.equal(parsed.dates.scheduled, "2024-01-16");
  import_node_assert.strict.equal(parsed.scheduleDate, "2024-01-16");
  import_node_assert.strict.equal(parsed.dateSource, "dataview");
});
(0, import_node_test.test)("parses common estimate formats", () => {
  import_node_assert.strict.equal(parseDurationToMinutes("60"), 60);
  import_node_assert.strict.equal(parseDurationToMinutes("60m"), 60);
  import_node_assert.strict.equal(parseDurationToMinutes("60 min"), 60);
  import_node_assert.strict.equal(parseDurationToMinutes("1h"), 60);
  import_node_assert.strict.equal(parseDurationToMinutes("1 h"), 60);
  import_node_assert.strict.equal(parseDurationToMinutes("1h30m"), 90);
  import_node_assert.strict.equal(parseDurationToMinutes("1 h 30 m"), 90);
  import_node_assert.strict.equal(parseDurationToMinutes("1.5h"), 90);
});
(0, import_node_test.test)("writes scheduled date without disturbing task content", () => {
  import_node_assert.strict.equal(
    setTaskScheduleDate("- [ ] Check NAS #task \u23F0 21:00 [priority:: high]", "2024-01-14"),
    "- [ ] Check NAS #task \u23F0 21:00 [priority:: high] [scheduled:: 2024-01-14]"
  );
});
(0, import_node_test.test)("writes point task schedule with plain estimate, created, scheduled, and due fields", () => {
  import_node_assert.strict.equal(
    setPointTaskSchedule("- [ ] \u4E2A\u4EBA\u6BD5\u4E1A\u7167\u6253\u5305\u53D1\u9001 #task [priority:: high]", "2026-06-17", 60, "2026-06-17"),
    "- [ ] \u4E2A\u4EBA\u6BD5\u4E1A\u7167\u6253\u5305\u53D1\u9001 #task 1h [priority:: high] [created:: 2026-06-17] [scheduled:: 2026-06-17] [due:: 2026-06-17]"
  );
});
(0, import_node_test.test)("point task schedule preserves existing created and estimate values", () => {
  import_node_assert.strict.equal(
    setPointTaskSchedule(
      "- [ ] \u4E2A\u4EBA\u6BD5\u4E1A\u7167\u6253\u5305\u53D1\u9001 45m #task [created:: 2026-06-10] [scheduled:: 2026-06-12] [due:: 2026-06-12] [context:: phone]",
      "2026-06-17",
      60,
      "2026-06-17"
    ),
    "- [ ] \u4E2A\u4EBA\u6BD5\u4E1A\u7167\u6253\u5305\u53D1\u9001 45m #task [created:: 2026-06-10] [context:: phone] [scheduled:: 2026-06-17] [due:: 2026-06-17]"
  );
});
(0, import_node_test.test)("replaces existing scheduled date while preserving other metadata", () => {
  import_node_assert.strict.equal(
    setTaskScheduleDate("	- [ ] Check NAS #task [scheduled:: 2024-01-13] [due:: 2024-01-12] \u23F0 21:00", "2024-01-14"),
    "	- [ ] Check NAS #task [due:: 2024-01-12] \u23F0 21:00 [scheduled:: 2024-01-14]"
  );
});
(0, import_node_test.test)("writes span dates and estimate without removing other fields", () => {
  import_node_assert.strict.equal(
    setTaskSpanDates("- [ ] A  B #task [start:: 2024-01-10] [estimate:: 30m] [context:: phone]", "2024-01-14", "2024-01-18"),
    "- [ ] A  B #task [estimate:: 30m] [context:: phone] [start:: 2024-01-14] [due:: 2024-01-18]"
  );
  import_node_assert.strict.equal(
    setTaskSpanDates("- [ ] A #task [scheduled:: 2024-01-12] [context:: phone]", "2024-01-14", "2024-01-18"),
    "- [ ] A #task [context:: phone] [start:: 2024-01-14] [due:: 2024-01-18]"
  );
  import_node_assert.strict.equal(
    setTaskEstimate("- [ ] A  B #task [estimate:: 30m] [scheduled:: 2024-01-18]", 75),
    "- [ ] A  B #task [scheduled:: 2024-01-18] [estimate:: 75m]"
  );
});
(0, import_node_test.test)("clears all schedule dates while preserving estimate and other metadata", () => {
  import_node_assert.strict.equal(
    clearTaskScheduleDates("- [ ] A #task [due:: 2024-01-10] [start:: 2024-01-11] [scheduled:: 2024-01-12] [estimate:: 75m] \u{1F4C5} 2024-01-09 [context:: phone]"),
    "- [ ] A #task [estimate:: 75m] [context:: phone]"
  );
});
(0, import_node_test.test)("clean display text removes trigger tags and Dataview fields", () => {
  import_node_assert.strict.equal(
    cleanTaskDisplayText("- [ ] A  B #task [scheduled:: 2024-01-18] [estimate:: 75m] #keep", ["task", "todo"]),
    "A B #keep"
  );
});
