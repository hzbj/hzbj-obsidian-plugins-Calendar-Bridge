import type {
  CalendarDay,
  CalendarDayLoad,
  CalendarSpanBar,
  CalendarTask,
  CalendarViewModel,
  LongTaskProgress,
  LongTaskTimelineRow,
  ReviewPressureByDate,
  SourceTaskGroup,
  SourceTaskGroupState,
  WeekDayRow
} from "../models/types";
import { addDays, monthGridDates, todayString, weekDates } from "../utils/date";
import { normalizeTaskPriority } from "../utils/DataviewTaskDate";

export function buildMonthViewModel(
  anchorDate: string,
  tasks: CalendarTask[],
  weekStartsOn: 0 | 1,
  reviewPressure: ReviewPressureByDate = {},
  defaultUnestimatedTaskMinutes = 30,
  sourceGroupState: SourceTaskGroupState = {}
): CalendarViewModel {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "month", sourceGroupState);
}

export function buildWeekViewModel(
  anchorDate: string,
  tasks: CalendarTask[],
  weekStartsOn: 0 | 1,
  reviewPressure: ReviewPressureByDate = {},
  defaultUnestimatedTaskMinutes = 30
): CalendarViewModel {
  const days = weekDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "week");
}

function buildViewModel(
  days: CalendarDay[],
  tasks: CalendarTask[],
  anchorDate: string,
  reviewPressure: ReviewPressureByDate,
  defaultUnestimatedTaskMinutes: number,
  mode: "month" | "week",
  sourceGroupState: SourceTaskGroupState = {}
): CalendarViewModel {
  const activeTasks = tasks.filter((task) => !task.completed);
  // Month pressure is a historical record; completing a point task should not erase its scheduled load.
  const loadTasks = mode === "month" ? tasks : activeTasks;
  const pointTasks = activeTasks.filter((task) => task.taskKind !== "long");
  const pointLoadTasks = loadTasks.filter((task) => task.taskKind !== "long");
  const longTasks = activeTasks.filter((task) => task.taskKind === "long");
  const topLevelLongTasks = longTasks.filter((task) => !task.parentLongTaskId);
  const visibleDates = new Set(days.map((day) => day.date));
  const tasksByDate: Record<string, CalendarTask[]> = {};
  const dayLoads: Record<string, CalendarDayLoad> = {};

  for (const day of days) {
    const review = reviewPressure[day.date] ?? { count: 0, minutes: 0, chars: 0 };
    tasksByDate[day.date] = [];
    dayLoads[day.date] = {
      date: day.date,
      taskCount: 0,
      taskMinutes: 0,
      reviewCount: review.count,
      reviewMinutes: review.minutes,
      heatScore: review.minutes
    };
  }

  for (const task of pointLoadTasks) {
    for (const date of activeDatesForTask(task, days[0]?.date, days[days.length - 1]?.date, mode)) {
      if (!visibleDates.has(date)) continue;
      tasksByDate[date].push(task);
      dayLoads[date].taskCount += 1;
      dayLoads[date].taskMinutes += task.estimateMinutes ?? defaultUnestimatedTaskMinutes;
      dayLoads[date].heatScore = dayLoads[date].taskMinutes + dayLoads[date].reviewMinutes;
    }
  }

  const overdueTasks = pointTasks.flatMap((task) => {
    const reason = getOverdueReason(task, todayStringFromAnchor(anchorDate));
    return reason ? [{ ...task, overdueReason: reason }] : [];
  });
  const unifiedUnscheduledTasks = activeTasks.flatMap((task) => {
    const reason = getUnifiedUnscheduledReason(task);
    return reason ? [{ ...task, unscheduledReason: reason }] : [];
  });
  const unscheduledTasks = pointTasks.flatMap((task) => {
    const reason = getUnscheduledReason(task);
    return reason ? [{ ...task, unscheduledReason: reason }] : [];
  });
  const childTasksByLongTaskId = buildChildTasksByLongTaskId(activeTasks);

  return {
    days,
    tasksByDate,
    unscheduledTasks,
    overdueTasks,
    unifiedUnscheduledTasks,
    dayLoads,
    spanBars: mode === "month" ? buildSpanBars(days, activeTasks) : [],
    longTaskTimelineRows: mode === "month" ? buildLongTaskTimelineRows(days, topLevelLongTasks, childTasksByLongTaskId, todayStringFromAnchor(anchorDate)) : [],
    sourceTaskGroups: mode === "month" ? buildSourceTaskGroups(unifiedUnscheduledTasks, sourceGroupState) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, todayStringFromAnchor(anchorDate)),
    longUnscheduledTasks: longTasks.filter((task) => !task.spanStart || !task.spanEnd),
    longOverdueTasks: longTasks.filter((task) => isLongTaskOverdue(task, todayStringFromAnchor(anchorDate)))
  };
}

