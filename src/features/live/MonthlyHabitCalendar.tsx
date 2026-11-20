import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, Minus, X } from 'lucide-react';
import { useMonthlyCalendarData } from '../../hooks/useMarlyData';
import { Card } from '../../components/ui';
import { cn } from '../../lib/cn';
import { HabitCalendarDayState } from '../../types/marly';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PartialHalfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="#F19A50" strokeWidth="1.6" />
      <path d="M8 2A6 6 0 0 0 8 14V2Z" fill="#F19A50" />
    </svg>
  );
}

export function MonthlyHabitCalendar() {
  const { months, defaultMonthIndex, defaultSelectedDay } = useMonthlyCalendarData();
  const [monthIdx, setMonthIdx] = useState(defaultMonthIndex);
  const [selectedDayNum, setSelectedDayNum] = useState<number>(defaultSelectedDay);

  const activeMonth = months[monthIdx];
  const selectedDay =
    activeMonth.days.find((d) => d.day === selectedDayNum) ?? activeMonth.days[0];

  const handleChangeMonth = (nextIdx: number) => {
    setMonthIdx(nextIdx);
    const nextMonth = months[nextIdx];
    const maxDay = nextMonth.days.length;
    setSelectedDayNum((prev) => Math.min(prev, maxDay));
  };

  const renderStateGlyph = (state: HabitCalendarDayState) => {
    switch (state) {
      case 'completed':
        return <Check className="h-3.5 w-3.5 text-[#96D2C5] stroke-[2.6]" />;
      case 'partial':
        return <PartialHalfIcon />;
      case 'missed':
        return <X className="h-3.5 w-3.5 text-[#E06C75] stroke-[2.5]" />;
      case 'unscheduled':
        return <Minus className="h-3 w-3 text-[#737378]" />;
      case 'future':
        return null;
    }
  };

  const getCircleBg = (state: HabitCalendarDayState) => {
    switch (state) {
      case 'completed':
        return 'bg-[#96D2C5]/[0.12] text-[#F2F2F2]';
      case 'partial':
        return 'bg-[#F19A50]/[0.12] text-[#F2F2F2]';
      case 'missed':
        return 'bg-[#E06C75]/[0.12] text-[#F2F2F2]';
      case 'unscheduled':
      case 'future':
        return 'bg-transparent text-[#A3A3A8]';
    }
  };

  const leadingBlanks = Array.from({ length: activeMonth.startWeekday });

  return (
    <div className="space-y-5">
      {/* Streak Summary Banner (Reference 2 inspired) */}
      <Card tone="surface" padding="lg">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F19A50]/15 text-[#F19A50]">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="font-mono text-3xl font-bold tracking-tight text-[#F2F2F2] tabular-nums">
                {activeMonth.streakDays}
              </div>
              <div className="text-sm text-[#A3A3A8]">
                days streak · longest {activeMonth.longestStreakDays} days
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="font-mono text-2xl font-semibold text-[#F2F2F2] tabular-nums">
              {activeMonth.monthlyRateLabel}
            </div>
            <div className="text-xs text-[#A3A3A8]">this month (demo schedule)</div>
          </div>
        </div>
      </Card>

      {/* Calendar + Day Breakdown Split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card tone="surface" padding="lg">
          {/* Month Header */}
          <div className="flex items-center justify-between pb-5">
            <button
              type="button"
              onClick={() => handleChangeMonth(Math.max(0, monthIdx - 1))}
              disabled={monthIdx === 0}
              aria-label="Previous demo month"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#E59585] transition-colors hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-[#F2F2F2]">{activeMonth.label}</h3>

            <button
              type="button"
              onClick={() => handleChangeMonth(Math.min(months.length - 1, monthIdx + 1))}
              disabled={monthIdx === months.length - 1}
              aria-label="Next demo month"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#A3A3A8] transition-colors hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs font-medium text-[#737378]">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Grid with accurate weekday offset and month length */}
          <div className="grid grid-cols-7 gap-2">
            {leadingBlanks.map((_, idx) => (
              <div key={`blank-${idx}`} aria-hidden="true" className="h-12 w-12 mx-auto" />
            ))}
            {activeMonth.days.map((cell) => {
              const isSelected = cell.day === selectedDay.day;
              return (
                <button
                  key={cell.day}
                  type="button"
                  onClick={() => setSelectedDayNum(cell.day)}
                  aria-label={`${activeMonth.label} ${cell.day}: ${cell.summary}`}
                  className={cn(
                    'mx-auto flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                    getCircleBg(cell.state),
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

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 text-xs text-[#A3A3A8]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-[#96D2C5]" /> Completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PartialHalfIcon /> Partial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="h-3.5 w-3.5 text-[#E06C75]" /> Missed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Minus className="h-3.5 w-3.5 text-[#737378]" /> Unscheduled (no penalty)
            </span>
          </div>
        </Card>

        {/* Selected Day Detail Panel */}
        <Card tone="surface" padding="lg" className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-[#A3A3A8]">Selected Day Preview</p>
            <h4 className="mt-1 font-mono text-xl font-bold text-[#F2F2F2] tabular-nums">
              {activeMonth.shortMonth} {selectedDay.day}, {activeMonth.year}
            </h4>
            <p className="mt-2 text-sm text-[#A3A3A8]">{selectedDay.summary}</p>

            <div className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A3A3A8]">Scheduled habits</span>
                <span className="font-mono font-semibold text-[#F2F2F2] tabular-nums">
                  {selectedDay.scheduledCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A3A3A8]">Completed</span>
                <span className="font-mono font-semibold text-[#96D2C5] tabular-nums">
                  {selectedDay.completedCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A3A3A8]">Day status</span>
                <span className="font-mono capitalize text-[#F2F2F2]">{selectedDay.state}</span>
              </div>
            </div>
          </div>

          <p className="mt-6 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-[#737378]">
            In Phase 7, clicking any date queries historical <code className="font-mono text-[#A3A3A8]">habit_logs</code> in your local timezone so schedule edits never rewrite past records.
          </p>
        </Card>
      </div>
    </div>
  );
}
