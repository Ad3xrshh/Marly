import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LogIn } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { useActivityHeatmapData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import { formatCalendarDate, parseCalendarDate } from '../../lib/habitSchedule';
import {
  buildYearlyHeatmapViewData,
  type HeatmapCellKind,
  type YearlyHeatmapCell,
} from '../../lib/habitVisualizations';
import { formatLogValueLabel } from '../../types/habit';

const FULL_COMPLETION_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#292929]',
  1: 'bg-[#6B4423]',
  2: 'bg-[#A3632C]',
  3: 'bg-[#D88138]',
  4: 'bg-[#F19A50]',
};

function getHeatmapCellClass(cell: YearlyHeatmapCell): string {
  switch (cell.kind) {
    case 'future':
      return 'bg-white/[0.02] border border-white/[0.04] opacity-45';
    case 'unscheduled':
    case 'unverified':
      return 'bg-transparent border border-white/[0.12]';
    case 'missed_zero':
      return FULL_COMPLETION_COLORS[0];
    case 'partial_only':
      return 'bg-[#6B4423]/40 border border-[#F19A50]/85';
    case 'completed':
      return FULL_COMPLETION_COLORS[cell.level ?? 1];
  }
}

function getKindBadgeText(kind: string): { label: string; colorClass: string } {
  switch (kind) {
    case 'completed':
      return { label: 'Completed', colorClass: 'text-[#96D2C5]' };
    case 'partial':
      return { label: 'Partial', colorClass: 'text-[#F19A50]' };
    case 'missed':
      return { label: 'Missed', colorClass: 'text-[#E06C75]' };
    case 'pending':
      return { label: 'Open today', colorClass: 'text-[#A9C8E9]' };
    case 'flexible_rest':
      return { label: 'Flexible week', colorClass: 'text-[#A3A3A8]' };
    case 'unscheduled':
      return { label: 'Unscheduled', colorClass: 'text-[#737378]' };
    case 'unverified_prior_schedule':
      return { label: 'Unrecorded prior schedule', colorClass: 'text-[#737378]' };
    case 'inactive':
      return { label: 'Inactive', colorClass: 'text-[#737378]' };
    default:
      return { label: 'Upcoming', colorClass: 'text-[#737378]' };
  }
}

function getCellKindHeadline(kind: HeatmapCellKind): string {
  switch (kind) {
    case 'completed':
      return 'Full completions recorded';
    case 'partial_only':
      return 'Partial progress only (excluded from full-completion intensity)';
    case 'missed_zero':
      return '0% of scheduled habits completed';
    case 'unscheduled':
      return 'Rest / unscheduled day';
    case 'unverified':
      return 'Prior schedule unrecorded';
    case 'future':
      return 'Upcoming date';
  }
}

