import React from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { useHabitsMomentumData } from '../../hooks/useMarlyData';
import { Card, Checkbox, IconButton } from '../../components/ui';

interface HabitMomentumColumnProps {
  onNavigate: (path: string) => void;
}

export function HabitMomentumColumn({ onNavigate }: HabitMomentumColumnProps) {
  const { habits, toggleHabit, searchQuery, sevenDayRates } = useHabitsMomentumData();

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleHabits = normalizedQuery
    ? habits.filter(
        (h) =>
          h.name.toLowerCase().includes(normalizedQuery) ||
          h.category.toLowerCase().includes(normalizedQuery)
      )
    : habits;

  const completedCount = habits.filter((h) => h.completedToday).length;
  const todayPercent = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  // Replace the last bar dynamically with today's live demo completion percentage
  const bars = sevenDayRates.map((bar, idx) =>
    idx === sevenDayRates.length - 1 ? { ...bar, percent: todayPercent } : bar
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Mint Card: Daily Habits & Live Anchor */}
      <Card tone="mint" padding="md" className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#151515]/70">
              Live Momentum
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#151515]">
              Daily Habits
            </h2>
            <p className="mt-1 text-xs font-medium text-[#151515]/75 font-mono tabular-nums">
              {completedCount}/{habits.length} completed today
            </p>
          </div>
          <IconButton
            variant="on-accent"
            label="Open Live Habit Tracker"
            onClick={() => onNavigate('/live/matrix')}
          >
            <ArrowRight className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#151515]/10 pt-3.5">
          {visibleHabits.length === 0 ? (
            <p className="text-xs text-[#151515]/70">No habits match "{searchQuery}".</p>
          ) : (
            visibleHabits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#151515]/[0.07] px-3 py-1.5"
              >
                <Checkbox
                  checked={habit.completedToday}
                  onChange={() => toggleHabit(habit.id)}
                  tone="dark-accent"
                  size="sm"
                  ariaLabel={`Toggle ${habit.name}`}
                  label={habit.name}
                />
                <span className="font-mono text-[11px] font-medium text-[#151515]/70 tabular-nums shrink-0">
                  {habit.targetLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Blue Card: Streak & Monthly Calendar Shortcut */}
      <Card tone="blue" padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#151515]/10 text-[#151515]">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#151515] font-mono tabular-nums">
                7 Day Streak
              </h3>
              <p className="mt-0.5 text-xs font-medium text-[#151515]/75">
                72% monthly consistency · View calendar
              </p>
            </div>
          </div>
          <IconButton
            variant="on-accent"
            label="Open Monthly Habit Calendar"
            onClick={() => onNavigate('/live/calendar')}
          >
            <ArrowRight className="h-4 w-4" />
          </IconButton>
        </div>
      </Card>

      {/* Dark Surface Card: 7-Day Habit Success Rate */}
      <Card tone="surface" padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-3xl font-bold tracking-tight text-[#F2F2F2] tabular-nums">
              {Math.round(
                bars.reduce((acc, item) => acc + item.percent, 0) / bars.length
              )}
              %
            </div>
            <p className="mt-1 text-xs text-[#A3A3A8]">7-day habit consistency (demo)</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/live/heatmap')}
            className="text-xs font-medium text-[#F19A50] hover:underline cursor-pointer whitespace-nowrap"
          >
            Activity heatmap
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 items-end gap-2 pt-2">
          {bars.map((bar, index) => {
            const isToday = index === bars.length - 1;
            return (
              <div key={bar.day} className="flex flex-col items-center gap-1.5">
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
