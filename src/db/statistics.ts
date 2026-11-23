import { asc, eq } from 'drizzle-orm';
import {
  addDaysToLocalDate,
  computeHabitStreakSummary,
  formatCalendarDate,
  formatScheduleLabel,
  formatTimestampInTimeZoneToLocalDate,
  getDayOfWeekFromLocalDate,
  getTodayLocalDateForTimeZone,
  getWeekStartMonday,
  isValidIanaTimeZone,
  maskToWeekdays,
} from '../lib/habitSchedule.ts';
import {
  diffLocalDays,
  evaluateHabitDayStatus,
  formatShortCalendarLabel,
  formatWeekRangeLabel,
  getDaysInMonth,
  getHabitLifecycleBounds,
  parseCalendarDateFromStr,
} from './statisticsHelpers.ts';
import {
  computeGoalProgress,
  computeProjectProgress,
  type ProjectProgressSummary,
} from '../lib/progress.ts';
import { getUtcInstantForLocalMidnight, resolveEffectiveTimeZone } from '../lib/timezone.ts';
import type { Habit, HabitLog } from '../types/habit.ts';
import type {
  StatisticsGoalItem,
  StatisticsGranularity,
  StatisticsHabitBreakdownItem,
  StatisticsHabitTrendBucket,
  StatisticsOverviewResponse,
  StatisticsPeriodPreset,
  StatisticsProjectItem,
  StatisticsRoutineBreakdownItem,
  StatisticsTaskCategoryItem,
  StatisticsTaskPriorityItem,
  StatisticsTaskTrendBucket,
  StatisticsWeeklyQuotaHabitItem,
} from '../types/statistics.ts';
import type { StatisticsQueryValidated } from '../validators/statisticsValidator.ts';
import { db } from './index.ts';
import { formatRoutineScheduleLabel, isRoutineScheduledOnDate } from './routines.ts';
import {
  calendarEvents,
  goalMilestones,
  goals,
  habitLogs,
  habitSchedules,
  habits,
  projectMilestones,
  projects,
  routineLogs,
  routines,
  tasks,
  workoutSessions,
  type TaskCategoryValue,
  type TaskPriorityValue,
  type WorkoutActivityTypeValue,
} from './schema.ts';

const TASK_PRIORITIES_ORDER: TaskPriorityValue[] = ['urgent', 'high', 'medium', 'low'];
const TASK_CATEGORIES_ORDER: TaskCategoryValue[] = [
  'Work',
  'Health',
  'Study',
  'Personal',
  'Family',
];
const WORKOUT_TYPES_ORDER: WorkoutActivityTypeValue[] = [
  'Strength',
  'Cardio',
  'Mobility',
  'Recovery',
  'Sport',
  'Other',
];

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface ResolvedPeriod {
  preset: StatisticsPeriodPreset;
  from: string;
  to: string;
  evaluationTo: string;
  spanDays: number;
  granularity: StatisticsGranularity;
  comparisonEligible: boolean;
  prevFrom: string | null;
  prevTo: string | null;
  comparisonReason: string | null;
}

interface TimeBucket {
  key: string;
  label: string;
  rangeLabel: string;
  from: string;
  to: string;
}

function resolveStatisticsPeriod(params: {
  query: StatisticsQueryValidated;
  todayLocalDate: string;
}): ResolvedPeriod {
  const { query, todayLocalDate } = params;
  const preset = query.preset;

  let from: string;
  let to: string;
  let comparisonEligible = false;
  let comparisonReason: string | null = null;

  if (preset === '7d') {
    from = addDaysToLocalDate(todayLocalDate, -6);
    to = todayLocalDate;
    comparisonEligible = true;
  } else if (preset === 'week') {
    from = getWeekStartMonday(todayLocalDate);
    to = addDaysToLocalDate(from, 6);
    comparisonEligible = false;
    comparisonReason =
      'Current Week is an in-progress calendar week; comparison against a full prior week is omitted.';
  } else if (preset === '30d') {
    from = addDaysToLocalDate(todayLocalDate, -29);
    to = todayLocalDate;
    comparisonEligible = true;
  } else if (preset === 'month') {
    const { year, month } = parseCalendarDateFromStr(todayLocalDate);
    from = formatCalendarDate(year, month, 1);
    to = formatCalendarDate(year, month, getDaysInMonth(year, month));
    comparisonEligible = false;
    comparisonReason =
      'Current Month is an in-progress calendar month; comparison against a full prior month is omitted.';
  } else if (preset === '90d') {
    from = addDaysToLocalDate(todayLocalDate, -89);
    to = todayLocalDate;
    comparisonEligible = true;
  } else if (preset === 'ytd') {
    const { year } = parseCalendarDateFromStr(todayLocalDate);
    from = formatCalendarDate(year, 1, 1);
    to = todayLocalDate;
    comparisonEligible = false;
    comparisonReason =
      'Year to Date is a partial calendar year; prior-period comparison is omitted.';
  } else {
    from = query.from!;
    to = query.to!;
    if (to <= todayLocalDate) {
      comparisonEligible = true;
    } else {
      comparisonEligible = false;
      comparisonReason =
        'Custom ranges extending into future dates omit prior-period comparisons.';
    }
  }

  const spanDays = diffLocalDays(from, to) + 1;
  const evaluationTo = to <= todayLocalDate ? to : todayLocalDate;
  const granularity: StatisticsGranularity =
    spanDays <= 35 ? 'day' : spanDays <= 180 ? 'week' : 'month';

  let prevFrom: string | null = null;
  let prevTo: string | null = null;
  if (comparisonEligible) {
    prevTo = addDaysToLocalDate(from, -1);
    prevFrom = addDaysToLocalDate(prevTo, -(spanDays - 1));
  }

  return {
    preset,
    from,
    to,
    evaluationTo,
    spanDays,
    granularity,
    comparisonEligible,
    prevFrom,
    prevTo,
    comparisonReason,
  };
}