export function ActivityHeatmap() {
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
    error,
    refreshHabits,
    ensureLogRangeLoaded,
    openCreateHabit,
  } = useActivityHeatmapData();

  const currentLocalYear = useMemo(
    () => parseCalendarDate(todayLocalDate).year,
    [todayLocalDate]
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentLocalYear);
  const [hoveredCell, setHoveredCell] = useState<YearlyHeatmapCell | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayLocalDate);
  const lastSyncedTodayRef = React.useRef(todayLocalDate);

  useEffect(() => {
    if (lastSyncedTodayRef.current === todayLocalDate) return;
    const prevToday = lastSyncedTodayRef.current;
    const prevYear = parseCalendarDate(prevToday).year;
    lastSyncedTodayRef.current = todayLocalDate;
    setSelectedYear((curr) => (curr === prevYear ? currentLocalYear : curr));
    setSelectedDate((curr) => (curr === prevToday ? todayLocalDate : curr));
  }, [todayLocalDate, currentLocalYear]);

  const yearFrom = formatCalendarDate(selectedYear, 1, 1);
  const yearTo = formatCalendarDate(selectedYear, 12, 31);

  useEffect(() => {
    if (!isAuthenticated) return;
    void ensureLogRangeLoaded(yearFrom, yearTo);
  }, [isAuthenticated, yearFrom, yearTo, ensureLogRangeLoaded]);

  const heatmapData = useMemo(
    () =>
      buildYearlyHeatmapViewData({
        year: selectedYear,
        habits,
        logsByKey,
        todayLocalDate,
        effectiveTimezone,
      }),
    [selectedYear, habits, logsByKey, todayLocalDate, effectiveTimezone]
  );

  // Selected cell for detailed inspection panel
  const inspectedCell = useMemo(() => {
    for (const week of heatmapData.weeks) {
      for (const cell of week) {
        if (cell && cell.localDate === selectedDate) {
          return cell;
        }
      }
    }
    return hoveredCell;
  }, [heatmapData.weeks, selectedDate, hoveredCell]);

  const activeHeadlineCell = hoveredCell ?? inspectedCell;

  const streakMetric = useMemo(() => {
    const activeHabits = habits.filter((h) => h.status === 'active');
    const bestDaily = activeHabits
      .filter((h) => h.streak.streakUnit === 'days')
      .reduce((max, h) => Math.max(max, h.streak.currentStreak), 0);
    const bestWeekly = activeHabits
      .filter((h) => h.streak.streakUnit === 'weeks')
      .reduce((max, h) => Math.max(max, h.streak.currentStreak), 0);

    if (bestDaily > 0 || activeHabits.some((h) => h.streak.streakUnit === 'days')) {
      return {
        value: bestDaily,
        unit: 'Days',
        subtitle:
          bestWeekly > 0
            ? `Active daily streak · ${bestWeekly}w weekly`
            : 'Top active daily streak',
      };
    }
    return {
      value: bestWeekly,
      unit: 'Weeks',
      subtitle: 'Top active weekly streak',
    };
  }, [habits]);

  if (isAuthLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
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
              Sign in to view your Yearly Activity Heatmap
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Explore calendar-aligned yearly completion intensity, partial-day distinction, and day-by-day history in your local timezone.
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
        title="Could not load Activity Heatmap"
        description={error}
        onRetry={() => {
          void refreshHabits();
          void ensureLogRangeLoaded(yearFrom, yearTo, { force: true });
        }}
      />
    );
  }

  if (isLoading && habits.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <EmptyState
        title="No activity history yet"
        description="Create habits and check them off to populate your yearly contribution heatmap and trend summaries."
        actionLabel="Create Habit"
        onAction={openCreateHabit}
      />
    );
  }

  const maxTrend = Math.max(1, ...heatmapData.monthlyTrend.map((m) => m.completions));
  const maxWeekdayCount = Math.max(
    1,
    ...heatmapData.weekdayFrequency.map((d) => d.completions)
  );

  const svgWidth = 360;
  const svgHeight = 96;
  const points = heatmapData.monthlyTrend.map((item, i) => {
    const x = (i / (heatmapData.monthlyTrend.length - 1)) * svgWidth;
    const y = svgHeight - 10 - (item.completions / maxTrend) * (svgHeight - 24);
    return { x, y };
  });
  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return (
    <div className="space-y-5">
      {/* Yearly Contribution Heatmap */}
      <Card tone="surface" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#F2F2F2]">Activity History</h3>
            <p className="text-xs text-[#A3A3A8]">
              {activeHeadlineCell
                ? `${activeHeadlineCell.dateLabel} · ${activeHeadlineCell.summary}`
                : 'Proportion of scheduled habits fully completed each day (hover or click a day)'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setHoveredCell(null);
                setSelectedYear((y) => {
                  const next = y - 1;
                  setSelectedDate(
                    next === currentLocalYear
                      ? todayLocalDate
                      : formatCalendarDate(next, 12, 31)
                  );
                  return next;
                });
              }}
              aria-label="Previous year"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#E59585] transition-colors hover:bg-white/[0.06] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[84px] text-center font-mono text-xs font-semibold text-[#F2F2F2] tabular-nums">
              {selectedYear}
            </span>
            <button
              type="button"
              disabled={selectedYear >= currentLocalYear}
              onClick={() => {
                setHoveredCell(null);
                setSelectedYear((y) => {
                  const next = Math.min(currentLocalYear, y + 1);
                  setSelectedDate(
                    next === currentLocalYear
                      ? todayLocalDate
                      : formatCalendarDate(next, 12, 31)
                  );
                  return next;
                });
              }}
              aria-label="Next year"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#A3A3A8] transition-colors hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {selectedYear !== currentLocalYear && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHoveredCell(null);
                  setSelectedYear(currentLocalYear);
                  setSelectedDate(todayLocalDate);
                }}
              >
                Current year
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[760px]">
              {/* Month markers positioned over true week start columns */}
              <div
                className="mb-1.5 grid pl-8 text-[11px] text-[#737378]"
                style={{
                  gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))`,
                }}
              >
                {heatmapData.weeks.map((_, wIdx) => {
                  const marker = heatmapData.monthMarkers.find(
                    (m) => m.weekIndex === wIdx
                  );
                  return (
                    <span key={`m-${wIdx}`} className="truncate leading-none">
                      {marker ? marker.label : ''}
                    </span>
                  );
                })}
              </div>

              {/* Weekday hint column + Sun–Sat week columns */}
              <div className="flex items-stretch gap-2">
                <div className="grid w-6 shrink-0 grid-rows-7 gap-[3px] text-[10px] text-[#737378] font-mono">
                  <span className="flex items-center">S</span>
                  <span className="flex items-center">M</span>
                  <span aria-hidden="true" />
                  <span className="flex items-center">W</span>
                  <span aria-hidden="true" />
                  <span className="flex items-center">F</span>
                  <span aria-hidden="true" />
                </div>

                <div
                  className="grid flex-1 gap-[3px]"
                  style={{
                    gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))`,
                  }}
                >
                  {heatmapData.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                      {week.map((cell, dIdx) => {
                        if (!cell) {
                          return (
                            <div
                              key={`empty-${wIdx}-${dIdx}`}
                              aria-hidden="true"
                              className="aspect-square w-full"
                            />
                          );
                        }
                        const isSelected = inspectedCell?.localDate === cell.localDate;
                        const isToday = cell.localDate === todayLocalDate;
                        return (
                          <button
                            key={cell.localDate}
                            type="button"
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            onFocus={() => setHoveredCell(cell)}
                            onClick={() => setSelectedDate(cell.localDate)}
                            aria-label={`${cell.dateLabel}: ${cell.summary}`}
                            className={cn(
                              'aspect-square w-full rounded-[3px] transition-transform duration-100 hover:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2F2F2] cursor-pointer',
                              getHeatmapCellClass(cell),
                              isToday && !isSelected && 'ring-1 ring-[#96D2C5]/80',
                              isSelected && 'ring-1 ring-[#F2F2F2]'
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear Legend separating Unscheduled/Unrecorded, 0% Missed, Partial-Only, Full Intensity, Future */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4 text-xs text-[#737378]">
          <span className="text-[11px] text-[#737378]">
            Intensity reflects full scheduled completions; unscheduled days carry no penalty.
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] border border-white/[0.14] bg-transparent" />
              <span>Unscheduled / unrecorded</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] border border-[#F19A50]/85 bg-[#6B4423]/40" />
              <span>Partial only</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span>0% missed</span>
              <span className="h-3 w-3 rounded-[3px] bg-[#292929]" title="0% missed scheduled day" />
              <span className="h-3 w-3 rounded-[3px] bg-[#6B4423]" title="1–25% full completion" />
              <span className="h-3 w-3 rounded-[3px] bg-[#A3632C]" title="26–50% full completion" />
              <span className="h-3 w-3 rounded-[3px] bg-[#D88138]" title="51–75% full completion" />
              <span className="h-3 w-3 rounded-[3px] bg-[#F19A50]" title="76–100% full completion" />
              <span>100%</span>
            </span>
          </div>
        </div>

        {heatmapData.hasUnverifiedPriorSchedule && (
          <p className="mt-2.5 text-[11px] text-[#737378]">
            Note: Dates before a schedule edit without recorded logs are shown as unrecorded rather than counted as missed.
          </p>
        )}
      </Card>

      {/* Selected Day Inspection Panel */}
      {inspectedCell && (
        <Card tone="surface" padding="md">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.07] pb-3">
            <div>
              <p className="font-mono text-sm font-semibold text-[#F2F2F2]">
                {inspectedCell.dateLabel}
              </p>
              <p className="mt-0.5 text-xs text-[#A3A3A8]">
                {inspectedCell.summary} · {getCellKindHeadline(inspectedCell.kind)}
              </p>
            </div>
            <span className="font-mono text-xs text-[#737378] tabular-nums">
              {inspectedCell.completedCount}/{inspectedCell.expectedCount} full
              {inspectedCell.partialCount > 0 ? ` · ${inspectedCell.partialCount} partial` : ''}
            </span>
          </div>

          {inspectedCell.habitItems.length === 0 ? (
            <p className="pt-3 text-xs text-[#737378]">No habits evaluated for this date.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {inspectedCell.habitItems.map((item) => {
                const badge = getKindBadgeText(item.kind);
                return (
                  <div
                    key={item.habit.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#1B1B1B] px-3 py-2"
                  >
                    <span className="truncate text-xs font-medium text-[#F2F2F2]">
                      {item.habit.name}
                    </span>
                    <span className={cn('shrink-0 font-mono text-[11px]', badge.colorClass)}>
                      {item.log && item.habit.trackingType === 'measurable'
                        ? formatLogValueLabel(
                            item.log,
                            item.habit.unit,
                            item.habit.trackingType
                          )
                        : badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {heatmapData.totalCompletions}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">Times</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">
            Full completions in {selectedYear}
            {heatmapData.totalPartialLogs > 0
              ? ` · ${heatmapData.totalPartialLogs} partial`
              : ''}
          </div>
        </Card>

        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {heatmapData.activeDays}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">Days</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">
            with full completion · {heatmapData.scheduledDays} scheduled days
          </div>
        </Card>

        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F19A50] tabular-nums">
            {heatmapData.completionRate !== null ? `${heatmapData.completionRate}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-[#737378]">Scheduled completion rate</div>
        </Card>

        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {streakMetric.value}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">{streakMetric.unit}</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">{streakMetric.subtitle}</div>
        </Card>
      </div>

      {/* Secondary Trend Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card tone="surface" padding="lg" className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {heatmapData.totalCompletions}{' '}
              <span className="text-base font-normal text-[#A3A3A8]">completions</span>
            </div>
            <p className="mt-0.5 text-xs text-[#737378]">
              Monthly full completions in {selectedYear}
            </p>
          </div>
          <div className="mt-5">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-24 w-full overflow-visible">
              <path d={areaPath} fill="rgba(241, 154, 80, 0.14)" />
              <path
                d={linePath}
                fill="none"
                stroke="#F19A50"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-1 grid grid-cols-12 text-center font-mono text-[10px] text-[#737378]">
              {heatmapData.monthlyTrend.map((m) => (
                <span key={m.month}>{m.month[0]}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card tone="surface" padding="lg" className="flex flex-col justify-between">
          <div>
            <div className="text-2xl font-bold text-[#F2F2F2]">{heatmapData.peakDayName}</div>
            <p className="mt-0.5 text-xs text-[#737378]">
              Most frequent full-completion weekday in {selectedYear}
            </p>
          </div>

          <div className="mt-5 grid h-24 grid-cols-7 items-end gap-2.5">
            {heatmapData.weekdayFrequency.map((item) => {
              const heightPct =
                item.completions === 0
                  ? 8
                  : Math.max(14, Math.round((item.completions / maxWeekdayCount) * 100));
              const isPeak =
                item.completions > 0 && item.day === heatmapData.peakDayName;
              return (
                <div
                  key={item.day}
                  className="flex h-full flex-col items-center justify-end gap-1.5"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      title={`${item.day}: ${item.completions} completions`}
                      className={cn(
                        'w-full rounded-t-md border transition-colors',
                        isPeak
                          ? 'border-[#F19A50] bg-[#F19A50]/25'
                          : 'border-[#F19A50]/60 bg-[#F19A50]/[0.06]'
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[#737378]">{item.day}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
