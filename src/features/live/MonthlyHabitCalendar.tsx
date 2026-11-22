import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  LogIn,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../../components/ui';
import { useMonthlyCalendarData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import { formatCalendarDate, parseCalendarDate } from '../../lib/habitSchedule';
import {
  buildMonthlyCalendarViewData,
  formatShortCalendarLabel,
  shiftYearMonth,
  type EvaluatedHabitDay,
  type MonthlyCalendarDayVisualState,
} from '../../lib/habitVisualizations';
import {
  formatHabitStreakDetail,
  formatHabitTargetLabel,
  formatLogValueLabel,
  type Habit,
} from '../../types/habit';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PartialHalfIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="6" stroke="#F19A50" strokeWidth="1.6" />
      <path d="M8 2A6 6 0 0 0 8 14V2Z" fill="#F19A50" />
    </svg>
  );
}

function getItemStatusMeta(item: EvaluatedHabitDay): {
  label: string;
  toneClass: string;
} {
  switch (item.kind) {
    case 'completed':
      return { label: 'Completed', toneClass: 'text-[#96D2C5]' };
    case 'partial':
      return { label: 'Partial', toneClass: 'text-[#F19A50]' };
    case 'missed':
      return { label: 'Missed', toneClass: 'text-[#E06C75]' };
    case 'pending':
      return { label: 'Scheduled today', toneClass: 'text-[#A9C8E9]' };
    case 'flexible_rest':
      return {
        label: `Flexible (${item.habit.schedule.targetPerWeek ?? 1}x/wk)`,
        toneClass: 'text-[#A3A3A8]',
      };
    case 'unscheduled':
      return { label: 'Rest / unscheduled', toneClass: 'text-[#737378]' };
    case 'unverified_prior_schedule':
      return { label: 'Prior schedule unrecorded', toneClass: 'text-[#737378]' };
    case 'inactive':
      return { label: 'Not active on date', toneClass: 'text-[#737378]' };
    case 'future':
      return { label: 'Upcoming', toneClass: 'text-[#737378]' };
  }
}

