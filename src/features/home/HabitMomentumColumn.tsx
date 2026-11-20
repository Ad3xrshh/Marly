import React, { useState } from 'react';
import { ArrowRight, Check, Flame, LogIn, Plus } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  ErrorState,
  IconButton,
  Skeleton,
} from '../../components/ui';
import { useHabitsMomentumData } from '../../hooks/useMarlyData';
import { computeLogProgressPercent } from '../../lib/habitSchedule';
import { formatHabitTargetLabel, type Habit } from '../../types/habit';

interface HabitMomentumColumnProps {
  onNavigate: (path: string) => void;
}

export function HabitMomentumColumn({ onNavigate }: HabitMomentumColumnProps) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    allActiveHabits,
    todayLocalDate,
    isLoading,
    isMutating,
    error,
    searchQuery,
    sevenDayRates,
    topDailyStreak,
    topWeeklyStreak,
    refreshHabits,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  } = useHabitsMomentumData();

  const [measurableDrafts, setMeasurableDrafts] = useState<Record<number, string>>({});

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleHabits = normalizedQuery
    ? habits.filter(
        (h) =>
          h.name.toLowerCase().includes(normalizedQuery) ||
          h.category.toLowerCase().includes(normalizedQuery)
      )
    : habits;

  const completedCount = habits.filter(
    (h) => h.todayLog?.statusSnapshot === 'completed'
  ).length;
  const todayPercent =
    habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  const avgSevenDayRate =
    sevenDayRates.length > 0
      ? Math.round(
          sevenDayRates.reduce((acc, item) => acc + item.percent, 0) /
            sevenDayRates.length
        )
      : 0;

  const handleToggleBoolean = async (habit: Habit) => {
    if (habit.todayLog) {
      await undoHabitLog(habit.id, todayLocalDate);
    } else {
      await upsertHabitLog(habit.id, { localDate: todayLocalDate });
    }
  };

  const handleSaveMeasurable = async (habit: Habit, valueOverride?: number) => {
    const raw =
      measurableDrafts[habit.id] ??
      (habit.todayLog
        ? String(habit.todayLog.completedValue)
        : String(habit.targetValue ?? 1));
    const numeric = valueOverride ?? Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) return;

    await upsertHabitLog(habit.id, {
      localDate: todayLocalDate,
      completedValue: numeric,
    });
  };

  const streakHeadline = !isAuthenticated
    ? 'Habit Streaks'
    : topDailyStreak > 0
      ? `${topDailyStreak} ${topDailyStreak === 1 ? 'Day' : 'Days'} Streak`
      : topWeeklyStreak > 0
        ? `${topWeeklyStreak} ${topWeeklyStreak === 1 ? 'Week' : 'Weeks'} Streak`
        : '0 Day Streak';

  const streakSubtitle = !isAuthenticated
    ? 'Sign in to track daily and weekly streaks'
    : allActiveHabits.length === 0
      ? 'Create a habit in LIVE to start building momentum'
      : `${todayPercent}% completed today · Manage habits`;

  return (
    <div className="flex flex-col gap-5">
      {/* Mint Card: Daily Habits & Live Anchor */}
      <Card tone="mint" padding="md" className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#151515]/70">Live Momentum</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#151515]">
              Daily Habits
            </h2>
            <p className="mt-1 font-mono text-xs font-medium text-[#151515]/75 tabular-nums">
              {isAuthenticated
                ? `${completedCount}/${habits.length} completed today`
                : 'Scheduled habits for today'}
            </p>
          </div>
          <IconButton
            variant="on-accent"
            label="Open Live Habits"
            onClick={() => onNavigate('/live/habits')}
          >
            <ArrowRight className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#151515]/10 pt-3.5">
          {isAuthLoading || (isAuthenticated && isLoading) ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full bg-[#151515]/15" />
              <Skeleton className="h-10 w-full bg-[#151515]/15" />
              <Skeleton className="h-10 w-4/5 bg-[#151515]/15" />
            </div>
          ) : !isAuthenticated ? (
            <div className="rounded-xl bg-[#151515]/[0.08] p-3.5">
              <p className="text-xs font-semibold text-[#151515]">
                Sign in to track your real habits
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#151515]/75">
                Check off scheduled habits, log measurable targets, and preserve timezone-safe streaks.
              </p>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<LogIn className="h-3.5 w-3.5" />}
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="mt-3 border-none bg-[#151515] text-[#F2F2F2] hover:bg-[#242424]"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              </Button>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-[#151515] p-3">
              <ErrorState
                title="Could not load habits"
                description={error}
                onRetry={() => void refreshHabits()}
              />
            </div>
          ) : visibleHabits.length === 0 ? (
            <div className="rounded-xl bg-[#151515]/[0.08] p-3.5 text-center">
              <p className="text-xs font-semibold text-[#151515]">
                {searchQuery
                  ? `No scheduled habits match "${searchQuery}".`
                  : allActiveHabits.length === 0
                    ? 'No habits created yet'
                    : 'No habits scheduled for today'}
              </p>
              {!searchQuery && (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={openCreateHabit}
                  className="mt-2.5 border-none bg-[#151515] text-[#F2F2F2] hover:bg-[#242424]"
                >
                  New Habit
                </Button>
              )}
            </div>
          ) : (
            visibleHabits.map((habit) => {
              const completed = habit.todayLog?.statusSnapshot === 'completed';
              const partial = habit.todayLog?.statusSnapshot === 'partial';

              if (habit.trackingType === 'boolean') {
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[#151515]/[0.07] px-3 py-1.5"
                  >
                    <Checkbox
                      checked={completed}
                      onChange={() => void handleToggleBoolean(habit)}
                      tone="dark-accent"
                      size="sm"
                      disabled={isMutating}
                      ariaLabel={`Toggle ${habit.name}`}
                      label={habit.name}
                    />
                    <span className="shrink-0 font-mono text-[11px] font-medium text-[#151515]/70 tabular-nums">
                      {habit.streak.currentStreak}
                      {habit.streak.streakUnit === 'weeks' ? 'w' : 'd'}
                    </span>
                  </div>
                );
              }

              const targetVal = habit.targetValue ?? 1;
              const currentVal = habit.todayLog?.completedValue ?? 0;
              const percent = habit.todayLog
                ? computeLogProgressPercent(
                    currentVal,
                    habit.todayLog.targetSnapshot ?? targetVal
                  )
                : 0;
              const draft =
                measurableDrafts[habit.id] ??
                (habit.todayLog ? String(habit.todayLog.completedValue) : String(targetVal));

              return (
                <div
                  key={habit.id}
                  className="space-y-1.5 rounded-xl bg-[#151515]/[0.07] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-[#151515]">
                      {habit.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-medium text-[#151515]/80 tabular-nums">
                      {currentVal}/{habit.todayLog?.targetSnapshot ?? targetVal}
                      {habit.unit ? ` ${habit.unit}` : ''} ({percent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`${habit.name} value`}
                      value={draft}
                      onChange={(e) =>
                        setMeasurableDrafts((prev) => ({
                          ...prev,
                          [habit.id]: e.target.value,
                        }))
                      }
                      className="h-7 w-16 rounded-md border border-[#151515]/20 bg-[#151515]/10 px-2 font-mono text-xs text-[#151515] focus:outline-none focus:ring-1 focus:ring-[#151515]"
                    />
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleSaveMeasurable(habit)}
                      className="h-7 rounded-md bg-[#151515]/15 px-2 text-[11px] font-semibold text-[#151515] hover:bg-[#151515]/25 cursor-pointer"
                    >
                      Save
                    </button>
                    {!completed ? (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => void handleSaveMeasurable(habit, targetVal)}
                        title={`Complete (${formatHabitTargetLabel(habit)})`}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-[#151515] px-2 text-[11px] font-semibold text-[#F2F2F2] hover:bg-[#242424] cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Done</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => void undoHabitLog(habit.id, todayLocalDate)}
                        className="h-7 rounded-md px-2 text-[11px] font-medium text-[#151515]/75 hover:bg-[#151515]/15 cursor-pointer"
                      >
                        Undo
                      </button>
                    )}
                    {partial && (
                      <span className="ml-auto font-mono text-[10px] font-medium text-[#151515]/70">
                        Partial
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Blue Card: Streak & LIVE Habits Shortcut */}
      <Card tone="blue" padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#151515]/10 text-[#151515]">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-[#151515] tabular-nums">
                {streakHeadline}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-[#151515]/75">
                {streakSubtitle}
              </p>
            </div>
          </div>
          <IconButton
            variant="on-accent"
            label="Open Live Habits"
            onClick={() => onNavigate('/live/habits')}
          >
            <ArrowRight className="h-4 w-4" />
          </IconButton>
        </div>
      </Card>

      {/* Dark Surface Card: 7-Day Habit Consistency */}
      <Card tone="surface" padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-[#F2F2F2] tabular-nums">
              {avgSevenDayRate}%
            </div>
            <p className="mt-1 text-xs text-[#A3A3A8]">
              {isAuthenticated
                ? '7-day scheduled habit consistency'
                : '7-day habit consistency (demo)'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/live/habits')}
            className="cursor-pointer whitespace-nowrap text-xs font-medium text-[#F19A50] hover:underline"
          >
            Manage habits
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 items-end gap-2 pt-2">
          {sevenDayRates.map((bar, index) => {
            const isToday = index === sevenDayRates.length - 1;
            return (
              <div
                key={`${bar.day}-${index}`}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="font-mono text-[10px] text-[#737378] tabular-nums">
                  {bar.percent}%
                </span>
                <div className="relative flex h-24 w-full items-end overflow-hidden rounded-lg bg-[#292929]">
                  <div
                    className={
                      isToday
                        ? 'w-full rounded-lg bg-[#96D2C5] transition-all duration-300'
                        : 'w-full rounded-lg bg-[#68686E] transition-all duration-300'
                    }
                    style={{
                      height: `${Math.max(8, bar.percent)}%`,
                      backgroundImage: !isToday
                        ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 3px, transparent 3px, transparent 6px)'
                        : undefined,
                    }}
                  />
                </div>
                <span
                  className={
                    isToday
                      ? 'font-mono text-[10px] font-semibold text-[#F2F2F2]'
                      : 'font-mono text-[10px] text-[#737378]'
                  }
                >
                  {bar.day}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