function buildTimeBuckets(
  from: string,
  to: string,
  granularity: StatisticsGranularity
): { buckets: TimeBucket[]; getBucketKeyForDate: (date: string) => string } {
  const buckets: TimeBucket[] = [];

  if (granularity === 'day') {
    let cursor = from;
    while (cursor <= to) {
      const parsed = parseCalendarDateFromStr(cursor);
      buckets.push({
        key: cursor,
        label: `${MONTH_SHORT_NAMES[parsed.month - 1]} ${parsed.day}`,
        rangeLabel: formatShortCalendarLabel(cursor),
        from: cursor,
        to: cursor,
      });
      cursor = addDaysToLocalDate(cursor, 1);
    }
    return {
      buckets,
      getBucketKeyForDate: (d: string) => d,
    };
  }

  if (granularity === 'week') {
    let weekStart = getWeekStartMonday(from);
    while (weekStart <= to) {
      const weekEnd = addDaysToLocalDate(weekStart, 6);
      const clampedFrom = weekStart < from ? from : weekStart;
      const clampedTo = weekEnd > to ? to : weekEnd;
      const parsed = parseCalendarDateFromStr(clampedFrom);
      buckets.push({
        key: weekStart,
        label: `${MONTH_SHORT_NAMES[parsed.month - 1]} ${parsed.day}`,
        rangeLabel: formatWeekRangeLabel(weekStart),
        from: clampedFrom,
        to: clampedTo,
      });
      weekStart = addDaysToLocalDate(weekStart, 7);
    }
    return {
      buckets,
      getBucketKeyForDate: (d: string) => getWeekStartMonday(d),
    };
  }

  // Monthly buckets
  const startParts = parseCalendarDateFromStr(from);
  const endParts = parseCalendarDateFromStr(to);
  const multiYear = startParts.year !== endParts.year;

  let curYear = startParts.year;
  let curMonth = startParts.month;

  while (curYear < endParts.year || (curYear === endParts.year && curMonth <= endParts.month)) {
    const monthStart = formatCalendarDate(curYear, curMonth, 1);
    const monthEnd = formatCalendarDate(curYear, curMonth, getDaysInMonth(curYear, curMonth));
    const key = `${String(curYear).padStart(4, '0')}-${String(curMonth).padStart(2, '0')}`;
    const shortName = MONTH_SHORT_NAMES[curMonth - 1];
    buckets.push({
      key,
      label: multiYear ? `${shortName} '${String(curYear).slice(-2)}` : shortName,
      rangeLabel: `${shortName} ${curYear}`,
      from: monthStart < from ? from : monthStart,
      to: monthEnd > to ? to : monthEnd,
    });
    curMonth += 1;
    if (curMonth > 12) {
      curMonth = 1;
      curYear += 1;
    }
  }

  return {
    buckets,
    getBucketKeyForDate: (d: string) => d.slice(0, 7),
  };
}

function evaluateDailyWeekdayHabitsInRange(params: {
  habitsList: Habit[];
  logsByKey: Map<string, HabitLog>;
  lifecycles: Map<number, ReturnType<typeof getHabitLifecycleBounds>>;
  from: string;
  evaluationTo: string;
  todayLocalDate: string;
  getBucketKeyForDate?: (d: string) => string;
  buckets?: TimeBucket[];
}) {
  const {
    habitsList,
    logsByKey,
    lifecycles,
    from,
    evaluationTo,
    todayLocalDate,
    getBucketKeyForDate,
    buckets,
  } = params;

  const dailyWeekdayHabits = habitsList.filter(
    (h) => h.schedule.frequencyType !== 'times_per_week'
  );

  let completedUnits = 0;
  let partialUnits = 0;
  let missedUnits = 0;
  let pendingUnits = 0;
  let eligibleUnits = 0;
  let unverifiedUnits = 0;
  let hasUnverifiedPriorSchedule = false;

  const bucketAccum = new Map<
    string,
    { completed: number; partial: number; missed: number; eligible: number }
  >();
  if (buckets) {
    for (const b of buckets) {
      bucketAccum.set(b.key, { completed: 0, partial: 0, missed: 0, eligible: 0 });
    }
  }

  const perHabitCounts = new Map<
    number,
    { completed: number; partial: number; missed: number; eligible: number }
  >();
  for (const h of dailyWeekdayHabits) {
    perHabitCounts.set(h.id, { completed: 0, partial: 0, missed: 0, eligible: 0 });
  }

  if (from <= evaluationTo) {
    let cursor = from;
    while (cursor <= evaluationTo) {
      const bucketKey = getBucketKeyForDate ? getBucketKeyForDate(cursor) : null;
      const bucketEntry = bucketKey ? bucketAccum.get(bucketKey) : undefined;

      for (const habit of dailyWeekdayHabits) {
        const log = logsByKey.get(`${habit.id}:${cursor}`) ?? null;
        const lifecycle = lifecycles.get(habit.id)!;
        const evaluated = evaluateHabitDayStatus({
          habit,
          log,
          localDate: cursor,
          todayLocalDate,
          lifecycle,
        });

        const habitCounters = perHabitCounts.get(habit.id)!;

        if (evaluated.kind === 'completed') {
          completedUnits += 1;
          habitCounters.completed += 1;
          if (bucketEntry) bucketEntry.completed += 1;
        } else if (evaluated.kind === 'partial') {
          partialUnits += 1;
          habitCounters.partial += 1;
          if (bucketEntry) bucketEntry.partial += 1;
        } else if (evaluated.kind === 'missed') {
          missedUnits += 1;
          habitCounters.missed += 1;
          if (bucketEntry) bucketEntry.missed += 1;
        } else if (evaluated.kind === 'pending') {
          pendingUnits += 1;
        } else if (evaluated.kind === 'unverified_prior_schedule') {
          unverifiedUnits += 1;
          hasUnverifiedPriorSchedule = true;
        }

        if (evaluated.countsInScheduledDenominator) {
          eligibleUnits += 1;
          habitCounters.eligible += 1;
          if (bucketEntry) bucketEntry.eligible += 1;
        }
      }

      cursor = addDaysToLocalDate(cursor, 1);
    }
  }

  const adherenceRate =
    eligibleUnits > 0 ? Math.round((completedUnits / eligibleUnits) * 100) : null;

  return {
    adherenceRate,
    completedUnits,
    partialUnits,
    missedUnits,
    pendingUnits,
    eligibleUnits,
    unverifiedUnits,
    hasUnverifiedPriorSchedule,
    bucketAccum,
    perHabitCounts,
  };
}

