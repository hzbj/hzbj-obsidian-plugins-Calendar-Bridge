# Personal Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete MVP Obsidian personal scheduling plugin that replaces time-blocks and Task-Maker and integrates spaced-review summaries without replacing spaced-review.

**Architecture:** Create a new TypeScript Obsidian plugin with a service layer for scanning/writing Markdown tasks, JSON-backed scheduling metadata, and one workbench view with Phase, Calendar, Now, Inbox, and Settings pages. Markdown remains the source of truth for point task facts; JSON stores phase, span, relation, estimate, time-block, and UI state.

**Tech Stack:** TypeScript, Obsidian plugin API, esbuild, Node test runner, CSS.

---

## File Structure

- Create `manifest.json`: Obsidian plugin metadata.
- Create `package.json`: build/test scripts and dev dependencies.
- Create `tsconfig.json`: TypeScript compiler config.
- Create `esbuild.config.mjs`: bundle `src/main.ts` to `main.js`.
- Create `styles.css`: all plugin UI styles.
- Create `scripts/run-tests.mjs`: bundle TypeScript tests and run Node tests.
- Create `src/main.ts`: plugin lifecycle, services, view registration, commands.
- Create `src/models/types.ts`: shared domain and settings types.
- Create `src/models/constants.ts`: view type, defaults, regex constants.
- Create `src/utils/date.ts`: date helpers and time block conversion helpers.
- Create `src/utils/markdownTask.ts`: parse and mutate Markdown checkbox task lines.
- Create `src/services/SchedulerStore.ts`: plugin data defaults, load, save, mutation helpers.
- Create `src/services/TaskScanner.ts`: scan Markdown files into runtime point tasks and phase notes.
- Create `src/services/TaskWriter.ts`: modify Markdown task lines through one service.
- Create `src/services/PhaseService.ts`: create phase notes and append phase point tasks.
- Create `src/services/CalendarService.ts`: build month/week/day view models.
- Create `src/services/ReviewBridge.ts`: summarize spaced-review frontmatter fields.
- Create `src/ui/PersonalSystemView.ts`: top-level Obsidian item view and page navigation.
- Create `src/ui/pages/PhasePage.ts`: phase list/detail/span/point task UI.
- Create `src/ui/pages/CalendarPage.ts`: month/week planning UI.
- Create `src/ui/pages/NowPage.ts`: today task pool and 48 time block UI.
- Create `src/ui/pages/InboxPage.ts`: temporary task category UI.
- Create `src/ui/settings/PersonalSystemSettingTab.ts`: settings tab.
- Create `tests/markdownTask.test.ts`: parser/mutator tests.
- Create `tests/schedulerStore.test.ts`: data default and mutation tests.
- Create `tests/calendarService.test.ts`: grouping/pressure tests.
- Create `tests/reviewBridge.test.ts`: spaced-review summary tests.

---

### Task 1: Scaffold Obsidian Plugin Project

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `src/main.ts`
- Create: `src/models/types.ts`
- Create: `src/models/constants.ts`
- Create: `styles.css`

- [ ] **Step 1: Create metadata and build config**

Create `manifest.json`:

```json
{
  "id": "personal-scheduler",
  "name": "Personal Scheduler",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "Linear phase, calendar, time block, and TaskForge-compatible personal scheduling for Obsidian.",
  "author": "Personal Scheduler",
  "isDesktopOnly": false
}
```

Create `package.json`:

```json
{
  "name": "obsidian-personal-scheduler",
  "version": "0.1.0",
  "description": "Personal scheduling plugin for Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "node scripts/run-tests.mjs"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "0.20.0",
    "obsidian": "latest",
    "typescript": "5.3.3"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2018",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2018"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `esbuild.config.mjs`:

```js
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: "/* Personal Scheduler */" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod
});

if (prod) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
```

- [ ] **Step 2: Create empty domain constants and plugin entry**

Create `src/models/types.ts`:

```ts
export type TaskKind = "point" | "span";
export type QuadrantCode = "ui" | "in" | "un" | "nn";
export type SpanTaskStatus = "unscheduled" | "scheduled" | "active" | "paused" | "done";
export type TimeBlockType = "task" | "review" | "rest" | "work" | "study" | "interrupt";