function buildChildTasksByLongTaskId(tasks: CalendarTask[]): Map<string, CalendarTask[]> {
  const byParent = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
    if (!task.parentLongTaskId || task.parentLongTaskId === task.id) continue;
    const children = byParent.get(task.parentLongTaskId) ?? [];
    children.push(task);
    byParent.set(task.parentLongTaskId, children);
  }
  for (const [parentId, children] of byParent) {
    byParent.set(parentId, sortLongTaskChildren(children));
  }
  return byParent;
}

function sortLongTaskChildren(tasks: CalendarTask[]): CalendarTask[] {
  return [...tasks].sort((a, b) => {
    const leftDate = childTaskSortDate(a);
    const rightDate = childTaskSortDate(b);
    if (leftDate && rightDate) {
      const dateCompare = leftDate.localeCompare(rightDate);
      if (dateCompare !== 0) return dateCompare;
    } else if (leftDate) {
      return -1;
    } else if (rightDate) {
      return 1;
    }
    const endCompare = (a.spanEnd ?? "").localeCompare(b.spanEnd ?? "");
    if (endCompare !== 0) return endCompare;
    return a.id.localeCompare(b.id);
  });
}

function childTaskSortDate(task: CalendarTask): string | undefined {
  if (task.taskKind === "long") return task.spanStart ?? task.scheduleDate;
  return task.scheduleDate;
}

export function normalizePriorityRank(priority: string | undefined): 1 | 2 | 3 | 4 {
  const normalized = normalizeTaskPriority(priority);
  if (normalized === "highest") return 1;
  if (normalized === "high") return 2;
  if (normalized === "medium") return 3;
  return 4;
}

export function buildSourceTaskGroups(tasks: CalendarTask[], state: SourceTaskGroupState = {}): SourceTaskGroup[] {
  const byFile = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
    const items = byFile.get(task.filePath) ?? [];
    items.push(task);
    byFile.set(task.filePath, items);
  }

  const order = state.order ?? [];
  const indexByFile = new Map(order.map((filePath, index) => [filePath, index]));
  return [...byFile.entries()]
    .sort(([left], [right]) => {
      const leftIndex = indexByFile.get(left);
      const rightIndex = indexByFile.get(right);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return left.localeCompare(right);
    })
    .map(([sourceFilePath, groupTasks]) => ({
      sourceFilePath,
      sourceFileName: sourceFilePath.split("/").pop() ?? sourceFilePath,
      collapsed: Boolean(state.collapsed?.[sourceFilePath]),
      tasks: sortTasksForGroup(groupTasks, state)
    }));
}

function sortTasksForGroup(tasks: CalendarTask[], state: SourceTaskGroupState): CalendarTask[] {
  if (state.sortMode !== "priority") return tasks;
  return [...tasks].sort((a, b) => {
    const priorityCompare = normalizePriorityRank(a.priority) - normalizePriorityRank(b.priority);
    if (priorityCompare !== 0) return priorityCompare;
    return a.id.localeCompare(b.id);
  });
}

