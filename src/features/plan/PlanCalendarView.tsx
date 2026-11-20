import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  LogIn,
  Plus,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import { usePlanCalendarData } from '../../hooks/useMarlyData';
import { cn } from '../../lib/cn';
import {
  addDaysLocal,
  addMonthsLocal,
  eventOccursOnLocalDate,
  formatDayHeading,
  formatEventTimeSummary,
  formatLocalTime,
  formatMonthHeading,
  formatShortDayHeading,
  formatWeekHeading,
  getMonthGridDays,
  getWeekDays,
  parseLocalDate,
  sortEventsForDay,
  type CalendarEvent,
  type CalendarTaskVisibility,
  type CalendarViewMode,
} from '../../types/calendar';
import {
  getPriorityLabel,
  getTodayLocalDate,
  isTaskOverdue,
  TASK_CATEGORY_OPTIONS,
  toLocalDateString,
  type Task,
  type TaskCategory,
} from '../../types/task';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const VIEW_TABS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

export function PlanCalendarView() {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    events,
    tasks,
    isLoading,
    error,
    refreshCalendar,
    openCreateEvent,
    openEditEvent,
    openEditTask,
    toggleTaskCompleted,
  } = usePlanCalendarData();

  const todayIso = getTodayLocalDate();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => parseLocalDate(todayIso));
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [taskVisibility, setTaskVisibility] = useState<CalendarTaskVisibility>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | TaskCategory>('All');
  const [showFullDayHours, setShowFullDayHours] = useState(false);

  const visibleEvents = useMemo(() => {
    if (categoryFilter === 'All') return events;
    return events.filter((event) => event.category === categoryFilter);
  }, [events, categoryFilter]);

  const visibleTasks = useMemo(() => {
    if (taskVisibility === 'hidden') return [];
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      if (taskVisibility === 'open_only' && task.status === 'completed') return false;
      if (categoryFilter !== 'All' && task.category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, taskVisibility, categoryFilter]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [visibleTasks]);

  const monthCells = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);
  const weekCells = useMemo(() => getWeekDays(anchorDate), [anchorDate]);

  const eventsByDayIso = useMemo(() => {
    const targetDays =
      viewMode === 'month'
        ? monthCells.map((c) => c.isoDate)
        : viewMode === 'week'
          ? weekCells.map((c) => c.isoDate)
          : [selectedDateIso];

    const map = new Map<string, CalendarEvent[]>();
    for (const iso of targetDays) {
      const matching = visibleEvents.filter((event) => eventOccursOnLocalDate(event, iso));
      map.set(iso, sortEventsForDay(matching));
    }
    return map;
  }, [viewMode, monthCells, weekCells, selectedDateIso, visibleEvents]);

  const handleSelectDate = (isoDate: string) => {
    setSelectedDateIso(isoDate);
    setAnchorDate(parseLocalDate(isoDate));
  };

  const handleNavigatePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      const next = addMonthsLocal(anchorDate, direction);
      setAnchorDate(next);
      setSelectedDateIso(toLocalDateString(next));
    } else if (viewMode === 'week') {
      const next = addDaysLocal(anchorDate, direction * 7);
      setAnchorDate(next);
      setSelectedDateIso(toLocalDateString(next));
    } else {
      const next = addDaysLocal(anchorDate, direction);
      setAnchorDate(next);
      setSelectedDateIso(toLocalDateString(next));
    }
  };

  const handleJumpToday = () => {
    const freshToday = getTodayLocalDate();
    setAnchorDate(parseLocalDate(freshToday));
    setSelectedDateIso(freshToday);
  };

  const periodHeading = useMemo(() => {
    if (viewMode === 'month') return formatMonthHeading(anchorDate);
    if (viewMode === 'week') return formatWeekHeading(anchorDate);
    return formatDayHeading(parseLocalDate(selectedDateIso));
  }, [viewMode, anchorDate, selectedDateIso]);

  const selectedDayEvents = eventsByDayIso.get(selectedDateIso) ?? sortEventsForDay(
    visibleEvents.filter((e) => eventOccursOnLocalDate(e, selectedDateIso))
  );
  const selectedDayTasks = tasksByDate.get(selectedDateIso) ?? [];

  // Hours range for Week & Day views (auto-expands if any timed event sits outside 06:00-22:00)
  const timelineHours = useMemo(() => {
    let minHour = showFullDayHours ? 0 : 6;
    let maxHour = showFullDayHours ? 23 : 22;

    const relevantDays =
      viewMode === 'week' ? weekCells.map((c) => c.isoDate) : [selectedDateIso];

    for (const iso of relevantDays) {
      const dayEvts = eventsByDayIso.get(iso) ?? [];
      for (const evt of dayEvts) {
        if (!evt.allDay && evt.startAt) {
          const startDate = new Date(evt.startAt);
          if (toLocalDateString(startDate) === iso) {
            const h = startDate.getHours();
            if (h < minHour) minHour = h;
            if (h > maxHour) maxHour = h;
          }
        }
      }
    }

    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  }, [showFullDayHours, viewMode, weekCells, selectedDateIso, eventsByDayIso]);

  if (isAuthLoading) {
    return (
      <Card tone="surface" padding="lg">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
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
              Sign in to access your Calendar
            </h3>
            <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
              Schedule timed events and all-day commitments alongside your task due dates. Sign in with Google to save and view your calendar across sessions.
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

  return (
    <div className="space-y-4">
      {/* Calendar Controls Toolbar */}
      <Card tone="surface" padding="md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Navigation & Current Period */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center rounded-xl border border-white/[0.08] bg-[#1A1A1A] p-1">
              <button
                type="button"
                onClick={() => handleNavigatePeriod(-1)}
                aria-label={`Previous ${viewMode}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleJumpToday}
                className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-[#F2F2F2] transition-colors hover:bg-white/[0.06] cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(1)}
                aria-label={`Next ${viewMode}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-base font-bold tracking-tight text-[#F2F2F2] sm:text-lg">
              {periodHeading}
            </h3>
          </div>

          {/* Right: View Switcher + Create Event */}
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedTabs
              options={VIEW_TABS}
              value={viewMode}
              onChange={setViewMode}
            />

            <Button
              variant="coral"
              size="sm"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => openCreateEvent({ defaultDate: selectedDateIso })}
            >
              New Event
            </Button>
          </div>
        </div>

        {/* Filter & Legend Strip */}
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-3.5 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#A3A3A8]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#A9C8E9]" aria-hidden="true" />
              <Clock className="h-3.5 w-3.5 text-[#A9C8E9]" />
              <span>Scheduled Event</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E59585]" aria-hidden="true" />
              <CheckCircle2 className="h-3.5 w-3.5 text-[#E59585]" />
              <span>Task Due Date</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#A3A3A8]">
              <Eye className="h-3.5 w-3.5 text-[#737378]" />
              <select
                aria-label="Filter calendar task visibility"
                value={taskVisibility}
                onChange={(e) => setTaskVisibility(e.target.value as CalendarTaskVisibility)}
                className="h-8 rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 text-xs font-medium text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#E59585]/70 cursor-pointer"
              >
                <option value="all">Tasks: Show all due</option>
                <option value="open_only">Tasks: Open only</option>
                <option value="hidden">Tasks: Hidden</option>
              </select>
            </div>

            <select
              aria-label="Filter calendar by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | TaskCategory)}
              className="h-8 rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 text-xs font-medium text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70 cursor-pointer"
            >
              <option value="All">All categories</option>
              {TASK_CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {error && (
        <ErrorState
          title="Could not load calendar data"
          description={error}
          onRetry={refreshCalendar}
        />
      )}

      {isLoading ? (
        <Card tone="surface" padding="lg">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
              <Card tone="surface" padding="md" className="overflow-hidden">
                {/* Weekday Header */}
                <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold text-[#737378]">
                  {WEEKDAY_LABELS.map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Month Grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {monthCells.map((cell) => {
                    const dayEvents = eventsByDayIso.get(cell.isoDate) ?? [];
                    const dayTasks = tasksByDate.get(cell.isoDate) ?? [];
                    const isSelected = cell.isoDate === selectedDateIso;

                    // Combine up to 3 visible previews on sm+
                    const previewItems: Array<
                      | { kind: 'event'; item: CalendarEvent }
                      | { kind: 'task'; item: Task }
                    > = [
                      ...dayEvents.map((item) => ({ kind: 'event' as const, item })),
                      ...dayTasks.map((item) => ({ kind: 'task' as const, item })),
                    ];
                    const visiblePreview = previewItems.slice(0, 3);
                    const overflowCount = previewItems.length - visiblePreview.length;

                    return (
                      <div
                        key={cell.isoDate}
                        onClick={() => handleSelectDate(cell.isoDate)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectDate(cell.isoDate);
                          }
                        }}
                        aria-label={`${cell.isoDate}: ${dayEvents.length} events, ${dayTasks.length} tasks due`}
                        className={cn(
                          'group flex min-h-[60px] sm:min-h-[112px] flex-col rounded-xl border p-1.5 sm:p-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                          isSelected
                            ? 'border-[#E59585]/70 bg-[#292929]'
                            : cell.isCurrentMonth
                              ? 'border-white/[0.06] bg-[#1B1B1B] hover:border-white/[0.14]'
                              : 'border-white/[0.03] bg-[#161616] opacity-55 hover:opacity-80'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs tabular-nums',
                              cell.isToday
                                ? 'bg-[#E59585] font-bold text-[#151515]'
                                : isSelected
                                  ? 'font-bold text-[#F2F2F2]'
                                  : 'font-medium text-[#A3A3A8]'
                            )}
                          >
                            {cell.dayNumber}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateEvent({ defaultDate: cell.isoDate });
                            }}
                            aria-label={`Add event on ${cell.isoDate}`}
                            className="hidden sm:inline-flex h-5 w-5 items-center justify-center rounded-md text-[#737378] opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-[#F2F2F2] group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Mobile compact dot summary */}
                        <div className="mt-1.5 flex items-center gap-1 sm:hidden">
                          {dayEvents.length > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#A9C8E9]" />
                          )}
                          {dayTasks.length > 0 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#E59585]" />
                          )}
                          {previewItems.length > 0 && (
                            <span className="font-mono text-[10px] text-[#A3A3A8] tabular-nums">
                              {previewItems.length}
                            </span>
                          )}
                        </div>

                        {/* Desktop/Tablet compact event & task rows */}
                        <div className="mt-1.5 hidden flex-1 space-y-1 sm:block min-w-0">
                          {visiblePreview.map((entry) =>
                            entry.kind === 'event' ? (
                              <button
                                key={`evt-${entry.item.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditEvent(entry.item);
                                }}
                                className="flex w-full items-center gap-1 rounded-md bg-[#A9C8E9]/14 px-1.5 py-0.5 text-left text-[11px] font-medium text-[#A9C8E9] transition-colors hover:bg-[#A9C8E9]/24 cursor-pointer"
                              >
                                <span className="font-mono text-[10px] shrink-0 opacity-85">
                                  {entry.item.allDay
                                    ? 'All'
                                    : entry.item.startAt
                                      ? formatLocalTime(entry.item.startAt)
                                      : ''}
                                </span>
                                <span className="truncate text-[#F2F2F2]">{entry.item.title}</span>
                              </button>
                            ) : (
                              <button
                                key={`tsk-${entry.item.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTask(entry.item);
                                }}
                                className="flex w-full items-center gap-1 rounded-md border border-[#E59585]/25 bg-[#E59585]/[0.08] px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-[#E59585]/16 cursor-pointer"
                              >
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    entry.item.status === 'completed'
                                      ? 'bg-[#96D2C5]'
                                      : 'bg-[#E59585]'
                                  )}
                                />
                                <span
                                  className={cn(
                                    'truncate text-[#F2F2F2]',
                                    entry.item.status === 'completed' &&
                                      'line-through text-[#737378]'
                                  )}
                                >
                                  {entry.item.title}
                                </span>
                              </button>
                            )
                          )}
                          {overflowCount > 0 && (
                            <div className="px-1 font-mono text-[10px] text-[#A3A3A8]">
                              +{overflowCount} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Selected Day Detail Sidebar */}
              <SelectedDayAgendaPanel
                isoDate={selectedDateIso}
                events={selectedDayEvents}
                tasks={selectedDayTasks}
                onOpenDayView={() => setViewMode('day')}
                onCreateEvent={() => openCreateEvent({ defaultDate: selectedDateIso })}
                onEditEvent={openEditEvent}
                onEditTask={openEditTask}
                onToggleTask={toggleTaskCompleted}
              />
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <Card tone="surface" padding="md" className="space-y-4">
              {/* Desktop/Tablet 7-column Week Schedule */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[780px]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-white/[0.08] pb-3">
                    <div className="flex items-end justify-end pr-2">
                      <button
                        type="button"
                        onClick={() => setShowFullDayHours((v) => !v)}
                        className="text-[10px] font-medium text-[#737378] hover:text-[#F2F2F2] cursor-pointer"
                      >
                        {showFullDayHours ? '06–22' : '24h'}
                      </button>
                    </div>
                    {weekCells.map((day) => {
                      const active = day.isoDate === selectedDateIso;
                      return (
                        <div key={day.isoDate} className="px-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectDate(day.isoDate);
                            }}
                            className={cn(
                              'inline-flex w-full flex-col items-center rounded-xl py-1.5 transition-colors cursor-pointer',
                              active ? 'bg-[#292929]' : 'hover:bg-white/[0.04]'
                            )}
                          >
                            <span className="text-[11px] font-medium text-[#737378]">
                              {WEEKDAY_LABELS[day.date.getDay()]}
                            </span>
                            <span
                              className={cn(
                                'mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs tabular-nums',
                                day.isToday
                                  ? 'bg-[#E59585] font-bold text-[#151515]'
                                  : 'font-semibold text-[#F2F2F2]'
                              )}
                            >
                              {day.dayNumber}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* All-Day, Continuing & Task Deadlines Band */}
                  <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-white/[0.08] bg-[#191919] py-2">
                    <div className="pr-2 pt-1 text-right font-mono text-[10px] text-[#737378]">
                      All day
                    </div>
                    {weekCells.map((day) => {
                      const dayEvts = eventsByDayIso.get(day.isoDate) ?? [];
                      const allDayOrCont = dayEvts.filter((evt) => {
                        if (evt.allDay) return true;
                        if (!evt.startAt) return false;
                        return toLocalDateString(new Date(evt.startAt)) < day.isoDate;
                      });
                      const dayTasks = tasksByDate.get(day.isoDate) ?? [];

                      return (
                        <div
                          key={`allday-${day.isoDate}`}
                          className="min-h-[38px] space-y-1 border-l border-white/[0.05] px-1"
                        >
                          {allDayOrCont.map((evt) => (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={() => openEditEvent(evt)}
                              className="block w-full truncate rounded-md bg-[#A9C8E9]/18 px-1.5 py-1 text-left text-[11px] font-medium text-[#F2F2F2] hover:bg-[#A9C8E9]/28 cursor-pointer"
                            >
                              {evt.allDay ? evt.title : `↪ ${evt.title}`}
                            </button>
                          ))}
                          {dayTasks.map((task) => (
                            <button
                              key={`wtask-${task.id}`}
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="flex w-full items-center gap-1 rounded-md border border-[#E59585]/30 bg-[#E59585]/[0.09] px-1.5 py-1 text-left text-[11px] text-[#F2F2F2] hover:bg-[#E59585]/18 cursor-pointer"
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  task.status === 'completed' ? 'bg-[#96D2C5]' : 'bg-[#E59585]'
                                )}
                              />
                              <span
                                className={cn(
                                  'truncate',
                                  task.status === 'completed' && 'line-through text-[#737378]'
                                )}
                              >
                                {task.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hourly Rows */}
                  <div className="divide-y divide-white/[0.05]">
                    {timelineHours.map((hour) => {
                      const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                      return (
                        <div
                          key={hour}
                          className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] min-h-[54px]"
                        >
                          <div className="pr-2 pt-1.5 text-right font-mono text-[11px] text-[#737378] tabular-nums">
                            {hourLabel}
                          </div>
                          {weekCells.map((day) => {
                            const dayEvts = eventsByDayIso.get(day.isoDate) ?? [];
                            const slotEvents = dayEvts.filter((evt) => {
                              if (evt.allDay || !evt.startAt) return false;
                              const start = new Date(evt.startAt);
                              return (
                                toLocalDateString(start) === day.isoDate &&
                                start.getHours() === hour
                              );
                            });

                            return (
                              <div
                                key={`${day.isoDate}-${hour}`}
                                onClick={() =>
                                  openCreateEvent({
                                    defaultDate: day.isoDate,
                                    defaultStartHour: hour,
                                  })
                                }
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openCreateEvent({
                                      defaultDate: day.isoDate,
                                      defaultStartHour: hour,
                                    });
                                  }
                                }}
                                aria-label={`Schedule event on ${day.isoDate} at ${hourLabel}`}
                                className="space-y-1 border-l border-white/[0.05] p-1 transition-colors hover:bg-white/[0.03] cursor-pointer"
                              >
                                {slotEvents.map((evt) => (
                                  <button
                                    key={evt.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditEvent(evt);
                                    }}
                                    className="block w-full rounded-lg border border-[#A9C8E9]/30 bg-[#A9C8E9]/14 px-2 py-1 text-left transition-colors hover:bg-[#A9C8E9]/24 cursor-pointer"
                                  >
                                    <div className="font-mono text-[10px] font-semibold text-[#A9C8E9] tabular-nums">
                                      {formatEventTimeSummary(evt, day.isoDate)}
                                    </div>
                                    <div className="truncate text-xs font-medium text-[#F2F2F2]">
                                      {evt.title}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile Responsive Stacked Week Agenda */}
              <div className="space-y-3 md:hidden">
                {weekCells.map((day) => {
                  const dayEvts = eventsByDayIso.get(day.isoDate) ?? [];
                  const dayTasks = tasksByDate.get(day.isoDate) ?? [];
                  return (
                    <div
                      key={`mob-${day.isoDate}`}
                      className={cn(
                        'rounded-xl border p-3.5',
                        day.isToday
                          ? 'border-[#E59585]/50 bg-[#252525]'
                          : 'border-white/[0.07] bg-[#1A1A1A]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectDate(day.isoDate);
                            setViewMode('day');
                          }}
                          className="text-left text-sm font-semibold text-[#F2F2F2] cursor-pointer"
                        >
                          {formatShortDayHeading(day.isoDate)}
                          {day.isToday && (
                            <span className="ml-2 font-mono text-xs text-[#E59585]">Today</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateEvent({ defaultDate: day.isoDate })}
                          aria-label={`Add event on ${day.isoDate}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {dayEvts.length === 0 && dayTasks.length === 0 ? (
                        <p className="text-xs text-[#737378]">Nothing scheduled</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayEvts.map((evt) => (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={() => openEditEvent(evt)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#A9C8E9]/14 px-2.5 py-2 text-left text-xs text-[#F2F2F2] cursor-pointer"
                            >
                              <span className="truncate font-medium">{evt.title}</span>
                              <span className="font-mono text-[11px] text-[#A9C8E9] shrink-0">
                                {formatEventTimeSummary(evt, day.isoDate)}
                              </span>
                            </button>
                          ))}
                          {dayTasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E59585]/25 bg-[#E59585]/[0.08] px-2.5 py-2 text-left text-xs text-[#F2F2F2] cursor-pointer"
                            >
                              <span
                                className={cn(
                                  'truncate',
                                  task.status === 'completed' && 'line-through text-[#737378]'
                                )}
                              >
                                Due: {task.title}
                              </span>
                              <span className="font-mono text-[11px] text-[#E59585] shrink-0">
                                {getPriorityLabel(task.priority)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* DAY VIEW */}
          {viewMode === 'day' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Hourly Timeline Card */}
              <Card tone="surface" padding="md">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3.5">
                  <div>
                    <h4 className="text-base font-semibold text-[#F2F2F2]">Day Timeline</h4>
                    <p className="text-xs text-[#A3A3A8]">
                      Click any hour row to schedule an event, or click an event to view or edit it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFullDayHours((v) => !v)}
                    className="rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 py-1.5 text-xs font-medium text-[#A3A3A8] hover:text-[#F2F2F2] cursor-pointer"
                  >
                    {showFullDayHours ? 'Compact hours (06:00–22:00)' : 'Show all 24 hours'}
                  </button>
                </div>

                {/* All-Day / Continuing Events Strip */}
                {(() => {
                  const allDayAndCont = selectedDayEvents.filter((evt) => {
                    if (evt.allDay) return true;
                    if (!evt.startAt) return false;
                    return toLocalDateString(new Date(evt.startAt)) < selectedDateIso;
                  });
                  if (allDayAndCont.length === 0) return null;
                  return (
                    <div className="mt-3 space-y-1.5 rounded-xl border border-[#A9C8E9]/25 bg-[#A9C8E9]/[0.07] p-3">
                      <div className="text-[11px] font-semibold text-[#A9C8E9]">
                        All-day & Continuing
                      </div>
                      {allDayAndCont.map((evt) => (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => openEditEvent(evt)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg bg-[#202020] px-3 py-2 text-left transition-colors hover:bg-[#292929] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#F2F2F2]">{evt.title}</p>
                            {evt.description && (
                              <p className="truncate text-xs text-[#A3A3A8]">{evt.description}</p>
                            )}
                          </div>
                          <span className="font-mono text-xs text-[#A9C8E9] shrink-0">
                            {formatEventTimeSummary(evt, selectedDateIso)}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Hourly Slots */}
                <div className="mt-3 divide-y divide-white/[0.06]">
                  {timelineHours.map((hour) => {
                    const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                    const hourEvents = selectedDayEvents.filter((evt) => {
                      if (evt.allDay || !evt.startAt) return false;
                      const start = new Date(evt.startAt);
                      return (
                        toLocalDateString(start) === selectedDateIso &&
                        start.getHours() === hour
                      );
                    });

                    return (
                      <div
                        key={hour}
                        onClick={() =>
                          openCreateEvent({
                            defaultDate: selectedDateIso,
                            defaultStartHour: hour,
                          })
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openCreateEvent({
                              defaultDate: selectedDateIso,
                              defaultStartHour: hour,
                            });
                          }
                        }}
                        className="grid grid-cols-[60px_minmax(0,1fr)] gap-3 py-2.5 px-2 transition-colors hover:bg-white/[0.025] cursor-pointer rounded-lg"
                      >
                        <span className="font-mono text-xs font-medium text-[#737378] tabular-nums pt-1">
                          {hourLabel}
                        </span>
                        <div className="min-h-[28px] space-y-2">
                          {hourEvents.map((evt) => (
                            <button
                              key={evt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditEvent(evt);
                              }}
                              className="flex w-full flex-col justify-between gap-1 rounded-xl border border-[#A9C8E9]/30 bg-[#A9C8E9]/14 px-3.5 py-2.5 text-left transition-colors hover:bg-[#A9C8E9]/22 sm:flex-row sm:items-center cursor-pointer"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#F2F2F2]">
                                  {evt.title}
                                </p>
                                {evt.description && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-[#A3A3A8]">
                                    {evt.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 font-mono text-xs text-[#A9C8E9] shrink-0 tabular-nums">
                                <span>{evt.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatEventTimeSummary(evt, selectedDateIso)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Day View Tasks & Quick Summary Column */}
              <SelectedDayAgendaPanel
                isoDate={selectedDateIso}
                events={selectedDayEvents}
                tasks={selectedDayTasks}
                onCreateEvent={() => openCreateEvent({ defaultDate: selectedDateIso })}
                onEditEvent={openEditEvent}
                onEditTask={openEditTask}
                onToggleTask={toggleTaskCompleted}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SelectedDayAgendaPanelProps {
  isoDate: string;
  events: CalendarEvent[];
  tasks: Task[];
  onOpenDayView?: () => void;
  onCreateEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (task: Task) => Promise<void>;
}

function SelectedDayAgendaPanel({
  isoDate,
  events,
  tasks,
  onOpenDayView,
  onCreateEvent,
  onEditEvent,
  onEditTask,
  onToggleTask,
}: SelectedDayAgendaPanelProps) {
  const isToday = isoDate === getTodayLocalDate();

  return (
    <Card tone="surface" padding="lg" className="flex flex-col gap-5 h-fit">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div>
          <p className="text-xs font-medium text-[#A3A3A8]">
            {isToday ? 'Today · Selected Day' : 'Selected Day'}
          </p>
          <h4 className="mt-0.5 font-mono text-lg font-bold text-[#F2F2F2] tabular-nums">
            {formatShortDayHeading(isoDate)}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenDayView && (
            <Button variant="ghost" size="sm" onClick={onOpenDayView}>
              Day view
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={onCreateEvent}
          >
            Event
          </Button>
        </div>
      </div>

      {/* Scheduled Events */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#A9C8E9]">
            <CalendarIcon className="h-3.5 w-3.5" />
            Scheduled Events
          </span>
          <span className="font-mono text-[#737378] tabular-nums">{events.length}</span>
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="No events scheduled"
            description="Add a timed event or all-day block for this date."
            actionLabel="Schedule event"
            onAction={onCreateEvent}
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onEditEvent(event)}
                className="w-full rounded-xl border border-[#A9C8E9]/25 bg-[#292929] p-3 text-left transition-colors hover:border-[#A9C8E9]/50 hover:bg-[#303030] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[#F2F2F2]">
                    {event.title}
                  </span>
                  <span className="font-mono text-[11px] text-[#A9C8E9] shrink-0 tabular-nums">
                    {formatEventTimeSummary(event, isoDate)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#A3A3A8]">
                  {event.category}
                  {event.description ? ` · ${event.description}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Tasks Due */}
      <section className="space-y-2.5 border-t border-white/[0.07] pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#E59585]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tasks Due
          </span>
          <span className="font-mono text-[#737378] tabular-nums">{tasks.length}</span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-[#737378]">
            No visible tasks have a due date on {isoDate}.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const completed = task.status === 'completed';
              const overdue = isTaskOverdue(task);
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#1A1A1A] px-3 py-2.5"
                >
                  <div className="pt-0.5">
                    <Checkbox
                      checked={completed}
                      onChange={() => void onToggleTask(task)}
                      tone="coral"
                      ariaLabel={`Mark "${task.title}" ${completed ? 'incomplete' : 'complete'}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditTask(task)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <p
                      className={cn(
                        'truncate text-sm font-medium text-[#F2F2F2] hover:text-[#E59585]',
                        completed && 'line-through text-[#737378]'
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#A3A3A8]">
                      {task.category}
                      <span aria-hidden="true"> · </span>
                      {getPriorityLabel(task.priority)}
                      {overdue && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-[#E06C75]">Overdue</span>
                        </>
                      )}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Card>
  );
}
