import type {
  HabitFrequencyType,
  HabitTrackingType,
} from './habit.ts';
import type {
  GoalStatus,
  ProjectStatus,
} from './projectGoal.ts';
import type {
  RoutineStatus,
  RoutineTimeOfDay,
  WorkoutActivityType,
} from './fitnessRoutines.ts';
import type {
  TaskCategory,
  TaskPriority,
} from './task.ts';
import type { GoalProgressMode } from '../lib/progress.ts';

export type StatisticsPeriodPreset =
  | '7d'
  | 'week'
  | '30d'
  | 'month'
  | '90d'
  | 'ytd'
  | 'custom';

export type StatisticsGranularity = 'day' | 'week' | 'month';

export interface StatisticsComparisonMeta {
  eligible: boolean;
  from: string | null;
  to: string | null;
  reason: string | null;
}

export interface StatisticsMeta {
  preset: StatisticsPeriodPreset;
  from: string;
  to: string;
  evaluationTo: string;
  spanDays: number;
  granularity: StatisticsGranularity;
  timezone: string;
  timezoneInitialized: boolean;
  todayLocalDate: string;
  comparison: StatisticsComparisonMeta;
}

export interface StatisticsOverviewTasks {
  completedInWindow: number;
  completedInWindowDelta: number | null;
  dueCohortTotal: number;
  dueCohortCompleted: number;
  dueCohortCompletionRate: number | null;
  dueCohortRateDeltaPts: number | null;
  openOverdueCount: number;
}

export interface StatisticsOverviewHabits {
  adherenceRate: number | null;
  adherenceRateDeltaPts: number | null;
  completedUnits: number;
  partialUnits: number;
  missedUnits: number;
  pendingUnits: number;
  eligibleUnits: number;
  weeklyQuotaRate: number | null;
  weeklyQuotaQualifyingWeeks: number;
  weeklyQuotaClosedWeeks: number;
  weeklyQuotaHabitsCount: number;
  hasUnverifiedPriorSchedule: boolean;
}

export interface StatisticsOverviewGoalsProjects {
  activeGoalsCount: number;
  activeGoalsAvgProgress: number | null;
  activeProjectsCount: number;
  activeProjectsAvgProgress: number | null;
  milestonesCompletedInWindow: number;
  milestonesCompletedDelta: number | null;
}

export interface StatisticsOverviewFitnessRoutines {
  workoutSessionsCount: number;
  workoutMinutesTotal: number;
  workoutMinutesDelta: number | null;
  routineCompletedRunsCount: number;
  routineStepCompletionRate: number | null;
}

export interface StatisticsOverview {
  tasks: StatisticsOverviewTasks;
  habits: StatisticsOverviewHabits;
  goalsProjects: StatisticsOverviewGoalsProjects;
  fitnessRoutines: StatisticsOverviewFitnessRoutines;
}

export interface StatisticsTaskTrendBucket {
  bucketKey: string;
  label: string;
  rangeLabel: string;
  completedInWindow: number;
  dueTotal: number;
  dueCompleted: number;
}

export interface StatisticsTaskPriorityItem {
  priority: TaskPriority;
  openCount: number;
  completedInWindow: number;
}

export interface StatisticsTaskCategoryItem {
  category: TaskCategory;
  completedInWindow: number;
  dueCohortTotal: number;
  dueCohortCompleted: number;
  openCount: number;
}

export interface StatisticsProjectItem {
  id: number;
  name: string;
  status: ProjectStatus;
  category: TaskCategory;
  targetDate: string | null;
  progressPercent: number;
  completedUnits: number;
  totalUnits: number;
  goalTitle: string | null;
}

export interface StatisticsGoalItem {
  id: number;
  title: string;
  status: GoalStatus;
  category: TaskCategory;
  targetDate: string | null;
  progressPercent: number;
  mode: GoalProgressMode;
  completedMilestones: number;
  totalMilestones: number;
}

