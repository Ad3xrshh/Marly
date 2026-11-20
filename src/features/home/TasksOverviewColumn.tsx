import React from 'react';
import { ArrowRight, LogIn, Pencil, Plus, Target } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  ProgressBar,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import {
  TaskCategoryFilterOption,
  useProjectsAndGoalsData,
  useTasksOverviewData,
} from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  formatTaskDueLabel,
  getPriorityLabel,
  isTaskOverdue,
  TASK_CATEGORY_OPTIONS,
  type Task,
} from '../../types/task';

interface TasksOverviewColumnProps {
  onNavigate: (path: string) => void;
}

export function TasksOverviewColumn({ onNavigate }: TasksOverviewColumnProps) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    tasks,
    isLoading,
    error,
    todayIso,
    tomorrowIso,
    todayLabel,
    tomorrowLabel,
    taskCategoryFilter,
    setTaskCategoryFilter,
    searchQuery,
    setSearchQuery,
    refreshTasks,
    toggleTaskCompleted,
    openCreateTask,
    openEditTask,
  } = useTasksOverviewData();
  const {
    goals,
    isLoading: goalsLoading,
    error: goalsError,
    refreshProjectsAndGoals,
    openCreateGoal,
  } = useProjectsAndGoalsData();

  const visibleGoals = goals
    .filter((g) => g.status !== 'archived')
    .slice(0, 4);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesActiveFilters = (task: Task) => {
    if (taskCategoryFilter !== 'All' && task.category !== taskCategoryFilter) return false;
    if (
      normalizedQuery &&
      !task.title.toLowerCase().includes(normalizedQuery) &&
      !(task.description && task.description.toLowerCase().includes(normalizedQuery))
    ) {
      return false;
    }
    return true;
  };

  const filteredTasks = tasks.filter(matchesActiveFilters);

  const todayTasks = filteredTasks.filter(
    (task) => task.dueDate === todayIso || (task.dueDate !== null && task.dueDate < todayIso && task.status !== 'completed')
  );

  const upcomingTasks = filteredTasks.filter(
    (task) =>
      task.dueDate === tomorrowIso ||
      (task.dueDate !== null && task.dueDate > tomorrowIso) ||
      task.dueDate === null
  );

  const todayCompleted = todayTasks.filter((t) => t.status === 'completed').length;
  const upcomingCompleted = upcomingTasks.filter((t) => t.status === 'completed').length;

  const filterOptions: Array<{ value: TaskCategoryFilterOption; label: string; count?: number }> = [
    { value: 'All', label: 'All', count: tasks.length },
    ...TASK_CATEGORY_OPTIONS.map((category) => ({
      value: category,
      label: category,
    })),
  ];

  const handleNewTodayTask = () => {
    if (!isAuthenticated) {
      void signInWithGoogle();
      return;
    }
    openCreateTask({ defaultDueDate: todayIso });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Category Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">My Tasks</h2>
          <IconButton
            variant="light"
            label={isAuthenticated ? 'Create new task' : 'Sign in to create tasks'}
            onClick={handleNewTodayTask}
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
          <h3 className="text-lg font-bold text-[#151515]">{todayLabel}</h3>
          {isAuthenticated && !isLoading && (
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#151515]/80 tabular-nums">
              <span>
                {todayCompleted}/{todayTasks.length}
              </span>
            </div>
          )}
        </div>

        {isAuthLoading || (isAuthenticated && isLoading) ? (
          <div className="space-y-2.5 py-1">
            <Skeleton className="h-12 w-full bg-[#151515]/15" />
            <Skeleton className="h-12 w-full bg-[#151515]/15" />
            <Skeleton className="h-12 w-5/6 bg-[#151515]/15" />
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-xl bg-[#151515]/[0.09] p-4">
            <p className="text-sm font-semibold text-[#151515]">
              Sign in to manage your personal tasks
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#151515]/80">
              Connect your Google account to create, organize, and persist tasks across sessions.
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<LogIn className="h-3.5 w-3.5" />}
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="border-none bg-[#151515] text-[#F2F2F2] hover:bg-[#242424]"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              </Button>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-[#151515] p-3">
            <ErrorState title="Could not load tasks" description={error} onRetry={refreshTasks} />
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="rounded-xl bg-[#151515]/[0.08] p-4 text-center">
            <p className="text-sm font-medium text-[#151515]">No tasks due today</p>
            <p className="mt-1 text-xs text-[#151515]/75">
              {searchQuery || taskCategoryFilter !== 'All'
                ? 'Adjust your category filter or clear your search query.'
                : 'Add a task for today or open Plan to manage your full backlog.'}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => openCreateTask({ defaultDueDate: todayIso })}
                className="border-none bg-[#151515] text-[#F2F2F2] hover:bg-[#242424]"
              >
                Add task for today
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => {
              const completed = task.status === 'completed';
              const overdue = isTaskOverdue(task);
              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors',
                    completed ? 'bg-transparent' : 'bg-[#151515]/[0.07] hover:bg-[#151515]/[0.11]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={completed}
                      onChange={() => void toggleTaskCompleted(task)}
                      tone="dark-accent"
                      ariaLabel={`Mark "${task.title}" ${completed ? 'incomplete' : 'complete'}`}
                    />
                    <button
                      type="button"
                      onClick={() => openEditTask(task)}
                      className="min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#151515] rounded-md"
                    >
                      <p
                        className={cn(
                          'truncate text-sm font-medium text-[#151515]',
                          completed && 'line-through opacity-65'
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="text-[11px] font-medium text-[#151515]/70">
                        {task.category}
                        <span aria-hidden="true"> · </span>
                        {getPriorityLabel(task.priority)}
                        {task.status === 'in_progress' && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>In progress</span>
                          </>
                        )}
                        {overdue && task.dueDate && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono font-semibold text-[#6E171D]">
                              Overdue ({formatTaskDueLabel(task.dueDate)})
                            </span>
                          </>
                        )}
                      </p>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditTask(task)}
                    aria-label={`Edit "${task.title}"`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#151515]/60 opacity-0 transition-opacity hover:bg-[#151515]/10 hover:text-[#151515] group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Surface Card: Tomorrow & Upcoming */}
      <Card tone="surface" padding="md">
        <div className="flex items-center justify-between gap-4 pb-3">
          <h3 className="text-base font-semibold text-[#F2F2F2]">{tomorrowLabel} & Upcoming</h3>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <span className="font-mono text-xs text-[#A3A3A8] tabular-nums">
                {upcomingCompleted}/{upcomingTasks.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/plan/tasks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#A3A3A8] hover:text-[#F2F2F2] cursor-pointer"
            >
              <span>All tasks</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          <p className="text-xs leading-relaxed text-[#737378]">
            Upcoming and undated tasks will appear here once you sign in.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        ) : upcomingTasks.length === 0 ? (
          <EmptyState
            title="No upcoming tasks"
            description="Schedule a task for tomorrow or open Plan to view your complete task list."
            actionLabel={searchQuery ? 'Clear filter' : 'New Task'}
            onAction={
              searchQuery
                ? () => setSearchQuery('')
                : () => openCreateTask({ defaultDueDate: tomorrowIso })
            }
          />
        ) : (
          <div className="space-y-2">
            {upcomingTasks.slice(0, 6).map((task) => {
              const completed = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className="group flex items-center justify-between gap-3 rounded-xl bg-[#292929] px-3.5 py-2.5 transition-colors hover:bg-[#303030]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={completed}
                      onChange={() => void toggleTaskCompleted(task)}
                      tone="coral"
                      ariaLabel={`Mark "${task.title}" ${completed ? 'incomplete' : 'complete'}`}
                    />
                    <button
                      type="button"
                      onClick={() => openEditTask(task)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-[#F2F2F2] cursor-pointer"
                    >
                      <span className={cn(completed && 'line-through text-[#737378]')}>
                        {task.title}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-[#737378]">
                      {task.dueDate ? formatTaskDueLabel(task.dueDate) : task.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditTask(task)}
                      aria-label={`Edit "${task.title}"`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737378] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-[#F2F2F2] group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {upcomingTasks.length > 6 && (
              <button
                type="button"
                onClick={() => onNavigate('/plan/tasks')}
                className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-[#A3A3A8] hover:bg-white/[0.04] hover:text-[#F2F2F2] cursor-pointer"
              >
                <span>View all {upcomingTasks.length} upcoming tasks in Plan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Active Goals Strip */}
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

        {!isAuthenticated ? (
          <p className="text-xs leading-relaxed text-[#737378]">
            Sign in to track personal goals, ordered milestones, and linked project progress.
          </p>
        ) : goalsLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
          </div>
        ) : goalsError ? (
          <ErrorState
            title="Could not load goals"
            description={goalsError}
            onRetry={refreshProjectsAndGoals}
          />
        ) : visibleGoals.length === 0 ? (
          <div className="space-y-2.5">
            <p className="text-xs leading-relaxed text-[#737378]">
              No active goals yet. Create a goal to track milestones and linked work here.
            </p>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreateGoal}
            >
              Create goal
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {visibleGoals.map((goal) => {
              const summaryLabel =
                goal.progress.mode === 'milestones'
                  ? `${goal.progress.completedMilestones}/${goal.progress.totalMilestones} milestones`
                  : goal.progress.mode === 'measurable' && goal.targetValue
                    ? `${goal.currentValue ?? 0}/${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
                    : goal.progress.mode === 'linked_work'
                      ? `${goal.progress.linkedProjectsCount} proj · ${goal.progress.standaloneTasksCount} tasks`
                      : goal.status;

              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onNavigate('/plan/goals')}
                  className="block w-full space-y-1.5 text-left rounded-lg transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-[#F2F2F2]">{goal.title}</span>
                    <span className="font-mono text-[#A3A3A8] tabular-nums shrink-0">
                      {summaryLabel}
                    </span>
                  </div>
                  <ProgressBar
                    value={goal.progress.progressPercent}
                    tone={goal.status === 'completed' ? 'mint' : 'coral'}
                    showLabel
                  />
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
