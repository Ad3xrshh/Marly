import type {
  GoalStatusValue,
  HabitFrequencyTypeValue,
  HabitStatusValue,
  HabitTrackingTypeValue,
  ProjectStatusValue,
  RoutineLogStatusValue,
  RoutineScheduleTypeValue,
  RoutineStatusValue,
  RoutineTimeOfDayValue,
  TaskCategoryValue,
  TaskPriorityValue,
  TaskStatusValue,
  ThinkContextSourceValue,
  WorkoutActivityTypeValue,
} from '../../db/schema.ts';
import type { HabitDayEvaluationKind } from '../habitVisualizations.ts';
import type { GoalProgressMode } from '../progress.ts';
import type { StatisticsOverviewResponse, StatisticsPeriodPreset } from '../../types/statistics.ts';

export const THINK_CONTEXT_RETRIEVAL_LIMITS = {
  OPEN_TASKS_MAX: 30,
  RECENT_COMPLETED_TASKS_MAX: 10,
  RECENT_COMPLETED_TASKS_DAYS: 14,
  CALENDAR_EVENTS_MAX: 30,
  PROJECTS_MAX: 12,
  PROJECT_MILESTONES_PER_PROJECT_MAX: 5,
  GOALS_MAX: 12,
  GOAL_MILESTONES_PER_GOAL_MAX: 5,
  HABITS_MAX: 20,
  HABIT_LOGS_WINDOW_DAYS: 35,
  WORKOUTS_MAX: 20,
  WORKOUT_WINDOW_DAYS: 35,
  ROUTINES_MAX: 12,
  ROUTINE_STEPS_PER_ROUTINE_MAX: 15,
  ROUTINE_RECENT_LOGS_PER_ROUTINE_MAX: 7,
  ROUTINE_WINDOW_DAYS: 35,
  CALENDAR_OVERLAPS_MAX: 12,
  DEFAULT_TOKEN_BUDGET: 4500,
  MIN_TOKEN_BUDGET: 1200,
} as const;

export const THINK_TEXT_BOUNDS = {
  TITLE_MAX: 140,
  DESCRIPTION_MAX: 220,
  NOTE_MAX: 200,
  MILESTONE_TITLE_MAX: 120,
  STEP_TITLE_MAX: 120,
} as const;

export type ContextDomainKey =
  | 'plan_tasks'
  | 'plan_calendar'
  | 'plan_projects_goals'
  | 'live_habits'
  | 'live_workouts'
  | 'live_routines'
  | 'statistics';

export type ContextIntentCategory =
  | 'scheduling_workload'
  | 'tasks_projects_goals'
  | 'habits_consistency'
  | 'fitness_routines'
  | 'broad_review'
  | 'follow_up_continuity';

export interface PreviousTurnContextMeta {
  intentCategory?: ContextIntentCategory | null;
  selectedDomains?: ContextDomainKey[] | null;
  statsPreset?: StatisticsPeriodPreset | null;
}

export interface IntentClassificationResult {
  intentCategory: ContextIntentCategory;
  selectedDomains: ContextDomainKey[];
  isFollowUp: boolean;
  usedFollowUpHint: boolean;
  statsPreset: Exclude<StatisticsPeriodPreset, 'custom'>;
  calendarWindowPastDays: number;
  calendarWindowFutureDays: number;
  includeRecentlyCompletedTasks: boolean;
  matchedSignals: string[];
}

export interface ContextTruncationRecord {
  domain: string;
  truncated: boolean;
  totalAvailable: number;
  included: number;
  omitted: number;
  reason: 'within_limits' | 'cap_limit' | 'token_budget' | 'window_bound' | null;
}

export interface ContextBudgetSummary {
  tokenBudget: number;
  estimatedTokens: number;
  withinBudget: boolean;
  estimator: string;
  trimmedDomains: string[];
}

