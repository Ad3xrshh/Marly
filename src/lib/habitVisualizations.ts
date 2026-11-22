import type { Habit, HabitLog } from '../types/habit.ts';
import {
  addDaysToLocalDate,
  computeLogProgressPercent,
  formatCalendarDate,
  formatTimestampInTimeZoneToLocalDate,
  getDayOfWeekFromLocalDate,
  getWeekStartMonday,
  isHabitScheduledOnDate,
  parseCalendarDate,
  WEEKDAY_MONDAY_FIRST_ORDER,
  WEEKDAY_SHORT_LABELS,
} from './habitSchedule.ts';

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface DateRangeInterval {
  from: string;
  to: string;
}

export function diffLocalDays(from: string, to: string): number {
  const fromParts = parseCalendarDate(from);
  const toParts = parseCalendarDate(to);
  const fromMs = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toMs = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.round((toMs - fromMs) / 86400000);
}

/**
 * Splits any [from, to] range into inclusive chunks of at most `maxSpanDays`
 * (default 365 days, strictly under the backend's 400-day limit).
 */
export function splitDateRangeChunks(
  from: string,
  to: string,
  maxSpanDays = 365
): DateRangeInterval[] {
  if (from > to) return [];
  const chunks: DateRangeInterval[] = [];
  let cursor = from;
  while (cursor <= to) {
    const candidateEnd = addDaysToLocalDate(cursor, maxSpanDays - 1);
    const chunkEnd = candidateEnd <= to ? candidateEnd : to;
    chunks.push({ from: cursor, to: chunkEnd });
    cursor = addDaysToLocalDate(chunkEnd, 1);
  }
  return chunks;
}

