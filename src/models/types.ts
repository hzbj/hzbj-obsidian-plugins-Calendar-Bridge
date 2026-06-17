export type DateSource = "dataview" | "emoji" | "none";
export type TaskTriggerType = "inline" | "phase-note";
export type CalendarTaskKind = "point" | "long";
export type DateField = "due" | "scheduled" | "start" | "completion" | "created";
export type MonthHeatmapMode = "task-estimate-plus-review";
export type MonthTaskViewMode = "point" | "long";
export type LongTaskPaceStatus = "ahead" | "on-track" | "behind";

export type TaskDateMap = Partial<Record<DateField, string>>;
export type TaskDateSourceMap = Partial<Record<DateField, DateSource>>;

export interface CalendarTask {
  id: string;
  text: string;
  filePath: string;
  lineNumber: number;
  rawLine: string;
  completed: boolean;
  metadata: Record<string, string[]>;
  dates: TaskDateMap;
  dateSources?: TaskDateSourceMap;
  taskKind: CalendarTaskKind;
  createdDate?: string;
  scheduleDate?: string;
  spanStart?: string;
  spanEnd?: string;
  estimateMinutes?: number;
  plainEstimateMinutes?: number;
  progressPercent: number;
  durationMinutes?: number;
  priority?: string;
  recurrence?: string;
  project?: string;
  context?: string;
  overdueReason?: string;
  unscheduledReason?: string;
  dueDate?: string;
  dateSource: DateSource;
  triggerType: TaskTriggerType;
  phaseId?: string;
}

export interface CalendarSettings {
  triggerTags: string[];
  weekStartsOn: 0 | 1;
  readLegacyEmojiDates: boolean;
  excludedPathPrefixes: string[];
  primaryScheduleField: "scheduled";
  estimateField: "estimate";
  showAllDataviewFields: boolean;
  reviewPressureEnabled: boolean;
  reviewBaseMinutes: number;
  reviewCharsPerMinute: number;
  defaultUnestimatedTaskMinutes: number;
  monthHeatmapMode: MonthHeatmapMode;
}

export interface CalendarBridgeData {
  version: 1;
  settings: CalendarSettings;
  ui: {
    monthTaskViewMode?: MonthTaskViewMode;
    [key: string]: unknown;
  };
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export interface ReviewPressure {
  count: number;
  minutes: number;
  chars: number;
}

export type ReviewPressureByDate = Record<string, ReviewPressure>;

export interface CalendarDayLoad {
  date: string;
  taskCount: number;
  taskMinutes: number;
  reviewCount: number;
  reviewMinutes: number;
  heatScore: number;
}

export interface CalendarSpanBar {
  task: CalendarTask;
  startDate: string;
  endDate: string;
  startIndex: number;
  endIndex: number;
}

export interface LongTaskProgress {
  task: CalendarTask;
  daysElapsed: number;
  daysLeft: number;
  totalDays: number;
  expectedProgressPercent: number;
  progressPercent: number;
  dailyProgressPressure: number;
  dailyEstimatedMinutes?: number;
  status: LongTaskPaceStatus;
}

export interface WeekDayRow {
  day: CalendarDay;
  tasks: CalendarTask[];
  taskMinutes: number;
  review: ReviewPressure;
  totalMinutes: number;
}

export interface CalendarViewModel {
  days: CalendarDay[];
  tasksByDate: Record<string, CalendarTask[]>;
  unscheduledTasks: CalendarTask[];
  overdueTasks: CalendarTask[];
  dayLoads: Record<string, CalendarDayLoad>;
  spanBars: CalendarSpanBar[];
  weekDayRows: WeekDayRow[];
  longTaskProgress: LongTaskProgress[];
  longUnscheduledTasks: CalendarTask[];
  longOverdueTasks: CalendarTask[];
}

export interface ReviewNote {
  filePath: string;
  knowledgeType?: string;
  status?: string;
  nextReview?: string;
  description?: string;
  contentChars: number;
}
