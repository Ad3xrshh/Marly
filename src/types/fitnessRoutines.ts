export type WorkoutActivityType =
  | 'Strength'
  | 'Cardio'
  | 'Mobility'
  | 'Recovery'
  | 'Sport'
  | 'Other';

export const WORKOUT_ACTIVITY_TYPES: WorkoutActivityType[] = [
  'Strength',
  'Cardio',
  'Mobility',
  'Recovery',
  'Sport',
  'Other',
];

export type RoutineTimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';

export const ROUTINE_TIME_OF_DAY_OPTIONS: RoutineTimeOfDay[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Anytime',
];

export type RoutineScheduleType = 'daily' | 'weekdays' | 'as_needed';
export type RoutineStatus = 'active' | 'archived';
export type RoutineLogStatus = 'in_progress' | 'completed';

export interface WorkoutSession {
  id: number;
  title: string;
  activityType: WorkoutActivityType;
  localDate: string;
  startTime: string | null;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSummary {
  weekWorkoutsCount: number;
  weekDurationMinutes: number;
  thirtyDayWorkoutsCount: number;
  thirtyDayDurationMinutes: number;
  totalWorkoutsCount: number;
  totalDurationMinutes: number;
  byType: Array<{
    activityType: WorkoutActivityType;
    count: number;
    durationMinutes: number;
  }>;
}

export interface CreateWorkoutInput {
  title: string;
  activityType?: WorkoutActivityType;
  localDate?: string;
  startTime?: string | null;
  durationMinutes: number;
  notes?: string | null;
}

export interface UpdateWorkoutInput {
  title?: string;
  activityType?: WorkoutActivityType;
  localDate?: string;
  startTime?: string | null;
  durationMinutes?: number;
  notes?: string | null;
}

export interface RoutineStep {
  id: number;
  routineId: number;
  title: string;
  durationMinutes: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineStepSnapshot {
  stepId: number;
  title: string;
  durationMinutes: number | null;
}

export interface RoutineLog {
  id: number;
  routineId: number;
  localDate: string;
  completedStepIds: number[];
  stepsSnapshot: RoutineStepSnapshot[];
  completedStepsSnapshot: RoutineStepSnapshot[];
  completedStepsCount: number;
  totalStepsSnapshot: number;
  status: RoutineLogStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Routine {
  id: number;
  name: string;
  description: string | null;
  timeOfDay: RoutineTimeOfDay;
  preferredTime: string | null;
  scheduleType: RoutineScheduleType;
  weekdays: number[];
  weekdaysMask: number;
  scheduleLabel: string;
  status: RoutineStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledToday: boolean;
  steps: RoutineStep[];
  todayLog: RoutineLog | null;
  recentLogsCount: number;
  completedCount30d: number;
}

export interface CreateRoutineStepInput {
  title: string;
  durationMinutes?: number | null;
}

export interface CreateRoutineInput {
  name: string;
  description?: string | null;
  timeOfDay?: RoutineTimeOfDay;
  preferredTime?: string | null;
  scheduleType?: RoutineScheduleType;
  weekdays?: number[];
  steps?: CreateRoutineStepInput[];
}

export interface UpdateRoutineInput {
  name?: string;
  description?: string | null;
  timeOfDay?: RoutineTimeOfDay;
  preferredTime?: string | null;
  scheduleType?: RoutineScheduleType;
  weekdays?: number[];
  status?: RoutineStatus;
}

export interface UpsertRoutineLogInput {
  localDate?: string;
  completedStepIds?: number[];
  markAllCompleted?: boolean;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}
