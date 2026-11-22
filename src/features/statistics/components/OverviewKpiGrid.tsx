import React from 'react';
import { Card, ProgressRing } from '../../../components/ui';
import { formatDurationMinutes } from '../../../types/fitnessRoutines';
import type {
  StatisticsComparisonMeta,
  StatisticsOverview,
} from '../../../types/statistics';

interface OverviewKpiGridProps {
  overview: StatisticsOverview;
  comparison: StatisticsComparisonMeta;
}

function formatDeltaLabel(
  delta: number | null,
  unit: string,
  comparison: StatisticsComparisonMeta
): string | null {
  if (!comparison.eligible || delta === null) return null;
  if (delta === 0) return `No change vs prior period`;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}${unit} vs prior period`;
}

export function OverviewKpiGrid({ overview, comparison }: OverviewKpiGridProps) {
  const { tasks, habits, goalsProjects, fitnessRoutines } = overview;

  const taskCompletedDelta = formatDeltaLabel(
    tasks.completedInWindowDelta,
    '',
    comparison
  );
  const taskCohortDelta = formatDeltaLabel(
    tasks.dueCohortRateDeltaPts,
    ' pts',
    comparison
  );
  const habitDelta = formatDeltaLabel(
    habits.adherenceRateDeltaPts,
    ' pts',
    comparison
  );
  const milestoneDelta = formatDeltaLabel(
    goalsProjects.milestonesCompletedDelta,
    '',
    comparison
  );
  const workoutDelta = formatDeltaLabel(
    fitnessRoutines.workoutMinutesDelta,
    ' min',
    comparison
  );

  // Use daily/weekday adherence as primary habit ring when available; fall back to weekly quota closed-week rate if only weekly-quota habits exist
  const primaryHabitRate =
    habits.adherenceRate !== null
      ? habits.adherenceRate
      : habits.weeklyQuotaRate;

  const primaryHabitSubline =
    habits.adherenceRate !== null
      ? `${habits.completedUnits} of ${habits.eligibleUnits} scheduled${
          habits.partialUnits > 0 ? ` · ${habits.partialUnits} partial` : ''
        }`
      : habits.weeklyQuotaRate !== null
        ? `${habits.weeklyQuotaQualifyingWeeks} of ${habits.weeklyQuotaClosedWeeks} closed weeks`
        : habits.weeklyQuotaHabitsCount > 0
          ? 'No closed weeks in range yet'
          : 'No scheduled habit days in range';

  const combinedPortfolioRate =
    goalsProjects.activeGoalsAvgProgress !== null &&
    goalsProjects.activeProjectsAvgProgress !== null
      ? Math.round(
          (goalsProjects.activeGoalsAvgProgress +
            goalsProjects.activeProjectsAvgProgress) /
            2
        )
      : (goalsProjects.activeGoalsAvgProgress ??
        goalsProjects.activeProjectsAvgProgress);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Tasks Throughput + Scheduled Cohort Follow-Through */}
      <Card tone="surface" padding="md" className="flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#A3A3A8]">PLAN · Tasks</p>
            <h3 className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {tasks.completedInWindow}{' '}
              <span className="font-sans text-xs font-medium text-[#A3A3A8]">
                completed
              </span>
            </h3>
            <p className="mt-1 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {tasks.dueCohortTotal > 0
                ? `${tasks.dueCohortCompleted}/${tasks.dueCohortTotal} due-window cohort done`
                : 'No tasks due in window'}
            </p>
          </div>
          <ProgressRing
            value={tasks.dueCohortCompletionRate ?? 0}
            tone="coral"
            size={56}
            label={
              tasks.dueCohortCompletionRate !== null
                ? `${tasks.dueCohortCompletionRate}%`
                : '—'
            }
          />
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#737378]">
          <div className="flex items-center justify-between gap-2">
            <span>Open overdue (now)</span>
            <span
              className={
                tasks.openOverdueCount > 0
                  ? 'font-mono font-semibold text-[#E59585] tabular-nums'
                  : 'font-mono text-[#A3A3A8] tabular-nums'
              }
            >
              {tasks.openOverdueCount}
            </span>
          </div>
          {(taskCohortDelta || taskCompletedDelta) && (
            <p className="font-mono text-[10px] text-[#A3A3A8] tabular-nums">
              {taskCohortDelta ?? taskCompletedDelta}
            </p>
          )}
        </div>
      </Card>

      {/* KPI 2: LIVE Habits Adherence */}
      <Card tone="surface" padding="md" className="flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#A3A3A8]">LIVE · Habit Adherence</p>
            <h3 className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {primaryHabitRate !== null ? `${primaryHabitRate}%` : '—'}
            </h3>
            <p className="mt-1 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {primaryHabitSubline}
            </p>
          </div>
          <ProgressRing
            value={primaryHabitRate ?? 0}
            tone="mint"
            size={56}
            label={primaryHabitRate !== null ? `${primaryHabitRate}%` : '—'}
          />
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#737378]">
          <div className="flex items-center justify-between gap-2">
            <span>
              {habits.weeklyQuotaHabitsCount > 0
                ? 'Weekly quota (closed weeks)'
                : 'Unlogged missed days'}
            </span>
            <span className="font-mono text-[#A3A3A8] tabular-nums">
              {habits.weeklyQuotaHabitsCount > 0
                ? habits.weeklyQuotaRate !== null
                  ? `${habits.weeklyQuotaRate}% (${habits.weeklyQuotaQualifyingWeeks}/${habits.weeklyQuotaClosedWeeks})`
                  : 'In progress'
                : habits.missedUnits}
            </span>
          </div>
          {habitDelta && (
            <p className="font-mono text-[10px] text-[#A3A3A8] tabular-nums">
              {habitDelta}
            </p>
          )}
        </div>
      </Card>

      {/* KPI 3: PLAN Projects & Goals */}
      <Card tone="surface" padding="md" className="flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#A3A3A8]">PLAN · Goals &amp; Projects</p>
            <h3 className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {goalsProjects.milestonesCompletedInWindow}{' '}
              <span className="font-sans text-xs font-medium text-[#A3A3A8]">
                {goalsProjects.milestonesCompletedInWindow === 1
                  ? 'milestone'
                  : 'milestones'}
              </span>
            </h3>
            <p className="mt-1 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {goalsProjects.activeGoalsCount} active goals ·{' '}
              {goalsProjects.activeProjectsCount} active projects
            </p>
          </div>
          <ProgressRing
            value={combinedPortfolioRate ?? 0}
            tone="blue"
            size={56}
            label={
              combinedPortfolioRate !== null ? `${combinedPortfolioRate}%` : '—'
            }
          />
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#737378]">
          <div className="flex items-center justify-between gap-2">
            <span>Avg active goal / project</span>
            <span className="font-mono text-[#A3A3A8] tabular-nums">
              {goalsProjects.activeGoalsAvgProgress !== null
                ? `${goalsProjects.activeGoalsAvgProgress}%`
                : '—'}{' '}
              /{' '}
              {goalsProjects.activeProjectsAvgProgress !== null
                ? `${goalsProjects.activeProjectsAvgProgress}%`
                : '—'}
            </span>
          </div>
          {milestoneDelta && (
            <p className="font-mono text-[10px] text-[#A3A3A8] tabular-nums">
              {milestoneDelta}
            </p>
          )}
        </div>
      </Card>

      {/* KPI 4: LIVE Fitness & Routines */}
      <Card tone="surface" padding="md" className="flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#A3A3A8]">LIVE · Fitness &amp; Routines</p>
            <h3 className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {fitnessRoutines.workoutSessionsCount}{' '}
              <span className="font-sans text-xs font-medium text-[#A3A3A8]">
                {fitnessRoutines.workoutSessionsCount === 1 ? 'workout' : 'workouts'}
              </span>
            </h3>
            <p className="mt-1 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {formatDurationMinutes(fitnessRoutines.workoutMinutesTotal)} ·{' '}
              {fitnessRoutines.routineCompletedRunsCount} routine{' '}
              {fitnessRoutines.routineCompletedRunsCount === 1 ? 'run' : 'runs'}
            </p>
          </div>
          <ProgressRing
            value={fitnessRoutines.routineStepCompletionRate ?? 0}
            tone="orange"
            size={56}
            label={
              fitnessRoutines.routineStepCompletionRate !== null
                ? `${fitnessRoutines.routineStepCompletionRate}%`
                : '—'
            }
          />
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#737378]">
          <div className="flex items-center justify-between gap-2">
            <span>Routine step rate (snapshot)</span>
            <span className="font-mono text-[#A3A3A8] tabular-nums">
              {fitnessRoutines.routineStepCompletionRate !== null
                ? `${fitnessRoutines.routineStepCompletionRate}%`
                : 'No logs'}
            </span>
          </div>
          {workoutDelta && (
            <p className="font-mono text-[10px] text-[#A3A3A8] tabular-nums">
              {workoutDelta}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
