import React from 'react';
import { Calendar, FolderKanban, Target } from 'lucide-react';
import {
  useProjectsAndGoalsData,
  useScheduleData,
  useTasksOverviewData,
} from '../../hooks/useMarlyData';
import {
  Card,
  Checkbox,
  PreviewNotice,
  ProgressBar,
  SegmentedTabs,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { PlanSubTab } from '../../types/marly';

interface PlanPageProps {
  activeTab: PlanSubTab;
  onNavigate: (path: string) => void;
}

const PLAN_TABS: Array<{ value: PlanSubTab; label: string; href: string }> = [
  { value: 'tasks', label: 'Tasks', href: '/plan/tasks' },
  { value: 'calendar', label: 'Calendar', href: '/plan/calendar' },
  { value: 'projects', label: 'Projects', href: '/plan/projects' },
  { value: 'goals', label: 'Goals', href: '/plan/goals' },
];

export function PlanPage({ activeTab, onNavigate }: PlanPageProps) {
  const { tasks, toggleTask } = useTasksOverviewData();
  const { blocks } = useScheduleData();
  const { projects, goals } = useProjectsAndGoalsData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            PLAN · Tasks, Schedule & Goals
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Organize commitments, distinguish deadlines from time blocks, and link tasks to milestones.
          </p>
        </div>

        <SegmentedTabs
          options={PLAN_TABS}
          value={activeTab}
          onChange={(tab) => onNavigate(`/plan/${tab}`)}
        />
      </div>

      <PreviewNotice
        accent="coral"
        title="PLAN Module Preview"
        phaseLabel="Phases 3–5"
        description="Task CRUD, PostgreSQL/Drizzle persistence, recurring rules, and calendar scheduling will be implemented incrementally across Phases 3, 4, and 5."
      />

      {activeTab === 'tasks' && (
        <Card tone="surface" padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <h3 className="text-base font-semibold text-[#F2F2F2]">All Demonstration Tasks</h3>
            <span className="font-mono text-xs text-[#A3A3A8] tabular-nums">
              {tasks.filter((t) => t.completed).length}/{tasks.length} completed
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-white/[0.025] sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    tone="coral"
                    ariaLabel={`Toggle ${task.title}`}
                  />
                  <span
                    className={cn(
                      'truncate text-sm font-medium text-[#F2F2F2]',
                      task.completed && 'line-through text-[#737378]'
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-8 text-xs text-[#A3A3A8] sm:pl-0 shrink-0">
                  <span>{task.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{task.priority}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[#737378]">{task.dueLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card tone="surface" padding="lg">
            <div className="flex items-center gap-2.5 pb-4">
              <Calendar className="h-4 w-4 text-[#A9C8E9]" />
              <h3 className="text-base font-semibold text-[#F2F2F2]">Scheduled Time Blocks (Demo)</h3>
            </div>
            <div className="space-y-2.5">
              {blocks.slice(0, 5).map((block) => (
                <div
                  key={block.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl px-4 py-3',
                    block.featured ? 'bg-[#E59585] text-[#151515]' : 'bg-[#292929] text-[#F2F2F2]'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold">{block.title}</p>
                    <p
                      className={cn(
                        'text-xs',
                        block.featured ? 'text-[#151515]/75' : 'text-[#A3A3A8]'
                      )}
                    >
                      {block.period} · {block.category}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums">{block.time}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card tone="surface" padding="lg">
            <h3 className="text-base font-semibold text-[#F2F2F2]">
              Deadlines vs. Time Blocks (Phase 4 Design)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#A3A3A8]">
              In Marly, a task having a due date on Thursday does not automatically clutter your Thursday afternoon timeline. Deadlines track when work is due; scheduled time blocks represent intentional commitments on your calendar.
            </p>
            <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-4 text-xs text-[#A3A3A8]">
              <div>Day, Week, Month, and Agenda calendar modes</div>
              <div>Conflict detection for overlapping time blocks</div>
              <div>Optional workout session visibility from LIVE</div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {projects.map((project) => {
            const pct = Math.round((project.completedTasks / project.totalTasks) * 100);
            return (
              <Card key={project.id} tone="surface" padding="lg" className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#A3A3A8]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#E59585]">
                      <FolderKanban className="h-3.5 w-3.5" />
                      {project.status}
                    </span>
                    <span className="font-mono">{project.targetDate}</span>
                  </div>
                  <h3 className="mt-2.5 text-base font-semibold text-[#F2F2F2]">{project.name}</h3>
                  <p className="mt-1 text-xs text-[#737378]">Goal · {project.goalName}</p>
                </div>
                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between font-mono text-xs text-[#A3A3A8] tabular-nums">
                    <span>Tasks</span>
                    <span>
                      {project.completedTasks}/{project.totalTasks}
                    </span>
                  </div>
                  <ProgressBar value={pct} tone="coral" showLabel />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {goals.map((goal) => (
            <Card key={goal.id} tone="surface" padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E59585]/12 text-[#E59585]">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F2F2F2]">{goal.title}</h3>
                    <p className="mt-0.5 font-mono text-xs text-[#A3A3A8]">{goal.targetDate}</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-[#E59585] tabular-nums">
                  {goal.progressPercent}%
                </span>
              </div>
              <div className="mt-4">
                <ProgressBar value={goal.progressPercent} tone="coral" height="md" />
                <p className="mt-2.5 text-xs text-[#A3A3A8]">
                  <span className="font-mono tabular-nums text-[#F2F2F2]">
                    {goal.completedMilestones} of {goal.totalMilestones}
                  </span>{' '}
                  milestones completed · Manual milestone tracking works independently of AI.
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