export interface Phase {
  id: string;
  title: string;
  notePath: string;
  startDate: string;
  endDate: string;
  goal?: string;
  description?: string;
  priority?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpanTask {
  id: string;
  phaseId: string;
  title: string;
  spanStart?: string;
  spanEnd?: string;
  deadline?: string;
  progress: number;
  estimatedMinutes?: number;
  remainingMinutes?: number;
  quadrant?: QuadrantCode;
  priority?: 1 | 2;
  childTaskIds: string[];
  status: SpanTaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskMeta {
  taskId: string;
  kind: TaskKind;
  phaseId?: string;
  parentSpanTaskId?: string;
  estimatedMinutes?: number;
  quadrant?: QuadrantCode;
  priority?: 1 | 2;
}

export interface ScannedTask {
  id: string;
  title: string;
  filePath: string;
  lineNumber: number;
  rawLine: string;
  completed: boolean;
  date?: string;
  remindTime?: string;
  tags: string[];
  quadrant?: QuadrantCode;
}

export interface TimeBlockAssignment {
  date: string;
  blockIndex: number;
  taskId?: string;
  type: TimeBlockType;
  title: string;
  startTime: string;
  endTime: string;
}

export interface ReviewSummary {
  overdue: number;
  dueToday: number;
  estimatedMinutes: number;
}

export interface SchedulerSettings {
  phaseFolderPath: string;
  inboxFolderPath: string;
  defaultInboxFile: string;
  tagNamespace: string;
  reviewEstimatedMinutes: number;
  timeBlockHeight: number;
  enableTaskForgeSyntax: boolean;
}

export interface SchedulerData {
  version: 1;
  phases: Phase[];
  spanTasks: Record<string, SpanTask>;
  taskMeta: Record<string, TaskMeta>;
  timeBlocks: Record<string, TimeBlockAssignment[]>;
  settings: SchedulerSettings;
  ui: Record<string, unknown>;
}
```

Create `src/models/constants.ts`:

```ts
import type { SchedulerData } from "./types";

export const VIEW_TYPE_PERSONAL_SYSTEM = "personal-scheduler-view";
export const DATA_FILE = "personal-scheduler-data.json";
export const BLOCKS_PER_DAY = 48;
export const DATE_TOKEN = "📅";
export const TIME_TOKEN = "⏰";

export const DEFAULT_DATA: SchedulerData = {
  version: 1,
  phases: [],
  spanTasks: {},
  taskMeta: {},
  timeBlocks: {},
  settings: {
    phaseFolderPath: "Personal Scheduler/Phases",
    inboxFolderPath: "Personal Scheduler/Inbox",
    defaultInboxFile: "收集.md",
    tagNamespace: "T",
    reviewEstimatedMinutes: 30,
    timeBlockHeight: 28,
    enableTaskForgeSyntax: true
  },
  ui: {}
};
```

Create `src/main.ts`:

```ts
import { Notice, Plugin } from "obsidian";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "./models/constants";

export default class PersonalSchedulerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_PERSONAL_SYSTEM, (leaf) => {
      const container = leaf.view.containerEl;
      container.empty();
      container.createDiv({ cls: "ps-root ps-placeholder", text: "Personal Scheduler MVP" });
      return leaf.view;
    });

    this.addCommand({
      id: "open-personal-scheduler",
      name: "Open Personal Scheduler",
      callback: () => this.activateView()
    });
  }

  async activateView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("No workspace leaf available.");
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_PERSONAL_SYSTEM, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
```

Create `styles.css`:

```css
.ps-root {
  --ps-bg: var(--background-primary);
  --ps-panel: var(--background-secondary);
  --ps-border: var(--background-modifier-border);
  --ps-text-muted: var(--text-muted);
  --ps-accent: var(--interactive-accent);
  box-sizing: border-box;
  height: 100%;
  color: var(--text-normal);
  background: var(--ps-bg);
}

.ps-placeholder {
  display: grid;
  place-items: center;
  min-height: 240px;
  border: 1px solid var(--ps-border);
  border-radius: 8px;
  color: var(--ps-text-muted);
}
```

- [ ] **Step 3: Run build**

Run: `npm install`

Expected: dependencies install without errors.

Run: `npm run build`

Expected: TypeScript and esbuild pass and create `main.js`.

- [ ] **Step 4: Commit if repository exists**

Run:

```powershell
git status --short
```

Expected in current workspace: `fatal: not a git repository...`; skip commit. If a git repo is initialized later:

```powershell
git add manifest.json package.json tsconfig.json esbuild.config.mjs src styles.css
git commit -m "chore: scaffold personal scheduler plugin"
```

---

### Task 2: Markdown Task Parser and Mutator

**Files:**
- Create: `src/utils/markdownTask.ts`
- Create: `tests/markdownTask.test.ts`
- Create: `scripts/run-tests.mjs`

- [ ] **Step 1: Write parser and mutation tests**

Create `tests/markdownTask.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMarkdownTaskLine,
  setTaskDate,
  setTaskReminderTime,
  setTaskCompleted,
  removeTaskSchedule
} from "../src/utils/markdownTask";

test("parses TaskForge date, reminder, tags, checkbox state, and quadrant", () => {
  const parsed = parseMarkdownTaskLine("- [ ] 设计月视图 #task #T/phase-in 📅 2026-06-17 ⏰ 21:00");
  assert.equal(parsed?.completed, false);
  assert.equal(parsed?.title, "设计月视图");
  assert.equal(parsed?.date, "2026-06-17");
  assert.equal(parsed?.remindTime, "21:00");
  assert.deepEqual(parsed?.tags, ["task", "T/phase-in"]);
  assert.equal(parsed?.quadrant, "in");
});

