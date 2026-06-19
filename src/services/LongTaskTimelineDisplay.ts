import type { CalendarDay, LongTaskTimelineRow } from "../models/types";

export interface LongTimelineDisplayDay {
  date: string;
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  isFoldedPast: boolean;
  foldedStartDate?: string;
  foldedEndDate?: string;
  foldedDayCount?: number;
}

export interface LongTimelineDisplay {
  days: LongTimelineDisplayDay[];
  rows: LongTaskTimelineRow[];
  pastDaysFolded: boolean;
  pastDayCount: number;
}

export function buildLongTimelineDisplay(
  monthDays: CalendarDay[],
  rows: LongTaskTimelineRow[],
  today: string,
  pastDaysExpanded: boolean
): LongTimelineDisplay {
  const pastDays = monthDays.filter((day) => day.date < today);
  const shouldFoldPast = !pastDaysExpanded && pastDays.length > 0;
  if (!shouldFoldPast) {
    return {
      days: monthDays.map(toDisplayDay),
      rows,
      pastDaysFolded: false,
      pastDayCount: pastDays.length
    };
  }

  const foldedPastDay = buildFoldedPastDay(pastDays);
  const days = [
    foldedPastDay,
    ...monthDays.filter((day) => day.date >= today).map(toDisplayDay)
  ];
  const indexByDate = new Map(days.map((day, index) => [day.date, index + 1]));

  return {
    days,
    rows: rows.flatMap((row) => {
      const startDay = row.visibleStartDate < today ? 1 : indexByDate.get(row.visibleStartDate);
      const endDay = row.visibleEndDate < today ? 1 : indexByDate.get(row.visibleEndDate);
      if (!startDay || !endDay) return [];
      return [{
        ...row,
        startDay,
        endDay,
        // A folded past segment is still part of the task range, but it no longer maps one-to-one to dates.
        isClippedStart: row.isClippedStart || row.visibleStartDate < today,
        isClippedEnd: row.isClippedEnd || row.visibleEndDate < today
      }];
    }),
    pastDaysFolded: true,
    pastDayCount: pastDays.length
  };
}

function toDisplayDay(day: CalendarDay): LongTimelineDisplayDay {
  return {
    date: day.date,
    label: String(day.dayOfMonth),
    dayOfMonth: day.dayOfMonth,
    isToday: day.isToday,
    isFoldedPast: false
  };
}

function buildFoldedPastDay(pastDays: CalendarDay[]): LongTimelineDisplayDay {
  const first = pastDays[0];
  const last = pastDays[pastDays.length - 1];
  const label = first.dayOfMonth === last.dayOfMonth ? String(first.dayOfMonth) : `${first.dayOfMonth}-${last.dayOfMonth}`;
  return {
    date: last.date,
    label,
    dayOfMonth: last.dayOfMonth,
    isToday: false,
    isFoldedPast: true,
    foldedStartDate: first.date,
    foldedEndDate: last.date,
    foldedDayCount: pastDays.length
  };
}
