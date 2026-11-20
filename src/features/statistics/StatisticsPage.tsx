import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useStatisticsPreviewData } from '../../hooks/useMarlyData';
import { Card, PreviewNotice, ProgressBar, ProgressRing } from '../../components/ui';

export function StatisticsPage() {
  const { summary, todayTaskRate, todayHabitCompleted, todayHabitTotal } =
    useStatisticsPreviewData();

  const weeklyTaskRate = Math.round(
    (summary.tasksCompletedThisWeek / summary.tasksPlannedThisWeek) * 100
  );
  const milestoneRate = Math.round(
    (summary.milestonesCompleted / summary.milestonesTotal) * 100
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
          STATISTICS · Unified Progress
        </h2>
        <p className="mt-1 text-sm text-[#A3A3A8]">
          Answering meaningful questions across PLAN commitments and LIVE consistency.
        </p>
      </div>

      <PreviewNotice
        accent="orange"
        title="Unified Analytics Preview"
        phaseLabel="Phase 9 · Sample Metrics"
        description={`Real statistical queries and Recharts visualizations will be computed server-side in Phase 9. Today's live demo status: ${todayTaskRate}% Today tasks · ${todayHabitCompleted}/${todayHabitTotal} habits checked.`}
      />

      {/* Core Question-Driven Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card tone="surface" padding="lg" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#A3A3A8]">Am I finishing what I plan?</p>
            <h3 className="mt-1 text-base font-semibold text-[#F2F2F2]">Task Completion</h3>
            <p className="mt-1 font-mono text-xs text-[#737378] tabular-nums">
              {summary.tasksCompletedThisWeek} of {summary.tasksPlannedThisWeek} planned this week
            </p>
          </div>
          <ProgressRing value={weeklyTaskRate} tone="coral" size={64} />
        </Card>

        <Card tone="surface" padding="lg" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#A3A3A8]">Am I becoming more consistent?</p>
            <h3 className="mt-1 text-base font-semibold text-[#F2F2F2]">Habit Adherence</h3>
            <p className="mt-1 font-mono text-xs text-[#737378] tabular-nums">
              {summary.habitAdherencePercent}% monthly scheduled rate
            </p>
          </div>
          <ProgressRing value={summary.habitAdherencePercent} tone="mint" size={64} />
        </Card>

        <Card tone="surface" padding="lg" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#A3A3A8]">Am I moving toward my goals?</p>
            <h3 className="mt-1 text-base font-semibold text-[#F2F2F2]">Milestone Velocity</h3>
            <p className="mt-1 font-mono text-xs text-[#737378] tabular-nums">
              {summary.milestonesCompleted} of {summary.milestonesTotal} active milestones
            </p>
          </div>
          <ProgressRing value={milestoneRate} tone="orange" size={64} />
        </Card>
      </div>

      {/* Combined PLAN vs LIVE Comparison Preview */}
      <Card tone="surface" padding="lg">
        <div className="flex items-center gap-2.5 pb-4">
          <BarChart3 className="h-4 w-4 text-[#F19A50]" />
          <h3 className="text-base font-semibold text-[#F2F2F2]">
            Weekly Rhythm · Tasks vs. Habits (Demo)
          </h3>
        </div>

        <div className="space-y-4">
          {summary.rhythmBreakdown.map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#F2F2F2]">{row.label}</span>
                <span className="font-mono text-[#A3A3A8] tabular-nums">{row.value}%</span>
              </div>
              <ProgressBar value={row.value} tone={row.tone} height="md" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