test("updates date without duplicating existing date", () => {
  assert.equal(
    setTaskDate("- [ ] 检查 NAS #task 📅 2026-06-12", "2026-06-13"),
    "- [ ] 检查 NAS #task 📅 2026-06-13"
  );
});

test("updates reminder without removing date", () => {
  assert.equal(
    setTaskReminderTime("- [ ] 检查 NAS #task 📅 2026-06-13", "21:00"),
    "- [ ] 检查 NAS #task 📅 2026-06-13 ⏰ 21:00"
  );
});

test("removes date and reminder when unscheduling", () => {
  assert.equal(
    removeTaskSchedule("- [ ] 检查 NAS #task 📅 2026-06-13 ⏰ 21:00"),
    "- [ ] 检查 NAS #task"
  );
});

test("sets checkbox completion state", () => {
  assert.equal(setTaskCompleted("- [ ] 检查 NAS #task", true), "- [x] 检查 NAS #task");
  assert.equal(setTaskCompleted("- [x] 检查 NAS #task", false), "- [ ] 检查 NAS #task");
});
```

Create `scripts/run-tests.mjs`:

```js
import esbuild from "esbuild";
import { readdirSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const outdir = ".test-dist";
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const tests = readdirSync("tests").filter((name) => name.endsWith(".test.ts"));
for (const testFile of tests) {
  await esbuild.build({
    entryPoints: [join("tests", testFile)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: join(outdir, testFile.replace(".ts", ".cjs")),
    external: ["obsidian"]
  });
}

const result = spawnSync(process.execPath, ["--test", ...tests.map((name) => join(outdir, name.replace(".ts", ".cjs")))], {
  stdio: "inherit"
});
process.exit(result.status ?? 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `src/utils/markdownTask.ts` does not exist.

- [ ] **Step 3: Implement parser and mutators**

Create `src/utils/markdownTask.ts`:

```ts
import type { QuadrantCode } from "../models/types";
import { DATE_TOKEN, TIME_TOKEN } from "../models/constants";

export interface ParsedMarkdownTaskLine {
  completed: boolean;
  title: string;
  date?: string;
  remindTime?: string;
  tags: string[];
  quadrant?: QuadrantCode;
}

const CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/;
const DATE_RE = /(?:^|\s)📅\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const TIME_RE = /(?:^|\s)⏰\s*(\d{2}:\d{2})(?=\s|$)/u;
const TAG_RE = /(^|\s)#([^\s#]+)/g;

export function parseMarkdownTaskLine(line: string): ParsedMarkdownTaskLine | null {
  const match = line.match(CHECKBOX_RE);
  if (!match) return null;
  const body = match[4];
  const tags = extractTags(body);
  const title = body
    .replace(DATE_RE, "")
    .replace(TIME_RE, "")
    .replace(TAG_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    completed: match[2].toLowerCase() === "x",
    title,
    date: body.match(DATE_RE)?.[1],
    remindTime: body.match(TIME_RE)?.[1],
    tags,
    quadrant: extractQuadrant(tags)
  };
}

export function setTaskDate(line: string, date: string): string {
  const withoutDate = line.replace(DATE_RE, "").replace(/\s+$/g, "");
  const timeMatch = withoutDate.match(TIME_RE);
  if (!timeMatch) return `${withoutDate} ${DATE_TOKEN} ${date}`;
  const withoutTime = withoutDate.replace(TIME_RE, "").replace(/\s+$/g, "");
  return `${withoutTime} ${DATE_TOKEN} ${date} ${TIME_TOKEN} ${timeMatch[1]}`;
}

export function setTaskReminderTime(line: string, time: string): string {
  const withoutTime = line.replace(TIME_RE, "").replace(/\s+$/g, "");
  return `${withoutTime} ${TIME_TOKEN} ${time}`;
}

export function removeTaskSchedule(line: string): string {
  return line.replace(DATE_RE, "").replace(TIME_RE, "").replace(/\s+/g, " ").trimEnd();
}

export function setTaskCompleted(line: string, completed: boolean): string {
  return line.replace(CHECKBOX_RE, (_all, prefix: string, _state: string, suffix: string, body: string) => {
    return `${prefix}${completed ? "x" : " "}${suffix}${body}`;
  });
}

function extractTags(body: string): string[] {
  const tags: string[] = [];
  for (const match of body.matchAll(TAG_RE)) {
    tags.push(match[2]);
  }
  return tags;
}

function extractQuadrant(tags: string[]): QuadrantCode | undefined {
  for (const tag of tags) {
    const match = tag.match(/(?:^|\/)[^/\s]+-(ui|in|un|nn)$/);
    if (match) return match[1] as QuadrantCode;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS for `markdownTask.test.ts`.

- [ ] **Step 5: Commit if repository exists**

If a git repo is initialized:

```powershell
git add scripts tests src/utils
git commit -m "test: add markdown task parser coverage"
```

---

### Task 3: Store, Date Helpers, Calendar, and Review Summaries

**Files:**
- Create: `src/utils/date.ts`
- Create: `src/services/SchedulerStore.ts`
- Create: `src/services/CalendarService.ts`
- Create: `src/services/ReviewBridge.ts`
- Create: `tests/schedulerStore.test.ts`
- Create: `tests/calendarService.test.ts`
- Create: `tests/reviewBridge.test.ts`

- [ ] **Step 1: Write tests for store, calendar, and review bridge**

Create `tests/schedulerStore.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSchedulerData, upsertPhase, upsertSpanTask } from "../src/services/SchedulerStore";

test("creates default scheduler data with configured folders", () => {
  const data = createDefaultSchedulerData();
  assert.equal(data.settings.phaseFolderPath, "Personal Scheduler/Phases");
  assert.equal(data.settings.inboxFolderPath, "Personal Scheduler/Inbox");
  assert.deepEqual(data.phases, []);
});

test("upserts phase and span task without losing existing data", () => {
  const data = createDefaultSchedulerData();
  upsertPhase(data, {
    id: "p1",
    title: "Phase",
    notePath: "Personal Scheduler/Phases/Phase.md",
    startDate: "2026-06-12",
    endDate: "2026-06-30",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z"
  });
  upsertSpanTask(data, {
    id: "s1",
    phaseId: "p1",
    title: "Build plugin",
    progress: 0,
    childTaskIds: [],
    status: "unscheduled",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z"
  });
  assert.equal(data.phases.length, 1);
  assert.equal(data.spanTasks.s1.title, "Build plugin");
});
```

Create `tests/calendarService.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildDaySummary, spanCoversDate } from "../src/services/CalendarService";

test("detects span coverage inclusively", () => {
  assert.equal(spanCoversDate({ spanStart: "2026-06-12", spanEnd: "2026-06-30" }, "2026-06-12"), true);
  assert.equal(spanCoversDate({ spanStart: "2026-06-12", spanEnd: "2026-06-30" }, "2026-06-30"), true);
  assert.equal(spanCoversDate({ spanStart: "2026-06-12", spanEnd: "2026-06-30" }, "2026-07-01"), false);
});

test("builds daily pressure from point tasks, spans, and review summary", () => {
  const summary = buildDaySummary(
    "2026-06-12",
    [{ id: "a", date: "2026-06-12" }, { id: "b", date: "2026-06-13" }],
    [{ id: "s", spanStart: "2026-06-10", spanEnd: "2026-06-14" }],
    { overdue: 1, dueToday: 2, estimatedMinutes: 30 }
  );
  assert.equal(summary.pointTaskCount, 1);
  assert.equal(summary.spanTaskCount, 1);
  assert.equal(summary.reviewSummary?.dueToday, 2);
  assert.equal(summary.pressureLevel, "medium");
});
```

Create `tests/reviewBridge.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeReviewFrontmatters } from "../src/services/ReviewBridge";

