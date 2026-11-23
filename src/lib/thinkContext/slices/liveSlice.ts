import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { formatRoutineScheduleLabel, isRoutineScheduledOnDate } from '../../../db/routines.ts';
import {
  goals,
  habitLogs,
  habitSchedules,
  habits,
  routineLogs,
  routineSteps,
  routines,
  workoutSessions,
  type RoutineTimeOfDayValue,
} from '../../../db/schema.ts';
import { computeWorkoutSummary } from '../../../db/workouts.ts';
import type { Habit, HabitLog } from '../../../types/habit.ts';
import {
  ALL_WEEKDAYS_MASK,
  computeHabitStreakSummary,
  computeLogProgressPercent,
  formatScheduleLabel,
  isHabitScheduledOnDate,
  maskToWeekdays,
} from '../../habitSchedule.ts';
import {
  evaluateHabitDayStatus,
  getHabitLifecycleBounds,
} from '../../habitVisualizations.ts';
import {
  addDaysToLocalDate,
  formatTimestampInTimeZoneToLocalDate,
} from '../../timezone.ts';
import { sanitizeContextText, sanitizeRequiredContextLabel } from '../sanitize.ts';
import {
  THINK_CONTEXT_RETRIEVAL_LIMITS,
  THINK_TEXT_BOUNDS,
  type ContextTruncationRecord,
  type GroundedEntityCatalogEntry,
  type LiveContextSlice,
  type LiveHabitContextItem,
  type LiveRoutineContextItem,
  type LiveRoutineExecutionSnapshotItem,
  type LiveRoutineStepPatternItem,
  type LiveWorkoutContextItem,
} from '../types.ts';

const TIME_OF_DAY_ORDER: Record<RoutineTimeOfDayValue, number> = {
  Morning: 0,
  Afternoon: 1,
  Evening: 2,
  Anytime: 3,
};

export interface LoadLiveSliceParams {
  userId: number;
  effectiveTimeZone: string;
  todayLocalDate: string;
  includeHabits: boolean;
  includeWorkouts: boolean;
  includeRoutines: boolean;
}

export interface LoadLiveSliceResult {
  slice: LiveContextSlice;
  truncations: ContextTruncationRecord[];
  catalogEntries: GroundedEntityCatalogEntry[];
}

