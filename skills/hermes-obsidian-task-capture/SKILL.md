---
name: hermes-obsidian-task-capture
description: Capture user QQ text or OCR text into Obsidian TaskForge-compatible Dataview tasks and propose scheduling from Calendar Bridge context. Use when Hermes receives natural-language task requests, OCR text from images, reminders, errands, study/work tasks, or asks to record/schedule tasks in the user's Obsidian vault.
---

# Hermes Obsidian Task Capture

## Core Rule

Default to confirmation first. Do not write or reschedule anything until the user explicitly confirms the proposed task line, target file, and schedule changes.

## Inputs

- User message text from QQ.
- OCR text from images, if Hermes already provides it. Do not perform OCR in this skill.
- Calendar context JSON at `Calendar-Bridge/ai-schedule-context.json` under the Obsidian vault root.
- Obsidian vault root from Hermes runtime config. If no runtime value exists, use `D:\hzbj_obsidian`.

## Read Context First

Before proposing a task or schedule, read:

```text
<vault-root>/Calendar-Bridge/ai-schedule-context.json
```

If the file is missing, tell the user to reload or rescan the Calendar Bridge plugin in Obsidian, then continue with task capture only. Do not recreate Calendar Bridge logic by scanning the whole vault.

Use these JSON fields:

- `unscheduledTasks`: avoid duplicates and understand current backlog.
- `dailyLoadsByHorizon["7"]`, `["14"]`, `["30"]`: compare `taskMinutes`, `reviewMinutes`, and `totalMinutes` before suggesting dates.
- `overdueTasks`: surface conflicts or urgent cleanup.
- `longTaskProgress`: account for long tasks that are behind or have high daily estimated minutes.
- `settings.defaultUnestimatedTaskMinutes`: default estimate when the user gives no duration.
- `writePolicy.mode`: must remain `confirm-before-write`.

## Target File Selection

Choose the target Markdown file from the user's prompt, under the `规划/` folder. Do not always write to one fixed inbox file.

Selection examples:

- School, exam, homework, paper, English, class, course -> a study or school file under `规划/`.
- Work, client, delivery, meeting, project -> a work or project file under `规划/`.
- Errand, life admin, buy, repair, call, appointment -> a life/admin file under `规划/`.
- If the prompt names a specific project, phase, course, or folder, prefer the matching file.
- If multiple files fit or the target is ambiguous, ask the user to choose before writing.

Never write outside `规划/` unless the user explicitly requests it and confirms.

## Task Line Format

Write Markdown checkbox tasks using Dataview inline fields:

```md
- [ ] 任务标题 30m [priority:: high] [created:: YYYY-MM-DD]
```

If the user confirms a point-task schedule:

```md
- [ ] 任务标题 30m [priority:: high] [created:: YYYY-MM-DD] [scheduled:: YYYY-MM-DD] [due:: YYYY-MM-DD]
```

If the user confirms a long-task range:

```md
- [ ] 任务标题 [type:: long] [priority:: medium] [created:: YYYY-MM-DD] [start:: YYYY-MM-DD] [due:: YYYY-MM-DD] [progress:: 0%]
```

Priority write values must be exactly:

```text
highest / high / medium / low
```

For reading only, treat old `P1/P2/P3/P4`, `1/2/3/4`, `normal`, and `lowest` as compatible aliases. Do not write old `P1/P2/P3` values.

Preserve non-plugin Dataview fields if editing an existing task. Do not delete arbitrary fields such as `context`, `project`, `repeat`, `startTime`, `onCompletion`, or reminder tags.

## Scheduling Heuristic

Use Calendar Bridge context to propose dates:

1. Prefer days with lower `totalMinutes`.
2. Avoid adding low-priority work to days with heavy review pressure.
3. Put urgent or deadline-driven tasks before their due date, but show the pressure tradeoff.
4. If `longTaskProgress` contains behind tasks, avoid overloading nearby days unless the new task is urgent.
5. Use `settings.defaultUnestimatedTaskMinutes` when no estimate is given.
6. For unclear effort, ask for confirmation of the estimate instead of inventing a large duration.

## Confirmation Response

Before writing, respond with a compact proposal:

```text
准备记录：
目标文件：规划/...
任务行：- [ ] ...
排期建议：YYYY-MM-DD，原因：当天 totalMinutes=...，reviewMinutes=...
是否写入？确认后我再改 Obsidian。
```

If no schedule is appropriate, propose an unscheduled task and explain why.

## After Confirmation

Only after explicit confirmation:

1. Append the task line to the chosen target file, or update the existing matching task if the user asked to modify it.
2. Keep line endings and existing file content intact as much as possible.
3. Report exactly what file changed and what task line was written.
4. Do not edit `Calendar-Bridge/ai-schedule-context.json`; the Obsidian plugin owns that file and will refresh it automatically.

## Duplicate Check

Before proposing a new task, compare the new title against `unscheduledTasks`, `overdueTasks`, and obvious scheduled tasks mentioned in the JSON. If it looks like a duplicate, ask whether to update the existing task or create a new one.