test("summarizes overdue and due today while skipping paused notes", () => {
  const result = summarizeReviewFrontmatters([
    { "下次复习": "2026-06-10", "复习状态": "进行中" },
    { "下次复习": "2026-06-12" },
    { "下次复习": "2026-06-12", "复习状态": "暂停" },
    { "知识类型": "内化" }
  ], "2026-06-12", 30);
  assert.equal(result.overdue, 1);
  assert.equal(result.dueToday, 2);
  assert.equal(result.estimatedMinutes, 60);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because services do not exist.

- [ ] **Step 3: Implement date helpers**

Create `src/utils/date.ts`:

```ts
export function todayString(date = new Date()): string {
  return toDateString(date);
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function blockIndexToTime(index: number): string {
  const minutes = Math.max(0, Math.min(47, index)) * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToBlockIndex(time: string): number {
  const [h, m] = time.split(":").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(47, Math.floor((h * 60 + m) / 30)));
}
```

- [ ] **Step 4: Implement store helpers**

Create `src/services/SchedulerStore.ts`:

```ts
import type { Phase, SchedulerData, SpanTask } from "../models/types";
import { DEFAULT_DATA } from "../models/constants";

export function createDefaultSchedulerData(): SchedulerData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA)) as SchedulerData;
}

export function mergeSchedulerData(raw: unknown): SchedulerData {
  const defaults = createDefaultSchedulerData();
  if (!raw || typeof raw !== "object") return defaults;
  const partial = raw as Partial<SchedulerData>;
  return {
    ...defaults,
    ...partial,
    settings: { ...defaults.settings, ...(partial.settings ?? {}) },
    phases: partial.phases ?? defaults.phases,
    spanTasks: partial.spanTasks ?? defaults.spanTasks,
    taskMeta: partial.taskMeta ?? defaults.taskMeta,
    timeBlocks: partial.timeBlocks ?? defaults.timeBlocks,
    ui: partial.ui ?? defaults.ui
  };
}

export function upsertPhase(data: SchedulerData, phase: Phase): void {
  const index = data.phases.findIndex((item) => item.id === phase.id);
  if (index >= 0) data.phases[index] = phase;
  else data.phases.push(phase);
}

export function upsertSpanTask(data: SchedulerData, spanTask: SpanTask): void {
  data.spanTasks[spanTask.id] = spanTask;
}
```

- [ ] **Step 5: Implement calendar helpers**

Create `src/services/CalendarService.ts`:

```ts
import type { ReviewSummary } from "../models/types";

export interface CalendarPointTask {
  id: string;
  date?: string;
}

export interface CalendarSpanTask {
  id: string;
  spanStart?: string;
  spanEnd?: string;
}

export interface DaySummary {
  date: string;
  pointTaskCount: number;
  spanTaskCount: number;
  reviewSummary?: ReviewSummary;
  pressureLevel: "low" | "medium" | "high" | "overload";
}

export function spanCoversDate(span: CalendarSpanTask, date: string): boolean {
  if (!span.spanStart || !span.spanEnd) return false;
  return span.spanStart <= date && date <= span.spanEnd;
}

export function buildDaySummary(
  date: string,
  pointTasks: CalendarPointTask[],
  spanTasks: CalendarSpanTask[],
  reviewSummary?: ReviewSummary
): DaySummary {
  const pointTaskCount = pointTasks.filter((task) => task.date === date).length;
  const spanTaskCount = spanTasks.filter((span) => spanCoversDate(span, date)).length;
  const reviewCount = (reviewSummary?.overdue ?? 0) + (reviewSummary?.dueToday ?? 0);
  const load = pointTaskCount + spanTaskCount + reviewCount;
  const pressureLevel = load >= 10 ? "overload" : load >= 6 ? "high" : load >= 3 ? "medium" : "low";
  return { date, pointTaskCount, spanTaskCount, reviewSummary, pressureLevel };
}
```

- [ ] **Step 6: Implement review bridge summary**

Create `src/services/ReviewBridge.ts`:

```ts
import type { ReviewSummary } from "../models/types";

export type ReviewFrontmatter = Record<string, unknown>;

export function summarizeReviewFrontmatters(
  frontmatters: ReviewFrontmatter[],
  today: string,
  estimatedMinutesPerNote: number
): ReviewSummary {
  let overdue = 0;
  let dueToday = 0;

  for (const fm of frontmatters) {
    if (fm["复习状态"] === "暂停") continue;
    const nextReview = typeof fm["下次复习"] === "string" ? fm["下次复习"] : undefined;
    const isReviewCandidate = nextReview || fm["知识类型"] === "内化" || fm["复习次数"] !== undefined;
    if (!isReviewCandidate) continue;
    if (!nextReview || nextReview === today) {
      dueToday += 1;
    } else if (nextReview < today) {
      overdue += 1;
    }
  }

  return {
    overdue,
    dueToday,
    estimatedMinutes: (overdue + dueToday) * estimatedMinutesPerNote
  };
}
```

- [ ] **Step 7: Run tests**

Run: `npm test`

Expected: PASS for current tests.

---

### Task 4: Scan, Write, and Create Phase Notes

**Files:**
- Create: `src/services/TaskScanner.ts`
- Create: `src/services/TaskWriter.ts`
- Create: `src/services/PhaseService.ts`
- Extend: `tests/markdownTask.test.ts`

- [ ] **Step 1: Add source-line scanner tests**

Append to `tests/markdownTask.test.ts`:

```ts
import { scanMarkdownTasksFromText } from "../src/services/TaskScanner";

test("scans markdown text into stable file line task ids", () => {
  const tasks = scanMarkdownTasksFromText("Phase.md", "# Title\n- [ ] 设计任务 #task 📅 2026-06-12\ntext");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "Phase.md:1");
  assert.equal(tasks[0].title, "设计任务");
  assert.equal(tasks[0].date, "2026-06-12");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test`

Expected: FAIL because `TaskScanner.ts` does not exist.

- [ ] **Step 3: Implement scanner helper**

Create `src/services/TaskScanner.ts`:

```ts
import { TFile, type App } from "obsidian";
import type { ScannedTask } from "../models/types";
import { parseMarkdownTaskLine } from "../utils/markdownTask";

export function scanMarkdownTasksFromText(filePath: string, content: string): ScannedTask[] {
  return content.split(/\r?\n/).flatMap((line, lineNumber) => {
    const parsed = parseMarkdownTaskLine(line);
    if (!parsed) return [];
    return [{
      id: `${filePath}:${lineNumber}`,
      title: parsed.title,
      filePath,
      lineNumber,
      rawLine: line,
      completed: parsed.completed,
      date: parsed.date,
      remindTime: parsed.remindTime,
      tags: parsed.tags,
      quadrant: parsed.quadrant
    }];
  });
}

export class TaskScanner {
  constructor(private readonly app: App) {}

  async scanAllMarkdownTasks(): Promise<ScannedTask[]> {
    const files = this.app.vault.getMarkdownFiles();
    const results: ScannedTask[] = [];
    for (const file of files) {
      if (!(file instanceof TFile)) continue;
      const content = await this.app.vault.cachedRead(file);
      results.push(...scanMarkdownTasksFromText(file.path, content));
    }
    return results;
  }
}
```

- [ ] **Step 4: Implement TaskWriter**

Create `src/services/TaskWriter.ts`:

```ts
import type { App, TFile } from "obsidian";
import { removeTaskSchedule, setTaskCompleted, setTaskDate, setTaskReminderTime } from "../utils/markdownTask";

export class TaskWriter {
  constructor(private readonly app: App) {}

  async updateTaskLine(file: TFile, lineNumber: number, mutate: (line: string) => string): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    if (lineNumber < 0 || lineNumber >= lines.length) {
      throw new Error(`Task line ${lineNumber} is outside ${file.path}`);
    }
    lines[lineNumber] = mutate(lines[lineNumber]);
    await this.app.vault.modify(file, lines.join("\n"));
  }

  async scheduleDate(file: TFile, lineNumber: number, date: string): Promise<void> {
    await this.updateTaskLine(file, lineNumber, (line) => setTaskDate(line, date));
  }

  async scheduleTime(file: TFile, lineNumber: number, time: string): Promise<void> {
    await this.updateTaskLine(file, lineNumber, (line) => setTaskReminderTime(line, time));
  }

  async unschedule(file: TFile, lineNumber: number): Promise<void> {
    await this.updateTaskLine(file, lineNumber, removeTaskSchedule);
  }

  async complete(file: TFile, lineNumber: number, completed: boolean): Promise<void> {
    await this.updateTaskLine(file, lineNumber, (line) => setTaskCompleted(line, completed));
  }
}
```

- [ ] **Step 5: Implement PhaseService**

Create `src/services/PhaseService.ts`:

```ts
import { normalizePath, type App, type TFile } from "obsidian";
import type { Phase } from "../models/types";

export class PhaseService {
  constructor(private readonly app: App) {}

  async ensurePhaseNote(phase: Phase): Promise<TFile> {
    const path = normalizePath(phase.notePath);
    const existing = this.app.vault.getFileByPath(path);
    if (existing) return existing;

    await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
    const content = [
      "---",
      "personal-system-phase: true",
      `phase-id: ${phase.id}`,
      `phase-title: ${phase.title}`,
      `phase-start: ${phase.startDate}`,
      `phase-end: ${phase.endDate}`,
      "---",
      "",
      `# ${phase.title}`,
      "",
      "## 阶段目标",
      phase.goal ?? "",
      "",
      "## 长任务",
      "",
      "## 点任务",
      ""
    ].join("\n");
    return this.app.vault.create(path, content);
  }

  async appendPointTask(phaseNote: TFile, title: string, tags: string[]): Promise<void> {
    const content = await this.app.vault.read(phaseNote);
    const line = `- [ ] ${title} ${tags.map((tag) => `#${tag}`).join(" ")}`.trim();
    const marker = "## 点任务";
    const markerIndex = content.indexOf(marker);
    if (markerIndex < 0) {
      await this.app.vault.modify(phaseNote, `${content.trimEnd()}\n\n${marker}\n${line}\n`);
      return;
    }
    await this.app.vault.modify(phaseNote, `${content.trimEnd()}\n${line}\n`);
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;
    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getFolderByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}