export interface GroundedEntityCatalogEntry {
  entityType:
    | 'task'
    | 'calendar_event'
    | 'project'
    | 'project_milestone'
    | 'goal'
    | 'goal_milestone'
    | 'habit'
    | 'workout'
    | 'routine';
  entityId: number;
  parentId?: number | null;
  label: string;
  targetRoute: string;
}

// ============================================================================
// PLAN Slice Types
// ============================================================================

export interface PlanTaskContextItem {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  category: TaskCategoryValue;
  dueDate: string | null;
  isOverdue: boolean;
  projectId: number | null;
  projectName: string | null;
  goalId: number | null;
  goalTitle: string | null;
  completedAtLocalDate: string | null;
}

export interface PlanCalendarEventContextItem {
  id: number;
  title: string;
  description: string | null;
  category: TaskCategoryValue;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  localStartDate: string | null;
  localStartTime: string | null;
  localEndDate: string | null;
  localEndTime: string | null;
  durationMinutes: number | null;
  taskId: number | null;
}

export interface PlanCalendarDailySummary {
  localDate: string;
  timedEventsCount: number;
  allDayEventsCount: number;
  scheduledMinutes: number;
  scheduledHours: number;
  hasOverlaps: boolean;
}

export interface PlanCalendarOverlapItem {
  localDate: string;
  eventAId: number;
  eventATitle: string;
  eventBId: number;
  eventBTitle: string;
  overlapMinutes: number;
}

export interface PlanMilestoneContextItem {
  id: number;
  title: string;
  dueOrTargetDate: string | null;
  sortOrder: number;
}

export interface PlanProjectContextItem {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatusValue;
  priority: TaskPriorityValue;
  category: TaskCategoryValue;
  startDate: string | null;
  targetDate: string | null;
  goalId: number | null;
  goalTitle: string | null;
  progressPercent: number;
  completedUnits: number;
  totalUnits: number;
  openTasksCount: number;
  completedTasksCount: number;
  incompleteMilestonesCount: number;
  totalMilestonesCount: number;
  incompleteMilestones: PlanMilestoneContextItem[];
  milestonesTruncatedCount: number;
}

export interface PlanGoalContextItem {
  id: number;
  title: string;
  description: string | null;
  status: GoalStatusValue;
  category: TaskCategoryValue;
  targetDate: string | null;
  progressPercent: number;
  mode: GoalProgressMode;
  targetMetricLabel: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  linkedProjectsCount: number;
  openTasksCount: number;
  completedTasksCount: number;
  incompleteMilestonesCount: number;
  totalMilestonesCount: number;
  incompleteMilestones: PlanMilestoneContextItem[];
  milestonesTruncatedCount: number;
}

export interface PlanContextSlice {
  tasks?: {
    summary: {
      totalOpen: number;
      todoCount: number;
      inProgressCount: number;
      overdueCount: number;
      dueTodayCount: number;
      dueSoon7dCount: number;
      noDueDateCount: number;
      urgentOrHighOpenCount: number;
      recentlyCompletedWindowDays: number;
      recentlyCompletedTotal: number;
    };
    openTasks: PlanTaskContextItem[];
    recentlyCompletedTasks: PlanTaskContextItem[];
  };
  calendar?: {
    windowFrom: string;
    windowTo: string;
    summary: {
      totalEventsInWindow: number;
      allDayEventsCount: number;
      timedEventsCount: number;
      totalScheduledHours: number;
      overlapsCount: number;
    };
    dailySummaries: PlanCalendarDailySummary[];
    overlaps: PlanCalendarOverlapItem[];
    events: PlanCalendarEventContextItem[];
  };
  projectsGoals?: {
    summary: {
      relevantProjectsTotal: number;
      activeProjectsCount: number;
      plannedProjectsCount: number;
      onHoldProjectsCount: number;
      relevantGoalsTotal: number;
      activeGoalsCount: number;
      plannedGoalsCount: number;
      pausedGoalsCount: number;
    };
    projects: PlanProjectContextItem[];
    goals: PlanGoalContextItem[];
  };
}

