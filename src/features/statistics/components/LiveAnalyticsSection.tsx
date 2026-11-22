import React from 'react';
import { Activity, ArrowRight, Dumbbell, Flame, ListChecks } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, ProgressBar } from '../../../components/ui';
import { formatDurationMinutes } from '../../../types/fitnessRoutines';
import type { StatisticsGranularity, StatisticsLiveSection } from '../../../types/statistics';
import { StatisticsChartTooltip } from './StatisticsChartTooltip';

interface LiveAnalyticsSectionProps {
  live: StatisticsLiveSection;
  granularity: StatisticsGranularity;
  onNavigate?: (path: string) => void;
}

export function LiveAnalyticsSection({
  live,
  granularity,
  onNavigate,
}: LiveAnalyticsSectionProps) {
  const { habits, fitness, routines } = live;

  const hasHabitChartData = habits.adherenceTrend.some(
    (b) => b.eligibleUnits > 0 || b.completedUnits > 0 || b.partialUnits > 0
  );
  const hasFitnessChartData = fitness.trend.some((b) => b.durationMinutes > 0);

  return (
    <section aria-label="LIVE Analytics" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[#F2F2F2]">
            LIVE Consistency, Training &amp; Routines
          </h3>
          <p className="text-xs text-[#A3A3A8]">
            Schedule-aware adherence excluding unscheduled rest days and unverified pre-edit schedule history; partial logs are tracked separately from full completions.
          </p>
        </div>
        {onNavigate && (
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('/live/habits')}
              className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#96D2C5] hover:underline"
            >
              <span>Habits</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/live/fitness')}
              className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#F19A50] hover:underline"
            >
              <span>Fitness &amp; Routines</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Row 1: Habit Adherence Trend + Weekly Quota & Streaks */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card tone="surface" padding="lg" className="lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#96D2C5]" />
                <h4 className="text-sm font-semibold text-[#F2F2F2]">
                  Scheduled Habit Adherence ({granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly'})
                </h4>
              </div>
              <p className="mt-1 text-xs text-[#A3A3A8]">
                Full completion rate across scheduled daily &amp; weekday habit slots. Partial measurable logs appear distinctly below.
              </p>
            </div>
            <div className="text-right font-mono text-xs text-[#A3A3A8] tabular-nums">
              <div>
                {habits.dailyWeekdaySummary.completedUnits} completed ·{' '}
                {habits.dailyWeekdaySummary.partialUnits} partial ·{' '}
                {habits.dailyWeekdaySummary.missedUnits} missed
              </div>
              {habits.dailyWeekdaySummary.pendingUnits > 0 && (
                <div className="text-[11px] text-[#737378]">
                  {habits.dailyWeekdaySummary.pendingUnits} open today
                </div>
              )}
            </div>
          </div>

          {!hasHabitChartData ? (
            <EmptyState
              title="No scheduled habit history in this window"
              description="Create daily or weekday habits in LIVE to track schedule-aware adherence trends."
            />
          ) : (
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={habits.adherenceTrend}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="habitAdherenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#96D2C5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#96D2C5" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#737378', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#737378', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={
                      <StatisticsChartTooltip
                        formatValue={(val) =>
                          val === null || val === undefined ? 'Unscheduled' : `${val}%`
                        }
                        footerNote={(row) => {
                          const eligible = Number(row.eligibleUnits ?? 0);
                          if (eligible === 0) return 'No scheduled habit slots in bucket';
                          const done = Number(row.completedUnits ?? 0);
                          const part = Number(row.partialUnits ?? 0);
                          return `${done}/${eligible} full completions${part > 0 ? ` · ${part} partial` : ''}`;
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="adherenceRate"
                    name="Adherence"
                    stroke="#96D2C5"
                    strokeWidth={2}
                    fill="url(#habitAdherenceGrad)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {habits.dailyWeekdaySummary.hasUnverifiedPriorSchedule && (
            <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#A3A3A8]">
              Note: {habits.dailyWeekdaySummary.unverifiedUnits} unlogged day-slots preceded a later habit schedule edit and were omitted from missed counts.
            </p>
          )}
        </Card>

        {/* Weekly Quota Habits + Top Streaks */}
        <Card tone="surface" padding="lg" className="flex flex-col justify-between gap-5 lg:col-span-5">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#F19A50]" />
              <h4 className="text-sm font-semibold text-[#F2F2F2]">
                Weekly Quotas &amp; Top Streaks
              </h4>
            </div>

            {habits.weeklyQuotaSummary.habitsCount > 0 ? (
              <div className="mt-3 space-y-2.5 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#F2F2F2]">
                    Closed weeks meeting target
                  </span>
                  <span className="font-mono font-semibold text-[#96D2C5] tabular-nums">
                    {habits.weeklyQuotaSummary.closedWeekSuccessRate !== null
                      ? `${habits.weeklyQuotaSummary.closedWeekSuccessRate}% (${habits.weeklyQuotaSummary.qualifyingClosedWeeks}/${habits.weeklyQuotaSummary.totalClosedWeeks})`
                      : 'No closed weeks in range'}
                  </span>
                </div>
                <p className="text-[11px] text-[#737378]">
                  Current in-progress week is excluded from closed-week penalties ({habits.weeklyQuotaSummary.currentWeekCompletedCount}/{habits.weeklyQuotaSummary.currentWeekTargetTotal} completed so far this week).
                </p>
                <div className="space-y-1.5 border-t border-white/[0.06] pt-2">
                  {habits.weeklyQuotaSummary.habits.map((wh) => (
                    <div
                      key={wh.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-[#F2F2F2]">
                        {wh.name}{' '}
                        <span className="text-[#737378]">({wh.targetPerWeek}x/wk)</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                        {wh.closedWeekSuccessRate !== null
                          ? `${wh.qualifyingClosedWeeks}/${wh.totalClosedWeeks}w`
                          : '—'}{' '}
                        · {wh.currentStreakWeeks}w streak
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#737378]">
                No weekly-frequency (times-per-week) habits configured.
              </p>
            )}

            <div className="mt-4 space-y-2.5">
              <p className="text-xs font-medium text-[#A3A3A8]">
                Active daily &amp; weekday streaks
              </p>
              {habits.topDailyStreaks.length === 0 ? (
                <p className="text-xs text-[#737378]">
                  Complete scheduled daily or weekday habits to build streaks.
                </p>
              ) : (
                habits.topDailyStreaks.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="truncate font-medium text-[#F2F2F2]">{s.name}</span>
                      <span className="ml-2 text-[11px] text-[#737378]">
                        {s.scheduleLabel}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[#F19A50] tabular-nums">
                      {s.currentStreak}d (best {s.longestStreak}d)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-3 text-[11px] text-[#737378] tabular-nums">
            {habits.activeCount} active · {habits.archivedCount} archived habits
          </div>
        </Card>
      </div>

      {/* Per-Habit Adherence Breakdown */}
      {habits.breakdown.length > 0 && (
        <Card tone="surface" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <h4 className="text-sm font-semibold text-[#F2F2F2]">
              Habit Breakdown in Selected Period
            </h4>
            <span className="text-xs text-[#737378]">
              Partial completions are listed separately from full completions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] text-[#737378]">
                  <th className="py-2 pr-4 font-medium">Habit</th>
                  <th className="py-2 px-3 font-medium">Schedule</th>
                  <th className="py-2 px-3 text-right font-medium">Completed</th>
                  <th className="py-2 px-3 text-right font-medium">Partial</th>
                  <th className="py-2 px-3 text-right font-medium">Missed</th>
                  <th className="py-2 px-3 text-right font-medium">Rate</th>
                  <th className="py-2 pl-3 text-right font-medium">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {habits.breakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 font-medium text-[#F2F2F2]">
                      {item.name}
                      <span className="ml-2 text-[11px] font-normal text-[#737378]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#A3A3A8]">{item.scheduleLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#96D2C5] tabular-nums">
                      {item.completedCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#F19A50] tabular-nums">
                      {item.partialCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#A3A3A8] tabular-nums">
                      {item.frequencyType === 'times_per_week' ? '—' : item.missedCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#F2F2F2] tabular-nums">
                      {item.adherenceRate !== null ? `${item.adherenceRate}%` : '—'}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[#A3A3A8] tabular-nums">
                      {item.currentStreak}
                      {item.streakUnit === 'weeks' ? 'w' : 'd'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Row 2: Fitness Volume & Activity Mix + Routine Snapshot Consistency */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Fitness */}
        <Card tone="surface" padding="lg" className="lg:col-span-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-[#F19A50]" />
              <div>
                <h4 className="text-sm font-semibold text-[#F2F2F2]">
                  Fitness Volume &amp; Activity Mix
                </h4>
                <p className="mt-0.5 font-mono text-xs text-[#A3A3A8] tabular-nums">
                  {fitness.totalSessions} sessions ·{' '}
                  {formatDurationMinutes(fitness.totalDurationMinutes)} ·{' '}
                  {fitness.activeWorkoutDays} active days
                  {fitness.avgDurationMinutes !== null
                    ? ` · ${fitness.avgDurationMinutes} min avg`
                    : ''}
                </p>
              </div>
            </div>
          </div>

          {!hasFitnessChartData ? (
            <EmptyState
              title="No workouts logged in this period"
              description="Log strength, cardio, mobility, or recovery sessions in LIVE Fitness to view training volume."
            />
          ) : (
            <div className="space-y-4">
              <div className="h-52 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fitness.trend}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#737378', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#737378', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={
                        <StatisticsChartTooltip
                          formatValue={(val) => `${val ?? 0} min`}
                          footerNote={(row) => {
                            const sessions = Number(row.sessions ?? 0);
                            return `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`;
                          }}
                        />
                      }
                    />
                    <Bar
                      dataKey="durationMinutes"
                      name="Duration"
                      fill="#F19A50"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5 border-t border-white/[0.06] pt-3.5">
                {fitness.activityMix.map((mix) => (
                  <div key={mix.activityType} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F2F2F2]">
                        {mix.activityType}
                      </span>
                      <span className="font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                        {mix.sessions} {mix.sessions === 1 ? 'session' : 'sessions'} ·{' '}
                        {formatDurationMinutes(mix.durationMinutes)} ({mix.sharePercent}%)
                      </span>
                    </div>
                    <ProgressBar value={mix.sharePercent} tone="orange" height="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Routines */}
        <Card tone="surface" padding="lg" className="flex flex-col justify-between gap-4 lg:col-span-6">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[#A9C8E9]" />
                <div>
                  <h4 className="text-sm font-semibold text-[#F2F2F2]">
                    Routine Execution Consistency
                  </h4>
                  <p className="mt-0.5 text-xs text-[#A3A3A8]">
                    Step completion percentages are evaluated strictly from recorded execution snapshots, preserving historical accuracy across later step edits.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3">
              <div>
                <p className="text-[11px] text-[#737378]">Completed runs</p>
                <p className="mt-0.5 font-mono text-base font-bold text-[#F2F2F2] tabular-nums">
                  {routines.completedRunsCount}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  {routines.inProgressRunsCount} partial
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#737378]">Full-run rate</p>
                <p className="mt-0.5 font-mono text-base font-bold text-[#F2F2F2] tabular-nums">
                  {routines.fullCompletionRate !== null
                    ? `${routines.fullCompletionRate}%`
                    : '—'}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  {routines.totalLogsInWindow} total logs
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#737378]">Snapshot steps</p>
                <p className="mt-0.5 font-mono text-base font-bold text-[#A9C8E9] tabular-nums">
                  {routines.snapshotStepCompletionRate !== null
                    ? `${routines.snapshotStepCompletionRate}%`
                    : '—'}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  {routines.totalStepsCompletedSnapshot}/{routines.totalStepsExpectedSnapshot} steps
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {routines.perRoutineBreakdown.length === 0 ? (
                <EmptyState
                  title="No active or logged routines"
                  description="Create step-based routines in LIVE Fitness & Routines and log runs to track execution consistency."
                />
              ) : (
                routines.perRoutineBreakdown.map((item) => (
                  <div key={item.routineId} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="truncate font-semibold text-[#F2F2F2]">
                          {item.name}
                        </span>
                        <span className="ml-2 text-[11px] text-[#737378]">
                          {item.timeOfDay} · {item.scheduleLabel}
                          {item.status === 'archived' ? ' · Archived' : ''}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                        {item.completedRuns} full
                        {item.inProgressRuns > 0 ? ` · ${item.inProgressRuns} partial` : ''}
                        {item.scheduledDaysInWindow !== null
                          ? ` / ${item.scheduledDaysInWindow} sched`
                          : ''}
                        {item.snapshotStepRate !== null
                          ? ` · ${item.snapshotStepRate}% steps`
                          : ''}
                      </span>
                    </div>
                    <ProgressBar
                      value={item.snapshotStepRate ?? 0}
                      tone="blue"
                      height="sm"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-3 text-[11px] text-[#737378] tabular-nums">
            {routines.activeCount} active · {routines.archivedCount} archived routines
          </div>
        </Card>
      </div>
    </section>
  );
}
