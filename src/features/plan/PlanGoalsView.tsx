import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  FolderKanban,
  LogIn,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  ProgressBar,
  Skeleton,
  type BadgeTone,
} from '../../components/ui';
import { useProjectsAndGoalsData, useTasksOverviewData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  parsePositiveIdQueryParam,
  useTemporaryEntityHighlight,
} from '../../lib/useHighlightTarget';
import {
  getGoalStatusLabel,
  getProjectStatusLabel,
  GOAL_STATUS_OPTIONS,
  type Goal,
  type GoalMilestone,
  type GoalStatus,
} from '../../types/projectGoal';
import { formatShortLocalDate, formatTaskDueLabel, isTaskOverdue } from '../../types/task';

type GoalFilterMode = 'active_set' | 'all' | GoalStatus;
type GoalSortMode = 'target_date' | 'progress' | 'title';

const GOAL_STATUS_TONE: Record<GoalStatus, BadgeTone> = {
  planned: 'blue',
  active: 'coral',
  paused: 'orange',
  completed: 'mint',
  archived: 'neutral',
};

function getGoalModeDescription(goal: Goal): string {
  switch (goal.progress.mode) {
    case 'milestones':
      return `${goal.progress.completedMilestones} of ${goal.progress.totalMilestones} goal milestones completed`;
    case 'measurable':
      return `${goal.currentValue ?? 0} of ${goal.targetValue ?? 0}${goal.unit ? ` ${goal.unit}` : ''} achieved`;
    case 'linked_work':
      return `Derived from ${goal.progress.linkedProjectsCount} linked project(s) and ${goal.progress.standaloneTasksCount} standalone task(s)`;
    case 'status':
      return goal.status === 'completed'
        ? 'Goal marked completed'
        : 'Add milestones, a measurable target, or link projects/tasks to track progress';
  }
}

const GOAL_ID_PARAMS = ['goalId'];

