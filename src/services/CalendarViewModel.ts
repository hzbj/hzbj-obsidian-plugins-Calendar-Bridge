import type {
  CalendarDay,
  CalendarDayLoad,
  CalendarSpanBar,
  CalendarTask,
  CalendarViewModel,
  LongTaskProgress,
  ReviewPressureByDate,
  WeekDayRow
} from "../models/types";
import { addDays, monthGridDates, todayString, weekDates } from "../utils/date";

export function buildMonthViewModel(
  anchorDate: string,
  tasks: CalendarTask[],
  weekStartsOn: 0 | 1,
  reviewPressure: ReviewPressureByDate = {},
  defaultUnestimatedTaskMinutes = 30
): CalendarViewModel {
  const days = monthGridDates(anchorDate, weekStartsOn);
  return buildViewModel(days, tasks, anchorDate, reviewPressure, defaultUnestimatedTaskMinutes, "month");
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
  mode: "month" | "week"
): CalendarViewModel {
  const activeTasks = tasks.filter((task) => !task.completed);
  const pointTasks = activeTasks.filter((task) => task.taskKind !== "long");
  const longTasks = activeTasks.filter((task) => task.taskKind === "long");
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

  for (const task of pointTasks) {
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
  const unscheduledTasks = pointTasks.flatMap((task) => {
    const reason = getUnscheduledReason(task);
    return reason ? [{ ...task, unscheduledReason: reason }] : [];
  });

  return {
    days,
    tasksByDate,
    unscheduledTasks,
    overdueTasks,
    dayLoads,
    spanBars: mode === "month" ? buildSpanBars(days, activeTasks) : [],
    weekDayRows: mode === "week" ? buildWeekDayRows(days, tasksByDate, reviewPressure, dayLoads) : [],
    longTaskProgress: buildLongTaskProgress(longTasks, todayStringFromAnchor(anchorDate)),
    longUnscheduledTasks: longTasks.filter((task) => !task.spanStart || !task.spanEnd),
    longOverdueTasks: longTasks.filter((task) => isLongTaskOverdue(task, todayStringFromAnchor(anchorDate)))
  };
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
      endIndex: indexByDate.get(endDate) ?? days.length - 1
    });
  }
  return bars;
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
  if (task.dates.due && task.dates.due < today) return "due is overdue";
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