export function MonthlyHabitCalendar() {
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
  } = useMonthlyCalendarData();

  const initialParsed = useMemo(() => parseCalendarDate(todayLocalDate), [todayLocalDate]);

  const [viewYearMonth, setViewYearMonth] = useState<{ year: number; month: number }>(() => ({
    year: initialParsed.year,
    month: initialParsed.month,
  }));
  const [selectedHabitId, setSelectedHabitId] = useState<number | 'all'>('all');
  const [selectedLocalDate, setSelectedLocalDate] = useState<string>(todayLocalDate);
  const [measurableDrafts, setMeasurableDrafts] = useState<Record<string, string>>({});

  const lastSyncedTodayRef = React.useRef(todayLocalDate);

  // Keep default month/day synced if authoritative user timezone resolves a different todayLocalDate
  useEffect(() => {
    if (lastSyncedTodayRef.current === todayLocalDate) return;
    const prevToday = lastSyncedTodayRef.current;
    lastSyncedTodayRef.current = todayLocalDate;

    const prevParts = parseCalendarDate(prevToday);
    const nextParts = parseCalendarDate(todayLocalDate);
    setViewYearMonth((curr) =>
      curr.year === prevParts.year && curr.month === prevParts.month
        ? { year: nextParts.year, month: nextParts.month }
        : curr
    );
    setSelectedLocalDate((curr) => (curr === prevToday ? todayLocalDate : curr));
  }, [todayLocalDate]);

  // Ensure selectedHabitId resets cleanly if a habit is deleted
  useEffect(() => {
    if (
      selectedHabitId !== 'all' &&
      !habits.some((h) => h.id === selectedHabitId)
    ) {
      setSelectedHabitId('all');
    }
  }, [habits, selectedHabitId]);

  const calendarData = useMemo(
    () =>
      buildMonthlyCalendarViewData({
        year: viewYearMonth.year,
        month: viewYearMonth.month,
        habits,
        logsByKey,
        selectedHabitId,
        todayLocalDate,
        effectiveTimezone,
      }),
    [
      viewYearMonth.year,
      viewYearMonth.month,
      habits,
      logsByKey,
      selectedHabitId,
      todayLocalDate,
      effectiveTimezone,
    ]
  );

  // Fetch logs covering the viewed month whenever month or auth changes
  useEffect(() => {
    if (!isAuthenticated) return;
    void ensureLogRangeLoaded(calendarData.from, calendarData.to);
  }, [isAuthenticated, calendarData.from, calendarData.to, ensureLogRangeLoaded]);

  const selectedDay = useMemo(() => {
    const matched = calendarData.days.find((d) => d.localDate === selectedLocalDate);
    if (matched) return matched;
    const todayInMonth = calendarData.days.find((d) => d.localDate === todayLocalDate);
    return todayInMonth ?? calendarData.days[0];
  }, [calendarData.days, selectedLocalDate, todayLocalDate]);

  const activeFilterHabit = useMemo(
    () =>
      selectedHabitId === 'all'
        ? null
        : (habits.find((h) => h.id === selectedHabitId) ?? null),
    [habits, selectedHabitId]
  );

  const streakSummary = useMemo(() => {
    if (activeFilterHabit) {
      return {
        primaryNumber: activeFilterHabit.streak.currentStreak,
        primaryUnit: activeFilterHabit.streak.streakUnit === 'weeks' ? 'weeks' : 'days',
        detailLine: formatHabitStreakDetail(activeFilterHabit),
      };
    }
    const activeHabits = habits.filter((h) => h.status === 'active');
    const dailyHabits = activeHabits.filter((h) => h.streak.streakUnit === 'days');
    const weeklyHabits = activeHabits.filter((h) => h.streak.streakUnit === 'weeks');

    const topDaily = dailyHabits.reduce(
      (max, h) => Math.max(max, h.streak.currentStreak),
      0
    );
    const longestDaily = dailyHabits.reduce(
      (max, h) => Math.max(max, h.streak.longestStreak),
      0
    );
    const topWeekly = weeklyHabits.reduce(
      (max, h) => Math.max(max, h.streak.currentStreak),
      0
    );

    if (dailyHabits.length > 0) {
      const weeklySuffix =
        weeklyHabits.length > 0 ? ` · best weekly ${topWeekly}w` : '';
      return {
        primaryNumber: topDaily,
        primaryUnit: 'days',
        detailLine: `top active daily streak · longest ${longestDaily}d${weeklySuffix}`,
      };
    }
    if (weeklyHabits.length > 0) {
      const longestWeekly = weeklyHabits.reduce(
        (max, h) => Math.max(max, h.streak.longestStreak),
        0
      );
      return {
        primaryNumber: topWeekly,
        primaryUnit: 'weeks',
        detailLine: `top active weekly streak · longest ${longestWeekly}w`,
      };
    }
    return {
      primaryNumber: 0,
      primaryUnit: 'days',
      detailLine: 'no active streaks yet',
    };
  }, [activeFilterHabit, habits]);

  const handleShiftMonth = (delta: number) => {
    const next = shiftYearMonth(viewYearMonth.year, viewYearMonth.month, delta);
    setViewYearMonth(next);

    const parsedSelected = parseCalendarDate(selectedLocalDate);
    const nextDaysInMonth = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate();
    const clampedDay = Math.min(parsedSelected.day, nextDaysInMonth);
    setSelectedLocalDate(formatCalendarDate(next.year, next.month, clampedDay));
  };

  const handleJumpToday = () => {
    const todayParts = parseCalendarDate(todayLocalDate);
    setViewYearMonth({ year: todayParts.year, month: todayParts.month });
    setSelectedLocalDate(todayLocalDate);
  };

  const handleToggleBooleanForDay = async (habit: Habit, localDate: string, hasLog: boolean) => {
    if (hasLog) {
      await undoHabitLog(habit.id, localDate);
    } else {
      await upsertHabitLog(habit.id, { localDate });
    }
  };

  const handleSaveMeasurableForDay = async (
    habit: Habit,
    localDate: string,
    overrideValue?: number
  ) => {
    const key = `${habit.id}:${localDate}`;
    const existingLog = logsByKey.get(key) ?? null;
    const raw =
      measurableDrafts[key] ??
      (existingLog ? String(existingLog.completedValue) : String(habit.targetValue ?? 1));
    const numeric = overrideValue ?? Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) return;

    await upsertHabitLog(habit.id, {
      localDate,
      completedValue: numeric,
    });
  };

  const renderStateGlyph = (state: MonthlyCalendarDayVisualState) => {
    switch (state) {
      case 'completed':
        return <Check className="h-3.5 w-3.5 text-[#96D2C5] stroke-[2.6]" />;
      case 'partial':
        return <PartialHalfIcon />;
      case 'missed':
        return <X className="h-3.5 w-3.5 text-[#E06C75] stroke-[2.5]" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-[#A9C8E9]" />;
      case 'unscheduled':
      case 'unverified':
        return <Minus className="h-3 w-3 text-[#737378]" />;
      case 'future':
        return null;
    }
  };

  const getCircleBg = (state: MonthlyCalendarDayVisualState) => {
    switch (state) {
      case 'completed':
        return 'bg-[#96D2C5]/[0.12] text-[#F2F2F2]';
      case 'partial':
        return 'bg-[#F19A50]/[0.12] text-[#F2F2F2]';
      case 'missed':
        return 'bg-[#E06C75]/[0.12] text-[#F2F2F2]';
      case 'pending':
        return 'border border-[#A9C8E9]/40 bg-[#A9C8E9]/[0.08] text-[#F2F2F2]';
      case 'unscheduled':
      case 'unverified':
        return 'bg-transparent text-[#A3A3A8]';
      case 'future':
        return 'bg-transparent text-[#737378] opacity-60';
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card tone="surface" padding="lg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-[#F2F2F2]">
              Sign in to view your Habit Calendar
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Inspect your real monthly completion patterns, streaks, and daily habit logs in your saved local timezone.
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
        title="Could not load Habit Calendar"
        description={error}
        onRetry={() => {
          void refreshHabits();
          void ensureLogRangeLoaded(calendarData.from, calendarData.to, { force: true });
        }}
      />
    );
  }

  if (isLoading && habits.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <EmptyState
        title="No habits to display yet"
        description="Create your first habit to start tracking daily completions, partial progress, and monthly calendar streaks."
        actionLabel="Create Habit"
        onAction={openCreateHabit}
      />
    );
  }

  const leadingBlanks = Array.from({ length: calendarData.startWeekday });
  const isSelectedDateBackfillable = selectedDay.localDate <= todayLocalDate;

  return (
    <div className="space-y-5">
      {/* Streak & Monthly Rate Banner */}
      <Card tone="surface" padding="lg">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F19A50]/15 text-[#F19A50]">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold tracking-tight text-[#F2F2F2] tabular-nums">
                  {streakSummary.primaryNumber}
                </span>
                <span className="text-sm font-medium text-[#A3A3A8]">
                  {streakSummary.primaryUnit}
                </span>
              </div>
              <div className="text-sm text-[#A3A3A8]">{streakSummary.detailLine}</div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex items-baseline gap-2 sm:justify-end">
              <span className="font-mono text-2xl font-semibold text-[#F2F2F2] tabular-nums">
                {calendarData.monthlyRatePercent !== null
                  ? `${calendarData.monthlyRatePercent}%`
                  : '—'}
              </span>
              <span className="font-mono text-xs text-[#737378] tabular-nums">
                {calendarData.completedUnits}/{calendarData.scheduledOrLoggedUnits}
              </span>
            </div>
            <div className="text-xs text-[#A3A3A8]">
              {calendarData.label} adherence
              {calendarData.partialUnits > 0
                ? ` · ${calendarData.partialUnits} partial`
                : ''}
            </div>
          </div>
        </div>
      </Card>

      {/* Calendar + Selected Day Breakdown Split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card tone="surface" padding="lg">
          {/* Month Header + Scope Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                aria-label="Previous month"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#E59585] transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="min-w-[155px] text-center text-lg font-semibold text-[#F2F2F2]">
                {calendarData.label}
              </h3>
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                aria-label="Next month"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#A3A3A8] transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <Button variant="ghost" size="sm" onClick={handleJumpToday}>
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="calendar-habit-filter" className="text-xs text-[#A3A3A8]">
                Scope:
              </label>
              <select
                id="calendar-habit-filter"
                value={selectedHabitId === 'all' ? 'all' : String(selectedHabitId)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedHabitId(val === 'all' ? 'all' : Number(val));
                }}
                className="h-9 max-w-[210px] rounded-xl border border-white/[0.08] bg-[#1A1A1A] px-3 text-xs font-medium text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]"
              >
                <option value="all">All habits ({habits.filter((h) => h.status === 'active').length} active)</option>
                {habits.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.name}
                    {habit.status === 'archived' ? ' (Archived)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs font-medium text-[#737378]">
                {WEEKDAYS.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {leadingBlanks.map((_, idx) => (
                  <div key={`blank-${idx}`} aria-hidden="true" className="mx-auto h-12 w-12" />
                ))}
                {calendarData.days.map((cell) => {
                  const isSelected = cell.localDate === selectedDay.localDate;
                  const isToday = cell.localDate === todayLocalDate;
                  return (
                    <button
                      key={cell.localDate}
                      type="button"
                      onClick={() => setSelectedLocalDate(cell.localDate)}
                      aria-label={`${formatShortCalendarLabel(cell.localDate)}: ${cell.summary}`}
                      className={cn(
                        'mx-auto flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                        getCircleBg(cell.state),
                        isToday && !isSelected && 'ring-1 ring-[#96D2C5]/60',
                        isSelected && 'ring-2 ring-[#E59585] bg-[#292929]'
                      )}
                    >
                      <span className="font-mono text-xs font-semibold tabular-nums leading-none">
                        {cell.day}
                      </span>
                      <span className="flex h-3.5 items-center justify-center">
                        {renderStateGlyph(cell.state)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 text-xs text-[#A3A3A8]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-[#96D2C5]" /> Completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PartialHalfIcon /> Partial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#A9C8E9]" /> Open today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="h-3.5 w-3.5 text-[#E06C75]" /> Missed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5 text-[#737378]" /> Rest / unrecorded
            </span>
          </div>

          {calendarData.hasUnverifiedPriorSchedule && (
            <p className="mt-3 text-[11px] leading-relaxed text-[#737378]">
              Note: A habit schedule was edited after creation ({calendarData.scheduleEditDates.join(', ')}). Unlogged dates before that schedule change are displayed neutrally rather than assumed missed.
            </p>
          )}
        </Card>

        {/* Selected Day Detail & Inline Logging Panel */}
        <Card tone="surface" padding="lg" className="flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#A3A3A8]">
                  Selected Day ({effectiveTimezone})
                </p>
                {selectedDay.localDate === todayLocalDate && (
                  <span className="font-mono text-[11px] font-semibold text-[#96D2C5]">
                    Today
                  </span>
                )}
              </div>
              <h4 className="mt-1 font-mono text-xl font-bold text-[#F2F2F2] tabular-nums">
                {formatShortCalendarLabel(selectedDay.localDate)}
              </h4>
              <p className="mt-1.5 text-sm text-[#A3A3A8]">{selectedDay.summary}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-white/[0.07] py-3 text-center">
              <div>
                <div className="font-mono text-base font-bold text-[#F2F2F2] tabular-nums">
                  {selectedDay.scheduledOrLoggedCount}
                </div>
                <div className="text-[11px] text-[#737378]">Scheduled</div>
              </div>
              <div>
                <div className="font-mono text-base font-bold text-[#96D2C5] tabular-nums">
                  {selectedDay.completedCount}
                </div>
                <div className="text-[11px] text-[#737378]">Completed</div>
              </div>
              <div>
                <div className="font-mono text-base font-bold text-[#F19A50] tabular-nums">
                  {selectedDay.partialCount}
                </div>
                <div className="text-[11px] text-[#737378]">Partial</div>
              </div>
            </div>

            {/* Per-habit status & interactive backfill */}
            <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
              {selectedDay.habitItems.length === 0 ? (
                <p className="text-xs text-[#737378]">
                  No active habits or recorded logs for this month.
                </p>
              ) : (
                selectedDay.habitItems.map((item) => {
                  const statusMeta = getItemStatusMeta(item);
                  const draftKey = `${item.habit.id}:${selectedDay.localDate}`;
                  const draftVal =
                    measurableDrafts[draftKey] ??
                    (item.log
                      ? String(item.log.completedValue)
                      : String(item.habit.targetValue ?? 1));
                  const canLog = isSelectedDateBackfillable && item.canMutateOnDate;

                  return (
                    <div
                      key={item.habit.id}
                      className="space-y-2 rounded-xl border border-white/[0.07] bg-[#1B1B1B] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[#F2F2F2]">
                            {item.habit.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#737378]">
                            <span className={statusMeta.toneClass}>{statusMeta.label}</span>
                            {item.log && item.habit.trackingType === 'measurable' && (
                              <span className="font-mono text-[#A3A3A8]">
                                {' '}
                                · {formatLogValueLabel(item.log, item.habit.unit, item.habit.trackingType)}
                              </span>
                            )}
                            {!item.log && item.habit.trackingType === 'measurable' && (
                              <span className="font-mono text-[#737378]">
                                {' '}
                                · {formatHabitTargetLabel(item.habit)}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.habit.trackingType === 'boolean' && canLog && (
                          <div className="shrink-0">
                            {item.log ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<RotateCcw className="h-3 w-3" />}
                                disabled={isMutating}
                                onClick={() =>
                                  void handleToggleBooleanForDay(
                                    item.habit,
                                    selectedDay.localDate,
                                    true
                                  )
                                }
                              >
                                Undo
                              </Button>
                            ) : (
                              <Button
                                variant="mint"
                                size="sm"
                                leadingIcon={<Check className="h-3 w-3" />}
                                disabled={isMutating}
                                onClick={() =>
                                  void handleToggleBooleanForDay(
                                    item.habit,
                                    selectedDay.localDate,
                                    false
                                  )
                                }
                              >
                                Check off
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {item.habit.trackingType === 'measurable' && canLog && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`${item.habit.name} value for ${selectedDay.localDate}`}
                            value={draftVal}
                            onChange={(e) =>
                              setMeasurableDrafts((prev) => ({
                                ...prev,
                                [draftKey]: e.target.value,
                              }))
                            }
                            className="h-7 w-20 rounded-lg border border-white/[0.08] bg-[#151515] px-2 font-mono text-xs text-[#F2F2F2] focus:outline-none focus:ring-1 focus:ring-[#96D2C5]"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isMutating}
                            onClick={() =>
                              void handleSaveMeasurableForDay(item.habit, selectedDay.localDate)
                            }
                          >
                            Save
                          </Button>
                          {item.kind !== 'completed' && item.habit.targetValue !== null && (
                            <Button
                              variant="mint"
                              size="sm"
                              disabled={isMutating}
                              onClick={() =>
                                void handleSaveMeasurableForDay(
                                  item.habit,
                                  selectedDay.localDate,
                                  item.habit.targetValue ?? 1
                                )
                              }
                            >
                              Complete
                            </Button>
                          )}
                          {item.log && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isMutating}
                              onClick={() =>
                                void undoHabitLog(item.habit.id, selectedDay.localDate)
                              }
                            >
                              Undo
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {!isSelectedDateBackfillable && (
            <p className="border-t border-white/[0.07] pt-3 text-xs text-[#737378]">
              Future dates cannot be logged ahead of {todayLocalDate} ({effectiveTimezone}).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
