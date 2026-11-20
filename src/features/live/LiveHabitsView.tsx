import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  Flame,
  History,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  ProgressBar,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import { useHabitsManagementData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  addDaysToLocalDate,
  computeLogProgressPercent,
  getDayOfWeekFromLocalDate,
  WEEKDAY_SHORT_LABELS,
} from '../../lib/habitSchedule';
import {
  formatHabitStreakDetail,
  formatHabitTargetLabel,
  formatLogValueLabel,
  type Habit,
  type HabitLog,
} from '../../types/habit';
import { TASK_CATEGORY_OPTIONS, type TaskCategory } from '../../types/task';

type HabitStatusTab = 'active' | 'archived';
type HabitCategoryFilter = 'All' | TaskCategory;

export function LiveHabitsView() {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    searchQuery,
    refreshHabits,
    archiveHabit,
    restoreHabit,
    upsertHabitLog,
    undoHabitLog,
    loadHabitLogsRange,
    openCreateHabit,
    openEditHabit,
  } = useHabitsManagementData();

  const [statusTab, setStatusTab] = useState<HabitStatusTab>('active');
  const [categoryFilter, setCategoryFilter] = useState<HabitCategoryFilter>('All');
  const [measurableDrafts, setMeasurableDrafts] = useState<Record<number, string>>({});
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [historyLogsByHabit, setHistoryLogsByHabit] = useState<Record<number, HabitLog[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);
  const [historyCustomDate, setHistoryCustomDate] = useState<string>('');
  const [historyCustomValue, setHistoryCustomValue] = useState<string>('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const activeCount = useMemo(
    () => habits.filter((h) => h.status === 'active').length,
    [habits]
  );
  const archivedCount = useMemo(
    () => habits.filter((h) => h.status === 'archived').length,
    [habits]
  );

  const visibleHabits = useMemo(() => {
    return habits.filter((habit) => {
      if (habit.status !== statusTab) return false;
      if (categoryFilter !== 'All' && habit.category !== categoryFilter) return false;
      if (
        normalizedQuery &&
        !habit.name.toLowerCase().includes(normalizedQuery) &&
        !(habit.description && habit.description.toLowerCase().includes(normalizedQuery)) &&
        !habit.category.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [habits, statusTab, categoryFilter, normalizedQuery]);

  const recentSevenDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToLocalDate(todayLocalDate, i - 6)),
    [todayLocalDate]
  );

  const fetchHistoryForHabit = async (habit: Habit) => {
    setHistoryLoadingId(habit.id);
    try {
      const from = addDaysToLocalDate(todayLocalDate, -29);
      const logs = await loadHabitLogsRange(habit.id, from, todayLocalDate);
      setHistoryLogsByHabit((prev) => ({ ...prev, [habit.id]: logs }));
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const toggleHistoryPanel = (habit: Habit) => {
    if (expandedHistoryId === habit.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(habit.id);
    setHistoryCustomDate(addDaysToLocalDate(todayLocalDate, -1));
    setHistoryCustomValue(
      habit.trackingType === 'measurable' && habit.targetValue !== null
        ? String(habit.targetValue)
        : '1'
    );
    void fetchHistoryForHabit(habit);
  };

  const handleToggleBooleanToday = async (habit: Habit) => {
    if (habit.todayLog) {
      await undoHabitLog(habit.id, todayLocalDate);
    } else {
      await upsertHabitLog(habit.id, { localDate: todayLocalDate });
    }
    if (expandedHistoryId === habit.id) {
      void fetchHistoryForHabit(habit);
    }
  };

  const handleSaveMeasurableToday = async (habit: Habit, overrideValue?: number) => {
    const draftStr =
      measurableDrafts[habit.id] ??
      (habit.todayLog ? String(habit.todayLog.completedValue) : String(habit.targetValue ?? 1));
    const numeric = overrideValue ?? Number(draftStr);
    if (!Number.isFinite(numeric) || numeric < 0) return;

    await upsertHabitLog(habit.id, {
      localDate: todayLocalDate,
      completedValue: numeric,
    });
    if (expandedHistoryId === habit.id) {
      void fetchHistoryForHabit(habit);
    }
  };

  const handleLogDateInHistory = async (
    habit: Habit,
    localDate: string,
    hasExistingLog: boolean,
    customValue?: number
  ) => {
    if (hasExistingLog && habit.trackingType === 'boolean' && customValue === undefined) {
      await undoHabitLog(habit.id, localDate);
    } else {
      const value =
        habit.trackingType === 'boolean'
          ? 1
          : (customValue ?? habit.targetValue ?? 1);
      await upsertHabitLog(habit.id, {
        localDate,
        completedValue: value,
      });
    }
    await fetchHistoryForHabit(habit);
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
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
              Sign in to manage your habits
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Create daily, weekday, or flexible weekly habits with local-timezone completion logs and deterministic streak tracking.
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
        title="Could not load habits"
        description={error}
        onRetry={() => void refreshHabits()}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#202020] p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            options={[
              { value: 'active', label: `Active (${activeCount})` },
              { value: 'archived', label: `Archived (${archivedCount})` },
            ]}
            value={statusTab}
            onChange={(val) => setStatusTab(val)}
          />
          <SegmentedTabs
            variant="pill-filter"
            options={[
              { value: 'All', label: 'All' },
              ...TASK_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
            ]}
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-[#A3A3A8]">
            {todayLocalDate} · {effectiveTimezone}
          </span>
          <Button
            variant="mint"
            size="sm"
            leadingIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={openCreateHabit}
          >
            New Habit
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : visibleHabits.length === 0 ? (
        <EmptyState
          title={
            statusTab === 'archived'
              ? 'No archived habits'
              : searchQuery || categoryFilter !== 'All'
                ? 'No matching habits'
                : 'No habits yet'
          }
          description={
            statusTab === 'archived'
              ? 'Archived habits appear here with their full historical log history preserved.'
              : searchQuery || categoryFilter !== 'All'
                ? 'Adjust your category filter or search query to view your habits.'
                : 'Create your first habit with a daily, selected-weekday, or weekly frequency target.'
          }
          actionLabel={statusTab === 'active' ? 'Create Habit' : undefined}
          onAction={statusTab === 'active' ? openCreateHabit : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleHabits.map((habit) => {
            const isCompletedToday = habit.todayLog?.statusSnapshot === 'completed';
            const isPartialToday = habit.todayLog?.statusSnapshot === 'partial';
            const isArchived = habit.status === 'archived';
            const measurablePercent =
              habit.trackingType === 'measurable' && habit.todayLog
                ? computeLogProgressPercent(
                    habit.todayLog.completedValue,
                    habit.todayLog.targetSnapshot ?? habit.targetValue
                  )
                : 0;
            const draftValue =
              measurableDrafts[habit.id] ??
              (habit.todayLog
                ? String(habit.todayLog.completedValue)
                : String(habit.targetValue ?? 1));
            const historyOpen = expandedHistoryId === habit.id;
            const historyLogs = historyLogsByHabit[habit.id] ?? [];
            const historyMap = new Map(historyLogs.map((l) => [l.localDate, l]));

            return (
              <Card key={habit.id} tone="surface" padding="md" className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {habit.trackingType === 'boolean' && !isArchived && (
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isCompletedToday}
                          onChange={() => void handleToggleBooleanToday(habit)}
                          tone="mint"
                          disabled={isMutating}
                          ariaLabel={`Mark "${habit.name}" ${isCompletedToday ? 'incomplete' : 'complete'} for ${todayLocalDate}`}
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#F2F2F2]">
                          {habit.name}
                        </h3>
                        <span className="font-mono text-[11px] text-[#96D2C5]">
                          {habit.scheduledToday ? 'Scheduled today' : 'Rest day'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#A3A3A8]">
                        {habit.category}
                        <span aria-hidden="true"> · </span>
                        {habit.schedule.label}
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{formatHabitTargetLabel(habit)}</span>
                      </p>
                      {habit.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#737378]">
                          {habit.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Deterministic Streak Indicator */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#F19A50] tabular-nums">
                      <Flame className="h-3.5 w-3.5" />
                      <span>
                        {habit.streak.currentStreak}
                        {habit.streak.streakUnit === 'weeks' ? 'w' : 'd'}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[#737378] tabular-nums">
                      {formatHabitStreakDetail(habit)}
                    </p>
                  </div>
                </div>

                {/* Today's Measurable Progress Controls */}
                {habit.trackingType === 'measurable' && !isArchived && (
                  <div className="space-y-2.5 rounded-xl bg-[#262626] p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#A3A3A8]">
                        {isCompletedToday
                          ? 'Target met today'
                          : isPartialToday
                            ? 'Partial progress (does not advance streak until target met)'
                            : 'Log today’s progress'}
                      </span>
                      <span className="font-mono text-[#F2F2F2] tabular-nums">
                        {habit.todayLog
                          ? formatLogValueLabel(habit.todayLog, habit.unit, habit.trackingType)
                          : `0 / ${habit.targetValue ?? 0}${habit.unit ? ` ${habit.unit}` : ''}`}
                      </span>
                    </div>

                    <ProgressBar
                      value={measurablePercent}
                      tone={isCompletedToday ? 'mint' : 'orange'}
                      showLabel
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        aria-label={`Logged value for ${habit.name}`}
                        value={draftValue}
                        onChange={(e) =>
                          setMeasurableDrafts((prev) => ({
                            ...prev,
                            [habit.id]: e.target.value,
                          }))
                        }
                        className="h-8 w-24 rounded-lg border border-white/[0.08] bg-[#1A1A1A] px-2.5 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void handleSaveMeasurableToday(habit)}
                      >
                        Save Value
                      </Button>
                      {!isCompletedToday && habit.targetValue !== null && (
                        <Button
                          variant="mint"
                          size="sm"
                          leadingIcon={<Check className="h-3.5 w-3.5" />}
                          disabled={isMutating}
                          onClick={() =>
                            void handleSaveMeasurableToday(habit, habit.targetValue ?? 1)
                          }
                        >
                          Complete Target
                        </Button>
                      )}
                      {habit.todayLog && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                          disabled={isMutating}
                          onClick={() => void undoHabitLog(habit.id, todayLocalDate)}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                  <button
                    type="button"
                    onClick={() => toggleHistoryPanel(habit)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#A3A3A8] transition-colors hover:bg-white/[0.05] hover:text-[#F2F2F2] cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>{historyOpen ? 'Hide Logs' : 'Recent Logs'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEditHabit(habit)}
                    >
                      Edit
                    </Button>
                    {isArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        leadingIcon={<ArchiveRestore className="h-3.5 w-3.5" />}
                        disabled={isMutating}
                        onClick={() => void restoreHabit(habit)}
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Archive className="h-3.5 w-3.5" />}
                        disabled={isMutating}
                        onClick={() => void archiveHabit(habit)}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>

                {/* Historical 7-day + Backfill Drawer */}
                {historyOpen && (
                  <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F2F2F2]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#96D2C5]" />
                        <span>Last 7 Local Days ({effectiveTimezone})</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#737378]">
                        {historyLogs.length} logged in 30d
                      </span>
                    </div>

                    {historyLoadingId === habit.id ? (
                      <Skeleton className="h-14 w-full" />
                    ) : (
                      <>
                        <div className="grid grid-cols-7 gap-1.5">
                          {recentSevenDates.map((dateStr) => {
                            const log = historyMap.get(dateStr);
                            const completed = log?.statusSnapshot === 'completed';
                            const partial = log?.statusSnapshot === 'partial';
                            const dayLabel =
                              WEEKDAY_SHORT_LABELS[getDayOfWeekFromLocalDate(dateStr)];

                            return (
                              <button
                                key={dateStr}
                                type="button"
                                disabled={isArchived || isMutating}
                                onClick={() =>
                                  void handleLogDateInHistory(habit, dateStr, Boolean(log))
                                }
                                title={`${dateStr}: ${
                                  completed
                                    ? 'Completed (click to undo/update)'
                                    : partial
                                      ? `Partial (${log?.completedValue}/${log?.targetSnapshot})`
                                      : 'Not logged (click to log)'
                                }`}
                                className={cn(
                                  'flex flex-col items-center justify-center rounded-lg border py-2 text-center transition-colors',
                                  !isArchived && 'cursor-pointer',
                                  completed
                                    ? 'border-[#96D2C5]/60 bg-[#96D2C5]/15 text-[#96D2C5]'
                                    : partial
                                      ? 'border-[#F19A50]/60 bg-[#F19A50]/15 text-[#F19A50]'
                                      : 'border-white/[0.07] bg-[#262626] text-[#737378] hover:border-white/20 hover:text-[#F2F2F2]'
                                )}
                              >
                                <span className="text-[10px] font-medium">{dayLabel}</span>
                                <span className="mt-0.5 font-mono text-[11px] font-semibold">
                                  {dateStr.slice(8)}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {!isArchived && (
                          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
                            <span className="text-[11px] text-[#A3A3A8]">Log past date:</span>
                            <input
                              type="date"
                              max={todayLocalDate}
                              value={historyCustomDate}
                              onChange={(e) => setHistoryCustomDate(e.target.value)}
                              className="h-8 rounded-lg border border-white/[0.08] bg-[#262626] px-2 font-mono text-xs text-[#F2F2F2]"
                            />
                            {habit.trackingType === 'measurable' && (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={historyCustomValue}
                                onChange={(e) => setHistoryCustomValue(e.target.value)}
                                className="h-8 w-20 rounded-lg border border-white/[0.08] bg-[#262626] px-2 font-mono text-xs text-[#F2F2F2]"
                              />
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!historyCustomDate || isMutating}
                              onClick={() => {
                                const val =
                                  habit.trackingType === 'measurable'
                                    ? Number(historyCustomValue)
                                    : 1;
                                if (!Number.isFinite(val) || val < 0) return;
                                void handleLogDateInHistory(
                                  habit,
                                  historyCustomDate,
                                  false,
                                  val
                                );
                              }}
                            >
                              Save Date
                            </Button>
                            {historyMap.has(historyCustomDate) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isMutating}
                                onClick={() =>
                                  void undoHabitLog(habit.id, historyCustomDate).then(() =>
                                    fetchHistoryForHabit(habit)
                                  )
                                }
                              >
                                Undo Date
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