export function PlanGoalsView({ search = '' }: { search?: string }) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    goals,
    tasks,
    isLoading,
    isMutating,
    error,
    refreshProjectsAndGoals,
    updateGoal,
    deleteGoal,
    createGoalMilestone,
    updateGoalMilestone,
    deleteGoalMilestone,
    reorderGoalMilestones,
    openCreateGoal,
    openEditGoal,
    openCreateProject,
  } = useProjectsAndGoalsData();

  const { toggleTaskCompleted, updateTask, openCreateTask, openEditTask } =
    useTasksOverviewData();

  const [statusFilter, setStatusFilter] = useState<GoalFilterMode>('active_set');
  const [sortBy, setSortBy] = useState<GoalSortMode>('target_date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

  // Inline milestone add
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneTargetDate, setNewMilestoneTargetDate] = useState('');

  // Inline milestone edit
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneTargetDate, setEditMilestoneTargetDate] = useState('');

  // Inline measurable target adjustment
  const [metricInput, setMetricInput] = useState('');

  // Confirm delete goal
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  const filteredGoals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = goals.filter((goal) => {
      if (statusFilter === 'active_set') {
        if (goal.status === 'archived') return false;
      } else if (statusFilter !== 'all' && goal.status !== statusFilter) {
        return false;
      }
      if (
        query &&
        !goal.title.toLowerCase().includes(query) &&
        !(goal.description && goal.description.toLowerCase().includes(query))
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'progress') {
        return b.progress.progressPercent - a.progress.progressPercent;
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.id - a.id;
    });
  }, [goals, statusFilter, sortBy, searchQuery]);

  const targetGoalId = useMemo(() => parsePositiveIdQueryParam(search, 'goalId'), [search]);
  const targetGoal = useMemo(
    () => (targetGoalId !== null ? goals.find((g) => g.id === targetGoalId) ?? null : null),
    [targetGoalId, goals]
  );

  useEffect(() => {
    if (isLoading || !targetGoal) return;
    if (statusFilter === 'active_set' && targetGoal.status === 'archived') {
      setStatusFilter('all');
    } else if (statusFilter !== 'active_set' && statusFilter !== 'all' && statusFilter !== targetGoal.status) {
      setStatusFilter('all');
    }
    if (searchQuery.trim().length > 0 && !filteredGoals.some((g) => g.id === targetGoal.id)) {
      setSearchQuery('');
    }
    setSelectedGoalId(targetGoal.id);
  }, [isLoading, targetGoal, statusFilter, searchQuery, filteredGoals]);

  const activeHighlightGoalId = useTemporaryEntityHighlight({
    targetId: targetGoalId,
    paramNamesToStrip: GOAL_ID_PARAMS,
    isReady: !isLoading,
    entityExists: Boolean(targetGoal),
    selectorPrefix: 'goal',
  });

  useEffect(() => {
    if (filteredGoals.length === 0) {
      setSelectedGoalId(null);
      return;
    }
    if (targetGoal && filteredGoals.some((g) => g.id === targetGoal.id)) {
      if (selectedGoalId !== targetGoal.id) {
        setSelectedGoalId(targetGoal.id);
      }
      return;
    }
    if (!selectedGoalId || !filteredGoals.some((g) => g.id === selectedGoalId)) {
      setSelectedGoalId(filteredGoals[0].id);
    }
  }, [filteredGoals, selectedGoalId, targetGoal]);

  const selectedGoal: Goal | null = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? null,
    [goals, selectedGoalId]
  );

  const selectedGoalTasks = useMemo(
    () => (selectedGoal ? tasks.filter((t) => t.goalId === selectedGoal.id) : []),
    [tasks, selectedGoal]
  );

  useEffect(() => {
    setEditingMilestoneId(null);
    setConfirmingDeleteId(null);
    setNewMilestoneTitle('');
    setNewMilestoneTargetDate('');
    setMetricInput(
      selectedGoal && selectedGoal.currentValue !== null ? String(selectedGoal.currentValue) : ''
    );
  }, [selectedGoalId, selectedGoal?.currentValue]);

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const trimmed = newMilestoneTitle.trim();
    if (!trimmed) return;
    const ok = await createGoalMilestone(selectedGoal.id, {
      title: trimmed,
      targetDate: newMilestoneTargetDate.trim() ? newMilestoneTargetDate.trim() : null,
    });
    if (ok) {
      setNewMilestoneTitle('');
      setNewMilestoneTargetDate('');
    }
  };

  const startEditingMilestone = (milestone: GoalMilestone) => {
    setEditingMilestoneId(milestone.id);
    setEditMilestoneTitle(milestone.title);
    setEditMilestoneTargetDate(milestone.targetDate ?? '');
  };

  const handleSaveMilestoneEdit = async (milestoneId: number) => {
    if (!selectedGoal) return;
    const trimmed = editMilestoneTitle.trim();
    if (!trimmed) return;
    const ok = await updateGoalMilestone(selectedGoal.id, milestoneId, {
      title: trimmed,
      targetDate: editMilestoneTargetDate.trim() ? editMilestoneTargetDate.trim() : null,
    });
    if (ok) {
      setEditingMilestoneId(null);
    }
  };

  const handleMoveMilestone = async (index: number, direction: -1 | 1) => {
    if (!selectedGoal) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedGoal.milestones.length) return;
    const reorderedIds = selectedGoal.milestones.map((m) => m.id);
    const [moved] = reorderedIds.splice(index, 1);
    reorderedIds.splice(targetIndex, 0, moved);
    await reorderGoalMilestones(selectedGoal.id, reorderedIds);
  };

  const handleUpdateMetricValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const parsed = metricInput.trim() === '' ? 0 : Number(metricInput.trim());
    if (!Number.isFinite(parsed) || parsed < 0) return;
    await updateGoal(selectedGoal.id, { currentValue: parsed });
  };

  if (isAuthLoading) {
    return (
      <Card tone="surface" padding="lg">
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card tone="surface" padding="lg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">
              Sign in to track your Goals
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Define long-term intentions with ordered milestones, measurable targets, and connected projects and tasks.
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
    );
  }

  if (error) {
    return (
      <Card tone="surface" padding="lg">
        <ErrorState
          title="Unable to load goals"
          description={error}
          onRetry={refreshProjectsAndGoals}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Filter Toolbar */}
      <Card tone="surface" padding="none" className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">Goals</h3>
            <p className="mt-0.5 font-mono text-xs text-[#A3A3A8] tabular-nums">
              {goals.filter((g) => g.status === 'active').length} active ·{' '}
              {goals.filter((g) => g.status === 'completed').length} completed
            </p>
          </div>
          <Button
            variant="coral"
            size="sm"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => openCreateGoal()}
          >
            New Goal
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 bg-[#1B1B1B] px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            placeholder="Search goals or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            leadingIcon={<Search className="h-3.5 w-3.5" />}
            aria-label="Search goals"
          />

          <select
            aria-label="Filter goals by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GoalFilterMode)}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          >
            <option value="active_set">Active & Planned (Hide Archived)</option>
            <option value="all">All goals</option>
            {GOAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort goals"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as GoalSortMode)}
            className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-xs font-medium text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          >
            <option value="target_date">Sort: Target date</option>
            <option value="progress">Sort: Progress</option>
            <option value="title">Sort: Title</option>
          </select>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : filteredGoals.length === 0 ? (
        <Card tone="surface" padding="lg">
          <EmptyState
            icon={<Target className="h-5 w-5 text-[#E59585]" />}
            title={goals.length === 0 ? 'No goals yet' : 'No goals match your filters'}
            description={
              goals.length === 0
                ? 'Set your first long-term goal with milestones, a measurable target, or connected projects.'
                : 'Adjust your status filter or clear your search query to view your goals.'
            }
            actionLabel={goals.length === 0 ? 'Create first goal' : 'Reset filters'}
            onAction={
              goals.length === 0
                ? () => openCreateGoal()
                : () => {
                    setStatusFilter('active_set');
                    setSearchQuery('');
                  }
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          {/* Left: Goals List */}
          <div className="space-y-3">
            {filteredGoals.map((goal) => {
              const isSelected = selectedGoal?.id === goal.id;
              const isHighlighted = activeHighlightGoalId === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  data-think-target={`goal-${goal.id}`}
                  onClick={() => setSelectedGoalId(goal.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                    isHighlighted
                      ? 'border-[#E59585]/80 bg-[#E59585]/[0.12] ring-1 ring-[#E59585]/65'
                      : isSelected
                        ? 'border-[#E59585]/45 bg-[#252222]'
                        : 'border-white/[0.07] bg-[#202020] hover:border-white/[0.14] hover:bg-[#242424]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={GOAL_STATUS_TONE[goal.status]}>
                          {getGoalStatusLabel(goal.status)}
                        </Badge>
                        <span className="text-xs text-[#A3A3A8]">{goal.category}</span>
                      </div>
                      <h4 className="mt-2.5 truncate text-sm font-semibold text-[#F2F2F2]">
                        {goal.title}
                      </h4>
                    </div>
                    {goal.targetDate && (
                      <span className="font-mono text-[11px] text-[#A3A3A8] shrink-0">
                        {formatShortLocalDate(goal.targetDate)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[#A3A3A8] tabular-nums">
                      <span>
                        {goal.progress.totalMilestones > 0
                          ? `${goal.progress.completedMilestones}/${goal.progress.totalMilestones} milestones`
                          : goal.targetValue
                            ? `${goal.currentValue ?? 0}/${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
                            : `${goal.progress.linkedProjectsCount} projects · ${goal.progress.linkedTasksCount} tasks`}
                      </span>
                    </div>
                    <ProgressBar
                      value={goal.progress.progressPercent}
                      tone={goal.status === 'completed' ? 'mint' : 'coral'}
                      showLabel
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected Goal Detail */}
          {selectedGoal && (
            <Card
              tone="surface"
              padding="lg"
              className={cn(
                'space-y-6 transition-all duration-300',
                activeHighlightGoalId === selectedGoal.id &&
                  'border-[#E59585]/65 ring-1 ring-[#E59585]/45'
              )}
            >
              {/* Goal Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={GOAL_STATUS_TONE[selectedGoal.status]}>
                      {getGoalStatusLabel(selectedGoal.status)}
                    </Badge>
                    <span className="text-xs text-[#A3A3A8]">{selectedGoal.category}</span>
                    {selectedGoal.targetDate && (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#A3A3A8]">
                        <Calendar className="h-3.5 w-3.5 text-[#A9C8E9]" />
                        Target {formatShortLocalDate(selectedGoal.targetDate)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-[#F2F2F2]">
                    {selectedGoal.title}
                  </h3>

                  {selectedGoal.description && (
                    <p className="text-sm leading-relaxed text-[#A3A3A8]">
                      {selectedGoal.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEditGoal(selectedGoal)}
                  >
                    Edit
                  </Button>
                  {confirmingDeleteId === selectedGoal.id ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void deleteGoal(selectedGoal.id)}
                        className="bg-[#E06C75]/15 text-[#E06C75] hover:bg-[#E06C75]/25 hover:text-[#E06C75]"
                      >
                        Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setConfirmingDeleteId(selectedGoal.id)}
                      className="text-[#E06C75] hover:bg-[#E06C75]/10 hover:text-[#E06C75]"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Goal Progress + Optional Measurable Target Bar */}
              <div className="rounded-xl border border-white/[0.06] bg-[#1A1A1A] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#F2F2F2]">Goal Progress</span>
                  <span className="text-[#A3A3A8]">{getGoalModeDescription(selectedGoal)}</span>
                </div>
                <ProgressBar
                  value={selectedGoal.progress.progressPercent}
                  tone={selectedGoal.status === 'completed' ? 'mint' : 'coral'}
                  height="md"
                  showLabel
                />

                {selectedGoal.targetValue !== null && selectedGoal.targetValue > 0 && (
                  <form
                    onSubmit={handleUpdateMetricValue}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3"
                  >
                    <div className="text-xs text-[#A3A3A8]">
                      <span className="font-medium text-[#F2F2F2]">
                        {selectedGoal.targetMetricLabel || 'Measurable target'}:
                      </span>{' '}
                      <span className="font-mono">
                        {selectedGoal.currentValue ?? 0} / {selectedGoal.targetValue}
                        {selectedGoal.unit ? ` ${selectedGoal.unit}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={metricInput}
                        onChange={(e) => setMetricInput(e.target.value)}
                        aria-label="Update current measurable value"
                        className="h-8 w-24 rounded-lg border border-white/[0.1] bg-[#262626] px-2.5 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                      />
                      <Button type="submit" variant="secondary" size="sm" disabled={isMutating}>
                        Update
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Ordered Goal Milestones */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#F2F2F2]">
                  Goal Milestones ({selectedGoal.milestones.length})
                </h4>

                <form onSubmit={handleAddMilestone} className="flex flex-col gap-2 rounded-xl bg-[#1A1A1A] p-3 sm:flex-row">
                  <input
                    type="text"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="Add a goal milestone..."
                    maxLength={160}
                    aria-label="New goal milestone title"
                    className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                  />
                  <input
                    type="date"
                    value={newMilestoneTargetDate}
                    onChange={(e) => setNewMilestoneTargetDate(e.target.value)}
                    aria-label="Goal milestone target date"
                    className="h-10 rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-xs text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                  />
                  <Button
                    type="submit"
                    variant="coral"
                    size="sm"
                    disabled={isMutating || !newMilestoneTitle.trim()}
                    leadingIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add
                  </Button>
                </form>

                {selectedGoal.milestones.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-[#737378]">
                    No goal milestones yet. Add ordered milestones above to track major checkpoints.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
                    {selectedGoal.milestones.map((milestone, index) => {
                      const isEditing = editingMilestoneId === milestone.id;
                      return (
                        <div key={milestone.id} className="px-3.5 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                value={editMilestoneTitle}
                                onChange={(e) => setEditMilestoneTitle(e.target.value)}
                                maxLength={160}
                                className="h-9 flex-1 rounded-lg border border-white/[0.1] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                              />
                              <input
                                type="date"
                                value={editMilestoneTargetDate}
                                onChange={(e) => setEditMilestoneTargetDate(e.target.value)}
                                className="h-9 rounded-lg border border-white/[0.1] bg-[#262626] px-2.5 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
                              />
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="coral"
                                  disabled={isMutating || !editMilestoneTitle.trim()}
                                  leadingIcon={<Check className="h-3.5 w-3.5" />}
                                  onClick={() => void handleSaveMilestoneEdit(milestone.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  leadingIcon={<X className="h-3.5 w-3.5" />}
                                  onClick={() => setEditingMilestoneId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Checkbox
                                  checked={milestone.completed}
                                  onChange={() =>
                                    void updateGoalMilestone(selectedGoal.id, milestone.id, {
                                      completed: !milestone.completed,
                                    })
                                  }
                                  tone="mint"
                                  ariaLabel={`Mark milestone "${milestone.title}" ${
                                    milestone.completed ? 'incomplete' : 'complete'
                                  }`}
                                />
                                <p
                                  className={cn(
                                    'min-w-0 flex-1 truncate text-sm font-medium text-[#F2F2F2]',
                                    milestone.completed && 'line-through text-[#737378]'
                                  )}
                                >
                                  <span className="mr-2 font-mono text-xs text-[#737378]">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  {milestone.title}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {milestone.targetDate && (
                                  <span className="mr-2 font-mono text-[11px] text-[#A3A3A8]">
                                    {formatShortLocalDate(milestone.targetDate)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={isMutating || index === 0}
                                  onClick={() => void handleMoveMilestone(index, -1)}
                                  aria-label={`Move "${milestone.title}" up`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isMutating || index === selectedGoal.milestones.length - 1
                                  }
                                  onClick={() => void handleMoveMilestone(index, 1)}
                                  aria-label={`Move "${milestone.title}" down`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditingMilestone(milestone)}
                                  aria-label={`Edit milestone "${milestone.title}"`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={() =>
                                    void deleteGoalMilestone(selectedGoal.id, milestone.id)
                                  }
                                  aria-label={`Delete milestone "${milestone.title}"`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737378] hover:bg-[#E06C75]/10 hover:text-[#E06C75] cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked Projects & Tasks */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[#F2F2F2]">
                      Linked Projects ({selectedGoal.linkedProjects.length})
                    </h4>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => openCreateProject({ defaultGoalId: selectedGoal.id })}
                    >
                      New Project
                    </Button>
                  </div>

                  {selectedGoal.linkedProjects.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-[#737378]">
                      No projects linked to this goal yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedGoal.linkedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 truncate text-xs font-semibold text-[#F2F2F2]">
                              <FolderKanban className="h-3.5 w-3.5 text-[#E59585] shrink-0" />
                              <span className="truncate">{project.name}</span>
                            </span>
                            <span className="text-[11px] text-[#A3A3A8] shrink-0">
                              {getProjectStatusLabel(project.status)}
                            </span>
                          </div>
                          <ProgressBar value={project.progressPercent} tone="coral" showLabel />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[#F2F2F2]">
                      Linked Tasks ({selectedGoalTasks.length})
                    </h4>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => openCreateTask({ defaultGoalId: selectedGoal.id })}
                    >
                      Add Task
                    </Button>
                  </div>

                  {selectedGoalTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-xs text-[#737378]">
                      No tasks linked directly to this goal yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
                      {selectedGoalTasks.map((task) => {
                        const completed = task.status === 'completed';
                        const overdue = isTaskOverdue(task);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-2.5 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Checkbox
                                checked={completed}
                                onChange={() => void toggleTaskCompleted(task)}
                                tone="coral"
                                ariaLabel={`Mark "${task.title}" ${
                                  completed ? 'incomplete' : 'complete'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => openEditTask(task)}
                                className="min-w-0 flex-1 truncate text-left text-xs font-medium text-[#F2F2F2] hover:text-[#E59585] cursor-pointer"
                              >
                                <span className={cn(completed && 'line-through text-[#737378]')}>
                                  {task.title}
                                </span>
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={cn(
                                  'font-mono text-[11px]',
                                  overdue ? 'text-[#E06C75]' : 'text-[#A3A3A8]'
                                )}
                              >
                                {task.dueDate ? formatTaskDueLabel(task.dueDate) : task.category}
                              </span>
                              <button
                                type="button"
                                title="Unlink task from goal"
                                aria-label={`Unlink "${task.title}" from goal`}
                                onClick={() => void updateTask(task.id, { goalId: null })}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737378] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