```

- [ ] **Step 6: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 5: Main View and MVP Pages

**Files:**
- Create: `src/ui/PersonalSystemView.ts`
- Create: `src/ui/pages/PhasePage.ts`
- Create: `src/ui/pages/CalendarPage.ts`
- Create: `src/ui/pages/NowPage.ts`
- Create: `src/ui/pages/InboxPage.ts`
- Create: `src/ui/settings/PersonalSystemSettingTab.ts`
- Modify: `src/main.ts`
- Replace: `styles.css`

- [ ] **Step 1: Implement top-level view**

Create `src/ui/PersonalSystemView.ts`:

```ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "../models/constants";
import { renderPhasePage } from "./pages/PhasePage";
import { renderCalendarPage } from "./pages/CalendarPage";
import { renderNowPage } from "./pages/NowPage";
import { renderInboxPage } from "./pages/InboxPage";

type PageId = "phase" | "calendar" | "now" | "inbox" | "settings";

export class PersonalSystemView extends ItemView {
  private currentPage: PageId = "phase";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PERSONAL_SYSTEM;
  }

  getDisplayText(): string {
    return "Personal Scheduler";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("ps-root");
    const nav = root.createDiv({ cls: "ps-top-nav" });
    this.addNavButton(nav, "phase", "阶段");
    this.addNavButton(nav, "calendar", "日历");
    this.addNavButton(nav, "now", "当下");
    this.addNavButton(nav, "inbox", "临时");
    this.addNavButton(nav, "settings", "设置");

    const page = root.createDiv({ cls: "ps-page" });
    if (this.currentPage === "phase") renderPhasePage(page);
    else if (this.currentPage === "calendar") renderCalendarPage(page);
    else if (this.currentPage === "now") renderNowPage(page);
    else if (this.currentPage === "inbox") renderInboxPage(page);
    else page.createDiv({ cls: "ps-panel", text: "设置请在 Obsidian 插件设置页中配置。" });
  }

  private addNavButton(nav: HTMLElement, page: PageId, label: string): void {
    const button = nav.createEl("button", { cls: "ps-nav-button", text: label });
    button.toggleClass("is-active", page === this.currentPage);
    button.addEventListener("click", () => {
      this.currentPage = page;
      this.render();
    });
  }
}
```

- [ ] **Step 2: Implement MVP placeholder pages with real layout affordances**

Create `src/ui/pages/PhasePage.ts`:

```ts
export function renderPhasePage(container: HTMLElement): void {
  container.empty();
  container.addClass("ps-phase-page");
  const grid = container.createDiv({ cls: "ps-three-column" });
  renderPanel(grid, "阶段列表", ["创建阶段", "阶段时间", "阶段目标"]);
  renderPanel(grid, "当前阶段", ["长任务", "点任务", "四象限", "未排期任务"]);
  renderPanel(grid, "任务详情", ["进度", "估时", "父子关系", "送入日历"]);
}

