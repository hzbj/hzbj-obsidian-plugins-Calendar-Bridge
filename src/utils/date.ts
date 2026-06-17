import type { CalendarDay } from "../models/types";

export function todayString(date = new Date()): string {
  return toDateString(date);
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function startOfWeek(dateString: string, weekStartsOn: 0 | 1): string {
  const date = parseLocalDate(dateString);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return toDateString(date);
}

export function weekDates(dateString: string, weekStartsOn: 0 | 1): CalendarDay[] {
  const start = startOfWeek(dateString, weekStartsOn);
  const today = todayString();
  return Array.from({ length: 7 }, (_unused, index) => {
    const date = addDays(start, index);
    return {
      date,
      dayOfMonth: parseLocalDate(date).getDate(),
      inCurrentMonth: true,
      isToday: date === today
    };
  });
}

export function monthGridDates(anchorDate: string, weekStartsOn: 0 | 1): CalendarDay[] {
  const anchor = parseLocalDate(anchorDate);
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const today = todayString();

  return Array.from({ length: 42 }, (_unused, index) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - offset + index);
    const dateString = toDateString(date);
    return {
      date: dateString,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: dateString === today
    };
  });
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}
