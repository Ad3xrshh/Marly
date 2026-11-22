import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  History,
  ListChecks,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  ProgressBar,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import { useFitnessAndRoutinesData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  formatDurationMinutes,
  WORKOUT_ACTIVITY_TYPES,
  type Routine,
  type RoutineLog,
  type RoutineStep,
  type WorkoutActivityType,
  type WorkoutSession,
} from '../../types/fitnessRoutines';

type WorkoutFilter = 'All' | WorkoutActivityType;
type RoutineStatusTab = 'active' | 'archived';

export function LiveFitnessRoutinesView() {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    workouts,
    workoutSummary,
    routines,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    searchQuery,
    refreshFitnessAndRoutines,
    deleteWorkout,
    archiveRoutine,
    restoreRoutine,
    deleteRoutine,
    addRoutineStep,
    updateRoutineStep,
    deleteRoutineStep,
    reorderRoutineSteps,
    upsertRoutineLog,
    resetRoutineLog,
    loadRoutineLogsRange,
    openCreateWorkout,
    openEditWorkout,
    openCreateRoutine,
    openEditRoutine,
  } = useFitnessAndRoutinesData();

  const [workoutFilter, setWorkoutFilter] = useState<WorkoutFilter>('All');
  const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<number | null>(null);

  const [routineTab, setRoutineTab] = useState<RoutineStatusTab>('active');
  const [managingStepsRoutineId, setManagingStepsRoutineId] = useState<number | null>(null);
  const [newStepTitleByRoutine, setNewStepTitleByRoutine] = useState<Record<number, string>>({});
  const [newStepDurationByRoutine, setNewStepDurationByRoutine] = useState<
    Record<number, string>
  >({});
  const [editingStep, setEditingStep] = useState<{
    routineId: number;
    stepId: number;
    title: string;
    durationMinutes: string;
  } | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [historyByRoutine, setHistoryByRoutine] = useState<Record<number, RoutineLog[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);

  const [deleteConfirmRoutine, setDeleteConfirmRoutine] = useState<Routine | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      if (workoutFilter !== 'All' && workout.activityType !== workoutFilter) return false;
      if (
        normalizedQuery &&
        !workout.title.toLowerCase().includes(normalizedQuery) &&
        !workout.activityType.toLowerCase().includes(normalizedQuery) &&
        !(workout.notes && workout.notes.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return true;
    });
  }, [workouts, workoutFilter, normalizedQuery]);

  const activeRoutinesCount = useMemo(
    () => routines.filter((r) => r.status === 'active').length,
    [routines]
  );
  const archivedRoutinesCount = useMemo(
    () => routines.filter((r) => r.status === 'archived').length,
    [routines]
  );

  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) => {
      if (routine.status !== routineTab) return false;
      if (
        normalizedQuery &&
        !routine.name.toLowerCase().includes(normalizedQuery) &&
        !(routine.description && routine.description.toLowerCase().includes(normalizedQuery)) &&
        !routine.steps.some((step) => step.title.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return true;
    });
  }, [routines, routineTab, normalizedQuery]);

  const todayRoutineStats = useMemo(() => {
    const active = routines.filter((r) => r.status === 'active');
    const scheduled = active.filter((r) => r.scheduledToday);
    const completedScheduled = scheduled.filter(
      (r) => r.todayLog?.status === 'completed'
    ).length;
    const completedTotal = active.filter((r) => r.todayLog?.status === 'completed').length;
    return {
      scheduledCount: scheduled.length,
      completedScheduled,
      completedTotal,
      activeCount: active.length,
    };
  }, [routines]);

  const refreshRoutineHistoryIfOpen = async (routineId: number) => {
    if (expandedHistoryId !== routineId) return;
    setHistoryLoadingId(routineId);
    try {
      const logs = await loadRoutineLogsRange(routineId);
      setHistoryByRoutine((prev) => ({ ...prev, [routineId]: logs }));
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const handleToggleRoutineHistory = async (routine: Routine) => {
    if (expandedHistoryId === routine.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(routine.id);
    setHistoryLoadingId(routine.id);
    try {
      const logs = await loadRoutineLogsRange(routine.id);
      setHistoryByRoutine((prev) => ({ ...prev, [routine.id]: logs }));
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const handleToggleRoutineStep = async (routine: Routine, stepId: number) => {
    const currentCompleted = new Set(routine.todayLog?.completedStepIds ?? []);
    if (currentCompleted.has(stepId)) {
      currentCompleted.delete(stepId);
    } else {
      currentCompleted.add(stepId);
    }

    const nextIds = routine.steps
      .filter((s) => currentCompleted.has(s.id))
      .map((s) => s.id);

    await upsertRoutineLog(routine.id, {
      localDate: todayLocalDate,
      completedStepIds: nextIds,
    });
    await refreshRoutineHistoryIfOpen(routine.id);
  };

  const handleCompleteAllSteps = async (routine: Routine) => {
    await upsertRoutineLog(routine.id, {
      localDate: todayLocalDate,
      markAllCompleted: true,
    });
    await refreshRoutineHistoryIfOpen(routine.id);
  };

  const handleResetTodayRoutine = async (routine: Routine) => {
    await resetRoutineLog(routine.id, todayLocalDate);
    await refreshRoutineHistoryIfOpen(routine.id);
  };

  const handleAddInlineStep = async (routineId: number) => {
    const title = (newStepTitleByRoutine[routineId] ?? '').trim();
    if (!title) return;
    const rawDuration = (newStepDurationByRoutine[routineId] ?? '').trim();
    let durationMinutes: number | null = null;
    if (rawDuration) {
      const parsed = Number(rawDuration);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) return;
      durationMinutes = parsed;
    }

    const updated = await addRoutineStep(routineId, { title, durationMinutes });
    if (updated) {
      setNewStepTitleByRoutine((prev) => ({ ...prev, [routineId]: '' }));
      setNewStepDurationByRoutine((prev) => ({ ...prev, [routineId]: '' }));
    }
  };

  const handleSaveInlineStepEdit = async () => {
    if (!editingStep) return;
    const trimmed = editingStep.title.trim();
    if (!trimmed) return;
    let durationMinutes: number | null = null;
    if (editingStep.durationMinutes.trim()) {
      const parsed = Number(editingStep.durationMinutes);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) return;
      durationMinutes = parsed;
    }

    const updated = await updateRoutineStep(editingStep.routineId, editingStep.stepId, {
      title: trimmed,
      durationMinutes,
    });
    if (updated) {
      setEditingStep(null);
    }
  };

  const handleMoveStep = async (routine: Routine, index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= routine.steps.length) return;
    const ids = routine.steps.map((s) => s.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved);
    await reorderRoutineSteps(routine.id, ids);
  };

  const handleConfirmDeleteWorkout = async (workout: WorkoutSession) => {
    const ok = await deleteWorkout(workout.id);
    if (ok) {
      setConfirmDeleteWorkoutId(null);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card tone="surface" padding="lg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-[#F2F2F2]">
              Sign in to track workouts &amp; routines
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Log training sessions by duration and activity type, and run step-based daily routines with preserved historical execution snapshots.
            </p>
          </div>
          <Button
            variant="mint"
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
      <ErrorState
        title="Could not load fitness & routines"
        description={error}
        onRetry={() => void refreshFitnessAndRoutines()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Activity & Routine Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card tone="surface" padding="md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#A3A3A8]">This Week</span>
            <Dumbbell className="h-4 w-4 text-[#F19A50]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {workoutSummary.weekWorkoutsCount}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">
              {workoutSummary.weekWorkoutsCount === 1 ? 'session' : 'sessions'}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-[#F19A50] tabular-nums">
            {formatDurationMinutes(workoutSummary.weekDurationMinutes)} active this week
          </p>
        </Card>

        <Card tone="surface" padding="md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#A3A3A8]">Last 30 Days</span>
            <Clock className="h-4 w-4 text-[#96D2C5]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {formatDurationMinutes(workoutSummary.thirtyDayDurationMinutes)}
          </p>
          <p className="mt-1 truncate text-xs text-[#A3A3A8]">
            {workoutSummary.thirtyDayWorkoutsCount} workouts
            {workoutSummary.byType.length > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span>
                  Top: {workoutSummary.byType[0].activityType} (
                  {workoutSummary.byType[0].count})
                </span>
              </>
            )}
          </p>
        </Card>

        <Card tone="surface" padding="md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#A3A3A8]">Routines Today</span>
            <ListChecks className="h-4 w-4 text-[#96D2C5]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {todayRoutineStats.scheduledCount > 0
              ? `${todayRoutineStats.completedScheduled} / ${todayRoutineStats.scheduledCount}`
              : todayRoutineStats.completedTotal}
          </p>
          <p className="mt-1 font-mono text-xs text-[#737378]">
            {todayLocalDate} · {effectiveTimezone}
          </p>
        </Card>
      </div>

      {/* Main Two-Column Fitness & Routines Workspace */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* LEFT COLUMN: Workouts */}
        <Card tone="surface" padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Dumbbell className="h-4 w-4 text-[#F19A50]" />
              <div>
                <h3 className="text-base font-semibold text-[#F2F2F2]">Workout Log</h3>
                <p className="text-xs text-[#A3A3A8]">
                  Recent training sessions and movement minutes
                </p>
              </div>
            </div>
            <Button
              variant="mint"
              size="sm"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreateWorkout}
            >
              Log Workout
            </Button>
          </div>

          <SegmentedTabs
            variant="pill-filter"
            options={[
              { value: 'All', label: 'All' },
              ...WORKOUT_ACTIVITY_TYPES.map((type) => ({ value: type, label: type })),
            ]}
            value={workoutFilter}
            onChange={(val) => setWorkoutFilter(val)}
          />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <EmptyState
              title={
                workoutFilter !== 'All' || searchQuery
                  ? 'No matching workouts'
                  : 'No workouts logged yet'
              }
              description={
                workoutFilter !== 'All' || searchQuery
                  ? 'Adjust your activity filter or search query to see other sessions.'
                  : 'Log strength, cardio, mobility, or recovery sessions to track weekly volume.'
              }
              actionLabel="Log First Workout"
              onAction={openCreateWorkout}
            />
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {filteredWorkouts.map((workout) => {
                const isConfirming = confirmDeleteWorkoutId === workout.id;
                return (
                  <div
                    key={workout.id}
                    className="space-y-2 py-3.5 first:pt-1 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#F2F2F2]">
                            {workout.title}
                          </h4>
                          <span className="font-mono text-[11px] font-medium text-[#F19A50]">
                            {workout.activityType}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs text-[#A3A3A8]">
                          {workout.localDate}
                          {workout.startTime ? ` · ${workout.startTime}` : ''}
                        </p>
                        {workout.notes && (
                          <p className="mt-1.5 text-xs leading-relaxed text-[#737378]">
                            {workout.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="font-mono text-sm font-semibold text-[#F19A50] tabular-nums">
                          {formatDurationMinutes(workout.durationMinutes)}
                        </span>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isMutating}
                              onClick={() => void handleConfirmDeleteWorkout(workout)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isMutating}
                              onClick={() => setConfirmDeleteWorkoutId(null)}
                            >
                              Keep
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              leadingIcon={<Pencil className="h-3 w-3" />}
                              onClick={() => openEditWorkout(workout)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${workout.title}`}
                              onClick={() => setConfirmDeleteWorkoutId(workout.id)}
                              className="text-[#A3A3A8] hover:text-[#E06C75]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* RIGHT COLUMN: Step-Based Routines */}
        <Card tone="surface" padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ListChecks className="h-4 w-4 text-[#96D2C5]" />
              <div>
                <h3 className="text-base font-semibold text-[#F2F2F2]">Routines</h3>
                <p className="text-xs text-[#A3A3A8]">
                  Ordered step checklists separate from habit streaks
                </p>
              </div>
            </div>
            <Button
              variant="mint"
              size="sm"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreateRoutine}
            >
              New Routine
            </Button>
          </div>

          <SegmentedTabs
            options={[
              { value: 'active', label: `Active (${activeRoutinesCount})` },
              { value: 'archived', label: `Archived (${archivedRoutinesCount})` },
            ]}
            value={routineTab}
            onChange={(val) => setRoutineTab(val)}
          />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : filteredRoutines.length === 0 ? (
            <EmptyState
              title={
                routineTab === 'archived'
                  ? 'No archived routines'
                  : searchQuery
                    ? 'No matching routines'
                    : 'No routines yet'
              }
              description={
                routineTab === 'archived'
                  ? 'Archived routines remain here with their historical execution logs intact.'
                  : searchQuery
                    ? 'Adjust your search query to view other routines.'
                    : 'Create a morning warm-up, evening wind-down, or mobility sequence.'
              }
              actionLabel={routineTab === 'active' ? 'Create Routine' : undefined}
              onAction={routineTab === 'active' ? openCreateRoutine : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredRoutines.map((routine) => {
                const isArchived = routine.status === 'archived';
                const totalSteps = routine.steps.length;
                const completedSet = new Set(routine.todayLog?.completedStepIds ?? []);
                const completedCount = routine.steps.filter((s) =>
                  completedSet.has(s.id)
                ).length;
                const isCompletedToday = routine.todayLog?.status === 'completed';
                const progressPercent =
                  isCompletedToday && totalSteps === 0
                    ? 100
                    : totalSteps > 0
                      ? Math.round((completedCount / totalSteps) * 100)
                      : 0;
                const stepsOpen = managingStepsRoutineId === routine.id;
                const historyOpen = expandedHistoryId === routine.id;
                const historyLogs = historyByRoutine[routine.id] ?? [];

                return (
                  <div
                    key={routine.id}
                    className="space-y-3 rounded-xl border border-white/[0.07] bg-[#262626] p-4"
                  >
                    {/* Routine Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#F2F2F2]">
                            {routine.name}
                          </h4>
                          <span
                            className={cn(
                              'font-mono text-[11px]',
                              routine.scheduledToday
                                ? 'text-[#96D2C5]'
                                : 'text-[#737378]'
                            )}
                          >
                            {routine.scheduleType === 'as_needed'
                              ? 'As needed'
                              : routine.scheduledToday
                                ? 'Scheduled today'
                                : 'Off schedule today'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#A3A3A8]">
                          {routine.timeOfDay}
                          <span aria-hidden="true"> · </span>
                          {routine.scheduleLabel}
                          {routine.preferredTime && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono">{routine.preferredTime}</span>
                            </>
                          )}
                        </p>
                        {routine.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-[#737378]">
                            {routine.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-mono text-xs font-semibold text-[#96D2C5] tabular-nums">
                          {routine.completedCount30d} runs
                        </span>
                        <p className="font-mono text-[11px] text-[#737378]">last 30d</p>
                      </div>
                    </div>

                    {/* Today Progress & Interactive Step Checklist */}
                    {!isArchived && (
                      <div className="space-y-2.5 rounded-xl bg-[#1A1A1A] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-[#A3A3A8]">
                            {isCompletedToday
                              ? 'Completed today'
                              : routine.todayLog
                                ? 'In progress today'
                                : 'Ready to run'}
                          </span>
                          <span className="font-mono text-[#F2F2F2] tabular-nums">
                            {totalSteps > 0
                              ? `${completedCount} / ${totalSteps} steps`
                              : isCompletedToday
                                ? 'Done'
                                : 'No steps yet'}
                          </span>
                        </div>

                        {totalSteps > 0 && (
                          <ProgressBar
                            value={progressPercent}
                            tone={isCompletedToday ? 'mint' : 'coral'}
                            showLabel
                          />
                        )}

                        {totalSteps > 0 ? (
                          <ol className="space-y-1.5 pt-1">
                            {routine.steps.map((step: RoutineStep, idx: number) => {
                              const checked = completedSet.has(step.id);
                              return (
                                <li
                                  key={step.id}
                                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.03]"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <Checkbox
                                      checked={checked}
                                      onChange={() =>
                                        void handleToggleRoutineStep(routine, step.id)
                                      }
                                      tone="mint"
                                      disabled={isMutating}
                                      ariaLabel={`Toggle step "${step.title}" in ${routine.name}`}
                                    />
                                    <span className="font-mono text-[11px] text-[#737378]">
                                      {idx + 1}.
                                    </span>
                                    <span
                                      className={cn(
                                        'text-xs transition-colors',
                                        checked
                                          ? 'text-[#737378] line-through'
                                          : 'text-[#F2F2F2]'
                                      )}
                                    >
                                      {step.title}
                                    </span>
                                  </div>
                                  {step.durationMinutes !== null && (
                                    <span className="shrink-0 font-mono text-[11px] text-[#A3A3A8]">
                                      {step.durationMinutes}m
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="text-xs text-[#737378]">
                            Add steps below to build a guided checklist, or mark complete as a single block.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {!isCompletedToday && (
                            <Button
                              variant="mint"
                              size="sm"
                              leadingIcon={<Check className="h-3.5 w-3.5" />}
                              disabled={isMutating}
                              onClick={() => void handleCompleteAllSteps(routine)}
                            >
                              {totalSteps > 0 ? 'Complete All' : 'Mark Completed'}
                            </Button>
                          )}
                          {routine.todayLog && (
                            <Button
                              variant="ghost"
                              size="sm"
                              leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                              disabled={isMutating}
                              onClick={() => void handleResetTodayRoutine(routine)}
                            >
                              Reset Today
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Routine Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() =>
                              setManagingStepsRoutineId(stepsOpen ? null : routine.id)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#A3A3A8] transition-colors hover:bg-white/[0.05] hover:text-[#F2F2F2] cursor-pointer"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>
                              {stepsOpen
                                ? 'Done Editing Steps'
                                : `Steps (${routine.steps.length})`}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleToggleRoutineHistory(routine)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#A3A3A8] transition-colors hover:bg-white/[0.05] hover:text-[#F2F2F2] cursor-pointer"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>{historyOpen ? 'Hide History' : 'Execution History'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => openEditRoutine(routine)}
                        >
                          Edit
                        </Button>
                        {isArchived ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={<ArchiveRestore className="h-3.5 w-3.5" />}
                            disabled={isMutating}
                            onClick={() => void restoreRoutine(routine)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Archive className="h-3.5 w-3.5" />}
                            disabled={isMutating}
                            onClick={() => void archiveRoutine(routine)}
                          >
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${routine.name}`}
                          disabled={isMutating}
                          onClick={() => setDeleteConfirmRoutine(routine)}
                          className="text-[#A3A3A8] hover:text-[#E06C75]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Inline Step Management Panel */}
                    {stepsOpen && !isArchived && (
                      <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#F2F2F2]">
                            Manage Ordered Steps
                          </span>
                          <span className="text-[11px] text-[#737378]">
                            Past execution logs preserve step snapshots
                          </span>
                        </div>

                        {routine.steps.length > 0 && (
                          <div className="space-y-1.5">
                            {routine.steps.map((step, index) => {
                              const isEditingThis =
                                editingStep?.routineId === routine.id &&
                                editingStep.stepId === step.id;

                              if (isEditingThis && editingStep) {
                                return (
                                  <div
                                    key={step.id}
                                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[#96D2C5]/40 bg-[#262626] p-2"
                                  >
                                    <input
                                      type="text"
                                      value={editingStep.title}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          title: e.target.value,
                                        })
                                      }
                                      maxLength={160}
                                      className="h-8 min-w-[150px] flex-1 rounded-lg border border-white/[0.08] bg-[#1A1A1A] px-2.5 text-xs text-[#F2F2F2]"
                                    />
                                    <input
                                      type="number"
                                      min="1"
                                      max="720"
                                      placeholder="Min"
                                      value={editingStep.durationMinutes}
                                      onChange={(e) =>
                                        setEditingStep({
                                          ...editingStep,
                                          durationMinutes: e.target.value,
                                        })
                                      }
                                      className="h-8 w-16 rounded-lg border border-white/[0.08] bg-[#1A1A1A] px-2 font-mono text-xs text-[#F2F2F2]"
                                    />
                                    <Button
                                      variant="mint"
                                      size="sm"
                                      disabled={isMutating}
                                      onClick={() => void handleSaveInlineStepEdit()}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingStep(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={step.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-[#262626] px-2.5 py-2 text-xs"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="font-mono text-[11px] text-[#737378]">
                                      {index + 1}.
                                    </span>
                                    <span className="truncate text-[#F2F2F2]">
                                      {step.title}
                                    </span>
                                    {step.durationMinutes !== null && (
                                      <span className="shrink-0 font-mono text-[11px] text-[#96D2C5]">
                                        {step.durationMinutes}m
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={index === 0 || isMutating}
                                      onClick={() => void handleMoveStep(routine, index, -1)}
                                      aria-label={`Move ${step.title} up`}
                                      className="rounded p-1 text-[#A3A3A8] hover:bg-white/[0.08] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === routine.steps.length - 1 || isMutating}
                                      onClick={() => void handleMoveStep(routine, index, 1)}
                                      aria-label={`Move ${step.title} down`}
                                      className="rounded p-1 text-[#A3A3A8] hover:bg-white/[0.08] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isMutating}
                                      onClick={() =>
                                        setEditingStep({
                                          routineId: routine.id,
                                          stepId: step.id,
                                          title: step.title,
                                          durationMinutes:
                                            step.durationMinutes !== null
                                              ? String(step.durationMinutes)
                                              : '',
                                        })
                                      }
                                      aria-label={`Edit ${step.title}`}
                                      className="rounded p-1 text-[#A3A3A8] hover:bg-white/[0.08] hover:text-[#F2F2F2] cursor-pointer"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isMutating}
                                      onClick={() =>
                                        void deleteRoutineStep(routine.id, step.id)
                                      }
                                      aria-label={`Remove ${step.title}`}
                                      className="rounded p-1 text-[#A3A3A8] hover:bg-[#E06C75]/15 hover:text-[#E06C75] cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Add step title..."
                            value={newStepTitleByRoutine[routine.id] ?? ''}
                            onChange={(e) =>
                              setNewStepTitleByRoutine((prev) => ({
                                ...prev,
                                [routine.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleAddInlineStep(routine.id);
                              }
                            }}
                            maxLength={160}
                            className="h-8 min-w-[160px] flex-1 rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
                          />
                          <input
                            type="number"
                            min="1"
                            max="720"
                            placeholder="Min"
                            value={newStepDurationByRoutine[routine.id] ?? ''}
                            onChange={(e) =>
                              setNewStepDurationByRoutine((prev) => ({
                                ...prev,
                                [routine.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleAddInlineStep(routine.id);
                              }
                            }}
                            className="h-8 w-16 rounded-lg border border-white/[0.08] bg-[#262626] px-2 font-mono text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={
                              isMutating ||
                              !(newStepTitleByRoutine[routine.id] ?? '').trim()
                            }
                            onClick={() => void handleAddInlineStep(routine.id)}
                          >
                            Add Step
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Execution History Drawer (Immutable Step Snapshots) */}
                    {historyOpen && (
                      <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#F2F2F2]">
                            Execution History (Last 90 Days)
                          </span>
                          <span className="font-mono text-[11px] text-[#737378]">
                            Preserved step snapshots
                          </span>
                        </div>

                        {historyLoadingId === routine.id ? (
                          <Skeleton className="h-16 w-full" />
                        ) : historyLogs.length === 0 ? (
                          <p className="text-xs text-[#737378]">
                            No routine executions logged in the last 90 days yet.
                          </p>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {historyLogs.map((log) => {
                              const completedSnapshotIds = new Set(
                                log.completedStepsSnapshot.map((s) => s.stepId)
                              );
                              const snapshotSteps =
                                log.stepsSnapshot.length > 0
                                  ? log.stepsSnapshot
                                  : log.completedStepsSnapshot;

                              return (
                                <div
                                  key={log.id}
                                  className="space-y-1.5 rounded-lg border border-white/[0.06] bg-[#262626] px-3 py-2.5 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2
                                        className={cn(
                                          'h-3.5 w-3.5',
                                          log.status === 'completed'
                                            ? 'text-[#96D2C5]'
                                            : 'text-[#F19A50]'
                                        )}
                                      />
                                      <span className="font-mono font-semibold text-[#F2F2F2]">
                                        {log.localDate}
                                      </span>
                                    </div>
                                    <span
                                      className={cn(
                                        'font-mono text-[11px]',
                                        log.status === 'completed'
                                          ? 'text-[#96D2C5]'
                                          : 'text-[#F19A50]'
                                      )}
                                    >
                                      {log.status === 'completed'
                                        ? 'Completed'
                                        : 'In progress'}
                                      {log.totalStepsSnapshot > 0
                                        ? ` · ${log.completedStepsCount}/${log.totalStepsSnapshot} steps`
                                        : ''}
                                    </span>
                                  </div>

                                  {snapshotSteps.length > 0 && (
                                    <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                                      {snapshotSteps.map((stepSnap) => {
                                        const done =
                                          completedSnapshotIds.has(stepSnap.stepId) ||
                                          log.completedStepIds.includes(stepSnap.stepId);
                                        return (
                                          <li
                                            key={`${log.id}-${stepSnap.stepId}-${stepSnap.title}`}
                                            className={cn(
                                              'flex items-center gap-1',
                                              done ? 'text-[#96D2C5]' : 'text-[#737378]'
                                            )}
                                          >
                                            <span>{done ? '✓' : '○'}</span>
                                            <span>{stepSnap.title}</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Permanent Routine Deletion Confirmation Dialog (Recommends Archiving) */}
      <Dialog
        open={Boolean(deleteConfirmRoutine)}
        onClose={() => setDeleteConfirmRoutine(null)}
        title="Delete Routine Permanently?"
        subtitle="Permanent deletion removes steps and historical execution records."
        maxWidthClass="max-w-md"
      >
        {deleteConfirmRoutine && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#E06C75]/35 bg-[#E06C75]/10 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E06C75]" />
              <div className="space-y-1 text-xs leading-relaxed text-[#A3A3A8]">
                <p className="font-semibold text-[#F2F2F2]">
                  “{deleteConfirmRoutine.name}”
                </p>
                <p>
                  Permanently deleting this routine will also delete all{' '}
                  {deleteConfirmRoutine.steps.length}{' '}
                  {deleteConfirmRoutine.steps.length === 1 ? 'step' : 'steps'} and its{' '}
                  {deleteConfirmRoutine.recentLogsCount} historical execution{' '}
                  {deleteConfirmRoutine.recentLogsCount === 1 ? 'log' : 'logs'}.
                </p>
                {deleteConfirmRoutine.status === 'active' && (
                  <p className="text-[#F2F2F2]">
                    Archiving is recommended instead so your past execution records remain preserved.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={() => setDeleteConfirmRoutine(null)}
              >
                Cancel
              </Button>
              {deleteConfirmRoutine.status === 'active' && (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Archive className="h-3.5 w-3.5" />}
                  disabled={isMutating}
                  onClick={() => {
                    const target = deleteConfirmRoutine;
                    setDeleteConfirmRoutine(null);
                    void archiveRoutine(target);
                  }}
                >
                  Archive Routine (Recommended)
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                disabled={isMutating}
                onClick={() => {
                  const target = deleteConfirmRoutine;
                  void deleteRoutine(target.id).then((ok) => {
                    if (ok) setDeleteConfirmRoutine(null);
                  });
                }}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