function buildLongTaskProgress(tasks: CalendarTask[], today: string): LongTaskProgress[] {
  return tasks
    .filter((task) => task.spanStart && task.spanEnd && !isLongTaskOverdue(task, today))
    .map((task) => {
      const start = task.spanStart as string;
      const due = task.spanEnd as string;
      const totalDays = Math.max(1, diffDays(start, due));
      const daysElapsed = Math.min(totalDays, Math.max(0, diffDays(start, today)));
      const daysLeft = Math.max(1, diffDays(today, due));
      const progressPercent = task.progressPercent ?? 0;
      const expectedProgressPercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      const remainingRatio = Math.max(0, 100 - progressPercent) / 100;
      const dailyProgressPressure = Math.round(((100 - progressPercent) / daysLeft) * 10) / 10;
      const dailyEstimatedMinutes = task.estimateMinutes !== undefined
        ? Math.round((task.estimateMinutes * remainingRatio) / daysLeft)
        : undefined;
      return {
        task,
        daysElapsed,
        daysLeft,
        totalDays,
        expectedProgressPercent,
        progressPercent,
        dailyProgressPressure,
        dailyEstimatedMinutes,
        status: progressPercent + 5 < expectedProgressPercent ? "behind" : progressPercent > expectedProgressPercent + 5 ? "ahead" : "on-track"
      };
    });
}

function isLongTaskOverdue(task: CalendarTask, today: string): boolean {
  return Boolean(task.spanEnd && task.spanEnd < today && (task.progressPercent ?? 0) < 100);
}

function buildLongTaskTimelineRows(
  days: CalendarDay[],
  tasks: CalendarTask[],
  childTasksByLongTaskId: Map<string, CalendarTask[]>,
  today: string
): LongTaskTimelineRow[] {
  const monthDays = days.filter((day) => day.inCurrentMonth);
  const first = monthDays[0]?.date;
  const last = monthDays[monthDays.length - 1]?.date;
  if (!first || !last) return [];

  return tasks
    .filter((task) => task.spanStart && task.spanEnd && task.spanEnd >= first && task.spanStart <= last)
    .sort((a, b) => {
      const startCompare = (a.spanStart as string).localeCompare(b.spanStart as string);
      if (startCompare !== 0) return startCompare;
      const endCompare = (a.spanEnd as string).localeCompare(b.spanEnd as string);
      if (endCompare !== 0) return endCompare;
      return a.id.localeCompare(b.id);
    })
    .map((task) => {
      const fullStartDate = task.spanStart as string;
      const fullEndDate = task.spanEnd as string;
      const visibleStartDate = fullStartDate < first ? first : fullStartDate;
      const visibleEndDate = fullEndDate > last ? last : fullEndDate;
      const progressPercent = task.progressPercent ?? 0;
      const totalDays = Math.max(1, diffDays(fullStartDate, fullEndDate));
      const daysElapsed = Math.min(totalDays, Math.max(0, diffDays(fullStartDate, today)));
      const expectedProgressPercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      return {
        task,
        childTasks: childTasksByLongTaskId.get(task.id) ?? [],
        fullStartDate,
        fullEndDate,
        visibleStartDate,
        visibleEndDate,
        startDay: Number.parseInt(visibleStartDate.slice(8, 10), 10),
        endDay: Number.parseInt(visibleEndDate.slice(8, 10), 10),
        isClippedStart: fullStartDate < first,
        isClippedEnd: fullEndDate > last,
        isOverdue: isLongTaskOverdue(task, today),
        daysLeft: Math.max(0, diffDays(today, fullEndDate)),
        progressPercent,
        status: progressPercent + 5 < expectedProgressPercent ? "behind" : progressPercent > expectedProgressPercent + 5 ? "ahead" : "on-track"
      };
    });
}

function buildSpanBars(days: CalendarDay[], tasks: CalendarTask[]): CalendarSpanBar[] {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last) return [];

  const indexByDate = new Map(days.map((day, index) => [day.date, index]));
  const bars: CalendarSpanBar[] = [];
  for (const task of tasks) {
    if (!task.spanStart || !task.spanEnd || task.spanEnd < first || task.spanStart > last) continue;
    const startDate = task.spanStart < first ? first : task.spanStart;
    const endDate = task.spanEnd > last ? last : task.spanEnd;
    bars.push({
      task,
      startDate,
      endDate,
      startIndex: indexByDate.get(startDate) ?? 0,
      endIndex: indexByDate.get(endDate) ?? days.length - 1,
      layoutRow: 1
    });
  }
  return assignSpanBarRows(bars);
}

