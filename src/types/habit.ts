import type { TaskCategory } from './task';

export type HabitStatus = 'active' | 'archived';
export type HabitTrackingType = 'boolean' | 'measurable';
export type HabitFrequencyType = 'daily' | 'weekdays' | 'times_per_week';
export type HabitLogStatusSnapshot = 'completed' | 'partial';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  timezone: string | null;
  effectiveTimezone: string;
  timezoneInitialized: boolean;
  todayLocalDate: string;
}

export interface HabitSchedule {
  id: number;
  frequencyType: HabitFrequencyType;
  weekdays: number[];
  weekdaysMask: number;
  targetPerWeek: number | null;
  createdAt: string;
  updatedAt: string;
  label: string;
}

export interface HabitLog {
  id: number;
  habitId: number;
  localDate: string;
  completedValue: number;
  targetSnapshot: number | null;
  statusSnapshot: HabitLogStatusSnapshot;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitStreak {
  streakUnit: 'days' | 'weeks';
  currentStreak: number;
  longestStreak: number;
  weeklyCompletionsCount: number | null;
  weeklyTarget: number | null;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  category: TaskCategory;
  trackingType: HabitTrackingType;
  targetValue: number | null;
  unit: string | null;
  status: HabitStatus;
  goalId: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schedule: HabitSchedule;
  scheduledToday: boolean;
  todayLog: HabitLog | null;
  streak: HabitStreak;
}

export interface HabitsMeta {
  timezone: string;
  timezoneInitialized: boolean;
  todayLocalDate: string;
  targetLocalDate: string;
}

export interface HabitScheduleInput {
  frequencyType: HabitFrequencyType;
  weekdays?: number[];
  targetPerWeek?: number | null;
}

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  category?: TaskCategory;
  trackingType?: HabitTrackingType;
  targetValue?: number | null;
  unit?: string | null;
  goalId?: number | null;
  schedule?: HabitScheduleInput;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  category?: TaskCategory;
  trackingType?: HabitTrackingType;
  targetValue?: number | null;
  unit?: string | null;
  status?: HabitStatus;
  goalId?: number | null;
  schedule?: HabitScheduleInput;
}

export interface UpsertHabitLogInput {
  localDate?: string;
  completedValue?: number;
}

export function formatHabitTargetLabel(habit: Pick<Habit, 'trackingType' | 'targetValue' | 'unit'>): string {
  if (habit.trackingType === 'boolean') {
    return 'Check-off';
  }
  const value = habit.targetValue ?? 0;
  return habit.unit ? `${value} ${habit.unit}` : `${value}`;
}

export function formatHabitStreakLabel(habit: Pick<Habit, 'streak'>): string {
  const { streakUnit, currentStreak } = habit.streak;
  if (streakUnit === 'weeks') {
    return `${currentStreak}w streak`;
  }
  return `${currentStreak}d streak`;
}

export function formatHabitStreakDetail(habit: Pick<Habit, 'streak'>): string {
  const { streakUnit, currentStreak, longestStreak, weeklyCompletionsCount, weeklyTarget } =
    habit.streak;
  if (streakUnit === 'weeks') {
    const unitLabel = currentStreak === 1 ? 'week' : 'weeks';
    const progressPart =
      weeklyCompletionsCount !== null && weeklyTarget !== null
        ? ` · ${weeklyCompletionsCount}/${weeklyTarget} this week`
        : '';
    return `${currentStreak} ${unitLabel} (best ${longestStreak}w)${progressPart}`;
  }
  const unitLabel = currentStreak === 1 ? 'day' : 'days';
  return `${currentStreak} ${unitLabel} (best ${longestStreak}d)`;
}

export function formatLogValueLabel(
  log: Pick<HabitLog, 'completedValue' | 'targetSnapshot'>,
  unit: string | null,
  trackingType: HabitTrackingType
): string {
  if (trackingType === 'boolean') {
    return 'Done';
  }
  const target = log.targetSnapshot;
  const suffix = unit ? ` ${unit}` : '';
  if (target !== null) {
    return `${log.completedValue} / ${target}${suffix}`;
  }
  return `${log.completedValue}${suffix}`;
}