// ============================================================================
// LIVE Slice Types
// ============================================================================

export interface LiveHabitContextItem {
  id: number;
  name: string;
  description: string | null;
  category: TaskCategoryValue;
  status: HabitStatusValue;
  trackingType: HabitTrackingTypeValue;
  targetValue: number | null;
  unit: string | null;
  goalId: number | null;
  goalTitle: string | null;
  schedule: {
    frequencyType: HabitFrequencyTypeValue;
    weekdaysMask: number;
    targetPerWeek: number | null;
    label: string;
  };
  streak: {
    streakUnit: 'days' | 'weeks';
    currentStreak: number;
    longestStreak: number;
    weeklyCompletionsCount: number | null;
    weeklyTarget: number | null;
  };
  todayStatus: {
    kind: HabitDayEvaluationKind;
    scheduledToday: boolean;
    completedValue: number | null;
    targetSnapshot: number | null;
    progressPercent: number;
  };
  recentWindowSummary: {
    windowDays: number;
    completedDays: number;
    partialDays: number;
    missedDays: number;
    pendingDays: number;
    unscheduledDays: number;
    flexibleRestDays: number;
    unverifiedDays: number;
    eligibleDays: number;
    adherenceRate: number | null;
    hasUnverifiedPriorSchedule: boolean;
  };
  lastCompletedDate: string | null;
}

export interface LiveWorkoutContextItem {
  id: number;
  title: string;
  activityType: WorkoutActivityTypeValue;
  localDate: string;
  startTime: string | null;
  durationMinutes: number;
  notes: string | null;
}

export interface LiveRoutineStepContextItem {
  id: number;
  title: string;
  durationMinutes: number | null;
  sortOrder: number;
}

export interface LiveRoutineExecutionSnapshotItem {
  localDate: string;
  status: RoutineLogStatusValue;
  completedStepsCount: number;
  totalStepsSnapshot: number;
  completedStepTitles: string[];
}

export interface LiveRoutineStepPatternItem {
  stepTitle: string;
  appearsInSnapshots: number;
  completedInSnapshots: number;
  completionRatePercent: number | null;
}

export interface LiveRoutineContextItem {
  id: number;
  name: string;
  description: string | null;
  status: RoutineStatusValue;
  timeOfDay: RoutineTimeOfDayValue;
  preferredTime: string | null;
  scheduleType: RoutineScheduleTypeValue;
  scheduleLabel: string;
  scheduledToday: boolean;
  stepsCount: number;
  steps: LiveRoutineStepContextItem[];
  stepsTruncated: boolean;
  todayExecution: LiveRoutineExecutionSnapshotItem | null;
  recentExecutionSummary: {
    windowDays: number;
    totalRuns: number;
    completedRuns: number;
    inProgressRuns: number;
    scheduledDaysInWindow: number | null;
    snapshotStepCompletionRate: number | null;
  };
  stepPatterns: LiveRoutineStepPatternItem[];
  recentSnapshots: LiveRoutineExecutionSnapshotItem[];
}

export interface LiveContextSlice {
  habits?: {
    windowDays: number;
    windowFrom: string;
    windowTo: string;
    summary: {
      activeHabitsTotal: number;
      archivedHabitsCount: number;
      scheduledTodayCount: number;
      completedTodayCount: number;
      partialTodayCount: number;
      pendingTodayCount: number;
      hasUnverifiedPriorSchedule: boolean;
    };
    habits: LiveHabitContextItem[];
  };
  workouts?: {
    windowDays: number;
    windowFrom: string;
    windowTo: string;
    summary: {
      weekWorkoutsCount: number;
      weekDurationMinutes: number;
      thirtyDayWorkoutsCount: number;
      thirtyDayDurationMinutes: number;
      totalWorkoutsCount: number;
      totalDurationMinutes: number;
      byType30d: Array<{
        activityType: WorkoutActivityTypeValue;
        count: number;
        durationMinutes: number;
      }>;
    };
    recentSessions: LiveWorkoutContextItem[];
  };
  routines?: {
    windowDays: number;
    windowFrom: string;
    windowTo: string;
    summary: {
      activeRoutinesTotal: number;
      archivedRoutinesCount: number;
      scheduledTodayCount: number;
      completedTodayCount: number;
      inProgressTodayCount: number;
      recentLogsInWindow: number;
    };
    routines: LiveRoutineContextItem[];
  };
}

