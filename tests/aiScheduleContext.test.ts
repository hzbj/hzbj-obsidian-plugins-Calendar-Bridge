import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { App } from "obsidian";
import { AI_SCHEDULE_CONTEXT_PATH, AiScheduleContextExporter, buildAiScheduleContext } from "../src/services/AiScheduleContext";
import type { CalendarSettings, CalendarTask, ReviewPressureByDate } from "../src/models/types";

const settings: CalendarSettings = {
  triggerTags: ["task", "todo"],
  weekStartsOn: 1,
  readLegacyEmojiDates: true,
  includedPathPrefixes: ["规划/"],
  excludedPathPrefixes: ["time-blocks-data/", ".obsidian/", ".trash/"],
  primaryScheduleField: "scheduled",
  estimateField: "estimate",
  showAllDataviewFields: true,
  reviewPressureEnabled: true,
  reviewBaseMinutes: 2,
  reviewCharsPerMinute: 800,
  defaultUnestimatedTaskMinutes: 30,
  monthHeatmapMode: "task-estimate-plus-review",
  scheduledDayFolder: "规划/日"
};

test("builds AI schedule context with stable horizons and planning signals", () => {
  const reviewPressure: ReviewPressureByDate = {
    "2026-06-18": { count: 1, minutes: 12, chars: 8000 },
    "2026-06-20": { count: 2, minutes: 20, chars: 12000 }
  };
  const context = buildAiScheduleContext({
    anchorDate: "2026-06-18",
    tasks: [
      task("u1", "Loose", {}, { priority: "P1" }),
      task("s1", "Scheduled", { scheduled: "2026-06-18" }, { estimateMinutes: 45, priority: "high" }),
      task("o1", "Overdue", { due: "2026-06-17" }, { priority: "low" }),
      task("l1", "Long", { start: "2026-06-10", due: "2026-06-22" }, { taskKind: "long", estimateMinutes: 600, progressPercent: 25 })
    ],
    reviewPressure,
    settings
  });

  assert.equal(AI_SCHEDULE_CONTEXT_PATH, "Calendar-Bridge/ai-schedule-context.json");
  assert.deepEqual(Object.keys(context.dailyLoadsByHorizon), ["7", "14", "30"]);
  assert.equal(context.dailyLoadsByHorizon["7"].length, 7);
  assert.equal(context.dailyLoadsByHorizon["30"].at(-1)?.date, "2026-07-17");
  assert.deepEqual(context.dailyLoadsByHorizon["7"][0], {
    date: "2026-06-18",
    taskMinutes: 45,
    reviewMinutes: 12,
    totalMinutes: 57
  });
  assert.deepEqual(context.unscheduledTasks.map((item) => ({ id: item.id, priority: item.priority, priorityRank: item.priorityRank })), [
    { id: "u1", priority: "highest", priorityRank: 1 },
    { id: "o1", priority: "low", priorityRank: 4 }
  ]);
  assert.deepEqual(context.overdueTasks.map((item) => item.id), ["o1"]);
  assert.deepEqual(context.longTaskProgress.map((item) => ({
    id: item.task.id,
    status: item.status,
    dailyEstimatedMinutes: item.dailyEstimatedMinutes
  })), [{ id: "l1", status: "behind", dailyEstimatedMinutes: 113 }]);
  assert.equal(context.settings.defaultUnestimatedTaskMinutes, 30);
  assert.equal(context.writePolicy.mode, "confirm-before-write");
});

test("syncs AI schedule context only when exported JSON changes", async () => {
  const fakeApp = createFakeApp();
  const exporter = new AiScheduleContextExporter(fakeApp as unknown as App);
  const input = { anchorDate: "2026-06-18", tasks: [task("u1", "Loose")], reviewPressure: {}, settings };

  assert.equal(await exporter.sync(input), "created");
  assert.deepEqual(fakeApp.createdFolders, ["Calendar-Bridge"]);
  assert.equal(fakeApp.createdFiles.length, 1);
  assert.equal(await exporter.sync(input), "unchanged");
  assert.equal(fakeApp.modifiedFiles.length, 0);

  assert.equal(await exporter.sync({ ...input, tasks: [task("u1", "Loose"), task("u2", "New")] }), "updated");
  assert.equal(fakeApp.modifiedFiles.length, 1);
});

function task(
  id: string,
  text: string,
  dates: Partial<CalendarTask["dates"]> = {},
  options: Partial<CalendarTask> = {}
): CalendarTask {
  const scheduleDate = dates.scheduled ?? dates.due ?? dates.start;
  const isLong = options.taskKind === "long";
  return {
    id,
    text,
    filePath: options.filePath ?? "规划/代办/未排期任务池.md",
    lineNumber: Number(id.charCodeAt(0)),
    rawLine: `- [${options.completed ? "x" : " "}] ${text}`,
    completed: options.completed ?? false,
    metadata: {},
    dates,
    dateSources: {},
    taskKind: isLong ? "long" : "point",
    createdDate: dates.created,
    progressPercent: options.progressPercent ?? 0,
    scheduleDate,
    spanStart: isLong ? dates.start : undefined,
    spanEnd: isLong ? dates.due : undefined,
    dueDate: dates.due,
    dateSource: scheduleDate ? "dataview" : "none",
    triggerType: "inline",
    ...options
  };
}

function createFakeApp() {
  const folders = new Set<string>();
  const files = new Map<string, { path: string; extension: string; content: string }>();
  const fakeApp = {
    createdFolders: [] as string[],
    createdFiles: [] as string[],
    modifiedFiles: [] as string[],
    vault: {
      getAbstractFileByPath(path: string) {
        if (files.has(path)) return files.get(path);
        if (folders.has(path)) return { path };
        return null;
      },
      async createFolder(path: string) {
        folders.add(path);
        fakeApp.createdFolders.push(path);
      },
      async create(path: string, content: string) {
        const file = { path, extension: "json", content };
        files.set(path, file);
        fakeApp.createdFiles.push(path);
        return file;
      },
      async read(file: { content: string }) {
        return file.content;
      },
      async modify(file: { path: string; content: string }, content: string) {
        file.content = content;
        fakeApp.modifiedFiles.push(file.path);
      }
    }
  };
  return fakeApp;
}
