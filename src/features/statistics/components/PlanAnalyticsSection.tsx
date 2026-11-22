import React from 'react';
import { ArrowRight, Calendar, CheckSquare, FolderKanban, Target } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, ProgressBar } from '../../../components/ui';
import type { StatisticsGranularity, StatisticsPlanSection } from '../../../types/statistics';
import { StatisticsChartTooltip } from './StatisticsChartTooltip';

interface PlanAnalyticsSectionProps {
  plan: StatisticsPlanSection;
  granularity: StatisticsGranularity;
  onNavigate?: (path: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const GOAL_MODE_LABELS: Record<string, string> = {
  milestones: 'Milestones',
  measurable: 'Target value',
  linked_work: 'Linked work',
  status: 'Status',
};

export function PlanAnalyticsSection({
  plan,
  granularity,
  onNavigate,
}: PlanAnalyticsSectionProps) {
  const { tasks, projects, goals, calendarContext } = plan;
  const hasAnyTaskTrend = tasks.trend.some(
    (b) => b.completedInWindow > 0 || b.dueTotal > 0
  );

  const maxPriorityCount = Math.max(
    1,
    ...tasks.priorityBreakdown.map((p) => p.completedInWindow + p.openCount)
  );

  return (
    <section aria-label="PLAN Analytics" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[#F2F2F2]">
            PLAN Execution &amp; Portfolio
          </h3>
          <p className="text-xs text-[#A3A3A8]">
            Distinguishing completion throughput (completed date) from scheduled due-date cohort status and current open backlog.
          </p>
        </div>
        {onNavigate && (
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('/plan/tasks')}
              className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#E59585] hover:underline"
            >
              <span>Tasks</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/plan/projects')}
              className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#A9C8E9] hover:underline"
            >
              <span>Projects &amp; Goals</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Row 1: Task Execution & Due Cohort Trend + Open Snapshot & Breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card tone="surface" padding="lg" className="lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#E59585]" />
                <h4 className="text-sm font-semibold text-[#F2F2F2]">
                  Task Throughput vs. Due Cohort ({granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly'})
                </h4>
              </div>
              <p className="mt-1 text-xs text-[#A3A3A8]">
                Completed bars track tasks finished by completion timestamp; Due Cohort tracks current status of tasks due in each bucket.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#A3A3A8]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#E59585]" />
                Completed (throughput)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#52525B]" />
                Due in bucket
              </span>
            </div>
          </div>

          {!hasAnyTaskTrend ? (
            <EmptyState
              title="No task activity in this window"
              description="Complete tasks or assign due dates within this period to inspect throughput and follow-through trends."
            />
          ) : (
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tasks.trend}
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
                        footerNote={(row) => {
                          const dueTotal = Number(row.dueTotal ?? 0);
                          const dueCompleted = Number(row.dueCompleted ?? 0);
                          return dueTotal > 0
                            ? `Due cohort completed: ${dueCompleted}/${dueTotal} (${Math.round((dueCompleted / dueTotal) * 100)}%)`
                            : 'No tasks due in this bucket';
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="completedInWindow"
                    name="Completed (throughput)"
                    fill="#E59585"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="dueTotal"
                    name="Tasks due"
                    fill="#52525B"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3.5 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#737378]">Throughput</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
                {tasks.completedInWindow} finished
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#737378]">Created in window</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
                {tasks.createdInWindow} added
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#737378]">Due cohort status</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
                {tasks.dueCohort.completionRate !== null
                  ? `${tasks.dueCohort.completionRate}% (${tasks.dueCohort.completed}/${tasks.dueCohort.total})`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#737378]">Calendar scheduled</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
                {calendarContext.eventsCountInWindow} events · {calendarContext.scheduledHours}h
              </p>
            </div>
          </div>
        </Card>

        {/* Task Snapshot & Priority/Category Breakdown */}
        <Card tone="surface" padding="lg" className="flex flex-col justify-between gap-5 lg:col-span-5">
          <div>
            <h4 className="text-sm font-semibold text-[#F2F2F2]">
              Current Task Backlog &amp; Mix
            </h4>
            <p className="mt-1 text-xs text-[#A3A3A8]">
              Live snapshot of open tasks alongside window completions by priority and category.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3">
              <div>
                <p className="text-[11px] text-[#737378]">Open (now)</p>
                <p className="mt-0.5 font-mono text-base font-bold text-[#F2F2F2] tabular-nums">
                  {tasks.currentOpenSnapshot.totalOpen}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  {tasks.currentOpenSnapshot.inProgress} active · {tasks.currentOpenSnapshot.todo} todo
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#737378]">Overdue</p>
                <p
                  className={
                    tasks.currentOpenSnapshot.overdue > 0
                      ? 'mt-0.5 font-mono text-base font-bold text-[#E59585] tabular-nums'
                      : 'mt-0.5 font-mono text-base font-bold text-[#F2F2F2] tabular-nums'
                  }
                >
                  {tasks.currentOpenSnapshot.overdue}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  Past due date
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#737378]">Due today</p>
                <p className="mt-0.5 font-mono text-base font-bold text-[#F2F2F2] tabular-nums">
                  {tasks.currentOpenSnapshot.dueToday}
                </p>
                <p className="text-[10px] text-[#737378] tabular-nums">
                  {tasks.currentOpenSnapshot.noDueDate} undated
                </p>
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-[#A3A3A8]">By priority (completed vs. open)</p>
              {tasks.priorityBreakdown.map((row) => {
                const total = row.completedInWindow + row.openCount;
                const widthPct = Math.round((total / maxPriorityCount) * 100);
                return (
                  <div key={row.priority} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#F2F2F2]">
                        {PRIORITY_LABELS[row.priority] ?? row.priority}
                      </span>
                      <span className="font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                        {row.completedInWindow} done · {row.openCount} open
                      </span>
                    </div>
                    <ProgressBar value={widthPct} tone="coral" height="sm" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="border-t border-white/[0.06] pt-3.5">
            <p className="mb-2 text-xs font-medium text-[#A3A3A8]">By category</p>
            <div className="space-y-1.5">
              {tasks.categoryBreakdown
                .filter(
                  (c) =>
                    c.completedInWindow > 0 ||
                    c.dueCohortTotal > 0 ||
                    c.openCount > 0
                )
                .map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[#F2F2F2]">{cat.category}</span>
                    <span className="font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                      {cat.completedInWindow} done · {cat.openCount} open
                      {cat.dueCohortTotal > 0
                        ? ` · ${cat.dueCohortCompleted}/${cat.dueCohortTotal} due`
                        : ''}
                    </span>
                  </div>
                ))}
              {tasks.categoryBreakdown.every(
                (c) =>
                  c.completedInWindow === 0 &&
                  c.dueCohortTotal === 0 &&
                  c.openCount === 0
              ) && (
                <p className="text-xs text-[#737378]">No categorized tasks recorded yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Active Projects & Goals Progress */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Projects */}
        <Card tone="surface" padding="lg">
          <div className="flex items-start justify-between gap-3 pb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-[#E59585]" />
              <div>
                <h4 className="text-sm font-semibold text-[#F2F2F2]">Projects Progress</h4>
                <p className="mt-0.5 text-xs text-[#737378] tabular-nums">
                  {projects.statusCounts.active} active · {projects.statusCounts.planned} planned · {projects.statusCounts.completed} completed · {projects.milestonesCompletedInWindow} milestones finished in window
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
              {projects.activeAvgProgress !== null ? `${projects.activeAvgProgress}% avg` : '—'}
            </span>
          </div>

          {projects.activeItems.length === 0 ? (
            <EmptyState
              title="No active or planned projects"
              description="Create a project with milestones or linked tasks in PLAN to track portfolio progress here."
            />
          ) : (
            <div className="space-y-3.5">
              {projects.activeItems.map((project) => (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <span className="truncate text-xs font-semibold text-[#F2F2F2]">
                        {project.name}
                      </span>
                      <span className="ml-2 text-[11px] text-[#737378]">
                        {project.status === 'planned' ? 'Planned' : 'Active'}
                        {project.goalTitle ? ` · ${project.goalTitle}` : ''}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                      {project.totalUnits > 0
                        ? `${project.completedUnits}/${project.totalUnits} units · `
                        : ''}
                      {project.progressPercent}%
                    </span>
                  </div>
                  <ProgressBar value={project.progressPercent} tone="coral" height="sm" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Goals */}
        <Card tone="surface" padding="lg">
          <div className="flex items-start justify-between gap-3 pb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#A9C8E9]" />
              <div>
                <h4 className="text-sm font-semibold text-[#F2F2F2]">Goals Progress</h4>
                <p className="mt-0.5 text-xs text-[#737378] tabular-nums">
                  {goals.statusCounts.active} active · {goals.statusCounts.planned} planned · {goals.statusCounts.completed} completed · {goals.milestonesCompletedInWindow} milestones finished in window
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-semibold text-[#F2F2F2] tabular-nums">
              {goals.activeAvgProgress !== null ? `${goals.activeAvgProgress}% avg` : '—'}
            </span>
          </div>

          {goals.activeItems.length === 0 ? (
            <EmptyState
              title="No active or planned goals"
              description="Define long-term goals with milestones, targets, or linked projects in PLAN to monitor momentum."
            />
          ) : (
            <div className="space-y-3.5">
              {goals.activeItems.map((goal) => (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <span className="truncate text-xs font-semibold text-[#F2F2F2]">
                        {goal.title}
                      </span>
                      <span className="ml-2 text-[11px] text-[#737378]">
                        {GOAL_MODE_LABELS[goal.mode] ?? goal.mode}
                        {goal.targetDate ? ` · Due ${goal.targetDate}` : ''}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                      {goal.totalMilestones > 0
                        ? `${goal.completedMilestones}/${goal.totalMilestones} ms · `
                        : ''}
                      {goal.progressPercent}%
                    </span>
                  </div>
                  <ProgressBar value={goal.progressPercent} tone="blue" height="sm" />
                </div>
              ))}
            </div>
          )}

          {calendarContext.eventsCountInWindow > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-[#A3A3A8]">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#A9C8E9]" />
                <span>Calendar events in window</span>
              </span>
              <span className="font-mono tabular-nums">
                {calendarContext.timedEventsCount} timed ({calendarContext.scheduledHours}h) ·{' '}
                {calendarContext.allDayEventsCount} all-day
              </span>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
