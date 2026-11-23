import type {
  HabitFrequencyTypeValue,
  HabitLogStatusSnapshotValue,
  HabitTrackingTypeValue,
} from '../db/schema.ts';
import {
  addDaysToLocalDate,
  formatCalendarDate,
  formatTimestampInTimeZoneToLocalDate,
  getDayOfWeekFromLocalDate,
  getTodayLocalDateForTimeZone,
  getWeekStartMonday,
  isValidCalendarDate,
  isValidIanaTimeZone,
  normalizeTimeZoneOrNull,
  parseCalendarDate,
} from './timezone.ts';

export {
  addDaysToLocalDate,
  formatCalendarDate,
  formatTimestampInTimeZoneToLocalDate,
  getDayOfWeekFromLocalDate,
  getTodayLocalDateForTimeZone,
  getWeekStartMonday,
  isValidCalendarDate,
  isValidIanaTimeZone,
  normalizeTimeZoneOrNull,
  parseCalendarDate,
};

export const ALL_WEEKDAYS_MASK = 127; // Bits 0..6 (Sun..Sat)
export const WEEKDAY_SHORT_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_MONDAY_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export interface HabitScheduleShape {
  frequencyType: HabitFrequencyTypeValue;
  weekdaysMask: number;
  targetPerWeek: number | null;
}

export interface StreakLogInput {
  localDate: string;
  statusSnapshot: HabitLogStatusSnapshotValue;
}

export interface HabitStreakSummary {
  streakUnit: 'days' | 'weeks';
  currentStreak: number;
  longestStreak: number;
  weeklyCompletionsCount: number | null;
  weeklyTarget: number | null;
}

export function weekdaysToMask(weekdays: number[]): number {
  let mask = 0;
  for (const day of weekdays) {
    if (Number.isInteger(day) && day >= 0 && day <= 6) {
      mask |= 1 << day;
    }
  }
  return mask;
}

export function maskToWeekdays(mask: number): number[] {
  const days: number[] = [];
  for (let day = 0; day <= 6; day += 1) {
    if ((mask & (1 << day)) !== 0) {
      days.push(day);
    }
  }
  return days;
}

export function formatScheduleLabel(schedule: {
  frequencyType: HabitFrequencyTypeValue;
  weekdays?: number[];
  weekdaysMask?: number;
  targetPerWeek: number | null;
}): string {
  if (schedule.frequencyType === 'daily') {
    return 'Daily';
  }
  if (schedule.frequencyType === 'times_per_week') {
    const count = schedule.targetPerWeek ?? 1;
    return `${count}x / week`;
  }
  const days =
    schedule.weekdays ?? maskToWeekdays(schedule.weekdaysMask ?? ALL_WEEKDAYS_MASK);
  const daySet = new Set(days);
  const ordered = WEEKDAY_MONDAY_FIRST_ORDER.filter((d) => daySet.has(d));
  if (ordered.length === 7) return 'Daily';
  if (ordered.length === 5 && [1, 2, 3, 4, 5].every((d) => daySet.has(d))) {
    return 'Weekdays';
  }
  if (ordered.length === 2 && daySet.has(0) && daySet.has(6)) {
    return 'Weekends';
  }
  return ordered.map((d) => WEEKDAY_SHORT_LABELS[d]).join(', ');
}

/**
 * Determines whether a habit is scheduled/eligible on `localDate`.
 * - `daily`: always true (all 7 days scheduled).
 * - `weekdays`: true iff the weekday bit is set in `weekdaysMask`.
 * - `times_per_week`: true for all days (flexible across the week; `weekdaysMask` is never consulted).
 */
export function isHabitScheduledOnDate(
  schedule: HabitScheduleShape,
  localDate: string
): boolean {
  if (schedule.frequencyType === 'daily') {
    return true;
  }
  if (schedule.frequencyType === 'times_per_week') {
    return true;
  }
  const dow = getDayOfWeekFromLocalDate(localDate);
  return (schedule.weekdaysMask & (1 << dow)) !== 0;
}

export function evaluateHabitLogSnapshot(params: {
  trackingType: HabitTrackingTypeValue;
  completedValue: number;
  effectiveTarget: number;
}): {
  completedValue: number;
  targetSnapshot: number;
  statusSnapshot: HabitLogStatusSnapshotValue;
} {
  if (params.trackingType === 'boolean') {
    return {
      completedValue: 1,
      targetSnapshot: 1,
      statusSnapshot: 'completed',
    };
  }

  const target = params.effectiveTarget > 0 ? params.effectiveTarget : 1;
  const value = Math.max(0, params.completedValue);
  return {
    completedValue: value,
    targetSnapshot: target,
    statusSnapshot: value >= target ? 'completed' : 'partial',
  };
}

/**
 * Caps visual progress display to 0..100 while allowing actual logged values to exceed target.
 */
