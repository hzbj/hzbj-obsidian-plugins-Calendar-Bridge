export type DateSource = "dataview" | "emoji" | "none";
export type TaskTriggerType = "inline" | "phase-note";
export type CalendarTaskKind = "point" | "long";
export type DateField = "due" | "scheduled" | "start" | "completion" | "created";
export type MonthHeatmapMode = "task-estimate-plus-review";
export type MonthTaskViewMode = "point" | "long";
export type LongTaskPaceStatus = "ahead" | "on-track" | "behind";
export type TaskSortMode = "manual" | "priority";
export type TaskPriority = "highest" | "high" | "medium" | "low";

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
  indentLevel: number;
  parentLongTaskId?: string;
  parentLongTaskText?: string;
  createdDate?: string;
  scheduleDate?: string;
  spanStart?: string;
  spanEnd?: string;
  estimateMinutes?: number;
  plainEstimateMinutes?: number;
  progressPercent: number;
  plannedDate?: string;
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
  includedPathPrefixes: string[];
  excludedPathPrefixes: string[];
  primaryScheduleField: "scheduled";
  estimateField: "estimate";
  showAllDataviewFields: boolean;
  reviewPressureEnabled: boolean;
  reviewBaseMinutes: number;
  reviewCharsPerMinute: number;
  defaultUnestimatedTaskMinutes: number;
  monthHeatmapMode: MonthHeatmapMode;
  scheduledDayFolder: string;
  archiveHeading: string;
  scheduleInPlacePathPrefixes: string[];
}

export interface CalendarBridgeData {
  version: 1;
  settings: CalendarSettings;
  ui: {
    monthTaskViewMode?: MonthTaskViewMode;
    longTaskPastDaysExpanded?: boolean;
    sourceTaskGroups?: SourceTaskGroupState;
    [key: string]: unknown;
  };
}

export interface SourceTaskGroupState {
  order?: string[];
  collapsed?: Record<string, boolean>;
  sortMode?: TaskSortMode;
}

export interface SourceTaskGroup {
  sourceFilePath: string;
  sourceFileName: string;
  collapsed: boolean;
  tasks: CalendarTask[];
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
  recurringTaskCount: number;
  recurringTaskMinutes: number;
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
  layoutRow: number;
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

export interface LongTaskTimelineRow {
  task: CalendarTask;
  childTasks: CalendarTask[];
  fullStartDate: string;
  fullEndDate: string;
  visibleStartDate: string;
  visibleEndDate: string;
  startDay: number;
  endDay: number;
  isClippedStart: boolean;
  isClippedEnd: boolean;
  daysLeft: number;
  progressPercent: number;
  status: LongTaskPaceStatus;
}

export interface WeekDayRow {
  day: CalendarDay;
  tasks: CalendarTask[];
  recurringTaskCount: number;
  recurringTaskMinutes: number;
  taskMinutes: number;
  review: ReviewPressure;
  totalMinutes: number;
}

export interface CalendarViewModel {
  days: CalendarDay[];
  tasksByDate: Record<string, CalendarTask[]>;
  unscheduledTasks: CalendarTask[];
  overdueTasks: CalendarTask[];
  unifiedUnscheduledTasks: CalendarTask[];
  dayLoads: Record<string, CalendarDayLoad>;
  spanBars: CalendarSpanBar[];
  longTaskTimelineRows: LongTaskTimelineRow[];
  sourceTaskGroups: SourceTaskGroup[];
  weekDayRows: WeekDayRow[];
  longTaskProgress: LongTaskProgress[];
  longUnscheduledTasks: CalendarTask[];
}

export interface ReviewNote {
  filePath: string;
  knowledgeType?: string;
  status?: string;
  nextReview?: string;
  description?: string;
  contentChars: number;
}