export interface StatisticsPlanSection {
  tasks: {
    completedInWindow: number;
    createdInWindow: number;
    dueCohort: {
      total: number;
      completed: number;
      inProgress: number;
      todo: number;
      completionRate: number | null;
    };
    currentOpenSnapshot: {
      totalOpen: number;
      todo: number;
      inProgress: number;
      overdue: number;
      dueToday: number;
      noDueDate: number;
    };
    priorityBreakdown: StatisticsTaskPriorityItem[];
    categoryBreakdown: StatisticsTaskCategoryItem[];
    trend: StatisticsTaskTrendBucket[];
  };
  projects: {
    statusCounts: {
      planned: number;
      active: number;
      on_hold: number;
      completed: number;
      archived: number;
    };
    activeAvgProgress: number | null;
    completedInWindow: number;
    milestonesCompletedInWindow: number;
    activeItems: StatisticsProjectItem[];
  };
  goals: {
    statusCounts: {
      planned: number;
      active: number;
      paused: number;
      completed: number;
      archived: number;
    };
    activeAvgProgress: number | null;
    completedInWindow: number;
    milestonesCompletedInWindow: number;
    activeItems: StatisticsGoalItem[];
  };
  calendarContext: {
    eventsCountInWindow: number;
    allDayEventsCount: number;
    timedEventsCount: number;
    scheduledHours: number;
  };
}

export interface StatisticsHabitTrendBucket {
  bucketKey: string;
  label: string;
  rangeLabel: string;
  adherenceRate: number | null;
  completedUnits: number;
  partialUnits: number;
  missedUnits: number;
  eligibleUnits: number;
}

export interface StatisticsWeeklyQuotaHabitItem {
  id: number;
  name: string;
  targetPerWeek: number;
  qualifyingClosedWeeks: number;
  totalClosedWeeks: number;
  closedWeekSuccessRate: number | null;
  currentWeekCompletions: number;
  currentStreakWeeks: number;
  longestStreakWeeks: number;
}

export interface StatisticsHabitBreakdownItem {
  id: number;
  name: string;
  category: TaskCategory;
  trackingType: HabitTrackingType;
  frequencyType: HabitFrequencyType;
  scheduleLabel: string;
  completedCount: number;
  partialCount: number;
  missedCount: number;
  eligibleUnits: number;
  adherenceRate: number | null;
  currentStreak: number;
  longestStreak: number;
  streakUnit: 'days' | 'weeks';
}

export interface StatisticsFitnessTrendBucket {
  bucketKey: string;
  label: string;
  rangeLabel: string;
  sessions: number;
  durationMinutes: number;
}

export interface StatisticsFitnessActivityMixItem {
  activityType: WorkoutActivityType;
  sessions: number;
  durationMinutes: number;
  sharePercent: number;
}

export interface StatisticsRoutineBreakdownItem {
  routineId: number;
  name: string;
  timeOfDay: RoutineTimeOfDay;
  status: RoutineStatus;
  scheduleLabel: string;
  completedRuns: number;
  inProgressRuns: number;
  totalRuns: number;
  scheduledDaysInWindow: number | null;
  snapshotStepRate: number | null;
}

export interface StatisticsLiveSection {
  habits: {
    activeCount: number;
    archivedCount: number;
    dailyWeekdaySummary: {
      adherenceRate: number | null;
      completedUnits: number;
      partialUnits: number;
      missedUnits: number;
      pendingUnits: number;
      eligibleUnits: number;
      unverifiedUnits: number;
      hasUnverifiedPriorSchedule: boolean;
    };
    weeklyQuotaSummary: {
      habitsCount: number;
      qualifyingClosedWeeks: number;
      totalClosedWeeks: number;
      closedWeekSuccessRate: number | null;
      currentWeekCompletedCount: number;
      currentWeekTargetTotal: number;
      habits: StatisticsWeeklyQuotaHabitItem[];
    };
    topDailyStreaks: Array<{
      id: number;
      name: string;
      category: TaskCategory;
      currentStreak: number;
      longestStreak: number;
      scheduleLabel: string;
    }>;
    adherenceTrend: StatisticsHabitTrendBucket[];
    breakdown: StatisticsHabitBreakdownItem[];
  };
  fitness: {
    totalSessions: number;
    totalDurationMinutes: number;
    avgDurationMinutes: number | null;
    activeWorkoutDays: number;
    activityMix: StatisticsFitnessActivityMixItem[];
    trend: StatisticsFitnessTrendBucket[];
  };
  routines: {
    activeCount: number;
    archivedCount: number;
    totalLogsInWindow: number;
    completedRunsCount: number;
    inProgressRunsCount: number;
    fullCompletionRate: number | null;
    snapshotStepCompletionRate: number | null;
    totalStepsCompletedSnapshot: number;
    totalStepsExpectedSnapshot: number;
    perRoutineBreakdown: StatisticsRoutineBreakdownItem[];
  };
}

export interface StatisticsOverviewResponse {
  meta: StatisticsMeta;
  overview: StatisticsOverview;
  plan: StatisticsPlanSection;
  live: StatisticsLiveSection;
}