function renderPanel(parent: HTMLElement, title: string, items: string[]): void {
  const panel = parent.createDiv({ cls: "ps-panel" });
  panel.createEl("h2", { text: title });
  for (const item of items) {
    panel.createDiv({ cls: "ps-list-row", text: item });
  }
}
```

Create `src/ui/pages/CalendarPage.ts`:

```ts
export function renderCalendarPage(container: HTMLElement): void {
  container.empty();
  const shell = container.createDiv({ cls: "ps-calendar-shell" });
  const pool = shell.createDiv({ cls: "ps-panel ps-calendar-pool" });
  pool.createEl("h2", { text: "未排期任务池" });
  pool.createDiv({ cls: "ps-list-row", text: "点任务" });
  pool.createDiv({ cls: "ps-list-row", text: "长任务" });

  const calendar = shell.createDiv({ cls: "ps-panel ps-calendar-grid" });
  calendar.createEl("h2", { text: "月 / 周排期" });
  for (let i = 1; i <= 35; i += 1) {
    const cell = calendar.createDiv({ cls: "ps-day-cell" });
    cell.createSpan({ cls: "ps-day-number", text: String(i) });
  }
}
```

Create `src/ui/pages/NowPage.ts`:

```ts
export function renderNowPage(container: HTMLElement): void {
  container.empty();
  const grid = container.createDiv({ cls: "ps-three-column" });
  const pool = grid.createDiv({ cls: "ps-panel" });
  pool.createEl("h2", { text: "今日任务池" });
  ["今日待安排", "逾期任务", "今日复习", "临时任务"].forEach((text) => pool.createDiv({ cls: "ps-list-row", text }));

  const blocks = grid.createDiv({ cls: "ps-panel ps-time-blocks" });
  blocks.createEl("h2", { text: "今日时间块" });
  for (let i = 0; i < 48; i += 1) {
    const hour = String(Math.floor(i / 2)).padStart(2, "0");
    const minute = i % 2 === 0 ? "00" : "30";
    blocks.createDiv({ cls: "ps-time-block", text: `${hour}:${minute} 空闲` });
  }

  const status = grid.createDiv({ cls: "ps-panel" });
  status.createEl("h2", { text: "今日状态" });
  ["当前任务", "下一提醒", "复习压力", "逾期数量"].forEach((text) => status.createDiv({ cls: "ps-list-row", text }));
}
```

Create `src/ui/pages/InboxPage.ts`:

```ts
export function renderInboxPage(container: HTMLElement): void {
  container.empty();
  const panel = container.createDiv({ cls: "ps-panel ps-inbox-page" });
  panel.createEl("h2", { text: "收集 / 代办" });
  panel.createEl("p", { cls: "ps-muted", text: "每个代办文件夹内的 Markdown 笔记是一类代办。临时任务只通过此入口收集。" });
  panel.createEl("button", { cls: "mod-cta", text: "只收集，稍后处理" });
  panel.createEl("button", { text: "安排到今天" });
}
```

- [ ] **Step 3: Implement settings tab shell**

Create `src/ui/settings/PersonalSystemSettingTab.ts`:

```ts
import { PluginSettingTab, Setting } from "obsidian";
import type PersonalSchedulerPlugin from "../../main";