export async function getUserStatisticsOverview(params: {
  userId: number;
  userTimeZone: string | null | undefined;
  query: StatisticsQueryValidated;
}): Promise<StatisticsOverviewResponse> {
  const { effectiveTimeZone: effectiveTimezone, timezoneInitialized } =
    resolveEffectiveTimeZone(params.userTimeZone);
  const todayLocalDate = getTodayLocalDateForTimeZone(effectiveTimezone);
  const period = resolveStatisticsPeriod({
    query: params.query,
    todayLocalDate,
  });

  const [
    taskRows,
    projectRows,
    projectMilestoneRows,
    goalRows,
    goalMilestoneRows,
    calendarEventRows,
    habitRows,
    habitScheduleRows,
    habitLogRows,
    workoutRows,
    routineRows,
    routineLogRows,
  ] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, params.userId)),
    db.select().from(projects).where(eq(projects.userId, params.userId)),
    db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.userId, params.userId)),
    db.select().from(goals).where(eq(goals.userId, params.userId)),
    db.select().from(goalMilestones).where(eq(goalMilestones.userId, params.userId)),
    db.select().from(calendarEvents).where(eq(calendarEvents.userId, params.userId)),
    db.select().from(habits).where(eq(habits.userId, params.userId)),
    db.select().from(habitSchedules).where(eq(habitSchedules.userId, params.userId)),
    db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.userId, params.userId))
      .orderBy(asc(habitLogs.localDate)),
    db.select().from(workoutSessions).where(eq(workoutSessions.userId, params.userId)),
    db.select().from(routines).where(eq(routines.userId, params.userId)),
    db.select().from(routineLogs).where(eq(routineLogs.userId, params.userId)),
  ]);

  const { buckets, getBucketKeyForDate } = buildTimeBuckets(
    period.from,
    period.to,
    period.granularity
  );

  // ============================================================================
  // 1. PLAN — Tasks Analytics
  // ============================================================================
  let completedInWindow = 0;
  let createdInWindow = 0;
  let dueCohortTotal = 0;
  let dueCohortCompleted = 0;
  let dueCohortInProgress = 0;
  let dueCohortTodo = 0;

  let prevCompletedInWindow = 0;
  let prevDueCohortTotal = 0;
  let prevDueCohortCompleted = 0;

  let totalOpen = 0;
  let openTodo = 0;
  let openInProgress = 0;
  let openOverdueCount = 0;
  let openDueToday = 0;
  let openNoDueDate = 0;

  const taskTrendMap = new Map<string, StatisticsTaskTrendBucket>();
  for (const b of buckets) {
    taskTrendMap.set(b.key, {
      bucketKey: b.key,
      label: b.label,
      rangeLabel: b.rangeLabel,
      completedInWindow: 0,
      dueTotal: 0,
      dueCompleted: 0,
    });
  }

  const priorityMap = new Map<TaskPriorityValue, StatisticsTaskPriorityItem>(
    TASK_PRIORITIES_ORDER.map((priority) => [
      priority,
      { priority, openCount: 0, completedInWindow: 0 },
    ])
  );

  const categoryMap = new Map<TaskCategoryValue, StatisticsTaskCategoryItem>(
    TASK_CATEGORIES_ORDER.map((category) => [
      category,
      {
        category,
        completedInWindow: 0,
        dueCohortTotal: 0,
        dueCohortCompleted: 0,
        openCount: 0,
      },
    ])
  );

  for (const task of taskRows) {
    const createdLocal = formatTimestampInTimeZoneToLocalDate(
      task.createdAt,
      effectiveTimezone
    );
    if (createdLocal >= period.from && createdLocal <= period.evaluationTo) {
      createdInWindow += 1;
    }

    const completedLocal =
      task.status === 'completed' && task.completedAt
        ? formatTimestampInTimeZoneToLocalDate(task.completedAt, effectiveTimezone)
        : null;

    if (
      completedLocal !== null &&
      completedLocal >= period.from &&
      completedLocal <= period.evaluationTo
    ) {
      completedInWindow += 1;
      const pEntry = priorityMap.get(task.priority);
      if (pEntry) pEntry.completedInWindow += 1;
      const cEntry = categoryMap.get(task.category);
      if (cEntry) cEntry.completedInWindow += 1;

      const tBucket = taskTrendMap.get(getBucketKeyForDate(completedLocal));
      if (tBucket) tBucket.completedInWindow += 1;
    }

    if (
      period.comparisonEligible &&
      period.prevFrom &&
      period.prevTo &&
      completedLocal !== null &&
      completedLocal >= period.prevFrom &&
      completedLocal <= period.prevTo
    ) {
      prevCompletedInWindow += 1;
    }

    if (task.dueDate !== null && task.dueDate >= period.from && task.dueDate <= period.to) {
      dueCohortTotal += 1;
      if (task.status === 'completed') dueCohortCompleted += 1;
      else if (task.status === 'in_progress') dueCohortInProgress += 1;
      else dueCohortTodo += 1;

      const cEntry = categoryMap.get(task.category);
      if (cEntry) {
        cEntry.dueCohortTotal += 1;
        if (task.status === 'completed') cEntry.dueCohortCompleted += 1;
      }

      const dBucket = taskTrendMap.get(getBucketKeyForDate(task.dueDate));
      if (dBucket) {
        dBucket.dueTotal += 1;
        if (task.status === 'completed') dBucket.dueCompleted += 1;
      }
    }

    if (
      period.comparisonEligible &&
      period.prevFrom &&
      period.prevTo &&
      task.dueDate !== null &&
      task.dueDate >= period.prevFrom &&
      task.dueDate <= period.prevTo
    ) {
      prevDueCohortTotal += 1;
      if (task.status === 'completed') prevDueCohortCompleted += 1;
    }

    if (task.status !== 'completed') {
      totalOpen += 1;
      if (task.status === 'in_progress') openInProgress += 1;
      else openTodo += 1;

      if (task.dueDate === null) {
        openNoDueDate += 1;
      } else {
        if (task.dueDate < todayLocalDate) openOverdueCount += 1;
        if (task.dueDate === todayLocalDate) openDueToday += 1;
      }

      const pEntry = priorityMap.get(task.priority);
      if (pEntry) pEntry.openCount += 1;
      const cEntry = categoryMap.get(task.category);
      if (cEntry) cEntry.openCount += 1;
    }
  }

  const dueCohortCompletionRate =
    dueCohortTotal > 0 ? Math.round((dueCohortCompleted / dueCohortTotal) * 100) : null;
  const prevDueCohortCompletionRate =
    period.comparisonEligible && prevDueCohortTotal > 0
      ? Math.round((prevDueCohortCompleted / prevDueCohortTotal) * 100)
      : null;

  const dueCohortRateDeltaPts =
    dueCohortCompletionRate !== null && prevDueCohortCompletionRate !== null
      ? dueCohortCompletionRate - prevDueCohortCompletionRate
      : null;

  const completedInWindowDelta = period.comparisonEligible
    ? completedInWindow - prevCompletedInWindow
    : null;

  // ============================================================================
  // 2. PLAN — Projects, Goals & Milestones (Reusing src/lib/progress.ts)
  // ============================================================================
  const projectMilestonesByProject = new Map<number, typeof projectMilestoneRows>();
  let projectMilestonesCompletedInWindow = 0;
  let prevProjectMilestonesCompleted = 0;

  for (const m of projectMilestoneRows) {
    const bucket = projectMilestonesByProject.get(m.projectId) ?? [];
    bucket.push(m);
    projectMilestonesByProject.set(m.projectId, bucket);

    if (m.completed && m.completedAt) {
      const mLocal = formatTimestampInTimeZoneToLocalDate(m.completedAt, effectiveTimezone);
      if (mLocal >= period.from && mLocal <= period.evaluationTo) {
        projectMilestonesCompletedInWindow += 1;
      }
      if (
        period.comparisonEligible &&
        period.prevFrom &&
        period.prevTo &&
        mLocal >= period.prevFrom &&
        mLocal <= period.prevTo
      ) {
        prevProjectMilestonesCompleted += 1;
      }
    }
  }

  const goalMilestonesByGoal = new Map<number, typeof goalMilestoneRows>();
  let goalMilestonesCompletedInWindow = 0;
  let prevGoalMilestonesCompleted = 0;

  for (const m of goalMilestoneRows) {
    const bucket = goalMilestonesByGoal.get(m.goalId) ?? [];
    bucket.push(m);
    goalMilestonesByGoal.set(m.goalId, bucket);

    if (m.completed && m.completedAt) {
      const mLocal = formatTimestampInTimeZoneToLocalDate(m.completedAt, effectiveTimezone);
      if (mLocal >= period.from && mLocal <= period.evaluationTo) {
        goalMilestonesCompletedInWindow += 1;
      }
      if (
        period.comparisonEligible &&
        period.prevFrom &&
        period.prevTo &&
        mLocal >= period.prevFrom &&
        mLocal <= period.prevTo
      ) {
        prevGoalMilestonesCompleted += 1;
      }
    }
  }

  const tasksByProject = new Map<number, typeof taskRows>();
  const tasksByGoal = new Map<number, typeof taskRows>();
  for (const t of taskRows) {
    if (t.projectId !== null) {
      const bucket = tasksByProject.get(t.projectId) ?? [];
      bucket.push(t);
      tasksByProject.set(t.projectId, bucket);
    }
    if (t.goalId !== null) {
      const bucket = tasksByGoal.get(t.goalId) ?? [];
      bucket.push(t);
      tasksByGoal.set(t.goalId, bucket);
    }
  }

  const goalTitleById = new Map(goalRows.map((g) => [g.id, g.title]));
  const projectStatusCounts = {
    planned: 0,
    active: 0,
    on_hold: 0,
    completed: 0,
    archived: 0,
  };
  let projectsCompletedInWindow = 0;

  const projectProgressById = new Map<number, ProjectProgressSummary>();
  const activeProjectItems: StatisticsProjectItem[] = [];
  const activeProjectPercentages: number[] = [];

  for (const project of projectRows) {
    projectStatusCounts[project.status] += 1;
    if (project.status === 'completed' && project.completedAt) {
      const pLocal = formatTimestampInTimeZoneToLocalDate(
        project.completedAt,
        effectiveTimezone
      );
      if (pLocal >= period.from && pLocal <= period.evaluationTo) {
        projectsCompletedInWindow += 1;
      }
    }

    const pMilestones = projectMilestonesByProject.get(project.id) ?? [];
    const pTasks = tasksByProject.get(project.id) ?? [];
    const progress = computeProjectProgress({
      status: project.status,
      milestones: pMilestones,
      tasks: pTasks,
    });
    projectProgressById.set(project.id, progress);

    if (project.status === 'active') {
      activeProjectPercentages.push(progress.progressPercent);
    }
    if (project.status === 'active' || project.status === 'planned') {
      activeProjectItems.push({
        id: project.id,
        name: project.name,
        status: project.status,
        category: project.category,
        targetDate: project.targetDate,
        progressPercent: progress.progressPercent,
        completedUnits: progress.completedUnits,
        totalUnits: progress.totalUnits,
        goalTitle: project.goalId ? (goalTitleById.get(project.goalId) ?? null) : null,
      });
    }
  }

  activeProjectItems.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.progressPercent - a.progressPercent;
  });

  const projectsByGoal = new Map<number, typeof projectRows>();
  for (const p of projectRows) {
    if (p.goalId !== null) {
      const bucket = projectsByGoal.get(p.goalId) ?? [];
      bucket.push(p);
      projectsByGoal.set(p.goalId, bucket);
    }
  }

  const goalStatusCounts = {
    planned: 0,
    active: 0,
    paused: 0,
    completed: 0,
    archived: 0,
  };
  let goalsCompletedInWindow = 0;
  const activeGoalPercentages: number[] = [];
  const activeGoalItems: StatisticsGoalItem[] = [];

  for (const goal of goalRows) {
    goalStatusCounts[goal.status] += 1;
    if (goal.status === 'completed' && goal.completedAt) {
      const gLocal = formatTimestampInTimeZoneToLocalDate(goal.completedAt, effectiveTimezone);
      if (gLocal >= period.from && gLocal <= period.evaluationTo) {
        goalsCompletedInWindow += 1;
      }
    }

    const gMilestones = goalMilestonesByGoal.get(goal.id) ?? [];
    const linkedProjects = projectsByGoal.get(goal.id) ?? [];
    const goalTasks = tasksByGoal.get(goal.id) ?? [];

    const progress = computeGoalProgress({
      goalId: goal.id,
      status: goal.status,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      milestones: gMilestones,
      linkedProjects: linkedProjects.map((p) => ({
        id: p.id,
        status: p.status,
        progress: projectProgressById.get(p.id)!,
      })),
      goalTasks,
    });

    if (goal.status === 'active') {
      activeGoalPercentages.push(progress.progressPercent);
    }
    if (goal.status === 'active' || goal.status === 'planned') {
      activeGoalItems.push({
        id: goal.id,
        title: goal.title,
        status: goal.status,
        category: goal.category,
        targetDate: goal.targetDate,
        progressPercent: progress.progressPercent,
        mode: progress.mode,
        completedMilestones: progress.completedMilestones,
        totalMilestones: progress.totalMilestones,
      });
    }
  }

  activeGoalItems.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.progressPercent - a.progressPercent;
  });

  const activeProjectsAvgProgress =
    activeProjectPercentages.length > 0
      ? Math.round(
          activeProjectPercentages.reduce((acc, v) => acc + v, 0) /
            activeProjectPercentages.length
        )
      : null;

  const activeGoalsAvgProgress =
    activeGoalPercentages.length > 0
      ? Math.round(
          activeGoalPercentages.reduce((acc, v) => acc + v, 0) / activeGoalPercentages.length
        )
      : null;

  const milestonesCompletedInWindow =
    projectMilestonesCompletedInWindow + goalMilestonesCompletedInWindow;
  const prevMilestonesCompleted =
    prevProjectMilestonesCompleted + prevGoalMilestonesCompleted;
  const milestonesCompletedDelta = period.comparisonEligible
    ? milestonesCompletedInWindow - prevMilestonesCompleted
    : null;

  // ============================================================================
  // 3. PLAN — Calendar Context (Lightweight Commitment Summary)
  // ============================================================================
  const windowStartMs = getUtcInstantForLocalMidnight(period.from, effectiveTimezone);
  const windowEndMs = getUtcInstantForLocalMidnight(
    addDaysToLocalDate(period.to, 1),
    effectiveTimezone
  );

  let allDayEventsCount = 0;
  let timedEventsCount = 0;
  let timedOverlapMs = 0;

  for (const ev of calendarEventRows) {
    if (ev.allDay) {
      if (ev.startDate && ev.endDate && ev.startDate <= period.to && ev.endDate >= period.from) {
        allDayEventsCount += 1;
      }
    } else if (ev.startAt && ev.endAt) {
      const evStart = ev.startAt.getTime();
      const evEnd = ev.endAt.getTime();
      if (evStart < windowEndMs && evEnd > windowStartMs) {
        timedEventsCount += 1;
        const clampedStart = Math.max(evStart, windowStartMs);
        const clampedEnd = Math.min(evEnd, windowEndMs);
        if (clampedEnd > clampedStart) {
          timedOverlapMs += clampedEnd - clampedStart;
        }
      }
    }
  }

  const scheduledHours = Math.round((timedOverlapMs / 3600000) * 10) / 10;

  // ============================================================================
  // 4. LIVE — Habits Analytics (Schedule-Aware + Partial-Safe + Weekly Quota)
  // ============================================================================
  const scheduleByHabitId = new Map(habitScheduleRows.map((s) => [s.habitId, s]));
  const logsByHabitId = new Map<number, typeof habitLogRows>();
  const domainLogs: HabitLog[] = [];

  for (const log of habitLogRows) {
    const bucket = logsByHabitId.get(log.habitId) ?? [];
    bucket.push(log);
    logsByHabitId.set(log.habitId, bucket);

    domainLogs.push({
      id: log.id,
      habitId: log.habitId,
      localDate: log.localDate,
      completedValue: log.completedValue,
      targetSnapshot: log.targetSnapshot,
      statusSnapshot: log.statusSnapshot,
      completedAt: log.completedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    });
  }

  const logsByKey = new Map<string, HabitLog>();
  for (const l of domainLogs) {
    logsByKey.set(`${l.habitId}:${l.localDate}`, l);
  }

  const domainHabits: Habit[] = habitRows.map((h) => {
    const scheduleRow = scheduleByHabitId.get(h.id);
    const frequencyType = scheduleRow?.frequencyType ?? 'daily';
    const weekdaysMask = scheduleRow?.weekdaysMask ?? 127;
    const targetPerWeek = scheduleRow?.targetPerWeek ?? null;
    const weekdays =
      frequencyType === 'weekdays' ? maskToWeekdays(weekdaysMask) : [0, 1, 2, 3, 4, 5, 6];

    const createdLocalDate = formatTimestampInTimeZoneToLocalDate(
      h.createdAt,
      effectiveTimezone
    );
    const streak = computeHabitStreakSummary({
      schedule: { frequencyType, weekdaysMask, targetPerWeek },
      logs: (logsByHabitId.get(h.id) ?? []).map((l) => ({
        localDate: l.localDate,
        statusSnapshot: l.statusSnapshot,
      })),
      createdLocalDate,
      todayLocalDate,
    });

    return {
      id: h.id,
      name: h.name,
      description: h.description,
      category: h.category,
      trackingType: h.trackingType,
      targetValue: h.targetValue,
      unit: h.unit,
      status: h.status,
      goalId: h.goalId,
      archivedAt: h.archivedAt ? h.archivedAt.toISOString() : null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
      schedule: {
        id: scheduleRow?.id ?? 0,
        frequencyType,
        weekdays,
        weekdaysMask,
        targetPerWeek,
        createdAt: (scheduleRow?.createdAt ?? h.createdAt).toISOString(),
        updatedAt: (scheduleRow?.updatedAt ?? h.updatedAt).toISOString(),
        label: formatScheduleLabel({
          frequencyType,
          weekdays,
          weekdaysMask,
          targetPerWeek,
        }),
      },
      scheduledToday: false,
      todayLog: null,
      streak,
    };
  });

  const lifecycles = new Map(
    domainHabits.map((h) => [h.id, getHabitLifecycleBounds(h, effectiveTimezone)])
  );

  // Relevant habits for current window: active OR has logs in [from, evaluationTo] OR archived on/after from
  const relevantCurrentHabits = domainHabits.filter((habit) => {
    if (habit.status === 'active') return true;
    const lc = lifecycles.get(habit.id)!;
    if (lc.archivedLocalDate && lc.archivedLocalDate >= period.from) return true;
    return (logsByHabitId.get(habit.id) ?? []).some(
      (l) => l.localDate >= period.from && l.localDate <= period.evaluationTo
    );
  });

  const currentDailyWeekdayEval = evaluateDailyWeekdayHabitsInRange({
    habitsList: relevantCurrentHabits,
    logsByKey,
    lifecycles,
    from: period.from,
    evaluationTo: period.evaluationTo,
    todayLocalDate,
    getBucketKeyForDate,
    buckets,
  });

  let adherenceRateDeltaPts: number | null = null;
  if (
    period.comparisonEligible &&
    period.prevFrom &&
    period.prevTo &&
    currentDailyWeekdayEval.adherenceRate !== null
  ) {
    const relevantPrevHabits = domainHabits.filter((habit) => {
      const lc = lifecycles.get(habit.id)!;
      if (lc.createdLocalDate > period.prevTo!) return false;
      if (lc.archivedLocalDate && lc.archivedLocalDate < period.prevFrom!) return false;
      return true;
    });
    const prevDailyWeekdayEval = evaluateDailyWeekdayHabitsInRange({
      habitsList: relevantPrevHabits,
      logsByKey,
      lifecycles,
      from: period.prevFrom,
      evaluationTo: period.prevTo,
      todayLocalDate,
    });
    if (
      prevDailyWeekdayEval.eligibleUnits > 0 &&
      prevDailyWeekdayEval.adherenceRate !== null
    ) {
      adherenceRateDeltaPts =
        currentDailyWeekdayEval.adherenceRate - prevDailyWeekdayEval.adherenceRate;
    }
  }

  const adherenceTrend: StatisticsHabitTrendBucket[] = buckets.map((b) => {
    const acc = currentDailyWeekdayEval.bucketAccum.get(b.key) ?? {
      completed: 0,
      partial: 0,
      missed: 0,
      eligible: 0,
    };
    return {
      bucketKey: b.key,
      label: b.label,
      rangeLabel: b.rangeLabel,
      adherenceRate:
        acc.eligible > 0 ? Math.round((acc.completed / acc.eligible) * 100) : null,
      completedUnits: acc.completed,
      partialUnits: acc.partial,
      missedUnits: acc.missed,
      eligibleUnits: acc.eligible,
    };
  });

  // Weekly-quota (`times_per_week`) habits — strictly closed weeks only (never penalize current incomplete week)
  const currentWeekStart = getWeekStartMonday(todayLocalDate);
  const weeklyQuotaHabits = relevantCurrentHabits.filter(
    (h) => h.schedule.frequencyType === 'times_per_week'
  );

  let weeklyQualifyingClosedWeeks = 0;
  let weeklyTotalClosedWeeks = 0;
  let currentWeekCompletedCount = 0;
  let currentWeekTargetTotal = 0;
  const weeklyQuotaItems: StatisticsWeeklyQuotaHabitItem[] = [];

  for (const habit of weeklyQuotaHabits) {
    const lc = lifecycles.get(habit.id)!;
    const targetPerWeek = Math.max(1, Math.min(7, habit.schedule.targetPerWeek ?? 1));
    const hLogs = logsByHabitId.get(habit.id) ?? [];

    const completedWeekCounts = new Map<string, number>();
    for (const l of hLogs) {
      if (l.statusSnapshot === 'completed' && l.localDate <= todayLocalDate) {
        const ws = getWeekStartMonday(l.localDate);
        completedWeekCounts.set(ws, (completedWeekCounts.get(ws) ?? 0) + 1);
      }
    }

    if (habit.status === 'active') {
      currentWeekTargetTotal += targetPerWeek;
      currentWeekCompletedCount += completedWeekCounts.get(currentWeekStart) ?? 0;
    }

    let habitClosedTotal = 0;
    let habitClosedQualifying = 0;

    let weekCursor = getWeekStartMonday(period.from);
    while (weekCursor <= period.evaluationTo) {
      const weekEnd = addDaysToLocalDate(weekCursor, 6);
      // Strictly closed weeks ending before current incomplete week AND ending inside/on evaluation window
      if (
        weekEnd < currentWeekStart &&
        weekEnd >= period.from &&
        weekEnd <= period.evaluationTo
      ) {
        const existedInWeek =
          lc.createdLocalDate <= weekEnd &&
          (lc.archivedLocalDate === null || lc.archivedLocalDate >= weekCursor);

        const weekCompletions = completedWeekCounts.get(weekCursor) ?? 0;
        const scheduleVerifiedForWeek =
          !lc.scheduleWasEditedAfterCreation ||
          lc.scheduleUpdatedLocalDate <= weekCursor ||
          weekCompletions >= targetPerWeek;

        if (existedInWeek && scheduleVerifiedForWeek) {
          habitClosedTotal += 1;
          if (weekCompletions >= targetPerWeek) {
            habitClosedQualifying += 1;
          }
        }
      }
      weekCursor = addDaysToLocalDate(weekCursor, 7);
    }

    weeklyTotalClosedWeeks += habitClosedTotal;
    weeklyQualifyingClosedWeeks += habitClosedQualifying;

    weeklyQuotaItems.push({
      id: habit.id,
      name: habit.name,
      targetPerWeek,
      qualifyingClosedWeeks: habitClosedQualifying,
      totalClosedWeeks: habitClosedTotal,
      closedWeekSuccessRate:
        habitClosedTotal > 0
          ? Math.round((habitClosedQualifying / habitClosedTotal) * 100)
          : null,
      currentWeekCompletions: completedWeekCounts.get(currentWeekStart) ?? 0,
      currentStreakWeeks: habit.streak.currentStreak,
      longestStreakWeeks: habit.streak.longestStreak,
    });
  }

  const closedWeekSuccessRate =
    weeklyTotalClosedWeeks > 0
      ? Math.round((weeklyQualifyingClosedWeeks / weeklyTotalClosedWeeks) * 100)
      : null;

  // Per-habit breakdown across relevant habits
  const habitBreakdown: StatisticsHabitBreakdownItem[] = relevantCurrentHabits
    .map((habit) => {
      if (habit.schedule.frequencyType === 'times_per_week') {
        const hLogs = (logsByHabitId.get(habit.id) ?? []).filter(
          (l) => l.localDate >= period.from && l.localDate <= period.evaluationTo
        );
        const completedCount = hLogs.filter((l) => l.statusSnapshot === 'completed').length;
        const partialCount = hLogs.filter((l) => l.statusSnapshot === 'partial').length;
        const weeklyInfo = weeklyQuotaItems.find((w) => w.id === habit.id);
        return {
          id: habit.id,
          name: habit.name,
          category: habit.category,
          trackingType: habit.trackingType,
          frequencyType: habit.schedule.frequencyType,
          scheduleLabel: habit.schedule.label,
          completedCount,
          partialCount,
          missedCount: 0,
          eligibleUnits: weeklyInfo?.totalClosedWeeks ?? 0,
          adherenceRate: weeklyInfo?.closedWeekSuccessRate ?? null,
          currentStreak: habit.streak.currentStreak,
          longestStreak: habit.streak.longestStreak,
          streakUnit: habit.streak.streakUnit,
        };
      }

      const counts = currentDailyWeekdayEval.perHabitCounts.get(habit.id) ?? {
        completed: 0,
        partial: 0,
        missed: 0,
        eligible: 0,
      };
      return {
        id: habit.id,
        name: habit.name,
        category: habit.category,
        trackingType: habit.trackingType,
        frequencyType: habit.schedule.frequencyType,
        scheduleLabel: habit.schedule.label,
        completedCount: counts.completed,
        partialCount: counts.partial,
        missedCount: counts.missed,
        eligibleUnits: counts.eligible,
        adherenceRate:
          counts.eligible > 0 ? Math.round((counts.completed / counts.eligible) * 100) : null,
        currentStreak: habit.streak.currentStreak,
        longestStreak: habit.streak.longestStreak,
        streakUnit: habit.streak.streakUnit,
      };
    })
    .sort((a, b) => (b.adherenceRate ?? -1) - (a.adherenceRate ?? -1));

  const topDailyStreaks = domainHabits
    .filter((h) => h.status === 'active' && h.streak.streakUnit === 'days')
    .sort((a, b) => b.streak.currentStreak - a.streak.currentStreak)
    .slice(0, 5)
    .map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category,
      currentStreak: h.streak.currentStreak,
      longestStreak: h.streak.longestStreak,
      scheduleLabel: h.schedule.label,
    }));

  const activeHabitsCount = domainHabits.filter((h) => h.status === 'active').length;
  const archivedHabitsCount = domainHabits.length - activeHabitsCount;

  // ============================================================================
  // 5. LIVE — Fitness Analytics
  // ============================================================================
  let workoutSessionsCount = 0;
  let workoutMinutesTotal = 0;
  let prevWorkoutMinutesTotal = 0;
  const activeWorkoutDateSet = new Set<string>();

  const workoutMixMap = new Map<
    WorkoutActivityTypeValue,
    { sessions: number; durationMinutes: number }
  >(WORKOUT_TYPES_ORDER.map((type) => [type, { sessions: 0, durationMinutes: 0 }]));

  const fitnessTrendMap = new Map<
    string,
    { bucketKey: string; label: string; rangeLabel: string; sessions: number; durationMinutes: number }
  >();
  for (const b of buckets) {
    fitnessTrendMap.set(b.key, {
      bucketKey: b.key,
      label: b.label,
      rangeLabel: b.rangeLabel,
      sessions: 0,
      durationMinutes: 0,
    });
  }

  for (const w of workoutRows) {
    if (w.localDate >= period.from && w.localDate <= period.evaluationTo) {
      workoutSessionsCount += 1;
      workoutMinutesTotal += w.durationMinutes;
      activeWorkoutDateSet.add(w.localDate);

      const mixEntry = workoutMixMap.get(w.activityType);
      if (mixEntry) {
        mixEntry.sessions += 1;
        mixEntry.durationMinutes += w.durationMinutes;
      }

      const fBucket = fitnessTrendMap.get(getBucketKeyForDate(w.localDate));
      if (fBucket) {
        fBucket.sessions += 1;
        fBucket.durationMinutes += w.durationMinutes;
      }
    }

    if (
      period.comparisonEligible &&
      period.prevFrom &&
      period.prevTo &&
      w.localDate >= period.prevFrom &&
      w.localDate <= period.prevTo
    ) {
      prevWorkoutMinutesTotal += w.durationMinutes;
    }
  }

  const workoutMinutesDelta = period.comparisonEligible
    ? workoutMinutesTotal - prevWorkoutMinutesTotal
    : null;

  const activityMix = WORKOUT_TYPES_ORDER.map((activityType) => {
    const entry = workoutMixMap.get(activityType)!;
    return {
      activityType,
      sessions: entry.sessions,
      durationMinutes: entry.durationMinutes,
      sharePercent:
        workoutMinutesTotal > 0
          ? Math.round((entry.durationMinutes / workoutMinutesTotal) * 100)
          : 0,
    };
  })
    .filter((item) => item.sessions > 0)
    .sort((a, b) => b.durationMinutes - a.durationMinutes);

  // ============================================================================
  // 6. LIVE — Routine Analytics (Strictly Immutable Execution Snapshots)
  // ============================================================================
  const logsByRoutineId = new Map<number, typeof routineLogRows>();
  let totalRoutineLogsInWindow = 0;
  let routineCompletedRunsCount = 0;
  let routineInProgressRunsCount = 0;
  let totalStepsCompletedSnapshot = 0;
  let totalStepsExpectedSnapshot = 0;

  for (const rLog of routineLogRows) {
    if (rLog.localDate >= period.from && rLog.localDate <= period.evaluationTo) {
      const bucket = logsByRoutineId.get(rLog.routineId) ?? [];
      bucket.push(rLog);
      logsByRoutineId.set(rLog.routineId, bucket);

      totalRoutineLogsInWindow += 1;
      if (rLog.status === 'completed') routineCompletedRunsCount += 1;
      else routineInProgressRunsCount += 1;

      if (rLog.totalStepsSnapshot > 0) {
        totalStepsCompletedSnapshot += rLog.completedStepsCount;
        totalStepsExpectedSnapshot += rLog.totalStepsSnapshot;
      }
    }
  }

  const activeRoutinesCount = routineRows.filter((r) => r.status === 'active').length;
  const archivedRoutinesCount = routineRows.length - activeRoutinesCount;

  const perRoutineBreakdown: StatisticsRoutineBreakdownItem[] = routineRows
    .filter(
      (routine) =>
        routine.status === 'active' || (logsByRoutineId.get(routine.id)?.length ?? 0) > 0
    )
    .map((routine) => {
      const rLogs = logsByRoutineId.get(routine.id) ?? [];
      let completedRuns = 0;
      let inProgressRuns = 0;
      let stepsDone = 0;
      let stepsExpected = 0;

      for (const l of rLogs) {
        if (l.status === 'completed') completedRuns += 1;
        else inProgressRuns += 1;
        if (l.totalStepsSnapshot > 0) {
          stepsDone += l.completedStepsCount;
          stepsExpected += l.totalStepsSnapshot;
        }
      }

      let scheduledDaysInWindow: number | null = null;
      if (routine.scheduleType !== 'as_needed') {
        const createdLocal = formatTimestampInTimeZoneToLocalDate(
          routine.createdAt,
          effectiveTimezone
        );
        const archivedLocal = routine.archivedAt
          ? formatTimestampInTimeZoneToLocalDate(routine.archivedAt, effectiveTimezone)
          : null;
        const startBound = createdLocal > period.from ? createdLocal : period.from;
        const endBound =
          archivedLocal && archivedLocal < period.evaluationTo
            ? archivedLocal
            : period.evaluationTo;

        if (startBound <= endBound) {
          let schedCount = 0;
          let cur = startBound;
          while (cur <= endBound) {
            if (isRoutineScheduledOnDate(routine.scheduleType, routine.weekdaysMask, cur)) {
              schedCount += 1;
            }
            cur = addDaysToLocalDate(cur, 1);
          }
          scheduledDaysInWindow = schedCount;
        } else {
          scheduledDaysInWindow = 0;
        }
      }

      return {
        routineId: routine.id,
        name: routine.name,
        timeOfDay: routine.timeOfDay,
        status: routine.status,
        scheduleLabel: formatRoutineScheduleLabel(routine.scheduleType, routine.weekdaysMask),
        completedRuns,
        inProgressRuns,
        totalRuns: rLogs.length,
        scheduledDaysInWindow,
        snapshotStepRate:
          stepsExpected > 0 ? Math.round((stepsDone / stepsExpected) * 100) : null,
      };
    })
    .sort((a, b) => b.totalRuns - a.totalRuns);

  const routineFullCompletionRate =
    totalRoutineLogsInWindow > 0
      ? Math.round((routineCompletedRunsCount / totalRoutineLogsInWindow) * 100)
      : null;

  const routineSnapshotStepCompletionRate =
    totalStepsExpectedSnapshot > 0
      ? Math.round((totalStepsCompletedSnapshot / totalStepsExpectedSnapshot) * 100)
      : null;

  return {
    meta: {
      preset: period.preset,
      from: period.from,
      to: period.to,
      evaluationTo: period.evaluationTo,
      spanDays: period.spanDays,
      granularity: period.granularity,
      timezone: effectiveTimezone,
      timezoneInitialized,
      todayLocalDate,
      comparison: {
        eligible: period.comparisonEligible,
        from: period.prevFrom,
        to: period.prevTo,
        reason: period.comparisonReason,
      },
    },
    overview: {
      tasks: {
        completedInWindow,
        completedInWindowDelta,
        dueCohortTotal,
        dueCohortCompleted,
        dueCohortCompletionRate,
        dueCohortRateDeltaPts,
        openOverdueCount,
      },
      habits: {
        adherenceRate: currentDailyWeekdayEval.adherenceRate,
        adherenceRateDeltaPts,
        completedUnits: currentDailyWeekdayEval.completedUnits,
        partialUnits: currentDailyWeekdayEval.partialUnits,
        missedUnits: currentDailyWeekdayEval.missedUnits,
        pendingUnits: currentDailyWeekdayEval.pendingUnits,
        eligibleUnits: currentDailyWeekdayEval.eligibleUnits,
        weeklyQuotaRate: closedWeekSuccessRate,
        weeklyQuotaQualifyingWeeks: weeklyQualifyingClosedWeeks,
        weeklyQuotaClosedWeeks: weeklyTotalClosedWeeks,
        weeklyQuotaHabitsCount: weeklyQuotaHabits.length,
        hasUnverifiedPriorSchedule: currentDailyWeekdayEval.hasUnverifiedPriorSchedule,
      },
      goalsProjects: {
        activeGoalsCount: goalStatusCounts.active,
        activeGoalsAvgProgress,
        activeProjectsCount: projectStatusCounts.active,
        activeProjectsAvgProgress,
        milestonesCompletedInWindow,
        milestonesCompletedDelta,
      },
      fitnessRoutines: {
        workoutSessionsCount,
        workoutMinutesTotal,
        workoutMinutesDelta,
        routineCompletedRunsCount,
        routineStepCompletionRate: routineSnapshotStepCompletionRate,
      },
    },
    plan: {
      tasks: {
        completedInWindow,
        createdInWindow,
        dueCohort: {
          total: dueCohortTotal,
          completed: dueCohortCompleted,
          inProgress: dueCohortInProgress,
          todo: dueCohortTodo,
          completionRate: dueCohortCompletionRate,
        },
        currentOpenSnapshot: {
          totalOpen,
          todo: openTodo,
          inProgress: openInProgress,
          overdue: openOverdueCount,
          dueToday: openDueToday,
          noDueDate: openNoDueDate,
        },
        priorityBreakdown: TASK_PRIORITIES_ORDER.map((p) => priorityMap.get(p)!),
        categoryBreakdown: TASK_CATEGORIES_ORDER.map((c) => categoryMap.get(c)!),
        trend: buckets.map((b) => taskTrendMap.get(b.key)!),
      },
      projects: {
        statusCounts: projectStatusCounts,
        activeAvgProgress: activeProjectsAvgProgress,
        completedInWindow: projectsCompletedInWindow,
        milestonesCompletedInWindow: projectMilestonesCompletedInWindow,
        activeItems: activeProjectItems.slice(0, 8),
      },
      goals: {
        statusCounts: goalStatusCounts,
        activeAvgProgress: activeGoalsAvgProgress,
        completedInWindow: goalsCompletedInWindow,
        milestonesCompletedInWindow: goalMilestonesCompletedInWindow,
        activeItems: activeGoalItems.slice(0, 8),
      },
      calendarContext: {
        eventsCountInWindow: allDayEventsCount + timedEventsCount,
        allDayEventsCount,
        timedEventsCount,
        scheduledHours,
      },
    },
    live: {
      habits: {
        activeCount: activeHabitsCount,
        archivedCount: archivedHabitsCount,
        dailyWeekdaySummary: {
          adherenceRate: currentDailyWeekdayEval.adherenceRate,
          completedUnits: currentDailyWeekdayEval.completedUnits,
          partialUnits: currentDailyWeekdayEval.partialUnits,
          missedUnits: currentDailyWeekdayEval.missedUnits,
          pendingUnits: currentDailyWeekdayEval.pendingUnits,
          eligibleUnits: currentDailyWeekdayEval.eligibleUnits,
          unverifiedUnits: currentDailyWeekdayEval.unverifiedUnits,
          hasUnverifiedPriorSchedule: currentDailyWeekdayEval.hasUnverifiedPriorSchedule,
        },
        weeklyQuotaSummary: {
          habitsCount: weeklyQuotaHabits.length,
          qualifyingClosedWeeks: weeklyQualifyingClosedWeeks,
          totalClosedWeeks: weeklyTotalClosedWeeks,
          closedWeekSuccessRate,
          currentWeekCompletedCount,
          currentWeekTargetTotal,
          habits: weeklyQuotaItems,
        },
        topDailyStreaks,
        adherenceTrend,
        breakdown: habitBreakdown,
      },
      fitness: {
        totalSessions: workoutSessionsCount,
        totalDurationMinutes: workoutMinutesTotal,
        avgDurationMinutes:
          workoutSessionsCount > 0
            ? Math.round(workoutMinutesTotal / workoutSessionsCount)
            : null,
        activeWorkoutDays: activeWorkoutDateSet.size,
        activityMix,
        trend: buckets.map((b) => fitnessTrendMap.get(b.key)!),
      },
      routines: {
        activeCount: activeRoutinesCount,
        archivedCount: archivedRoutinesCount,
        totalLogsInWindow: totalRoutineLogsInWindow,
        completedRunsCount: routineCompletedRunsCount,
        inProgressRunsCount: routineInProgressRunsCount,
        fullCompletionRate: routineFullCompletionRate,
        snapshotStepCompletionRate: routineSnapshotStepCompletionRate,
        totalStepsCompletedSnapshot,
        totalStepsExpectedSnapshot,
        perRoutineBreakdown,
      },
    },
  };
}