function assignSpanBarRows(bars: CalendarSpanBar[]): CalendarSpanBar[] {
  const sorted = [...bars].sort((a, b) => {
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
    if (a.endIndex !== b.endIndex) return a.endIndex - b.endIndex;
    return a.task.id.localeCompare(b.task.id);
  });
  const lastEndByRow: number[] = [];

  return sorted.map((bar) => {
    let rowIndex = lastEndByRow.findIndex((lastEnd) => lastEnd < bar.startIndex);
    if (rowIndex < 0) {
      rowIndex = lastEndByRow.length;
      lastEndByRow.push(bar.endIndex);
    } else {
      lastEndByRow[rowIndex] = bar.endIndex;
    }
    return { ...bar, layoutRow: rowIndex + 1 };
  });
}

function buildWeekDayRows(
  days: CalendarDay[],
  tasksByDate: Record<string, CalendarTask[]>,
  reviewPressure: ReviewPressureByDate,
  dayLoads: Record<string, CalendarDayLoad>
): WeekDayRow[] {
  return days.map((day) => {
    const review = reviewPressure[day.date] ?? { count: 0, minutes: 0, chars: 0 };
    return {
      day,
      tasks: tasksByDate[day.date] ?? [],
      taskMinutes: dayLoads[day.date]?.taskMinutes ?? 0,
      review,
      totalMinutes: (dayLoads[day.date]?.taskMinutes ?? 0) + review.minutes
    };
  });
}

function activeDatesForTask(task: CalendarTask, visibleStart?: string, visibleEnd?: string, mode: "month" | "week" = "month"): string[] {
  if (task.spanStart && task.spanEnd) {
    if (mode === "week") return [];
    const start = visibleStart && task.spanStart < visibleStart ? visibleStart : task.spanStart;
    const end = visibleEnd && task.spanEnd > visibleEnd ? visibleEnd : task.spanEnd;
    if (end < start) return [];

    const dates: string[] = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      dates.push(date);
    }
    return dates;
  }

  return task.scheduleDate ? [task.scheduleDate] : [];
}

function getOverdueReason(task: CalendarTask, today: string): string | undefined {
  if (task.dates.scheduled && task.dates.scheduled > "2026-06-12" && task.dates.scheduled < today) return "scheduled before today";
  if (isRecurring(task) && task.dates.start && task.dates.start < today) return "recurring start before today";
  return undefined;
}

function getUnscheduledReason(task: CalendarTask): string | undefined {
  if (task.filePath.includes("收集/代办")) return "path contains 收集/代办";
  if (task.filePath.includes("规划/阶段")) return "path contains 规划/阶段";
  if (!task.dates.scheduled && !isRecurring(task)) return "scheduled is empty and not recurring";
  return undefined;
}

function getUnifiedUnscheduledReason(task: CalendarTask): string | undefined {
  if (task.dates.scheduled) return undefined;
  if (isRecurring(task)) return undefined;
  if (task.taskKind === "long" && task.spanStart && task.spanEnd) return undefined;
  if (task.filePath.includes("鏀堕泦/浠ｅ姙")) return "path contains 鏀堕泦/浠ｅ姙";
  if (task.filePath.includes("瑙勫垝/闃舵")) return "path contains 瑙勫垝/闃舵";
  return "not scheduled";
}

function isRecurring(task: CalendarTask): boolean {
  return Boolean(task.recurrence?.trim()) || /\brecurr/i.test(task.rawLine) || /🔁/u.test(task.rawLine);
}

function todayStringFromAnchor(anchorDate: string): string {
  return anchorDate || todayString();
}

function diffDays(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00`);
  const endTime = Date.parse(`${end}T00:00:00`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.round((endTime - startTime) / 86_400_000);
}
