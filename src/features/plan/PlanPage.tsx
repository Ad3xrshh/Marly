import React, { useEffect, useMemo, useState } from 'react';
import {
  LogIn,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import {
  useProjectsAndGoalsData,
  useTasksOverviewData,
} from '../../hooks/useMarlyData';
import { PlanCalendarView } from './PlanCalendarView';
import { PlanGoalsView } from './PlanGoalsView';
import { PlanProjectsView } from './PlanProjectsView';
import { cn } from '../../lib/cn';
import {
  parsePositiveIdQueryParam,
  useTemporaryEntityHighlight,
} from '../../lib/useHighlightTarget';
import { PlanSubTab } from '../../types/marly';
import {
  formatTaskDueLabel,
  getPriorityLabel,
  isTaskOverdue,
  TASK_CATEGORY_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '../../types/task';

interface PlanPageProps {
  activeTab: PlanSubTab;
  search?: string;
  onNavigate: (path: string) => void;
}

const TASK_HIGHLIGHT_PARAMS = ['highlight'];

const PLAN_TABS: Array<{ value: PlanSubTab; label: string; href: string }> = [
  { value: 'tasks', label: 'Tasks', href: '/plan/tasks' },
  { value: 'calendar', label: 'Calendar', href: '/plan/calendar' },
  { value: 'projects', label: 'Projects', href: '/plan/projects' },
  { value: 'goals', label: 'Goals', href: '/plan/goals' },
];

const PRIORITY_TONES: Record<TaskPriority, string> = {
  low: 'text-[#A3A3A8]',
  medium: 'text-[#A9C8E9]',
  high: 'text-[#F19A50]',
  urgent: 'text-[#E59585]',
};

export function PlanPage({ activeTab, search = '', onNavigate }: PlanPageProps) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    tasks,
    isLoading,
    isMutating,
    error,
    refreshTasks,
    toggleTaskCompleted,
    updateTask,
    deleteTask,
    openCreateTask,
    openEditTask,
  } = useTasksOverviewData();
  const { projects, goals } = useProjectsAndGoalsData();

  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const goalTitleById = useMemo(
    () => new Map(goals.map((g) => [g.id, g.title])),
    [goals]
  );

  const filteredTasks = useMemo(() => {
    const query = localSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (
        query &&
        !task.title.toLowerCase().includes(query) &&
        !(task.description && task.description.toLowerCase().includes(query))
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, statusFilter, categoryFilter, priorityFilter, localSearch]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    priorityFilter !== 'all' ||
    localSearch.trim().length > 0;

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setLocalSearch('');
  };

  const highlightTaskId = useMemo(
    () => (activeTab === 'tasks' ? parsePositiveIdQueryParam(search, 'highlight') : null),
    [activeTab, search]
  );

  const targetTask = useMemo(
    () => (highlightTaskId !== null ? tasks.find((t) => t.id === highlightTaskId) ?? null : null),
    [highlightTaskId, tasks]
  );

  useEffect(() => {
    if (activeTab !== 'tasks' || isLoading || !targetTask) return;
    const isVisible = filteredTasks.some((t) => t.id === targetTask.id);
    if (!isVisible) {
      setStatusFilter('all');
      setCategoryFilter('all');
      setPriorityFilter('all');
      setLocalSearch('');
    }
  }, [activeTab, isLoading, targetTask, filteredTasks]);

  const activeHighlightTaskId = useTemporaryEntityHighlight({
    targetId: highlightTaskId,
    paramNamesToStrip: TASK_HIGHLIGHT_PARAMS,
    isReady: activeTab === 'tasks' && !isLoading,
    entityExists: Boolean(targetTask),
    selectorPrefix: 'task',
  });

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            PLAN · Tasks, Schedule & Goals
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Organize commitments, distinguish deadlines from scheduled events, and link tasks to projects and goals.
          </p>
        </div>

        <SegmentedTabs
          options={PLAN_TABS}
          value={activeTab}
          onChange={(tab) => onNavigate(`/plan/${tab}`)}
        />
      </div>

      {activeTab === 'tasks' && (
        <>
          {isAuthLoading ? (
            <Card tone="surface" padding="lg">
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </Card>
          ) : !isAuthenticated ? (
            <Card tone="surface" padding="lg">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-semibold text-[#F2F2F2]">
                    Sign in to access your Tasks workspace
                  </h3>
                  <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
                    Tasks are saved per account with priorities, categories, statuses, and due dates. Sign in with Google to create and organize your tasks.
                  </p>
                </div>
                <Button
                  variant="coral"
                  size="md"
                  leadingIcon={<LogIn className="h-4 w-4" />}
                  disabled={isSigningIn}
                  onClick={() => void signInWithGoogle()}
                >
                  {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card tone="surface" padding="none" className="overflow-hidden">
              {/* Header & Action Bar */}
              <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-semibold text-[#F2F2F2]">My Tasks</h3>
                  <p className="mt-0.5 font-mono text-xs text-[#A3A3A8] tabular-nums">
                    {completedCount}/{tasks.length} completed
                  </p>
                </div>

                <Button
                  variant="coral"
                  size="sm"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={() => openCreateTask()}
                >
                  New Task
                </Button>
              </div>

              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 gap-3 border-b border-white/[0.07] bg-[#1B1B1B] px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <Input
                  placeholder="Search title or description..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onClear={() => setLocalSearch('')}
                  leadingIcon={<Search className="h-3.5 w-3.5" />}
                  aria-label="Search tasks"
                />

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | TaskStatus)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                >
                  <option value="all">All statuses</option>
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'all' | TaskCategory)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                >
                  <option value="all">All categories</option>
                  {TASK_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                >
                  <option value="all">All priorities</option>
                  {TASK_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tasks List Body */}
              {isLoading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-5/6" />
                </div>
              ) : error ? (
                <div className="p-5">
                  <ErrorState
                    title="Unable to load tasks"
                    description={error}
                    onRetry={refreshTasks}
                  />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title={hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                    description={
                      hasActiveFilters
                        ? 'Try clearing or adjusting your search, status, category, or priority filters.'
                        : 'Create your first task to start organizing your priorities and deadlines.'
                    }
                    actionLabel={hasActiveFilters ? 'Clear filters' : 'Create first task'}
                    onAction={hasActiveFilters ? clearFilters : () => openCreateTask()}
                  />
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {filteredTasks.map((task) => {
                    const completed = task.status === 'completed';
                    const overdue = isTaskOverdue(task);
                    const isConfirmingDelete = pendingDeleteId === task.id;
                    const isHighlighted = activeHighlightTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        data-think-target={`task-${task.id}`}
                        className={cn(
                          'flex flex-col justify-between gap-3 px-5 py-3.5 transition-all duration-300 hover:bg-white/[0.025] lg:flex-row lg:items-center',
                          isHighlighted &&
                            'bg-[#E59585]/[0.12] ring-1 ring-inset ring-[#E59585]/65'
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={completed}
                              onChange={() => void toggleTaskCompleted(task)}
                              tone="coral"
                              ariaLabel={`Mark "${task.title}" ${completed ? 'incomplete' : 'complete'}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="block w-full truncate text-left text-sm font-medium text-[#F2F2F2] hover:text-[#E59585] cursor-pointer"
                            >
                              <span className={cn(completed && 'line-through text-[#737378]')}>
                                {task.title}
                              </span>
                            </button>
                            {task.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-[#A3A3A8]">
                                {task.description}
                              </p>
                            )}
                            {(task.projectId || task.goalId) && (
                              <p className="mt-0.5 truncate text-[11px] text-[#737378]">
                                {task.projectId && projectNameById.get(task.projectId)
                                  ? `Project: ${projectNameById.get(task.projectId)}`
                                  : null}
                                {task.projectId &&
                                projectNameById.get(task.projectId) &&
                                task.goalId &&
                                goalTitleById.get(task.goalId)
                                  ? ' · '
                                  : null}
                                {task.goalId && goalTitleById.get(task.goalId)
                                  ? `Goal: ${goalTitleById.get(task.goalId)}`
                                  : null}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pl-8 lg:justify-end lg:pl-0 shrink-0">
                          <div className="flex items-center gap-2 text-xs text-[#A3A3A8]">
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={task.status}
                              disabled={isMutating}
                              onChange={(e) =>
                                void updateTask(task.id, {
                                  status: e.target.value as TaskStatus,
                                })
                              }
                              className="h-7 rounded-lg border border-white/[0.08] bg-[#262626] px-2 text-[11px] font-medium text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70 cursor-pointer"
                            >
                              {TASK_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <span>{task.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className={cn('font-medium', PRIORITY_TONES[task.priority])}>
                              {getPriorityLabel(task.priority)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={cn(
                                'font-mono',
                                overdue ? 'text-[#E06C75]' : 'text-[#737378]'
                              )}
                              title={task.dueDate ?? undefined}
                            >
                              {task.dueDate
                                ? `${formatTaskDueLabel(task.dueDate)} (${task.dueDate})`
                                : 'No due date'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              aria-label={`Edit "${task.title}"`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isMutating}
                                  onClick={async () => {
                                    await deleteTask(task.id);
                                    setPendingDeleteId(null);
                                  }}
                                  className="h-7 px-2 text-xs text-[#E06C75] hover:bg-[#E06C75]/15 hover:text-[#E06C75]"
                                >
                                  Delete
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPendingDeleteId(null)}
                                  className="h-7 px-2 text-xs"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(task.id)}
                                aria-label={`Delete "${task.title}"`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737378] transition-colors hover:bg-[#E06C75]/10 hover:text-[#E06C75] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {activeTab === 'calendar' && <PlanCalendarView search={search} />}

      {activeTab === 'projects' && <PlanProjectsView search={search} />}

      {activeTab === 'goals' && <PlanGoalsView search={search} />}
    </div>
  );
}
