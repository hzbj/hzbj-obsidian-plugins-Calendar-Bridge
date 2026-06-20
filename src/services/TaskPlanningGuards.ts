import type { CalendarTask } from "../models/types";

export function isScheduledPointTask(task: CalendarTask | undefined): boolean {
  return task?.taskKind === "point" && Boolean(task.dates.scheduled);
}