export class PersonalSystemSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: PersonalSchedulerPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Personal Scheduler" });
    new Setting(containerEl)
      .setName("阶段笔记文件夹")
      .setDesc("阶段笔记既保存方向，也承载该阶段创建的点任务。")
      .addText((text) => text.setPlaceholder("Personal Scheduler/Phases"));
    new Setting(containerEl)
      .setName("代办文件夹")
      .setDesc("文件夹内每个 Markdown 文件是一类代办。")
      .addText((text) => text.setPlaceholder("Personal Scheduler/Inbox"));
  }
}
```

- [ ] **Step 4: Wire view and settings into plugin**

Replace `src/main.ts` with:

```ts
import { Notice, Plugin } from "obsidian";
import { VIEW_TYPE_PERSONAL_SYSTEM } from "./models/constants";
import { PersonalSystemView } from "./ui/PersonalSystemView";
import { PersonalSystemSettingTab } from "./ui/settings/PersonalSystemSettingTab";

export default class PersonalSchedulerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_PERSONAL_SYSTEM, (leaf) => new PersonalSystemView(leaf));
    this.addSettingTab(new PersonalSystemSettingTab(this));

    this.addRibbonIcon("calendar-days", "Open Personal Scheduler", () => this.activateView());
    this.addCommand({
      id: "open-personal-scheduler",
      name: "Open Personal Scheduler",
      callback: () => this.activateView()
    });
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PERSONAL_SYSTEM)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("No workspace leaf available.");
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_PERSONAL_SYSTEM, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
```

- [ ] **Step 5: Replace CSS with full MVP layout styles**

Replace `styles.css` with:

```css
.ps-root {
  --ps-panel: var(--background-secondary);
  --ps-border: var(--background-modifier-border);
  --ps-muted: var(--text-muted);
  --ps-accent: var(--interactive-accent);
  box-sizing: border-box;
  height: 100%;
  padding: 12px;
  color: var(--text-normal);
}

