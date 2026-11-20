import React from 'react';
import { ArrowRight, Plus, Target } from 'lucide-react';
import { TaskFilterOption } from '../../context/DemoStateContext';
import { useToast } from '../../context/ToastContext';
import { useProjectsAndGoalsData, useTasksOverviewData } from '../../hooks/useMarlyData';
import {
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  ProgressBar,
  SegmentedTabs,
} from '../../components/ui';
import { cn } from '../../lib/cn';

interface TasksOverviewColumnProps {
  onNavigate: (path: string) => void;
}

export function TasksOverviewColumn({ onNavigate }: TasksOverviewColumnProps) {
  const {
    tasks,
    tomorrowLabel,
    taskCategoryFilter,
    setTaskCategoryFilter,
    toggleTask,
    searchQuery,
    setSearchQuery,
  } = useTasksOverviewData();
  const { goals } = useProjectsAndGoalsData();
  const { pushToast } = useToast();

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filterTasks = (bucket: 'today' | 'tomorrow') =>
    tasks.filter((task) => {
      if (task.bucket !== bucket) return false;
      if (taskCategoryFilter !== 'All' && task.category !== taskCategoryFilter) return false;
      if (normalizedQuery && !task.title.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });

  const todayTasks = filterTasks('today');
  const tomorrowTasks = filterTasks('tomorrow');

  const todayCompleted = todayTasks.filter((t) => t.completed).length;
  const tomorrowCompleted = tomorrowTasks.filter((t) => t.completed).length;

  const filterOptions: Array<{ value: TaskFilterOption; label: string; count?: number }> = [
    { value: 'All', label: 'All', count: tasks.length },
    { value: 'Work', label: 'Work' },
    { value: 'Health', label: 'Health' },
    { value: 'Family', label: 'Family' },
    { value: 'Study', label: 'Study' },
  ];

  const handlePlanShortcut = () => {
    onNavigate('/plan/tasks');
    pushToast({
      title: 'Opened Plan preview',
      description: 'Full task creation and persistence will arrive in Phase 3.',
      variant: 'info',
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Category Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">My Tasks</h2>
          <IconButton
            variant="light"
            label="Open Plan Tasks preview"
            onClick={handlePlanShortcut}
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>

        <SegmentedTabs
          variant="pill-filter"
          options={filterOptions}
          value={taskCategoryFilter}
          onChange={setTaskCategoryFilter}
        />
      </div>

      {/* Featured Coral Card: Today */}
      <Card tone="coral" padding="md">
        <div className="flex items-center justify-between gap-4 pb-3">
          <h3 className="text-lg font-bold text-[#151515]">Today · Mar 24</h3>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#151515]/80 tabular-nums">
            <span>
              {todayCompleted}/{todayTasks.length}
            </span>
          </div>
        </div>

        {todayTasks.length === 0 ? (
          <div className="rounded-xl bg-[#151515]/[0.08] p-4 text-center">
            <p className="text-sm font-medium text-[#151515]">No matching Today tasks</p>
            <p className="mt-1 text-xs text-[#151515]/75">
              Adjust your category filter or clear the search query.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors',
                  task.completed ? 'bg-transparent' : 'bg-[#151515]/[0.07]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    tone="dark-accent"
                    ariaLabel={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'truncate text-sm font-medium text-[#151515]',
                        task.completed && 'line-through opacity-65'
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="text-[11px] font-medium text-[#151515]/65">
                      {task.category}
                      <span aria-hidden="true"> · </span>
                      {task.priority}
                      {task.subtaskProgress && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">{task.subtaskProgress}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {task.durationLabel && (
                  <span className="font-mono text-[11px] font-medium text-[#151515]/70 tabular-nums shrink-0">
                    {task.durationLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Surface Card: Tomorrow */}
      <Card tone="surface" padding="md">
        <div className="flex items-center justify-between gap-4 pb-3">
          <h3 className="text-base font-semibold text-[#F2F2F2]">{tomorrowLabel}</h3>
          <span className="font-mono text-xs text-[#A3A3A8] tabular-nums">
            {tomorrowCompleted}/{tomorrowTasks.length}
          </span>
        </div>

        {tomorrowTasks.length === 0 ? (
          <EmptyState
            title="No matching Tomorrow tasks"
            description="No scheduled demonstration tasks match the active filter."
            actionLabel={searchQuery ? 'Clear filter' : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
          />
        ) : (
          <div className="space-y-2">
            {tomorrowTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#292929] px-3.5 py-2.5 transition-colors hover:bg-[#303030]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    tone="coral"
                    ariaLabel={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
                  />
                  <span
                    className={cn(
                      'truncate text-sm text-[#F2F2F2]',
                      task.completed && 'line-through text-[#737378]'
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <span className="text-[11px] text-[#737378] shrink-0">{task.category}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active Goals Preview Strip */}
      <Card tone="surface" padding="md">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#E59585]" />
            <h3 className="text-sm font-semibold text-[#F2F2F2]">Goal Progress</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/plan/goals')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#A3A3A8] hover:text-[#F2F2F2] cursor-pointer"
          >
            <span>All goals</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {goals.map((goal) => (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-[#F2F2F2]">{goal.title}</span>
                <span className="font-mono text-[#A3A3A8] tabular-nums shrink-0">
                  {goal.completedMilestones}/{goal.totalMilestones} milestones
                </span>
              </div>
              <ProgressBar value={goal.progressPercent} tone="coral" showLabel />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
