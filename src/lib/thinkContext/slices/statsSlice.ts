import { getUserStatisticsOverview } from '../../../db/statistics.ts';
import type { StatisticsPeriodPreset } from '../../../types/statistics.ts';
import { sanitizeRequiredContextLabel } from '../sanitize.ts';
import { THINK_TEXT_BOUNDS, type StatsContextSlice } from '../types.ts';

export interface LoadStatsSliceParams {
  userId: number;
  userTimeZone: string | null | undefined;
  preset: Exclude<StatisticsPeriodPreset, 'custom'>;
}

/**
 * Loads concise cross-pillar statistics by reusing the authoritative server-side
 * `getUserStatisticsOverview` aggregation while stripping verbose chart trend arrays.
 */
export async function loadStatsContextSlice(
  params: LoadStatsSliceParams
): Promise<StatsContextSlice> {
  const full = await getUserStatisticsOverview({
    userId: params.userId,
    userTimeZone: params.userTimeZone,
    query: { preset: params.preset },
  });

  return {
    meta: full.meta,
    overview: full.overview,
    planSummary: {
      tasksCreatedInWindow: full.plan.tasks.createdInWindow,
      dueCohort: full.plan.tasks.dueCohort,
      currentOpenSnapshot: full.plan.tasks.currentOpenSnapshot,
      priorityBreakdown: full.plan.tasks.priorityBreakdown,
      categoryBreakdown: full.plan.tasks.categoryBreakdown,
      projectsStatusCounts: full.plan.projects.statusCounts,
      goalsStatusCounts: full.plan.goals.statusCounts,
      calendarContext: full.plan.calendarContext,
    },
    liveSummary: {
      habitsActiveCount: full.live.habits.activeCount,
      habitsArchivedCount: full.live.habits.archivedCount,
      dailyWeekdaySummary: full.live.habits.dailyWeekdaySummary,
      weeklyQuotaSummary: {
        habitsCount: full.live.habits.weeklyQuotaSummary.habitsCount,
        qualifyingClosedWeeks: full.live.habits.weeklyQuotaSummary.qualifyingClosedWeeks,
        totalClosedWeeks: full.live.habits.weeklyQuotaSummary.totalClosedWeeks,
        closedWeekSuccessRate: full.live.habits.weeklyQuotaSummary.closedWeekSuccessRate,
        currentWeekCompletedCount: full.live.habits.weeklyQuotaSummary.currentWeekCompletedCount,
        currentWeekTargetTotal: full.live.habits.weeklyQuotaSummary.currentWeekTargetTotal,
      },
      topDailyStreaks: full.live.habits.topDailyStreaks.slice(0, 5).map((item) => ({
        ...item,
        name: sanitizeRequiredContextLabel(item.name, THINK_TEXT_BOUNDS.TITLE_MAX),
      })),
      fitness: {
        totalSessions: full.live.fitness.totalSessions,
        totalDurationMinutes: full.live.fitness.totalDurationMinutes,
        avgDurationMinutes: full.live.fitness.avgDurationMinutes,
        activeWorkoutDays: full.live.fitness.activeWorkoutDays,
        activityMix: full.live.fitness.activityMix,
      },
      routines: {
        activeCount: full.live.routines.activeCount,
        archivedCount: full.live.routines.archivedCount,
        totalLogsInWindow: full.live.routines.totalLogsInWindow,
        completedRunsCount: full.live.routines.completedRunsCount,
        inProgressRunsCount: full.live.routines.inProgressRunsCount,
        fullCompletionRate: full.live.routines.fullCompletionRate,
        snapshotStepCompletionRate: full.live.routines.snapshotStepCompletionRate,
      },
    },
  };
}
