# Personal Scheduler Design

## Goal

Build an Obsidian personal scheduling plugin that replaces the existing time-blocks and Task-Maker plugins while integrating with spaced-review without replacing its review and rating flow.

The plugin turns work into a linear flow:

```text
Phase
-> span tasks
-> point tasks
-> unscheduled pool
-> month planning
-> week planning
-> today's 48 time blocks
-> TaskForge-compatible reminders
-> completion and progress feedback
```

## Confirmed Product Rules

- The MVP is a complete integrated plugin, not a quick stitch of the old plugins.
- Point tasks are the concrete action unit.
- Span tasks express date range and direction; they do not auto-generate daily work.
- Month and week views only schedule dates and spans.
- The Now page is the only place that assigns concrete times.
- Markdown checkbox lines are the fact source for point task title, completion, date, reminder time, and TaskForge compatibility.
- Plugin JSON stores data that Markdown does not model well: phases, span task ranges, parent-child relations, progress, estimates, time-block assignment details, and UI state.
- Created point tasks are written into the current phase note. The phase note is both a direction document and the task-bearing file.
- Temporary tasks use one unified Inbox page. The user chooses an inbox folder, and every Markdown file in that folder is one inbox category.
- Temporary task creation has two options: collect only, or schedule for today.
- spaced-review remains independent. This plugin reads its queue summary and can create a `#review` proxy point task, but real review completion still opens spaced-review and uses its rating logic.
- TaskForge integration is Markdown-format-only: write `📅 YYYY-MM-DD` and `⏰ HH:mm`.

## Reference Plugins

- `D:\Project\obsidian-Task-Maker`: phase scanning, quadrant tags, phase note frontmatter, archive/cleanup lessons.
- `D:\Project\obsidian-plugins-time-blocks`: 48 half-hour time blocks, plan/review split, category/time block rendering.
- `D:\Project\obsidian-spaced-review`: frontmatter fields and review queue semantics.

## Architecture

Create an independent Obsidian plugin in `D:\Project\obsidian-Personal-System`.

Main units:

- `PhaseService`: creates phase notes, updates phase metadata, and appends point tasks to the phase note task section.
- `TaskScanner`: scans Markdown checkbox lines and extracts task title, completion, tags, date, reminder time, quadrant, and source line.
- `TaskWriter`: the only service allowed to rewrite Markdown task lines. It schedules dates, reminder times, completion state, and unscheduling.
- `SchedulerStore`: stores `personal-scheduler-data.json` with phases, span tasks, task metadata, time blocks, settings, and UI state.
- `CalendarService`: builds month/week models from scanned tasks, span tasks, and review summaries.
- `ReviewBridge`: reads spaced-review-style frontmatter to summarize overdue and due-today review pressure.
- `PersonalSystemView`: one Obsidian item view with top navigation: Phase, Calendar, Now, Inbox, Settings.

## Data Model

```ts
type TaskKind = "point" | "span";
type QuadrantCode = "ui" | "in" | "un" | "nn";

interface Phase {
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

interface SpanTask {
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
  status: "unscheduled" | "scheduled" | "active" | "paused" | "done";
  createdAt: string;
  updatedAt: string;
}

interface TaskMeta {
  taskId: string;
  kind: TaskKind;
  phaseId?: string;
  parentSpanTaskId?: string;
  estimatedMinutes?: number;
  quadrant?: QuadrantCode;
  priority?: 1 | 2;
}

interface ScannedTask {
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
```

Plugin data file:

```json
{
  "version": 1,
  "phases": [],
  "spanTasks": {},
  "taskMeta": {},
  "timeBlocks": {},
  "settings": {
    "phaseFolderPath": "Personal Scheduler/Phases",
    "inboxFolderPath": "Personal Scheduler/Inbox",
    "defaultInboxFile": "收集.md",
    "tagNamespace": "T",
    "reviewEstimatedMinutes": 30
  },
  "ui": {}
}
```

## Markdown Contracts

Phase note template:

```md
---
personal-system-phase: true
phase-id: obsidian-personal-system
phase-title: Obsidian 个人排期系统
phase-start: 2026-06-12
phase-end: 2026-06-30
---

# Obsidian 个人排期系统

## 阶段目标

## 长任务

## 点任务
- [ ] 设计任务模型 #task #T/obsidian-personal-system-in
```

TaskForge-compatible point task:

```md
- [ ] 设计月视图拖拽 #task 📅 2026-06-17 ⏰ 21:00
```

Inbox folder:

```text
Personal Scheduler/Inbox/
├── 收集.md
├── 工作.md
├── 学习.md
└── 生活.md
```

Temporary task examples:

```md
- [ ] 检查 NAS 同步 #task
- [ ] 检查 NAS 同步 #task 📅 2026-06-12
```

## UI Design

The plugin uses one main workbench with restrained, dense, readable panels. Top navigation follows the real workflow:

```text
阶段 | 日历 | 当下 | 临时 | 设置
```

Phase page:

- Left: phase list.
- Center: current phase detail and span tasks.
- Right: unscheduled point task pool and selected task detail.
- Creating point tasks appends Markdown to the current phase note.

Calendar page:

- Toggle between month and week.
- Month: left unscheduled pool, right month grid with point task cards, span bars, pressure color.
- Week: span overview, seven day columns, detail panel.
- Month/week date operations modify only `📅` for point tasks.
- Span task operations modify JSON only.

Now page:

- Three columns: Today Pool, 48 Time Blocks, Today Status.
- Drag a today task into a time block to write `⏰ HH:mm`.
- Conflict MVP supports replace or cancel.
- Deferring changes `📅`; moving back to unscheduled removes `📅` and `⏰`.

Inbox page:

- User chooses an inbox category Markdown file inside the configured inbox folder.
- Add task with either collect-only or schedule-today behavior.
- Later assignment can move tasks into a phase/long task or calendar date.

Settings page:

- Phase note folder.
- Inbox folder and default inbox file.
- Tag namespace.
- Review estimated minutes.
- Time block row height.
- TaskForge Markdown output toggle.

## MVP Acceptance Criteria

1. Create a phase and phase note.
2. Create a span task under a phase.
3. Create a point task under a span task and write it to the phase note.
4. Scan Markdown tasks including checkbox state, tags, date, reminder time, and quadrant.
5. Month view schedules a point task by writing `📅 YYYY-MM-DD`.
6. Month view schedules a span task range in JSON without creating daily tasks.
7. Week view moves point task dates by changing only `📅`.
8. Week view creates a point task from a span task and records parent-child relation.
9. Now page displays today, overdue, review summary, and 48 half-hour time blocks.
10. Now page writes `⏰ HH:mm` when scheduling into a time block.
11. Now page can defer, unschedule, and complete point tasks.
12. Inbox page writes temporary tasks only into user-selected inbox category notes.
13. ReviewBridge summarizes spaced-review without replacing its rating flow.
14. Markdown output remains TaskForge-compatible.
15. UI is visually orderly and follows the linear workflow.

## Test Strategy

Automated tests:

- `markdownTask.test.ts`: parse and mutate checkbox lines with `#task`, `📅`, `⏰`, quadrant tags, completion, and unscheduling.
- `taskWriter.test.ts`: update task lines for schedule, reschedule, reminder time, defer, unschedule, and complete.
- `schedulerStore.test.ts`: load defaults and persist phase/span/task/time-block settings.
- `calendarService.test.ts`: group point tasks by date, span tasks by range, and pressure summaries.
- `reviewBridge.test.ts`: summarize due-today, overdue, and paused review notes.

Manual validation:

- `npm run build` passes.
- Obsidian loads the plugin and opens the main view.
- Full workflow passes: create phase, create span task, create point task, month schedule, week reschedule, Now time block schedule, complete task.
- Actual Markdown contains TaskForge-compatible date and reminder syntax.
- spaced-review plugin remains independent.

## Non-MVP

- Automatic scheduling.
- AI recommendations.
- Multi-user sync.
- Full Gantt editor.
- Complex recurrence.
- Full habit system.
- Automatic progress calculation.