export function computeLogProgressPercent(
  completedValue: number,
  targetSnapshot: number | null
): number {
  if (!targetSnapshot || targetSnapshot <= 0) {
    return completedValue > 0 ? 100 : 0;
  }
  return Math.min(100, Math.max(0, Math.round((completedValue / targetSnapshot) * 100)));
}

/**
 * Deterministic schedule-aware streak calculation derived strictly from `habit_schedules` and `habit_logs`.
 * - Only `statusSnapshot === 'completed'` logs advance streaks (partial measurable logs never advance streaks).
 * - `daily` and `weekdays`: consecutive scheduled completed days; unscheduled days are skipped; unfinished today does not break streak.
 * - `times_per_week`: consecutive qualifying Mon–Sun weeks (`completedDays >= targetPerWeek`); current in-progress week is never penalized.
 */
export function computeHabitStreakSummary(params: {
  schedule: HabitScheduleShape;
  logs: StreakLogInput[];
  createdLocalDate: string;
  todayLocalDate: string;
}): HabitStreakSummary {
  const { schedule, logs, createdLocalDate, todayLocalDate } = params;

  const completedDates = new Set<string>();
  for (const log of logs) {
    if (log.statusSnapshot === 'completed' && log.localDate <= todayLocalDate) {
      completedDates.add(log.localDate);
    }
  }

  let earliestAnchor = createdLocalDate <= todayLocalDate ? createdLocalDate : todayLocalDate;
  for (const dateStr of completedDates) {
    if (dateStr < earliestAnchor) {
      earliestAnchor = dateStr;
    }
  }

  if (schedule.frequencyType === 'times_per_week') {
    const weeklyTarget = Math.max(1, Math.min(7, schedule.targetPerWeek ?? 1));
    const weekCounts = new Map<string, number>();

    for (const dateStr of completedDates) {
      const weekStart = getWeekStartMonday(dateStr);
      weekCounts.set(weekStart, (weekCounts.get(weekStart) ?? 0) + 1);
    }

    const currentWeekStart = getWeekStartMonday(todayLocalDate);
    const weeklyCompletionsCount = weekCounts.get(currentWeekStart) ?? 0;
    const earliestWeekStart = getWeekStartMonday(earliestAnchor);

    // Current weekly streak
    let currentStreak = 0;
    let weekCursor =
      weeklyCompletionsCount >= weeklyTarget
        ? currentWeekStart
        : addDaysToLocalDate(currentWeekStart, -7);

    while (weekCursor >= earliestWeekStart) {
      if ((weekCounts.get(weekCursor) ?? 0) >= weeklyTarget) {
        currentStreak += 1;
        weekCursor = addDaysToLocalDate(weekCursor, -7);
      } else {
        break;
      }
    }

    // Longest weekly streak across all weeks through currentWeekStart
    let longestStreak = 0;
    let runningStreak = 0;
    let scanWeek = earliestWeekStart;
    while (scanWeek <= currentWeekStart) {
      const count = weekCounts.get(scanWeek) ?? 0;
      if (count >= weeklyTarget) {
        runningStreak += 1;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else if (scanWeek !== currentWeekStart) {
        // Past closed week missed target -> reset; current incomplete week does not penalize
        runningStreak = 0;
      }
      scanWeek = addDaysToLocalDate(scanWeek, 7);
    }

    return {
      streakUnit: 'weeks',
      currentStreak,
      longestStreak,
      weeklyCompletionsCount,
      weeklyTarget,
    };
  }

  // Daily or selected weekdays -> consecutive scheduled-day streaks
  let currentStreak = 0;
  let cursor = todayLocalDate;
  if (isHabitScheduledOnDate(schedule, todayLocalDate) && !completedDates.has(todayLocalDate)) {
    cursor = addDaysToLocalDate(todayLocalDate, -1);
  }

  while (cursor >= earliestAnchor) {
    if (!isHabitScheduledOnDate(schedule, cursor)) {
      cursor = addDaysToLocalDate(cursor, -1);
      continue;
    }
    if (completedDates.has(cursor)) {
      currentStreak += 1;
      cursor = addDaysToLocalDate(cursor, -1);
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let running = 0;
  let scan = earliestAnchor;
  while (scan <= todayLocalDate) {
    if (!isHabitScheduledOnDate(schedule, scan)) {
      scan = addDaysToLocalDate(scan, 1);
      continue;
    }
    if (completedDates.has(scan)) {
      running += 1;
      if (running > longestStreak) {
        longestStreak = running;
      }
    } else {
      running = 0;
    }
    scan = addDaysToLocalDate(scan, 1);
  }

  return {
    streakUnit: 'days',
    currentStreak,
    longestStreak,
    weeklyCompletionsCount: null,
    weeklyTarget: null,
  };
}