// ============================================================================
// STATISTICS Slice Types (Concise wrapper over getUserStatisticsOverview)
// ============================================================================

export interface StatsContextSlice {
  meta: StatisticsOverviewResponse['meta'];
  overview: StatisticsOverviewResponse['overview'];
  planSummary: {
    tasksCreatedInWindow: number;
    dueCohort: StatisticsOverviewResponse['plan']['tasks']['dueCohort'];
    currentOpenSnapshot: StatisticsOverviewResponse['plan']['tasks']['currentOpenSnapshot'];
    priorityBreakdown: StatisticsOverviewResponse['plan']['tasks']['priorityBreakdown'];
    categoryBreakdown: StatisticsOverviewResponse['plan']['tasks']['categoryBreakdown'];
    projectsStatusCounts: StatisticsOverviewResponse['plan']['projects']['statusCounts'];
    goalsStatusCounts: StatisticsOverviewResponse['plan']['goals']['statusCounts'];
    calendarContext: StatisticsOverviewResponse['plan']['calendarContext'];
  };
  liveSummary: {
    habitsActiveCount: number;
    habitsArchivedCount: number;
    dailyWeekdaySummary: StatisticsOverviewResponse['live']['habits']['dailyWeekdaySummary'];
    weeklyQuotaSummary: {
      habitsCount: number;
      qualifyingClosedWeeks: number;
      totalClosedWeeks: number;
      closedWeekSuccessRate: number | null;
      currentWeekCompletedCount: number;
      currentWeekTargetTotal: number;
    };
    topDailyStreaks: StatisticsOverviewResponse['live']['habits']['topDailyStreaks'];
    fitness: {
      totalSessions: number;
      totalDurationMinutes: number;
      avgDurationMinutes: number | null;
      activeWorkoutDays: number;
      activityMix: StatisticsOverviewResponse['live']['fitness']['activityMix'];
    };
    routines: {
      activeCount: number;
      archivedCount: number;
      totalLogsInWindow: number;
      completedRunsCount: number;
      inProgressRunsCount: number;
      fullCompletionRate: number | null;
      snapshotStepCompletionRate: number | null;
    };
  };
}

// ============================================================================
// Assembled Context Packet
// ============================================================================

export interface ThinkWorkspaceContextPacket {
  anchor: {
    todayLocalDate: string;
    effectiveTimeZone: string;
    timezoneInitialized: boolean;
    contextSource: ThinkContextSourceValue;
  };
  intent: {
    category: ContextIntentCategory;
    selectedDomains: ContextDomainKey[];
    isFollowUp: boolean;
    usedFollowUpHint: boolean;
  };
  plan?: PlanContextSlice;
  live?: LiveContextSlice;
  statistics?: StatsContextSlice;
  truncation: ContextTruncationRecord[];
  degraded?: {
    isDegraded: boolean;
    degradedDomains: ContextDomainKey[];
  };
}

export interface ThinkContextAssemblyResult {
  packet: ThinkWorkspaceContextPacket;
  classification: IntentClassificationResult;
  budget: ContextBudgetSummary;
  entityCatalog: GroundedEntityCatalogEntry[];
  degraded: boolean;
  degradedDomains: ContextDomainKey[];
  domainsConsulted: ContextDomainKey[];
  retrievedAt: string;
}
