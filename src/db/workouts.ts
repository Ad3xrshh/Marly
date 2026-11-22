import { and, desc, eq, gte, lte } from 'drizzle-orm';
import {
  addDaysToLocalDate,
  getTodayLocalDateForTimeZone,
  getWeekStartMonday,
} from '../lib/habitSchedule.ts';
import type {
  CreateWorkoutValidated,
  UpdateWorkoutValidated,
} from '../validators/fitnessRoutinesValidator.ts';
import { db } from './index.ts';
import {
  workoutSessions,
  type WorkoutActivityTypeValue,
  type WorkoutSessionRecord,
} from './schema.ts';

export interface WorkoutSummaryResult {
  weekWorkoutsCount: number;
  weekDurationMinutes: number;
  thirtyDayWorkoutsCount: number;
  thirtyDayDurationMinutes: number;
  totalWorkoutsCount: number;
  totalDurationMinutes: number;
  byType: Array<{
    activityType: WorkoutActivityTypeValue;
    count: number;
    durationMinutes: number;
  }>;
}

export function serializeWorkout(record: WorkoutSessionRecord) {
  return {
    id: record.id,
    title: record.title,
    activityType: record.activityType,
    localDate: record.localDate,
    startTime: record.startTime,
    durationMinutes: record.durationMinutes,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function computeWorkoutSummary(
  sessions: WorkoutSessionRecord[],
  userTimeZone: string
): WorkoutSummaryResult {
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const weekStart = getWeekStartMonday(todayLocalDate);
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  const thirtyDayStart = addDaysToLocalDate(todayLocalDate, -29);

  let weekWorkoutsCount = 0;
  let weekDurationMinutes = 0;
  let thirtyDayWorkoutsCount = 0;
  let thirtyDayDurationMinutes = 0;
  let totalWorkoutsCount = 0;
  let totalDurationMinutes = 0;

  const byTypeMap = new Map<
    WorkoutActivityTypeValue,
    { count: number; durationMinutes: number }
  >();

  for (const session of sessions) {
    totalWorkoutsCount += 1;
    totalDurationMinutes += session.durationMinutes;

    if (session.localDate >= weekStart && session.localDate <= weekEnd) {
      weekWorkoutsCount += 1;
      weekDurationMinutes += session.durationMinutes;
    }

    if (session.localDate >= thirtyDayStart && session.localDate <= todayLocalDate) {
      thirtyDayWorkoutsCount += 1;
      thirtyDayDurationMinutes += session.durationMinutes;

      const existing = byTypeMap.get(session.activityType) ?? {
        count: 0,
        durationMinutes: 0,
      };
      existing.count += 1;
      existing.durationMinutes += session.durationMinutes;
      byTypeMap.set(session.activityType, existing);
    }
  }

  const byType = Array.from(byTypeMap.entries())
    .map(([activityType, stats]) => ({
      activityType,
      count: stats.count,
      durationMinutes: stats.durationMinutes,
    }))
    .sort((a, b) => {
      if (b.durationMinutes !== a.durationMinutes) {
        return b.durationMinutes - a.durationMinutes;
      }
      return b.count - a.count;
    });

  return {
    weekWorkoutsCount,
    weekDurationMinutes,
    thirtyDayWorkoutsCount,
    thirtyDayDurationMinutes,
    totalWorkoutsCount,
    totalDurationMinutes,
    byType,
  };
}

export async function listUserWorkouts(params: {
  userId: number;
  userTimeZone: string;
  from?: string;
  to?: string;
  activityType?: WorkoutActivityTypeValue;
}): Promise<{
  workouts: WorkoutSessionRecord[];
  summary: WorkoutSummaryResult;
}> {
  const { userId, userTimeZone, from, to, activityType } = params;

  const conditions = [eq(workoutSessions.userId, userId)];
  if (from) conditions.push(gte(workoutSessions.localDate, from));
  if (to) conditions.push(lte(workoutSessions.localDate, to));
  if (activityType) conditions.push(eq(workoutSessions.activityType, activityType));

  const hasFilters = Boolean(from || to || activityType);

  const [filteredWorkouts, allWorkouts] = await Promise.all([
    db
      .select()
      .from(workoutSessions)
      .where(and(...conditions))
      .orderBy(
        desc(workoutSessions.localDate),
        desc(workoutSessions.createdAt),
        desc(workoutSessions.id)
      ),
    hasFilters
      ? db
          .select()
          .from(workoutSessions)
          .where(eq(workoutSessions.userId, userId))
      : Promise.resolve(null),
  ]);

  const summarySource = allWorkouts ?? filteredWorkouts;
  const summary = computeWorkoutSummary(summarySource, userTimeZone);

  return {
    workouts: filteredWorkouts,
    summary,
  };
}

export async function getUserWorkoutById(
  userId: number,
  workoutId: number
): Promise<WorkoutSessionRecord | null> {
  const [workout] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, workoutId), eq(workoutSessions.userId, userId)));

  return workout ?? null;
}

export async function createUserWorkout(params: {
  userId: number;
  userTimeZone: string;
  input: CreateWorkoutValidated;
}): Promise<WorkoutSessionRecord> {
  const { userId, userTimeZone, input } = params;
  const now = new Date();
  const localDate = input.localDate ?? getTodayLocalDateForTimeZone(userTimeZone, now);

  const [created] = await db
    .insert(workoutSessions)
    .values({
      userId,
      title: input.title,
      activityType: input.activityType,
      localDate,
      startTime: input.startTime ?? null,
      durationMinutes: input.durationMinutes,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateUserWorkout(params: {
  userId: number;
  workoutId: number;
  patch: UpdateWorkoutValidated;
}): Promise<WorkoutSessionRecord | null> {
  const { userId, workoutId, patch } = params;

  const [existing] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, workoutId), eq(workoutSessions.userId, userId)));

  if (!existing) return null;

  const [updated] = await db
    .update(workoutSessions)
    .set({
      title: patch.title !== undefined ? patch.title : existing.title,
      activityType:
        patch.activityType !== undefined ? patch.activityType : existing.activityType,
      localDate: patch.localDate !== undefined ? patch.localDate : existing.localDate,
      startTime: patch.startTime !== undefined ? patch.startTime : existing.startTime,
      durationMinutes:
        patch.durationMinutes !== undefined
          ? patch.durationMinutes
          : existing.durationMinutes,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(workoutSessions.id, workoutId), eq(workoutSessions.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteUserWorkout(
  userId: number,
  workoutId: number
): Promise<WorkoutSessionRecord | null> {
  const [deleted] = await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, workoutId), eq(workoutSessions.userId, userId)))
    .returning();

  return deleted ?? null;
}