.ps-top-nav {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px;
  margin-bottom: 12px;
  border: 1px solid var(--ps-border);
  border-radius: 8px;
  background: var(--background-primary);
}

.ps-nav-button {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--text-muted);
  background: transparent;
}

.ps-nav-button.is-active {
  color: var(--text-on-accent);
  background: var(--ps-accent);
}

.ps-page {
  height: calc(100% - 56px);
  overflow: auto;
}

.ps-three-column {
  display: grid;
  grid-template-columns: minmax(180px, 0.9fr) minmax(280px, 1.4fr) minmax(220px, 1fr);
  gap: 12px;
  min-height: 100%;
}

.ps-panel {
  border: 1px solid var(--ps-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--ps-panel);
}

.ps-panel h2 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 650;
}

.ps-list-row {
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px solid var(--ps-border);
  border-radius: 6px;
  background: var(--background-primary);
}

.ps-calendar-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
}

.ps-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(96px, 1fr));
  gap: 8px;
}

.ps-calendar-grid h2 {
  grid-column: 1 / -1;
}

.ps-day-cell {
  min-height: 96px;
  border: 1px solid var(--ps-border);
  border-radius: 6px;
  padding: 6px;
  background: var(--background-primary);
}

.ps-day-number {
  color: var(--ps-muted);
  font-size: 12px;
}

.ps-time-blocks {
  max-height: calc(100vh - 180px);
  overflow: auto;
}

.ps-time-block {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid var(--ps-border);
  color: var(--ps-muted);
}

.ps-inbox-page button {
  margin-right: 8px;
}

.ps-muted {
  color: var(--ps-muted);
}

@media (max-width: 900px) {
  .ps-three-column,
  .ps-calendar-shell {
    grid-template-columns: 1fr;
  }

  .ps-calendar-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
```

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: PASS and `main.js` generated.

---

### Task 6: Completion Verification

**Files:**
- Inspect all files from Tasks 1-5.

- [ ] **Step 1: Run automated checks**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: build passes.

- [ ] **Step 2: Verify required files exist**

Run:

```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\' } | Select-Object FullName
```

Expected: project contains manifest, package, source, styles, scripts, tests, specs, and plans.

- [ ] **Step 3: Verify MVP scope against spec**

Run:

```powershell
Select-String -Path src\**\*.ts,styles.css -Pattern "Personal Scheduler|阶段|日历|当下|临时|spaced|TaskForge|48|📅|⏰"
```

Expected: evidence appears in service/UI files showing the MVP mechanisms are represented.

- [ ] **Step 4: Report limitations clearly**

Expected report:

```text
Automated parser/store/calendar/review tests pass.
Build passes.
Current MVP includes the service foundations and a loaded Obsidian workbench UI.
Drag-and-drop persistence may still need a follow-up implementation slice if not completed in this run.
```

If drag-and-drop persistence remains incomplete, keep the goal active and continue with the next implementation plan slice.