export function mergeDateIntervals(intervals: DateRangeInterval[]): DateRangeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.from.localeCompare(b.from));
  const merged: DateRangeInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const dayAfterLast = addDaysToLocalDate(last.to, 1);
    if (current.from <= dayAfterLast) {
      if (current.to > last.to) {
        last.to = current.to;
      }
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function subtractCoveredIntervals(
  from: string,
  to: string,
  covered: DateRangeInterval[]
): DateRangeInterval[] {
  if (from > to) return [];
  const merged = mergeDateIntervals(covered);
  const missing: DateRangeInterval[] = [];
  let cursor = from;

  for (const interval of merged) {
    if (interval.to < cursor) continue;
    if (interval.from > to) break;
    if (interval.from > cursor) {
      const gapEnd = addDaysToLocalDate(interval.from, -1);
      missing.push({ from: cursor, to: gapEnd < to ? gapEnd : to });
    }
    const nextCursor = addDaysToLocalDate(interval.to, 1);
    if (nextCursor > cursor) {
      cursor = nextCursor;
    }
    if (cursor > to) break;
  }

  if (cursor <= to) {
    missing.push({ from: cursor, to });
  }
  return missing;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMonthBounds(year: number, month: number): {
  from: string;
  to: string;
  daysInMonth: number;
  startWeekday: number;
  label: string;
  shortMonth: string;
} {
  const daysInMonth = getDaysInMonth(year, month);
  const from = formatCalendarDate(year, month, 1);
  const to = formatCalendarDate(year, month, daysInMonth);
  const startWeekday = getDayOfWeekFromLocalDate(from);
  return {
    from,
    to,
    daysInMonth,
    startWeekday,
    label: `${MONTH_FULL_NAMES[month - 1]} ${year}`,
    shortMonth: MONTH_SHORT_NAMES[month - 1],
  };
}

export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number
): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

export function formatShortCalendarLabel(localDate: string): string {
  const { year, month, day } = parseCalendarDate(localDate);
  return `${MONTH_SHORT_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatWeekRangeLabel(weekStartLocalDate: string): string {
  const weekEndLocalDate = addDaysToLocalDate(weekStartLocalDate, 6);
  const start = parseCalendarDate(weekStartLocalDate);
  const end = parseCalendarDate(weekEndLocalDate);
  if (start.year === end.year && start.month === end.month) {
    return `${MONTH_SHORT_NAMES[start.month - 1]} ${start.day} – ${end.day}, ${end.year}`;
  }
  if (start.year === end.year) {
    return `${MONTH_SHORT_NAMES[start.month - 1]} ${start.day} – ${MONTH_SHORT_NAMES[end.month - 1]} ${end.day}, ${end.year}`;
  }
  return `${MONTH_SHORT_NAMES[start.month - 1]} ${start.day}, ${start.year} – ${MONTH_SHORT_NAMES[end.month - 1]} ${end.day}, ${end.year}`;
}

export function buildLogLookupMap(logs: HabitLog[]): Map<string, HabitLog> {
  const map = new Map<string, HabitLog>();
  for (const log of logs) {
    map.set(`${log.habitId}:${log.localDate}`, log);
  }
  return map;
}

export type HabitDayEvaluationKind =
  | 'future'
  | 'completed'
  | 'partial'
  | 'missed'
  | 'pending'
  | 'unscheduled'
  | 'flexible_rest'
  | 'unverified_prior_schedule'
  | 'inactive';

export interface EvaluatedHabitDay {
  habit: Habit;
  localDate: string;
  log: HabitLog | null;
  kind: HabitDayEvaluationKind;
  countsInScheduledDenominator: boolean;
  canMutateOnDate: boolean;
  progressPercent: number;
}

export interface HabitLifecycleBounds {
  createdLocalDate: string;
  archivedLocalDate: string | null;
  scheduleUpdatedLocalDate: string;
  scheduleWasEditedAfterCreation: boolean;
}

export function getHabitLifecycleBounds(
  habit: Habit,
  effectiveTimezone: string
): HabitLifecycleBounds {
  const createdLocalDate = formatTimestampInTimeZoneToLocalDate(
    new Date(habit.createdAt),
    effectiveTimezone
  );
  const archivedLocalDate = habit.archivedAt
    ? formatTimestampInTimeZoneToLocalDate(new Date(habit.archivedAt), effectiveTimezone)
    : null;
  const scheduleUpdatedRaw = habit.schedule.updatedAt
    ? formatTimestampInTimeZoneToLocalDate(
        new Date(habit.schedule.updatedAt),
        effectiveTimezone
      )
    : createdLocalDate;
  const scheduleUpdatedLocalDate =
    scheduleUpdatedRaw >= createdLocalDate ? scheduleUpdatedRaw : createdLocalDate;

  return {
    createdLocalDate,
    archivedLocalDate,
    scheduleUpdatedLocalDate,
    scheduleWasEditedAfterCreation: scheduleUpdatedLocalDate > createdLocalDate,
  };
}

/**
 * Single authoritative historical evaluation function shared across
 * Monthly Calendar, Weekly Matrix, and Yearly Heatmap.
 *
 * Guarantees:
 * - Persisted logs always win as historical truth.
 * - Unlogged dates before a later schedule edit are marked `unverified_prior_schedule`
 *   instead of fabricating `missed`.
 * - Unscheduled weekdays and `times_per_week` unlogged days are never marked `missed`.
 * - Partial measurable logs remain `partial` and never count as `completed`.
 * - Future dates are strictly `future`.
 */
export function evaluateHabitDayStatus(params: {
  habit: Habit;
  log: HabitLog | null;
  localDate: string;
  todayLocalDate: string;
  lifecycle: HabitLifecycleBounds;
}): EvaluatedHabitDay {
  const { habit, log, localDate, todayLocalDate, lifecycle } = params;

  if (localDate > todayLocalDate) {
    return {
      habit,
      localDate,
      log: null,
      kind: 'future',
      countsInScheduledDenominator: false,
      canMutateOnDate: false,
      progressPercent: 0,
    };
  }

  const canMutateOnDate = habit.status === 'active';

  // Historical logs are preserved regardless of later schedule edits or archival
  if (log) {
    const isCompleted = log.statusSnapshot === 'completed';
    const progressPercent =
      habit.trackingType === 'boolean'
        ? 100
        : computeLogProgressPercent(
            log.completedValue,
            log.targetSnapshot ?? habit.targetValue
          );
    return {
      habit,
      localDate,
      log,
      kind: isCompleted ? 'completed' : 'partial',
      countsInScheduledDenominator: true,
      canMutateOnDate,
      progressPercent,
    };
  }

  // No log exists on this date
  if (
    localDate < lifecycle.createdLocalDate ||
    (lifecycle.archivedLocalDate !== null && localDate > lifecycle.archivedLocalDate)
  ) {
    return {
      habit,
      localDate,
      log: null,
      kind: 'inactive',
      countsInScheduledDenominator: false,
      canMutateOnDate,
      progressPercent: 0,
    };
  }

  if (habit.schedule.frequencyType === 'times_per_week') {
    return {
      habit,
      localDate,
      log: null,
      kind: 'flexible_rest',
      countsInScheduledDenominator: false,
      canMutateOnDate,
      progressPercent: 0,
    };
  }

  // Daily or selected-weekdays habit without a log
  if (
    lifecycle.scheduleWasEditedAfterCreation &&
    localDate < lifecycle.scheduleUpdatedLocalDate
  ) {
    return {
      habit,
      localDate,
      log: null,
      kind: 'unverified_prior_schedule',
      countsInScheduledDenominator: false,
      canMutateOnDate,
      progressPercent: 0,
    };
  }

  const scheduled = isHabitScheduledOnDate(habit.schedule, localDate);
  if (!scheduled) {
    return {
      habit,
      localDate,
      log: null,
      kind: 'unscheduled',
      countsInScheduledDenominator: false,
      canMutateOnDate,
      progressPercent: 0,
    };
  }

  if (localDate === todayLocalDate) {
    return {
      habit,
      localDate,
      log: null,
      kind: 'pending',
      countsInScheduledDenominator: true,
      canMutateOnDate,
      progressPercent: 0,
    };
  }

  return {
    habit,
    localDate,
    log: null,
    kind: 'missed',
    countsInScheduledDenominator: true,
    canMutateOnDate,
    progressPercent: 0,
  };
}

// ============================================================================
// 1. Monthly Habit Calendar Builder
// ============================================================================

export type MonthlyCalendarDayVisualState =
  | 'completed'
  | 'partial'
  | 'missed'
  | 'pending'
  | 'unscheduled'
  | 'unverified'
  | 'future';

export interface MonthlyCalendarDayItem {
  day: number;
  localDate: string;
  state: MonthlyCalendarDayVisualState;
  completedCount: number;
  partialCount: number;
  missedCount: number;
  pendingCount: number;
  scheduledOrLoggedCount: number;
  unverifiedCount: number;
  summary: string;
  habitItems: EvaluatedHabitDay[];
}

export interface MonthlyCalendarViewData {
  year: number;
  month: number;
  label: string;
  shortMonth: string;
  from: string;
  to: string;
  startWeekday: number;
  days: MonthlyCalendarDayItem[];
  relevantHabits: Habit[];
  completedUnits: number;
  partialUnits: number;
  scheduledOrLoggedUnits: number;
  monthlyRatePercent: number | null;
  hasUnverifiedPriorSchedule: boolean;
  scheduleEditDates: string[];
}

export function buildMonthlyCalendarViewData(params: {
  year: number;
  month: number;
  habits: Habit[];
  logsByKey: Map<string, HabitLog>;
  selectedHabitId: number | 'all';
  todayLocalDate: string;
  effectiveTimezone: string;
}): MonthlyCalendarViewData {
  const {
    year,
    month,
    habits,
    logsByKey,
    selectedHabitId,
    todayLocalDate,
    effectiveTimezone,
  } = params;

  const bounds = getMonthBounds(year, month);

  // Determine relevant habits (active habits + archived habits that have logs in this month)
  const relevantHabits = habits.filter((habit) => {
    if (selectedHabitId !== 'all') {
      return habit.id === selectedHabitId;
    }
    if (habit.status === 'active') return true;
    for (let day = 1; day <= bounds.daysInMonth; day += 1) {
      const dateStr = formatCalendarDate(year, month, day);
      if (logsByKey.has(`${habit.id}:${dateStr}`)) return true;
    }
    return false;
  });

  const lifecycles = new Map(
    relevantHabits.map((h) => [h.id, getHabitLifecycleBounds(h, effectiveTimezone)])
  );

  let completedUnits = 0;
  let partialUnits = 0;
  let scheduledOrLoggedUnits = 0;
  let hasUnverifiedPriorSchedule = false;
  const scheduleEditDatesSet = new Set<string>();

  const days: MonthlyCalendarDayItem[] = [];

  for (let day = 1; day <= bounds.daysInMonth; day += 1) {
    const localDate = formatCalendarDate(year, month, day);
    const habitItems: EvaluatedHabitDay[] = relevantHabits.map((habit) => {
      const log = logsByKey.get(`${habit.id}:${localDate}`) ?? null;
      const lifecycle = lifecycles.get(habit.id)!;
      return evaluateHabitDayStatus({
        habit,
        log,
        localDate,
        todayLocalDate,
        lifecycle,
      });
    });

    if (localDate > todayLocalDate) {
      days.push({
        day,
        localDate,
        state: 'future',
        completedCount: 0,
        partialCount: 0,
        missedCount: 0,
        pendingCount: 0,
        scheduledOrLoggedCount: 0,
        unverifiedCount: 0,
        summary: 'Upcoming day',
        habitItems,
      });
      continue;
    }

    let completedCount = 0;
    let partialCount = 0;
    let missedCount = 0;
    let pendingCount = 0;
    let scheduledOrLoggedCount = 0;
    let unverifiedCount = 0;

    for (const item of habitItems) {
      if (item.kind === 'completed') completedCount += 1;
      else if (item.kind === 'partial') partialCount += 1;
      else if (item.kind === 'missed') missedCount += 1;
      else if (item.kind === 'pending') pendingCount += 1;
      else if (item.kind === 'unverified_prior_schedule') {
        unverifiedCount += 1;
        hasUnverifiedPriorSchedule = true;
        const lc = lifecycles.get(item.habit.id)!;
        scheduleEditDatesSet.add(lc.scheduleUpdatedLocalDate);
      }

      if (item.countsInScheduledDenominator) {
        scheduledOrLoggedCount += 1;
      }
    }

    completedUnits += completedCount;
    partialUnits += partialCount;
    scheduledOrLoggedUnits += scheduledOrLoggedCount;

    let state: MonthlyCalendarDayVisualState;
    let summary: string;

    if (scheduledOrLoggedCount === 0) {
      if (unverifiedCount > 0) {
        state = 'unverified';
        summary = 'No log recorded · prior schedule unrecorded';
      } else {
        state = 'unscheduled';
        summary = 'Rest / unscheduled day';
      }
    } else if (completedCount === scheduledOrLoggedCount && completedCount > 0) {
      state = 'completed';
      summary =
        completedCount === 1
          ? '1 of 1 habit completed'
          : `${completedCount} of ${scheduledOrLoggedCount} habits completed`;
    } else if (completedCount > 0 || partialCount > 0) {
      state = 'partial';
      const parts: string[] = [];
      if (completedCount > 0) parts.push(`${completedCount} completed`);
      if (partialCount > 0) parts.push(`${partialCount} partial`);
      if (missedCount > 0) parts.push(`${missedCount} missed`);
      if (pendingCount > 0) parts.push(`${pendingCount} pending`);
      summary = parts.join(' · ');
    } else if (pendingCount > 0 && missedCount === 0) {
      state = 'pending';
      summary = `${pendingCount} scheduled today (open)`;
    } else {
      state = 'missed';
      summary = `0 of ${scheduledOrLoggedCount} scheduled completed`;
    }

    days.push({
      day,
      localDate,
      state,
      completedCount,
      partialCount,
      missedCount,
      pendingCount,
      scheduledOrLoggedCount,
      unverifiedCount,
      summary,
      habitItems,
    });
  }

  const monthlyRatePercent =
    scheduledOrLoggedUnits > 0
      ? Math.round((completedUnits / scheduledOrLoggedUnits) * 100)
      : null;

  return {
    year,
    month,
    label: bounds.label,
    shortMonth: bounds.shortMonth,
    from: bounds.from,
    to: bounds.to,
    startWeekday: bounds.startWeekday,
    days,
    relevantHabits,
    completedUnits,
    partialUnits,
    scheduledOrLoggedUnits,
    monthlyRatePercent,
    hasUnverifiedPriorSchedule,
    scheduleEditDates: Array.from(scheduleEditDatesSet).sort(),
  };
}

// ============================================================================
// 2. Weekly Habit Matrix Builder
// ============================================================================

export interface WeeklyMatrixRow {
  localDate: string;
  weekdayLabel: string;
  shortDateLabel: string;
  isToday: boolean;
  isFuture: boolean;
  cells: EvaluatedHabitDay[];
  completedCount: number;
  partialCount: number;
  scheduledCount: number;
  rowPercent: number | null;
}

export interface WeeklyMatrixColumnSummary {
  habit: Habit;
  completedDays: number;
  partialDays: number;
  expectedCount: number;
  isWeeklyFlexible: boolean;
  footerLabel: string;
  adherencePercent: number | null;
}

export interface WeeklyMatrixViewData {
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  weekRangeLabel: string;
  relevantHabits: Habit[];
  rows: WeeklyMatrixRow[];
  columns: WeeklyMatrixColumnSummary[];
  totalCompleted: number;
  totalPartial: number;
  totalScheduledOrExpected: number;
  weeklyPercent: number | null;
  strongestHabit: WeeklyMatrixColumnSummary | null;
  attentionHabit: WeeklyMatrixColumnSummary | null;
  hasUnverifiedPriorSchedule: boolean;
}

export function buildWeeklyMatrixViewData(params: {
  weekStartLocalDate: string;
  habits: Habit[];
  logsByKey: Map<string, HabitLog>;
  todayLocalDate: string;
  effectiveTimezone: string;
}): WeeklyMatrixViewData {
  const {
    weekStartLocalDate,
    habits,
    logsByKey,
    todayLocalDate,
    effectiveTimezone,
  } = params;

  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDaysToLocalDate(weekStartLocalDate, i)
  );
  const weekEndLocalDate = weekDates[6];

  const relevantHabits = habits.filter((habit) => {
    if (habit.status === 'active') return true;
    return weekDates.some((d) => logsByKey.has(`${habit.id}:${d}`));
  });

  const lifecycles = new Map(
    relevantHabits.map((h) => [h.id, getHabitLifecycleBounds(h, effectiveTimezone)])
  );

  let hasUnverifiedPriorSchedule = false;

  const rows: WeeklyMatrixRow[] = weekDates.map((localDate) => {
    const dow = getDayOfWeekFromLocalDate(localDate);
    const parsed = parseCalendarDate(localDate);
    const cells = relevantHabits.map((habit) => {
      const evaluated = evaluateHabitDayStatus({
        habit,
        log: logsByKey.get(`${habit.id}:${localDate}`) ?? null,
        localDate,
        todayLocalDate,
        lifecycle: lifecycles.get(habit.id)!,
      });
      if (evaluated.kind === 'unverified_prior_schedule') {
        hasUnverifiedPriorSchedule = true;
      }
      return evaluated;
    });

    const completedCount = cells.filter((c) => c.kind === 'completed').length;
    const partialCount = cells.filter((c) => c.kind === 'partial').length;
    const scheduledCount = cells.filter((c) => c.countsInScheduledDenominator).length;

    const isFuture = localDate > todayLocalDate;
    const rowPercent =
      !isFuture && scheduledCount > 0
        ? Math.round((completedCount / scheduledCount) * 100)
        : null;

    return {
      localDate,
      weekdayLabel: WEEKDAY_SHORT_LABELS[dow],
      shortDateLabel: `${MONTH_SHORT_NAMES[parsed.month - 1]} ${parsed.day}`,
      isToday: localDate === todayLocalDate,
      isFuture,
      cells,
      completedCount,
      partialCount,
      scheduledCount,
      rowPercent,
    };
  });

  const columns: WeeklyMatrixColumnSummary[] = relevantHabits.map((habit, colIdx) => {
    const colCells = rows.map((r) => r.cells[colIdx]);
    const completedDays = colCells.filter((c) => c.kind === 'completed').length;
    const partialDays = colCells.filter((c) => c.kind === 'partial').length;

    if (habit.schedule.frequencyType === 'times_per_week') {
      const target = habit.schedule.targetPerWeek ?? 1;
      const cappedPercent = Math.min(100, Math.round((completedDays / target) * 100));
      return {
        habit,
        completedDays,
        partialDays,
        expectedCount: target,
        isWeeklyFlexible: true,
        footerLabel: `${completedDays}/${target} wk`,
        adherencePercent: cappedPercent,
      };
    }

    const scheduledDays = colCells.filter((c) => c.countsInScheduledDenominator).length;
    return {
      habit,
      completedDays,
      partialDays,
      expectedCount: scheduledDays,
      isWeeklyFlexible: false,
      footerLabel: `${completedDays}/${scheduledDays}`,
      adherencePercent:
        scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : null,
    };
  });

  const totalCompleted = columns.reduce((acc, c) => acc + c.completedDays, 0);
  const totalPartial = columns.reduce((acc, c) => acc + c.partialDays, 0);
  const totalScheduledOrExpected = columns.reduce((acc, c) => acc + c.expectedCount, 0);
  const weeklyPercent =
    totalScheduledOrExpected > 0
      ? Math.min(100, Math.round((totalCompleted / totalScheduledOrExpected) * 100))
      : null;

  const scorableColumns = columns.filter(
    (c) => c.habit.status === 'active' && c.adherencePercent !== null
  );
  const sortedDesc = [...scorableColumns].sort(
    (a, b) =>
      (b.adherencePercent ?? 0) - (a.adherencePercent ?? 0) ||
      b.completedDays - a.completedDays
  );
  const sortedAsc = [...scorableColumns].sort(
    (a, b) =>
      (a.adherencePercent ?? 0) - (b.adherencePercent ?? 0) ||
      a.completedDays - b.completedDays
  );

  return {
    weekStartLocalDate,
    weekEndLocalDate,
    weekRangeLabel: formatWeekRangeLabel(weekStartLocalDate),
    relevantHabits,
    rows,
    columns,
    totalCompleted,
    totalPartial,
    totalScheduledOrExpected,
    weeklyPercent,
    strongestHabit: sortedDesc[0] ?? null,
    attentionHabit:
      sortedAsc.length > 1 && sortedAsc[0]?.habit.id !== sortedDesc[0]?.habit.id
        ? sortedAsc[0]
        : sortedAsc[0] && (sortedAsc[0].adherencePercent ?? 100) < 100
          ? sortedAsc[0]
          : null,
    hasUnverifiedPriorSchedule,
  };
}

// ============================================================================
// 3. Yearly Activity Heatmap Builder
// ============================================================================

export type HeatmapCellKind =
  | 'future'
  | 'unscheduled'
  | 'unverified'
  | 'missed_zero'
  | 'partial_only'
  | 'completed';

export interface YearlyHeatmapCell {
  localDate: string;
  dateLabel: string;
  weekIndex: number;
  dayIndex: number; // 0=Sun..6=Sat
  kind: HeatmapCellKind;
  level: 0 | 1 | 2 | 3 | 4 | null;
  completedCount: number;
  partialCount: number;
  missedCount: number;
  expectedCount: number;
  summary: string;
  habitItems: EvaluatedHabitDay[];
}

export interface YearlyHeatmapMonthMarker {
  label: string;
  weekIndex: number;
}

export interface YearlyHeatmapViewData {
  year: number;
  from: string;
  to: string;
  weeks: Array<Array<YearlyHeatmapCell | null>>;
  monthMarkers: YearlyHeatmapMonthMarker[];
  totalCompletions: number;
  totalPartialLogs: number;
  activeDays: number;
  scheduledDays: number;
  completionRate: number | null;
  monthlyTrend: Array<{ month: string; completions: number }>;
  weekdayFrequency: Array<{ day: string; completions: number }>;
  peakDayName: string;
  hasUnverifiedPriorSchedule: boolean;
}

export function buildYearlyHeatmapViewData(params: {
  year: number;
  habits: Habit[];
  logsByKey: Map<string, HabitLog>;
  todayLocalDate: string;
  effectiveTimezone: string;
}): YearlyHeatmapViewData {
  const { year, habits, logsByKey, todayLocalDate, effectiveTimezone } = params;
  const from = formatCalendarDate(year, 1, 1);
  const to = formatCalendarDate(year, 12, 31);

  // Relevant habits: active + any archived habit with logs in this year
  const relevantHabits = habits.filter((habit) => {
    if (habit.status === 'active') return true;
    for (const log of logsByKey.values()) {
      if (log.habitId === habit.id && log.localDate >= from && log.localDate <= to) {
        return true;
      }
    }
    return false;
  });

  const lifecycles = new Map(
    relevantHabits.map((h) => [h.id, getHabitLifecycleBounds(h, effectiveTimezone)])
  );

  const startDow = getDayOfWeekFromLocalDate(from); // 0=Sun..6=Sat
  const totalDays = diffLocalDays(from, to) + 1;
  const totalSlots = startDow + totalDays;
  const weekCount = Math.ceil(totalSlots / 7);

  const weeks: Array<Array<YearlyHeatmapCell | null>> = Array.from(
    { length: weekCount },
    () => Array.from({ length: 7 }, () => null)
  );
  const monthMarkers: YearlyHeatmapMonthMarker[] = [];

  const monthlyCompletions = Array.from({ length: 12 }, () => 0);
  const weekdayCompletions = Array.from({ length: 7 }, () => 0);

  let totalCompletions = 0;
  let totalPartialLogs = 0;
  let activeDays = 0;
  let scheduledDays = 0;
  let totalExpectedUnits = 0;
  let hasUnverifiedPriorSchedule = false;

  for (let offset = 0; offset < totalDays; offset += 1) {
    const localDate = addDaysToLocalDate(from, offset);
    const parsed = parseCalendarDate(localDate);
    const slot = startDow + offset;
    const weekIndex = Math.floor(slot / 7);
    const dayIndex = slot % 7;

    if (parsed.day === 1) {
      monthMarkers.push({
        label: MONTH_SHORT_NAMES[parsed.month - 1],
        weekIndex,
      });
    }

    const habitItems: EvaluatedHabitDay[] = relevantHabits.map((habit) => {
      const log = logsByKey.get(`${habit.id}:${localDate}`) ?? null;
      return evaluateHabitDayStatus({
        habit,
        log,
        localDate,
        todayLocalDate,
        lifecycle: lifecycles.get(habit.id)!,
      });
    });

    const dateLabel = formatShortCalendarLabel(localDate);

    if (localDate > todayLocalDate) {
      weeks[weekIndex][dayIndex] = {
        localDate,
        dateLabel,
        weekIndex,
        dayIndex,
        kind: 'future',
        level: null,
        completedCount: 0,
        partialCount: 0,
        missedCount: 0,
        expectedCount: 0,
        summary: 'Upcoming date',
        habitItems,
      };
      continue;
    }

    let completedCount = 0;
    let partialCount = 0;
    let missedCount = 0;
    let expectedCount = 0;
    let unverifiedCount = 0;

    for (const item of habitItems) {
      if (item.kind === 'completed') completedCount += 1;
      else if (item.kind === 'partial') partialCount += 1;
      else if (item.kind === 'missed') missedCount += 1;
      else if (item.kind === 'unverified_prior_schedule') {
        unverifiedCount += 1;
        hasUnverifiedPriorSchedule = true;
      }

      if (item.countsInScheduledDenominator) {
        expectedCount += 1;
      }
    }

    totalCompletions += completedCount;
    totalPartialLogs += partialCount;
    monthlyCompletions[parsed.month - 1] += completedCount;
    weekdayCompletions[dayIndex] += completedCount;

    if (completedCount > 0) {
      activeDays += 1;
    }

    if (expectedCount > 0) {
      scheduledDays += 1;
      totalExpectedUnits += expectedCount;
    }

    let kind: HeatmapCellKind;
    let level: 0 | 1 | 2 | 3 | 4 | null;
    let summary: string;

    if (expectedCount === 0) {
      kind = unverifiedCount > 0 ? 'unverified' : 'unscheduled';
      level = null;
      summary =
        kind === 'unverified'
          ? 'No log recorded · prior schedule unrecorded'
          : 'Unscheduled / rest day';
    } else if (completedCount === 0 && partialCount > 0) {
      kind = 'partial_only';
      level = 1;
      summary = `Partial progress only (${partialCount} partial, 0 full completions)`;
    } else if (completedCount === 0) {
      kind = 'missed_zero';
      level = 0;
      summary = `0 of ${expectedCount} scheduled completed (0%)`;
    } else {
      const ratio = completedCount / expectedCount;
      const pct = Math.round(ratio * 100);
      level = ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
      kind = 'completed';
      summary =
        partialCount > 0
          ? `${completedCount} of ${expectedCount} completed (${pct}%) · ${partialCount} partial`
          : `${completedCount} of ${expectedCount} completed (${pct}%)`;
    }

    weeks[weekIndex][dayIndex] = {
      localDate,
      dateLabel,
      weekIndex,
      dayIndex,
      kind,
      level,
      completedCount,
      partialCount,
      missedCount,
      expectedCount,
      summary,
      habitItems,
    };
  }

  const monthlyTrend = MONTH_SHORT_NAMES.map((m, idx) => ({
    month: m,
    completions: monthlyCompletions[idx],
  }));

  const weekdayFrequency = WEEKDAY_MONDAY_FIRST_ORDER.map((dayIdx) => ({
    day: WEEKDAY_SHORT_LABELS[dayIdx],
    completions: weekdayCompletions[dayIdx],
  }));

  let peakDayName = '—';
  let maxWeekday = 0;
  for (const item of weekdayFrequency) {
    if (item.completions > maxWeekday) {
      maxWeekday = item.completions;
      peakDayName = item.day;
    }
  }

  const completionRate =
    totalExpectedUnits > 0
      ? Math.round((totalCompletions / totalExpectedUnits) * 100)
      : null;

  return {
    year,
    from,
    to,
    weeks,
    monthMarkers,
    totalCompletions,
    totalPartialLogs,
    activeDays,
    scheduledDays,
    completionRate,
    monthlyTrend,
    weekdayFrequency,
    peakDayName,
    hasUnverifiedPriorSchedule,
  };
}

export function getLatestWeekStart(todayLocalDate: string): string {
  return getWeekStartMonday(todayLocalDate);
}