export async function loadLiveContextSlice(
  params: LoadLiveSliceParams
): Promise<LoadLiveSliceResult> {
  const {
    userId,
    effectiveTimeZone,
    todayLocalDate,
    includeHabits,
    includeWorkouts,
    includeRoutines,
  } = params;

  const slice: LiveContextSlice = {};
  const truncations: ContextTruncationRecord[] = [];
  const catalogEntries: GroundedEntityCatalogEntry[] = [];

  const habitWindowFrom = addDaysToLocalDate(
    todayLocalDate,
    -(THINK_CONTEXT_RETRIEVAL_LIMITS.HABIT_LOGS_WINDOW_DAYS - 1)
  );
  const habitStreakQueryFrom = addDaysToLocalDate(todayLocalDate, -399);
  const workoutWindowFrom = addDaysToLocalDate(
    todayLocalDate,
    -(THINK_CONTEXT_RETRIEVAL_LIMITS.WORKOUT_WINDOW_DAYS - 1)
  );
  const routineWindowFrom = addDaysToLocalDate(
    todayLocalDate,
    -(THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_WINDOW_DAYS - 1)
  );

  // Parallel base queries strictly scoped by userId
  const [
    allHabitRows,
    allScheduleRows,
    boundedHabitLogRows,
    userGoalRows,
    allWorkoutRows,
    allRoutineRows,
  ] = await Promise.all([
    includeHabits
      ? db
          .select()
          .from(habits)
          .where(eq(habits.userId, userId))
          .orderBy(desc(habits.createdAt), asc(habits.id))
      : Promise.resolve([]),
    includeHabits
      ? db.select().from(habitSchedules).where(eq(habitSchedules.userId, userId))
      : Promise.resolve([]),
    includeHabits
      ? db
          .select()
          .from(habitLogs)
          .where(
            and(
              eq(habitLogs.userId, userId),
              gte(habitLogs.localDate, habitStreakQueryFrom),
              lte(habitLogs.localDate, todayLocalDate)
            )
          )
          .orderBy(asc(habitLogs.localDate), asc(habitLogs.id))
      : Promise.resolve([]),
    includeHabits
      ? db
          .select({ id: goals.id, title: goals.title })
          .from(goals)
          .where(eq(goals.userId, userId))
      : Promise.resolve([]),
    includeWorkouts
      ? db
          .select()
          .from(workoutSessions)
          .where(eq(workoutSessions.userId, userId))
          .orderBy(
            desc(workoutSessions.localDate),
            desc(workoutSessions.createdAt),
            desc(workoutSessions.id)
          )
      : Promise.resolve([]),
    includeRoutines
      ? db
          .select()
          .from(routines)
          .where(eq(routines.userId, userId))
          .orderBy(asc(routines.id))
      : Promise.resolve([]),
  ]);

  // --------------------------------------------------------------------------
  // 1. Habits
  // --------------------------------------------------------------------------
  if (includeHabits) {
    const goalTitleMap = new Map(
      userGoalRows.map((g) => [
        g.id,
        sanitizeRequiredContextLabel(g.title, THINK_TEXT_BOUNDS.TITLE_MAX),
      ])
    );
    const scheduleByHabit = new Map(allScheduleRows.map((s) => [s.habitId, s]));
    const logsByHabit = new Map<number, typeof boundedHabitLogRows>();

    for (const row of boundedHabitLogRows) {
      const list = logsByHabit.get(row.habitId) ?? [];
      list.push(row);
      logsByHabit.set(row.habitId, list);
    }

    const activeHabits = allHabitRows.filter((h) => h.status === 'active');
    const archivedHabitsCount = allHabitRows.length - activeHabits.length;

    let scheduledTodayCount = 0;
    let completedTodayCount = 0;
    let partialTodayCount = 0;
    let pendingTodayCount = 0;
    let anyUnverifiedPriorSchedule = false;

    const evaluatedItems: Array<{
      sortBucket: number;
      missedDays: number;
      item: LiveHabitContextItem;
    }> = activeHabits.map((h) => {
      const sched = scheduleByHabit.get(h.id);
      const frequencyType = sched?.frequencyType ?? 'daily';
      const weekdaysMask = sched?.weekdaysMask ?? ALL_WEEKDAYS_MASK;
      const targetPerWeek = sched?.targetPerWeek ?? null;
      const weekdays =
        frequencyType === 'weekdays' ? maskToWeekdays(weekdaysMask) : [0, 1, 2, 3, 4, 5, 6];
      const scheduleLabel = formatScheduleLabel({
        frequencyType,
        weekdays,
        weekdaysMask,
        targetPerWeek,
      });

      const createdLocalDate = formatTimestampInTimeZoneToLocalDate(
        h.createdAt,
        effectiveTimeZone
      );
      const hLogRows = logsByHabit.get(h.id) ?? [];

      const streak = computeHabitStreakSummary({
        schedule: { frequencyType, weekdaysMask, targetPerWeek },
        logs: hLogRows.map((l) => ({
          localDate: l.localDate,
          statusSnapshot: l.statusSnapshot,
        })),
        createdLocalDate,
        todayLocalDate,
      });

      const domainLogs: HabitLog[] = hLogRows.map((l) => ({
        id: l.id,
        habitId: l.habitId,
        localDate: l.localDate,
        completedValue: l.completedValue,
        targetSnapshot: l.targetSnapshot,
        statusSnapshot: l.statusSnapshot,
        completedAt: l.completedAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }));
      const logsByDate = new Map<string, HabitLog>(domainLogs.map((l) => [l.localDate, l]));

      const domainHabit: Habit = {
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
          id: sched?.id ?? 0,
          frequencyType,
          weekdays,
          weekdaysMask,
          targetPerWeek,
          createdAt: (sched?.createdAt ?? h.createdAt).toISOString(),
          updatedAt: (sched?.updatedAt ?? h.updatedAt).toISOString(),
          label: scheduleLabel,
        },
        scheduledToday: isHabitScheduledOnDate(
          { frequencyType, weekdaysMask, targetPerWeek },
          todayLocalDate
        ),
        todayLog: null,
        streak,
      };

      const lifecycle = getHabitLifecycleBounds(domainHabit, effectiveTimeZone);
      const todayLog = logsByDate.get(todayLocalDate) ?? null;
      const todayEvaluated = evaluateHabitDayStatus({
        habit: domainHabit,
        log: todayLog,
        localDate: todayLocalDate,
        todayLocalDate,
        lifecycle,
      });

      const scheduledToday =
        frequencyType === 'times_per_week'
          ? (streak.weeklyCompletionsCount ?? 0) < (streak.weeklyTarget ?? 1)
          : isHabitScheduledOnDate({ frequencyType, weekdaysMask, targetPerWeek }, todayLocalDate);

      if (scheduledToday) scheduledTodayCount += 1;
      if (todayEvaluated.kind === 'completed') completedTodayCount += 1;
      else if (todayEvaluated.kind === 'partial') partialTodayCount += 1;
      else if (todayEvaluated.kind === 'pending') pendingTodayCount += 1;

      // Evaluate bounded 35-day historical window strictly via shared evaluateHabitDayStatus
      let completedDays = 0;
      let partialDays = 0;
      let missedDays = 0;
      let pendingDays = 0;
      let unscheduledDays = 0;
      let flexibleRestDays = 0;
      let unverifiedDays = 0;
      let eligibleDays = 0;

      let cursor = habitWindowFrom;
      while (cursor <= todayLocalDate) {
        const dayEval = evaluateHabitDayStatus({
          habit: domainHabit,
          log: logsByDate.get(cursor) ?? null,
          localDate: cursor,
          todayLocalDate,
          lifecycle,
        });

        if (dayEval.kind === 'completed') completedDays += 1;
        else if (dayEval.kind === 'partial') partialDays += 1;
        else if (dayEval.kind === 'missed') missedDays += 1;
        else if (dayEval.kind === 'pending') pendingDays += 1;
        else if (dayEval.kind === 'unscheduled') unscheduledDays += 1;
        else if (dayEval.kind === 'flexible_rest') flexibleRestDays += 1;
        else if (dayEval.kind === 'unverified_prior_schedule') unverifiedDays += 1;

        if (dayEval.countsInScheduledDenominator) {
          eligibleDays += 1;
        }
        cursor = addDaysToLocalDate(cursor, 1);
      }

      const hasUnverifiedPriorSchedule = unverifiedDays > 0;
      if (hasUnverifiedPriorSchedule) {
        anyUnverifiedPriorSchedule = true;
      }

      // Weekly-quota (`times_per_week`) habits evaluate weekly streaks rather than a daily %
      const adherenceRate =
        frequencyType === 'times_per_week'
          ? null
          : eligibleDays > 0
            ? Math.round((completedDays / eligibleDays) * 100)
            : null;

      let lastCompletedDate: string | null = null;
      for (let i = domainLogs.length - 1; i >= 0; i -= 1) {
        if (domainLogs[i].statusSnapshot === 'completed') {
          lastCompletedDate = domainLogs[i].localDate;
          break;
        }
      }

      const todayProgressPercent = todayLog
        ? domainHabit.trackingType === 'boolean'
          ? 100
          : computeLogProgressPercent(
              todayLog.completedValue,
              todayLog.targetSnapshot ?? domainHabit.targetValue
            )
        : 0;

      let sortBucket = 3;
      if (todayEvaluated.kind === 'pending' || todayEvaluated.kind === 'partial') {
        sortBucket = 0;
      } else if (todayEvaluated.kind === 'completed') {
        sortBucket = 1;
      } else if (scheduledToday) {
        sortBucket = 2;
      }

      const name = sanitizeRequiredContextLabel(h.name, THINK_TEXT_BOUNDS.TITLE_MAX);

      return {
        sortBucket,
        missedDays,
        item: {
          id: h.id,
          name,
          description: sanitizeContextText(h.description, THINK_TEXT_BOUNDS.DESCRIPTION_MAX).text,
          category: h.category,
          status: h.status,
          trackingType: h.trackingType,
          targetValue: h.targetValue,
          unit: sanitizeContextText(h.unit, 40).text,
          goalId: h.goalId,
          goalTitle: h.goalId ? (goalTitleMap.get(h.goalId) ?? null) : null,
          schedule: {
            frequencyType,
            weekdaysMask,
            targetPerWeek,
            label: scheduleLabel,
          },
          streak,
          todayStatus: {
            kind: todayEvaluated.kind,
            scheduledToday,
            completedValue: todayLog ? todayLog.completedValue : null,
            targetSnapshot: todayLog ? todayLog.targetSnapshot : h.targetValue,
            progressPercent: todayProgressPercent,
          },
          recentWindowSummary: {
            windowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.HABIT_LOGS_WINDOW_DAYS,
            completedDays,
            partialDays,
            missedDays,
            pendingDays,
            unscheduledDays,
            flexibleRestDays,
            unverifiedDays,
            eligibleDays,
            adherenceRate,
            hasUnverifiedPriorSchedule,
          },
          lastCompletedDate,
        },
      };
    });

    evaluatedItems.sort((a, b) => {
      if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
      if (b.item.streak.currentStreak !== a.item.streak.currentStreak) {
        return b.item.streak.currentStreak - a.item.streak.currentStreak;
      }
      if (b.missedDays !== a.missedDays) return b.missedDays - a.missedDays;
      return a.item.id - b.item.id;
    });

    const cappedHabits = evaluatedItems
      .slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.HABITS_MAX)
      .map((entry) => {
        catalogEntries.push({
          entityType: 'habit',
          entityId: entry.item.id,
          label: entry.item.name,
          targetRoute: '/live/habits',
        });
        return entry.item;
      });

    slice.habits = {
      windowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.HABIT_LOGS_WINDOW_DAYS,
      windowFrom: habitWindowFrom,
      windowTo: todayLocalDate,
      summary: {
        activeHabitsTotal: activeHabits.length,
        archivedHabitsCount,
        scheduledTodayCount,
        completedTodayCount,
        partialTodayCount,
        pendingTodayCount,
        hasUnverifiedPriorSchedule: anyUnverifiedPriorSchedule,
      },
      habits: cappedHabits,
    };

    truncations.push({
      domain: 'live.habits',
      truncated: cappedHabits.length < activeHabits.length,
      totalAvailable: activeHabits.length,
      included: cappedHabits.length,
      omitted: Math.max(0, activeHabits.length - cappedHabits.length),
      reason: cappedHabits.length < activeHabits.length ? 'cap_limit' : 'within_limits',
    });
  }

  // --------------------------------------------------------------------------
  // 2. Workouts
  // --------------------------------------------------------------------------
  if (includeWorkouts) {
    const workoutSummary = computeWorkoutSummary(allWorkoutRows, effectiveTimeZone);
    const windowWorkouts = allWorkoutRows.filter(
      (w) => w.localDate >= workoutWindowFrom && w.localDate <= todayLocalDate
    );
    const cappedWorkouts = windowWorkouts.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.WORKOUTS_MAX);

    const recentSessions: LiveWorkoutContextItem[] = cappedWorkouts.map((w) => {
      const title = sanitizeRequiredContextLabel(w.title, THINK_TEXT_BOUNDS.TITLE_MAX);
      catalogEntries.push({
        entityType: 'workout',
        entityId: w.id,
        label: title,
        targetRoute: '/live/fitness',
      });
      return {
        id: w.id,
        title,
        activityType: w.activityType,
        localDate: w.localDate,
        startTime: w.startTime,
        durationMinutes: w.durationMinutes,
        notes: sanitizeContextText(w.notes, THINK_TEXT_BOUNDS.NOTE_MAX).text,
      };
    });

    slice.workouts = {
      windowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.WORKOUT_WINDOW_DAYS,
      windowFrom: workoutWindowFrom,
      windowTo: todayLocalDate,
      summary: {
        weekWorkoutsCount: workoutSummary.weekWorkoutsCount,
        weekDurationMinutes: workoutSummary.weekDurationMinutes,
        thirtyDayWorkoutsCount: workoutSummary.thirtyDayWorkoutsCount,
        thirtyDayDurationMinutes: workoutSummary.thirtyDayDurationMinutes,
        totalWorkoutsCount: workoutSummary.totalWorkoutsCount,
        totalDurationMinutes: workoutSummary.totalDurationMinutes,
        byType30d: workoutSummary.byType,
      },
      recentSessions,
    };

    truncations.push({
      domain: 'live.workouts',
      truncated: recentSessions.length < windowWorkouts.length,
      totalAvailable: windowWorkouts.length,
      included: recentSessions.length,
      omitted: Math.max(0, windowWorkouts.length - recentSessions.length),
      reason: recentSessions.length < windowWorkouts.length ? 'cap_limit' : 'within_limits',
    });
  }

  // --------------------------------------------------------------------------
  // 3. Routines
  // --------------------------------------------------------------------------
  if (includeRoutines) {
    const activeRoutines = allRoutineRows.filter((r) => r.status === 'active');
    const archivedRoutinesCount = allRoutineRows.length - activeRoutines.length;

    const rankedRoutines = [...activeRoutines].sort((a, b) => {
      const aSched = isRoutineScheduledOnDate(a.scheduleType, a.weekdaysMask, todayLocalDate);
      const bSched = isRoutineScheduledOnDate(b.scheduleType, b.weekdaysMask, todayLocalDate);
      if (aSched !== bSched) return aSched ? -1 : 1;

      const timeDiff = TIME_OF_DAY_ORDER[a.timeOfDay] - TIME_OF_DAY_ORDER[b.timeOfDay];
      if (timeDiff !== 0) return timeDiff;

      if (a.preferredTime && b.preferredTime && a.preferredTime !== b.preferredTime) {
        return a.preferredTime.localeCompare(b.preferredTime);
      }
      if (a.preferredTime && !b.preferredTime) return -1;
      if (!a.preferredTime && b.preferredTime) return 1;

      return a.id - b.id;
    });

    const cappedRoutineRows = rankedRoutines.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINES_MAX);
    const routineIds = cappedRoutineRows.map((r) => r.id);

    const [stepRows, recentLogRows] =
      routineIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(routineSteps)
              .where(
                and(
                  eq(routineSteps.userId, userId),
                  inArray(routineSteps.routineId, routineIds)
                )
              )
              .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id)),
            db
              .select()
              .from(routineLogs)
              .where(
                and(
                  eq(routineLogs.userId, userId),
                  inArray(routineLogs.routineId, routineIds),
                  gte(routineLogs.localDate, routineWindowFrom),
                  lte(routineLogs.localDate, todayLocalDate)
                )
              )
              .orderBy(desc(routineLogs.localDate), desc(routineLogs.id)),
          ])
        : [[], []];

    const stepsByRoutine = new Map<number, typeof stepRows>();
    for (const s of stepRows) {
      const list = stepsByRoutine.get(s.routineId) ?? [];
      list.push(s);
      stepsByRoutine.set(s.routineId, list);
    }

    const logsByRoutine = new Map<number, typeof recentLogRows>();
    for (const l of recentLogRows) {
      const list = logsByRoutine.get(l.routineId) ?? [];
      list.push(l);
      logsByRoutine.set(l.routineId, list);
    }

    let scheduledTodayCount = 0;
    let completedTodayCount = 0;
    let inProgressTodayCount = 0;

    const routineItems: LiveRoutineContextItem[] = cappedRoutineRows.map((r) => {
      const rSteps = stepsByRoutine.get(r.id) ?? [];
      const rLogs = logsByRoutine.get(r.id) ?? [];
      const scheduledToday = isRoutineScheduledOnDate(
        r.scheduleType,
        r.weekdaysMask,
        todayLocalDate
      );
      if (scheduledToday) scheduledTodayCount += 1;

      const todayLog = rLogs.find((l) => l.localDate === todayLocalDate) ?? null;
      if (todayLog?.status === 'completed') completedTodayCount += 1;
      else if (todayLog?.status === 'in_progress') inProgressTodayCount += 1;

      let completedRuns = 0;
      let inProgressRuns = 0;
      let stepsDone = 0;
      let stepsExpected = 0;

      // Aggregate immutable snapshot step patterns strictly from stored snapshots
      const stepPatternMap = new Map<
        string,
        { stepTitle: string; appearsInSnapshots: number; completedInSnapshots: number }
      >();

      for (const log of rLogs) {
        if (log.status === 'completed') completedRuns += 1;
        else inProgressRuns += 1;

        if (log.totalStepsSnapshot > 0) {
          stepsDone += log.completedStepsCount;
          stepsExpected += log.totalStepsSnapshot;
        }

        const completedKeySet = new Set(
          log.completedStepsSnapshot.map((item) => `${item.stepId}:${item.title}`)
        );
        for (const snapStep of log.stepsSnapshot) {
          const cleanTitle = sanitizeRequiredContextLabel(
            snapStep.title,
            THINK_TEXT_BOUNDS.STEP_TITLE_MAX
          );
          const key = `${snapStep.stepId}:${cleanTitle}`;
          const existing = stepPatternMap.get(key) ?? {
            stepTitle: cleanTitle,
            appearsInSnapshots: 0,
            completedInSnapshots: 0,
          };
          existing.appearsInSnapshots += 1;
          if (completedKeySet.has(`${snapStep.stepId}:${snapStep.title}`)) {
            existing.completedInSnapshots += 1;
          }
          stepPatternMap.set(key, existing);
        }
      }

      const stepPatterns: LiveRoutineStepPatternItem[] = Array.from(stepPatternMap.values())
        .map((p) => ({
          stepTitle: p.stepTitle,
          appearsInSnapshots: p.appearsInSnapshots,
          completedInSnapshots: p.completedInSnapshots,
          completionRatePercent:
            p.appearsInSnapshots > 0
              ? Math.round((p.completedInSnapshots / p.appearsInSnapshots) * 100)
              : null,
        }))
        .sort(
          (a, b) =>
            (a.completionRatePercent ?? 101) - (b.completionRatePercent ?? 101) ||
            b.appearsInSnapshots - a.appearsInSnapshots
        )
        .slice(0, 8);

      let scheduledDaysInWindow: number | null = null;
      if (r.scheduleType !== 'as_needed') {
        const createdLocal = formatTimestampInTimeZoneToLocalDate(
          r.createdAt,
          effectiveTimeZone
        );
        const startBound = createdLocal > routineWindowFrom ? createdLocal : routineWindowFrom;
        if (startBound <= todayLocalDate) {
          let count = 0;
          let cur = startBound;
          while (cur <= todayLocalDate) {
            if (isRoutineScheduledOnDate(r.scheduleType, r.weekdaysMask, cur)) {
              count += 1;
            }
            cur = addDaysToLocalDate(cur, 1);
          }
          scheduledDaysInWindow = count;
        } else {
          scheduledDaysInWindow = 0;
        }
      }

      const toSnapshotDto = (
        log: (typeof recentLogRows)[number]
      ): LiveRoutineExecutionSnapshotItem => ({
        localDate: log.localDate,
        status: log.status,
        completedStepsCount: log.completedStepsCount,
        totalStepsSnapshot: log.totalStepsSnapshot,
        completedStepTitles: log.completedStepsSnapshot
          .slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_STEPS_PER_ROUTINE_MAX)
          .map((s) =>
            sanitizeRequiredContextLabel(s.title, THINK_TEXT_BOUNDS.STEP_TITLE_MAX)
          ),
      });

      const boundedSteps = rSteps.slice(
        0,
        THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_STEPS_PER_ROUTINE_MAX
      );
      const boundedSnapshots = rLogs
        .slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_RECENT_LOGS_PER_ROUTINE_MAX)
        .map(toSnapshotDto);

      const name = sanitizeRequiredContextLabel(r.name, THINK_TEXT_BOUNDS.TITLE_MAX);
      catalogEntries.push({
        entityType: 'routine',
        entityId: r.id,
        label: name,
        targetRoute: '/live/fitness',
      });

      return {
        id: r.id,
        name,
        description: sanitizeContextText(r.description, THINK_TEXT_BOUNDS.DESCRIPTION_MAX).text,
        status: r.status,
        timeOfDay: r.timeOfDay,
        preferredTime: r.preferredTime,
        scheduleType: r.scheduleType,
        scheduleLabel: formatRoutineScheduleLabel(r.scheduleType, r.weekdaysMask),
        scheduledToday,
        stepsCount: rSteps.length,
        steps: boundedSteps.map((s) => ({
          id: s.id,
          title: sanitizeRequiredContextLabel(s.title, THINK_TEXT_BOUNDS.STEP_TITLE_MAX),
          durationMinutes: s.durationMinutes,
          sortOrder: s.sortOrder,
        })),
        stepsTruncated: rSteps.length > boundedSteps.length,
        todayExecution: todayLog ? toSnapshotDto(todayLog) : null,
        recentExecutionSummary: {
          windowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_WINDOW_DAYS,
          totalRuns: rLogs.length,
          completedRuns,
          inProgressRuns,
          scheduledDaysInWindow,
          snapshotStepCompletionRate:
            stepsExpected > 0 ? Math.round((stepsDone / stepsExpected) * 100) : null,
        },
        stepPatterns,
        recentSnapshots: boundedSnapshots,
      };
    });

    slice.routines = {
      windowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.ROUTINE_WINDOW_DAYS,
      windowFrom: routineWindowFrom,
      windowTo: todayLocalDate,
      summary: {
        activeRoutinesTotal: activeRoutines.length,
        archivedRoutinesCount,
        scheduledTodayCount,
        completedTodayCount,
        inProgressTodayCount,
        recentLogsInWindow: recentLogRows.length,
      },
      routines: routineItems,
    };

    truncations.push({
      domain: 'live.routines',
      truncated: routineItems.length < activeRoutines.length,
      totalAvailable: activeRoutines.length,
      included: routineItems.length,
      omitted: Math.max(0, activeRoutines.length - routineItems.length),
      reason: routineItems.length < activeRoutines.length ? 'cap_limit' : 'within_limits',
    });
  }

  return {
    slice,
    truncations,
    catalogEntries,
  };
}
