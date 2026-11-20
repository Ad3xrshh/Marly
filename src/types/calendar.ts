import { toLocalDateString, type TaskCategory } from './task';

export type CalendarViewMode = 'month' | 'week' | 'day';
export type CalendarTaskVisibility = 'all' | 'open_only' | 'hidden';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  category: TaskCategory;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAt: string | null;
  endAt: string | null;
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  category?: TaskCategory;
  allDay: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  allDay?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

export interface CalendarEventFilters {
  fromDate?: string;
  toDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  category?: TaskCategory;
}

export interface CalendarDayCell {
  date: Date;
  isoDate: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function addDaysLocal(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export function addMonthsLocal(date: Date, months: number): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const firstOfTarget = new Date(targetYear, targetMonth, 1, 12, 0, 0, 0);
  const daysInTargetMonth = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0
  ).getDate();
  const clampedDay = Math.min(date.getDate(), daysInTargetMonth);
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), clampedDay, 12, 0, 0, 0);
}

export function getStartOfWeekSunday(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sun .. 6 = Sat
  return addDaysLocal(date, -dayOfWeek);
}

export function getWeekDays(anchorDate: Date): CalendarDayCell[] {
  const start = getStartOfWeekSunday(anchorDate);
  const todayIso = toLocalDateString(new Date());
  const anchorMonth = anchorDate.getMonth();

  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = addDaysLocal(start, index);
    const isoDate = toLocalDateString(cellDate);
    return {
      date: cellDate,
      isoDate,
      dayNumber: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === anchorMonth,
      isToday: isoDate === todayIso,
    };
  });
}

export function getMonthGridDays(anchorDate: Date): CalendarDayCell[] {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
  const lastOfMonth = new Date(year, month + 1, 0, 12, 0, 0, 0);

  const gridStart = getStartOfWeekSunday(firstOfMonth);
  const lastDayWeekday = lastOfMonth.getDay();
  const trailingDays = 6 - lastDayWeekday;
  const gridEnd = addDaysLocal(lastOfMonth, trailingDays);

  const todayIso = toLocalDateString(new Date());
  const cells: CalendarDayCell[] = [];
  let cursor = gridStart;

  while (cursor.getTime() <= gridEnd.getTime()) {
    const isoDate = toLocalDateString(cursor);
    cells.push({
      date: cursor,
      isoDate,
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month,
      isToday: isoDate === todayIso,
    });
    cursor = addDaysLocal(cursor, 1);
  }

  return cells;
}

export function formatMonthHeading(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatWeekHeading(anchorDate: Date): string {
  const week = getWeekDays(anchorDate);
  const first = week[0].date;
  const last = week[6].date;
  const sameMonth = first.getMonth() === last.getMonth();
  const sameYear = first.getFullYear() === last.getFullYear();

  if (sameMonth && sameYear) {
    const monthLabel = first.toLocaleDateString('en-US', { month: 'short' });
    return `${monthLabel} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
  }
  if (sameYear) {
    const startLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}, ${last.getFullYear()}`;
  }
  const startLabel = first.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endLabel = last.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatDayHeading(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDayHeading(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getLocalDayBounds(isoDate: string): { dayStartMs: number; dayEndMs: number } {
  const [year, month, day] = isoDate.split('-').map(Number);
  const dayStart = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const dayEnd = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
  return { dayStartMs: dayStart.getTime(), dayEndMs: dayEnd.getTime() };
}

export function eventOccursOnLocalDate(event: CalendarEvent, isoDate: string): boolean {
  if (event.allDay) {
    if (!event.startDate) return false;
    const endDate = event.endDate ?? event.startDate;
    return event.startDate <= isoDate && endDate >= isoDate;
  }

  if (!event.startAt || !event.endAt) return false;
  const startMs = new Date(event.startAt).getTime();
  const endMs = new Date(event.endAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;

  const { dayStartMs, dayEndMs } = getLocalDayBounds(isoDate);
  return startMs <= dayEndMs && endMs > dayStartMs;
}

export function formatLocalTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatEventTimeSummary(event: CalendarEvent, contextIsoDate?: string): string {
  if (event.allDay) {
    if (event.startDate && event.endDate && event.endDate > event.startDate) {
      return `All day · ${event.startDate} → ${event.endDate}`;
    }
    return 'All day';
  }

  if (!event.startAt || !event.endAt) return '';
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const startIso = toLocalDateString(start);
  const endIso = toLocalDateString(end);

  if (contextIsoDate) {
    if (startIso < contextIsoDate && endIso > contextIsoDate) {
      return 'All day (cont.)';
    }
    if (startIso < contextIsoDate && endIso === contextIsoDate) {
      return `Until ${formatLocalTime(event.endAt)}`;
    }
    if (startIso === contextIsoDate && endIso > contextIsoDate) {
      return `${formatLocalTime(event.startAt)} →`;
    }
  }

  if (startIso !== endIso) {
    return `${startIso} ${formatLocalTime(event.startAt)} – ${endIso} ${formatLocalTime(event.endAt)}`;
  }

  return `${formatLocalTime(event.startAt)} – ${formatLocalTime(event.endAt)}`;
}

export function toLocalTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function combineLocalDateAndTimeToIso(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const local = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
  return local.toISOString();
}

export function sortEventsForDay(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.allDay && b.allDay) return a.title.localeCompare(b.title);
    const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
    const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}
