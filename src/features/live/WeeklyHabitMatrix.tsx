import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  Minus,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
} from '../../components/ui';
import { useWeeklyMatrixData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import { addDaysToLocalDate } from '../../lib/habitSchedule';
import {
  buildWeeklyMatrixViewData,
  formatShortCalendarLabel,
  getLatestWeekStart,
  type EvaluatedHabitDay,
} from '../../lib/habitVisualizations';
import { formatHabitTargetLabel, formatLogValueLabel } from '../../types/habit';

function PartialHalfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="#F19A50" strokeWidth="1.6" />
      <path d="M8 2A6 6 0 0 0 8 14V2Z" fill="#F19A50" />
    </svg>
  );
}

export function WeeklyHabitMatrix() {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    logsByKey,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    refreshHabits,
    ensureLogRangeLoaded,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  } = useWeeklyMatrixData();

  const currentWeekStart = useMemo(
    () => getLatestWeekStart(todayLocalDate),
    [todayLocalDate]
  );
  const [weekStartLocalDate, setWeekStartLocalDate] = useState<string>(currentWeekStart);
  const lastSyncedWeekRef = React.useRef(currentWeekStart);

  useEffect(() => {
    if (lastSyncedWeekRef.current === currentWeekStart) return;
    const prevWeek = lastSyncedWeekRef.current;
    lastSyncedWeekRef.current = currentWeekStart;
    setWeekStartLocalDate((curr) => (curr === prevWeek ? currentWeekStart : curr));
  }, [currentWeekStart]);
  const [activeEditorKey, setActiveEditorKey] = useState<string | null>(null);
  const [measurableValueDraft, setMeasurableValueDraft] = useState<string>('');

  const matrixData = useMemo(
    () =>
      buildWeeklyMatrixViewData({
        weekStartLocalDate,
        habits,
        logsByKey,
        todayLocalDate,
        effectiveTimezone,
      }),
    [weekStartLocalDate, habits, logsByKey, todayLocalDate, effectiveTimezone]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void ensureLogRangeLoaded(
      matrixData.weekStartLocalDate,
      matrixData.weekEndLocalDate
    );
  }, [
    isAuthenticated,
    matrixData.weekStartLocalDate,
    matrixData.weekEndLocalDate,
    ensureLogRangeLoaded,
  ]);

  const activeEditorCell = useMemo((): EvaluatedHabitDay | null => {
    if (!activeEditorKey) return null;
    for (const row of matrixData.rows) {
      for (const cell of row.cells) {
        if (`${cell.habit.id}:${cell.localDate}` === activeEditorKey) {
          return cell;
        }
      }
    }
    return null;
  }, [activeEditorKey, matrixData.rows]);

  const handleShiftWeek = (deltaWeeks: number) => {
    setActiveEditorKey(null);
    setWeekStartLocalDate((prev) => addDaysToLocalDate(prev, deltaWeeks * 7));
  };

  const handleJumpThisWeek = () => {
    setActiveEditorKey(null);
    setWeekStartLocalDate(currentWeekStart);
  };

  const handleOpenMeasurableEditor = (cell: EvaluatedHabitDay) => {
    const key = `${cell.habit.id}:${cell.localDate}`;
    if (activeEditorKey === key) {
      setActiveEditorKey(null);
      return;
    }
    setActiveEditorKey(key);
    setMeasurableValueDraft(
      cell.log
        ? String(cell.log.completedValue)
        : String(cell.habit.targetValue ?? 1)
    );
  };

  const handleToggleBooleanCell = async (cell: EvaluatedHabitDay) => {
    if (!cell.canMutateOnDate || cell.localDate > todayLocalDate) return;
    if (cell.log) {
      await undoHabitLog(cell.habit.id, cell.localDate);
    } else {
      await upsertHabitLog(cell.habit.id, { localDate: cell.localDate });
    }
  };

  const handleSaveActiveMeasurable = async (overrideValue?: number) => {
    if (!activeEditorCell || !activeEditorCell.canMutateOnDate) return;
    const numeric = overrideValue ?? Number(measurableValueDraft);
    if (!Number.isFinite(numeric) || numeric < 0) return;

    await upsertHabitLog(activeEditorCell.habit.id, {
      localDate: activeEditorCell.localDate,
      completedValue: numeric,
    });
    setActiveEditorKey(null);
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card tone="surface" padding="lg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-[#F2F2F2]">
              Sign in to view your Weekly Habit Matrix
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Review Monday–Sunday consistency across every habit, spot gaps accurately, and log completions inline.
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
        title="Could not load Weekly Matrix"
        description={error}
        onRetry={() => {
          void refreshHabits();
          void ensureLogRangeLoaded(
            matrixData.weekStartLocalDate,
            matrixData.weekEndLocalDate,
            { force: true }
          );
        }}
      />
    );
  }

  if (isLoading && habits.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <EmptyState
        title="No habits to compare yet"
        description="Create habits to populate your Monday–Sunday matrix and track weekly targets."
        actionLabel="Create Habit"
        onAction={openCreateHabit}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Compact Weekly Summary Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Weekly completions</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {matrixData.totalCompleted}
            <span className="text-sm font-normal text-[#737378]">
              /{matrixData.totalScheduledOrExpected}
            </span>
          </p>
          {matrixData.totalPartial > 0 && (
            <p className="font-mono text-[11px] text-[#F19A50] tabular-nums">
              +{matrixData.totalPartial} partial
            </p>
          )}
        </Card>

        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Weekly adherence</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#96D2C5] tabular-nums">
            {matrixData.weeklyPercent !== null ? `${matrixData.weeklyPercent}%` : '—'}
          </p>
          <p className="text-[11px] text-[#737378]">{effectiveTimezone}</p>
        </Card>

        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Strongest habit</p>
          <p className="mt-1 truncate text-base font-semibold text-[#F2F2F2]">
            {matrixData.strongestHabit?.habit.name ?? '—'}
          </p>
          <p className="font-mono text-xs text-[#96D2C5] tabular-nums">
            {matrixData.strongestHabit
              ? `${matrixData.strongestHabit.footerLabel} (${matrixData.strongestHabit.adherencePercent ?? 0}%)`
              : 'No active scheduled habits'}
          </p>
        </Card>

        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Needs attention</p>
          <p className="mt-1 truncate text-base font-semibold text-[#F2F2F2]">
            {matrixData.attentionHabit?.habit.name ?? 'All on track'}
          </p>
          <p className="font-mono text-xs text-[#F19A50] tabular-nums">
            {matrixData.attentionHabit
              ? `${matrixData.attentionHabit.footerLabel} (${matrixData.attentionHabit.adherencePercent ?? 0}%)`
              : '100% scheduled met'}
          </p>
        </Card>
      </div>

      {/* Inline Measurable Cell Editor Bar */}
      {activeEditorCell && activeEditorCell.habit.trackingType === 'measurable' && (
        <Card tone="surface" padding="sm" className="border-[#96D2C5]/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#F2F2F2]">
                {activeEditorCell.habit.name}
                <span className="font-mono font-normal text-[#A3A3A8]">
                  {' '}
                  · {formatShortCalendarLabel(activeEditorCell.localDate)}
                </span>
              </p>
              <p className="font-mono text-[11px] text-[#737378]">
                Target: {formatHabitTargetLabel(activeEditorCell.habit)}
                {activeEditorCell.log
                  ? ` · Current: ${formatLogValueLabel(
                      activeEditorCell.log,
                      activeEditorCell.habit.unit,
                      activeEditorCell.habit.trackingType
                    )}`
                  : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                aria-label={`Value for ${activeEditorCell.habit.name} on ${activeEditorCell.localDate}`}
                value={measurableValueDraft}
                onChange={(e) => setMeasurableValueDraft(e.target.value)}
                className="h-8 w-24 rounded-lg border border-white/[0.08] bg-[#1A1A1A] px-2.5 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={isMutating}
                onClick={() => void handleSaveActiveMeasurable()}
              >
                Save Value
              </Button>
              {activeEditorCell.kind !== 'completed' &&
                activeEditorCell.habit.targetValue !== null && (
                  <Button
                    variant="mint"
                    size="sm"
                    leadingIcon={<Check className="h-3.5 w-3.5" />}
                    disabled={isMutating}
                    onClick={() =>
                      void handleSaveActiveMeasurable(activeEditorCell.habit.targetValue ?? 1)
                    }
                  >
                    Complete
                  </Button>
                )}
              {activeEditorCell.log && (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  disabled={isMutating}
                  onClick={async () => {
                    await undoHabitLog(
                      activeEditorCell.habit.id,
                      activeEditorCell.localDate
                    );
                    setActiveEditorKey(null);
                  }}
                >
                  Undo
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveEditorKey(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Weekly Habit Matrix Table */}
      <Card tone="surface" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">Weekly Habit Matrix</h3>
            <p className="text-xs text-[#A3A3A8]">
              Schedule-aware Monday–Sunday overview. Rest days do not penalize adherence; partial measurable logs never count as full completions.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              aria-label="Previous week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#E59585] transition-colors hover:bg-white/[0.06] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[165px] text-center font-mono text-xs font-medium text-[#F2F2F2]">
              {matrixData.weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              aria-label="Next week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#A3A3A8] transition-colors hover:bg-white/[0.06] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleJumpThisWeek}>
              This week
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-72 w-full" />
          </div>
        ) : matrixData.relevantHabits.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A3A3A8]">
            No active habits or logged history in this week.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#1B1B1B] text-xs font-medium text-[#A3A3A8]">
                  <th className="w-40 py-3 pl-5 pr-4">Day</th>
                  {matrixData.relevantHabits.map((habit) => (
                    <th key={habit.id} className="px-3 py-3 text-center">
                      <div className="mx-auto max-w-[140px] truncate font-semibold text-[#F2F2F2]">
                        {habit.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] font-normal text-[#737378]">
                        {habit.schedule.label} · {formatHabitTargetLabel(habit)}
                      </div>
                    </th>
                  ))}
                  <th className="w-44 py-3 pl-4 pr-5">Progress</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.06]">
                {matrixData.rows.map((row) => (
                  <tr
                    key={row.localDate}
                    className={cn(
                      'transition-colors hover:bg-white/[0.025]',
                      row.isToday && 'bg-[#96D2C5]/[0.04]'
                    )}
                  >
                    <td className="py-2 pl-5 pr-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#F2F2F2]">
                          {row.weekdayLabel}
                        </span>
                        <span className="font-mono text-xs text-[#737378]">
                          {row.shortDateLabel}
                        </span>
                        {row.isToday && (
                          <span className="font-mono text-[10px] font-semibold text-[#96D2C5]">
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {row.cells.map((cell) => {
                      const cellKey = `${cell.habit.id}:${cell.localDate}`;
                      const isEditing = activeEditorKey === cellKey;
                      const interactive =
                        cell.canMutateOnDate &&
                        cell.localDate <= todayLocalDate &&
                        cell.kind !== 'inactive';

                      // Future or non-loggable historical states
                      if (
                        cell.kind === 'future' ||
                        cell.kind === 'inactive' ||
                        cell.kind === 'unverified_prior_schedule' ||
                        cell.kind === 'unscheduled'
                      ) {
                        const titleText =
                          cell.kind === 'future'
                            ? 'Upcoming date'
                            : cell.kind === 'unverified_prior_schedule'
                              ? 'Prior schedule unrecorded'
                              : cell.kind === 'inactive'
                                ? 'Habit not active on this date'
                                : 'Unscheduled rest day (no penalty)';
                        return (
                          <td key={cell.habit.id} className="px-2 py-1.5 text-center">
                            <span
                              title={titleText}
                              aria-label={`${cell.habit.name} on ${row.localDate}: ${titleText}`}
                              className="inline-flex h-10 w-10 items-center justify-center font-mono text-[11px] text-[#737378]"
                            >
                              {cell.kind === 'unscheduled' ? (
                                <span className="rounded px-1.5 py-0.5 text-[10px] text-[#737378] bg-white/[0.03]">
                                  Rest
                                </span>
                              ) : (
                                <Minus className="h-3.5 w-3.5 opacity-55" />
                              )}
                            </span>
                          </td>
                        );
                      }

                      // Boolean habit cell
                      if (cell.habit.trackingType === 'boolean') {
                        const isChecked = cell.kind === 'completed';
                        return (
                          <td key={cell.habit.id} className="px-2 py-1.5 text-center">
                            <div className="inline-flex items-center justify-center gap-1">
                              {cell.kind === 'missed' && interactive ? (
                                <button
                                  type="button"
                                  disabled={isMutating}
                                  onClick={() => void handleToggleBooleanCell(cell)}
                                  title={`${cell.habit.name} missed on ${row.localDate} (click to backfill)`}
                                  aria-label={`${cell.habit.name} on ${row.localDate}: Missed, click to mark complete`}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E06C75]/45 bg-[#E06C75]/10 text-[#E06C75] transition-colors hover:border-[#96D2C5] hover:bg-[#96D2C5]/15 hover:text-[#96D2C5] cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                </button>
                              ) : (
                                <Checkbox
                                  shape="square"
                                  tone={cell.kind === 'completed' ? 'mint' : 'blue'}
                                  size="md"
                                  hitTarget="cell"
                                  disabled={!interactive || isMutating}
                                  checked={isChecked}
                                  onChange={() => void handleToggleBooleanCell(cell)}
                                  ariaLabel={`${cell.habit.name} on ${row.localDate}${
                                    cell.kind === 'flexible_rest'
                                      ? ' (flexible weekly target)'
                                      : ''
                                  }`}
                                />
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Measurable habit cell
                      return (
                        <td key={cell.habit.id} className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            disabled={!interactive || isMutating}
                            onClick={() => handleOpenMeasurableEditor(cell)}
                            aria-label={`${cell.habit.name} on ${row.localDate}: ${
                              cell.log
                                ? formatLogValueLabel(
                                    cell.log,
                                    cell.habit.unit,
                                    cell.habit.trackingType
                                  )
                                : cell.kind
                            }`}
                            className={cn(
                              'inline-flex h-10 min-w-[68px] items-center justify-center gap-1 rounded-lg border px-2 font-mono text-[11px] tabular-nums transition-colors',
                              interactive && 'cursor-pointer',
                              isEditing && 'ring-2 ring-[#E59585]',
                              cell.kind === 'completed'
                                ? 'border-[#96D2C5]/45 bg-[#96D2C5]/15 text-[#96D2C5]'
                                : cell.kind === 'partial'
                                  ? 'border-[#F19A50]/55 bg-[#F19A50]/15 text-[#F19A50]'
                                  : cell.kind === 'missed'
                                    ? 'border-[#E06C75]/45 bg-[#E06C75]/10 text-[#E06C75]'
                                    : 'border-white/[0.1] bg-white/[0.03] text-[#A3A3A8] hover:border-white/25 hover:text-[#F2F2F2]'
                            )}
                          >
                            {cell.kind === 'completed' ? (
                              <>
                                <Check className="h-3 w-3 shrink-0" />
                                <span>{cell.log?.completedValue}</span>
                              </>
                            ) : cell.kind === 'partial' ? (
                              <>
                                <PartialHalfIcon />
                                <span>
                                  {cell.log?.completedValue}/
                                  {cell.log?.targetSnapshot ?? cell.habit.targetValue}
                                </span>
                              </>
                            ) : cell.kind === 'missed' ? (
                              <>
                                <X className="h-3 w-3 shrink-0" />
                                <span>0</span>
                              </>
                            ) : cell.kind === 'pending' ? (
                              <>
                                <Clock className="h-3 w-3 text-[#A9C8E9]" />
                                <span>Open</span>
                              </>
                            ) : (
                              <span>Log</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-2 pl-4 pr-5">
                      {row.rowPercent !== null ? (
                        <ProgressBar value={row.rowPercent} tone="mint" showLabel />
                      ) : (
                        <span className="font-mono text-xs text-[#737378]">
                          {row.isFuture ? 'Upcoming' : 'Rest'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-white/[0.08] bg-[#1B1B1B] text-xs text-[#A3A3A8]">
                  <td className="py-3 pl-5 pr-4 font-medium">Completed</td>
                  {matrixData.columns.map((col) => (
                    <td
                      key={col.habit.id}
                      className="px-3 py-3 text-center font-mono tabular-nums"
                    >
                      <span className="font-semibold text-[#F2F2F2]">{col.footerLabel}</span>
                      {col.partialDays > 0 && (
                        <div className="text-[10px] text-[#F19A50]">
                          {col.partialDays} partial
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="py-3 pl-4 pr-5 text-right font-mono font-semibold text-[#96D2C5] tabular-nums">
                    {matrixData.weeklyPercent !== null
                      ? `${matrixData.weeklyPercent}% avg`
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {matrixData.hasUnverifiedPriorSchedule && (
          <p className="border-t border-white/[0.07] px-5 py-3 text-[11px] text-[#737378]">
            Unlogged days prior to a later habit schedule edit are displayed neutrally (`—`) rather than marked missed.
          </p>
        )}
      </Card>
    </div>
  );
}
