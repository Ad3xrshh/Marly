import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  ALL_WEEKDAYS_MASK,
  computeHabitStreakSummary,
  evaluateHabitLogSnapshot,
  formatScheduleLabel,
  formatTimestampInTimeZoneToLocalDate,
  getTodayLocalDateForTimeZone,
  isHabitScheduledOnDate,
  maskToWeekdays,
  type HabitStreakSummary,
} from '../lib/habitSchedule.ts';
import type {
  CreateHabitInputValidated,
  UpdateHabitInputValidated,
  UpsertHabitLogInputValidated,
  ValidatedHabitScheduleInput,
} from '../validators/habitValidator.ts';
import { db } from './index.ts';
import {
  goals,
  habitLogs,
  habits,
  habitSchedules,
  type HabitLogRecord,
  type HabitRecord,
  type HabitScheduleRecord,
  type HabitStatusValue,
} from './schema.ts';

export class HabitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HabitValidationError';
  }
}

export interface HydratedHabitRecord {
  habit: HabitRecord;
  schedule: HabitScheduleRecord;
  logs: HabitLogRecord[];
  targetLocalDate: string;
  userTodayLocalDate: string;
  scheduledToday: boolean;
  todayLog: HabitLogRecord | null;
  streak: HabitStreakSummary;
}

async function assertGoalOwnership(userId: number, goalId: number | null | undefined) {
  if (goalId === null || goalId === undefined) return;
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
  if (!goal) {
    throw new HabitValidationError('Selected goal was not found in your account.');
  }
}

function buildDefaultScheduleFallback(habit: HabitRecord): HabitScheduleRecord {
  return {
    id: 0,
    habitId: habit.id,
    userId: habit.userId,
    frequencyType: 'daily',
    weekdaysMask: ALL_WEEKDAYS_MASK,
    targetPerWeek: null,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
  };
}

function hydrateHabit(params: {
  habit: HabitRecord;
  schedule: HabitScheduleRecord;
  logs: HabitLogRecord[];
  userTimeZone: string;
  targetLocalDate: string;
  userTodayLocalDate: string;
}): HydratedHabitRecord {
  const { habit, schedule, logs, userTimeZone, targetLocalDate, userTodayLocalDate } = params;

  const createdLocalDate = formatTimestampInTimeZoneToLocalDate(
    habit.createdAt,
    userTimeZone
  );

  const todayLog = logs.find((l) => l.localDate === targetLocalDate) ?? null;
  const scheduledToday = isHabitScheduledOnDate(schedule, targetLocalDate);
  const streak = computeHabitStreakSummary({
    schedule,
    logs: logs.map((l) => ({
      localDate: l.localDate,
      statusSnapshot: l.statusSnapshot,
    })),
    createdLocalDate,
    todayLocalDate: userTodayLocalDate,
  });

  return {
    habit,
    schedule,
    logs,
    targetLocalDate,
    userTodayLocalDate,
    scheduledToday,
    todayLog,
    streak,
  };
}

export async function listUserHabits(params: {
  userId: number;
  userTimeZone: string;
  status?: HabitStatusValue | 'all';
  targetDate?: string;
}): Promise<HydratedHabitRecord[]> {
  const { userId, userTimeZone, status = 'all', targetDate } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const targetLocalDate = targetDate ?? userTodayLocalDate;

  const conditions = [eq(habits.userId, userId)];
  if (status !== 'all') {
    conditions.push(eq(habits.status, status));
  }

  const habitRows = await db
    .select()
    .from(habits)
    .where(and(...conditions))
    .orderBy(desc(habits.createdAt), desc(habits.id));

  if (habitRows.length === 0) return [];

  const habitIds = habitRows.map((h) => h.id);
  const [scheduleRows, logRows] = await Promise.all([
    db
      .select()
      .from(habitSchedules)
      .where(and(eq(habitSchedules.userId, userId), inArray(habitSchedules.habitId, habitIds))),
    db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), inArray(habitLogs.habitId, habitIds)))
      .orderBy(asc(habitLogs.localDate)),
  ]);

  const scheduleByHabit = new Map(scheduleRows.map((s) => [s.habitId, s]));
  const logsByHabit = new Map<number, HabitLogRecord[]>();
  for (const log of logRows) {
    const bucket = logsByHabit.get(log.habitId) ?? [];
    bucket.push(log);
    logsByHabit.set(log.habitId, bucket);
  }

  return habitRows.map((habit) =>
    hydrateHabit({
      habit,
      schedule: scheduleByHabit.get(habit.id) ?? buildDefaultScheduleFallback(habit),
      logs: logsByHabit.get(habit.id) ?? [],
      userTimeZone,
      targetLocalDate,
      userTodayLocalDate,
    })
  );
}

export async function getUserHabitById(params: {
  userId: number;
  habitId: number;
  userTimeZone: string;
  targetDate?: string;
}): Promise<HydratedHabitRecord | null> {
  const { userId, habitId, userTimeZone, targetDate } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const targetLocalDate = targetDate ?? userTodayLocalDate;

  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

  if (!habit) return null;

  const [[schedule], logs] = await Promise.all([
    db
      .select()
      .from(habitSchedules)
      .where(and(eq(habitSchedules.habitId, habit.id), eq(habitSchedules.userId, userId))),
    db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.userId, userId)))
      .orderBy(asc(habitLogs.localDate)),
  ]);

  return hydrateHabit({
    habit,
    schedule: schedule ?? buildDefaultScheduleFallback(habit),
    logs,
    userTimeZone,
    targetLocalDate,
    userTodayLocalDate,
  });
}

export async function createUserHabit(params: {
  userId: number;
  userTimeZone: string;
  input: CreateHabitInputValidated;
}): Promise<HydratedHabitRecord> {
  const { userId, userTimeZone, input } = params;
  await assertGoalOwnership(userId, input.goalId);

  const now = new Date();
  const created = await db.transaction(async (tx) => {
    const [habit] = await tx
      .insert(habits)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        trackingType: input.trackingType,
        targetValue: input.trackingType === 'measurable' ? (input.targetValue ?? null) : null,
        unit: input.trackingType === 'measurable' ? (input.unit ?? null) : null,
        status: 'active',
        goalId: input.goalId ?? null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [schedule] = await tx
      .insert(habitSchedules)
      .values({
        habitId: habit.id,
        userId,
        frequencyType: input.schedule.frequencyType,
        weekdaysMask: input.schedule.weekdaysMask,
        targetPerWeek: input.schedule.targetPerWeek,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { habit, schedule };
  });

  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  return hydrateHabit({
    habit: created.habit,
    schedule: created.schedule,
    logs: [],
    userTimeZone,
    targetLocalDate: userTodayLocalDate,
    userTodayLocalDate,
  });
}

export async function updateUserHabit(params: {
  userId: number;
  habitId: number;
  userTimeZone: string;
  patch: UpdateHabitInputValidated;
}): Promise<HydratedHabitRecord | null> {
  const { userId, habitId, userTimeZone, patch } = params;

  if (patch.goalId !== undefined) {
    await assertGoalOwnership(userId, patch.goalId);
  }

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (!existing) return null;

    const nextTrackingType = patch.trackingType ?? existing.trackingType;
    let nextTargetValue =
      patch.targetValue !== undefined ? patch.targetValue : existing.targetValue;
    let nextUnit = patch.unit !== undefined ? patch.unit : existing.unit;

    if (nextTrackingType === 'boolean') {
      if (patch.targetValue !== undefined && patch.targetValue !== null) {
        throw new HabitValidationError(
          'Boolean habits do not accept a numeric target value.'
        );
      }
      nextTargetValue = null;
      nextUnit = null;
    } else if (nextTargetValue === null || nextTargetValue === undefined || nextTargetValue <= 0) {
      throw new HabitValidationError(
        'Measurable habits require a target value greater than 0.'
      );
    }

    const nextStatus = patch.status ?? existing.status;
    let nextArchivedAt = existing.archivedAt;
    if (patch.status === 'archived' && existing.status !== 'archived') {
      nextArchivedAt = new Date();
    } else if (patch.status === 'active' && existing.status !== 'active') {
      nextArchivedAt = null;
    }

    const now = new Date();
    const [habit] = await tx
      .update(habits)
      .set({
        name: patch.name !== undefined ? patch.name : existing.name,
        description:
          patch.description !== undefined ? patch.description : existing.description,
        category: patch.category !== undefined ? patch.category : existing.category,
        trackingType: nextTrackingType,
        targetValue: nextTargetValue,
        unit: nextUnit,
        status: nextStatus,
        goalId: patch.goalId !== undefined ? patch.goalId : existing.goalId,
        archivedAt: nextArchivedAt,
        updatedAt: now,
      })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();

    let [schedule] = await tx
      .select()
      .from(habitSchedules)
      .where(and(eq(habitSchedules.habitId, habitId), eq(habitSchedules.userId, userId)));

    if (patch.schedule) {
      if (schedule) {
        const [updatedSchedule] = await tx
          .update(habitSchedules)
          .set({
            frequencyType: patch.schedule.frequencyType,
            weekdaysMask: patch.schedule.weekdaysMask,
            targetPerWeek: patch.schedule.targetPerWeek,
            updatedAt: now,
          })
          .where(and(eq(habitSchedules.id, schedule.id), eq(habitSchedules.userId, userId)))
          .returning();
        schedule = updatedSchedule;
      } else {
        const [createdSchedule] = await tx
          .insert(habitSchedules)
          .values({
            habitId,
            userId,
            frequencyType: patch.schedule.frequencyType,
            weekdaysMask: patch.schedule.weekdaysMask,
            targetPerWeek: patch.schedule.targetPerWeek,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        schedule = createdSchedule;
      }
    }

    const logs = await tx
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId)))
      .orderBy(asc(habitLogs.localDate));

    return {
      habit,
      schedule: schedule ?? buildDefaultScheduleFallback(habit),
      logs,
    };
  });

  if (!updated) return null;

  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  return hydrateHabit({
    habit: updated.habit,
    schedule: updated.schedule,
    logs: updated.logs,
    userTimeZone,
    targetLocalDate: userTodayLocalDate,
    userTodayLocalDate,
  });
}

export async function updateUserHabitSchedule(params: {
  userId: number;
  habitId: number;
  userTimeZone: string;
  scheduleInput: ValidatedHabitScheduleInput;
}): Promise<HydratedHabitRecord | null> {
  const { userId, habitId, userTimeZone, scheduleInput } = params;

  const result = await db.transaction(async (tx) => {
    const [habit] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (!habit) return null;

    const now = new Date();
    const [existingSchedule] = await tx
      .select()
      .from(habitSchedules)
      .where(and(eq(habitSchedules.habitId, habitId), eq(habitSchedules.userId, userId)));

    let schedule: HabitScheduleRecord;
    if (existingSchedule) {
      const [updatedSchedule] = await tx
        .update(habitSchedules)
        .set({
          frequencyType: scheduleInput.frequencyType,
          weekdaysMask: scheduleInput.weekdaysMask,
          targetPerWeek: scheduleInput.targetPerWeek,
          updatedAt: now,
        })
        .where(
          and(eq(habitSchedules.id, existingSchedule.id), eq(habitSchedules.userId, userId))
        )
        .returning();
      schedule = updatedSchedule;
    } else {
      const [createdSchedule] = await tx
        .insert(habitSchedules)
        .values({
          habitId,
          userId,
          frequencyType: scheduleInput.frequencyType,
          weekdaysMask: scheduleInput.weekdaysMask,
          targetPerWeek: scheduleInput.targetPerWeek,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      schedule = createdSchedule;
    }

    await tx
      .update(habits)
      .set({ updatedAt: now })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    const logs = await tx
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId)))
      .orderBy(asc(habitLogs.localDate));

    return { habit, schedule, logs };
  });

  if (!result) return null;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  return hydrateHabit({
    habit: result.habit,
    schedule: result.schedule,
    logs: result.logs,
    userTimeZone,
    targetLocalDate: userTodayLocalDate,
    userTodayLocalDate,
  });
}

export async function deleteUserHabit(
  userId: number,
  habitId: number
): Promise<HabitRecord | null> {
  const [deleted] = await db
    .delete(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .returning();

  return deleted ?? null;
}

export async function upsertUserHabitLog(params: {
  userId: number;
  habitId: number;
  userTimeZone: string;
  input: UpsertHabitLogInputValidated;
}): Promise<{
  log: HabitLogRecord;
  hydratedHabit: HydratedHabitRecord;
} | null> {
  const { userId, habitId, userTimeZone, input } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const localDate = input.localDate ?? userTodayLocalDate;

  if (localDate > userTodayLocalDate) {
    throw new HabitValidationError(
      `Cannot log a habit completion for a future date (${localDate}).`
    );
  }

  const outcome = await db.transaction(async (tx) => {
    const [habit] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (!habit) return null;

    if (habit.status === 'archived') {
      throw new HabitValidationError(
        'Restore this archived habit before logging completions.'
      );
    }

    if (habit.trackingType === 'boolean') {
      if (input.completedValue !== undefined && input.completedValue !== 1) {
        throw new HabitValidationError(
          'Boolean habits only accept binary completion (value must be 1 or omitted).'
        );
      }
    } else if (input.completedValue === undefined) {
      throw new HabitValidationError(
        'Measurable habits require a non-negative numeric completedValue.'
      );
    }

    const [existingLog] = await tx
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.localDate, localDate)));

    // Preserve the target snapshot that applied when the log was recorded
    const effectiveTarget =
      habit.trackingType === 'boolean'
        ? 1
        : existingLog?.targetSnapshot ?? habit.targetValue ?? 1;

    const evaluated = evaluateHabitLogSnapshot({
      trackingType: habit.trackingType,
      completedValue: input.completedValue ?? 1,
      effectiveTarget,
    });

    const now = new Date();
    const [upsertedLog] = await tx
      .insert(habitLogs)
      .values({
        habitId,
        userId,
        localDate,
        completedValue: evaluated.completedValue,
        targetSnapshot: evaluated.targetSnapshot,
        statusSnapshot: evaluated.statusSnapshot,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [habitLogs.habitId, habitLogs.localDate],
        set: {
          completedValue: evaluated.completedValue,
          targetSnapshot: evaluated.targetSnapshot,
          statusSnapshot: evaluated.statusSnapshot,
          completedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    const [[schedule], logs] = await Promise.all([
      tx
        .select()
        .from(habitSchedules)
        .where(and(eq(habitSchedules.habitId, habitId), eq(habitSchedules.userId, userId))),
      tx
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId)))
        .orderBy(asc(habitLogs.localDate)),
    ]);

    return {
      log: upsertedLog,
      habit,
      schedule: schedule ?? buildDefaultScheduleFallback(habit),
      logs,
    };
  });

  if (!outcome) return null;

  return {
    log: outcome.log,
    hydratedHabit: hydrateHabit({
      habit: outcome.habit,
      schedule: outcome.schedule,
      logs: outcome.logs,
      userTimeZone,
      targetLocalDate: userTodayLocalDate,
      userTodayLocalDate,
    }),
  };
}

export async function deleteUserHabitLog(params: {
  userId: number;
  habitId: number;
  localDate: string;
  userTimeZone: string;
}): Promise<{
  habitExists: boolean;
  deletedLog: HabitLogRecord | null;
  hydratedHabit: HydratedHabitRecord | null;
}> {
  const { userId, habitId, localDate, userTimeZone } = params;

  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

  if (!habit) {
    return { habitExists: false, deletedLog: null, hydratedHabit: null };
  }

  const [deletedLog] = await db
    .delete(habitLogs)
    .where(
      and(
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.userId, userId),
        eq(habitLogs.localDate, localDate)
      )
    )
    .returning();

  const hydratedHabit = await getUserHabitById({
    userId,
    habitId,
    userTimeZone,
  });

  return {
    habitExists: true,
    deletedLog: deletedLog ?? null,
    hydratedHabit,
  };
}

export async function listHabitLogsForHabit(params: {
  userId: number;
  habitId: number;
  from?: string;
  to?: string;
}): Promise<{ habit: HabitRecord; logs: HabitLogRecord[] } | null> {
  const { userId, habitId, from, to } = params;

  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

  if (!habit) return null;

  const conditions = [eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId)];
  if (from) conditions.push(gte(habitLogs.localDate, from));
  if (to) conditions.push(lte(habitLogs.localDate, to));

  const logs = await db
    .select()
    .from(habitLogs)
    .where(and(...conditions))
    .orderBy(asc(habitLogs.localDate));

  return { habit, logs };
}

export async function listUserHabitLogsInRange(params: {
  userId: number;
  from: string;
  to: string;
}): Promise<HabitLogRecord[]> {
  const { userId, from, to } = params;
  return db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        gte(habitLogs.localDate, from),
        lte(habitLogs.localDate, to)
      )
    )
    .orderBy(asc(habitLogs.localDate), asc(habitLogs.habitId));
}

export function serializeHabitLog(record: HabitLogRecord) {
  return {
    id: record.id,
    habitId: record.habitId,
    localDate: record.localDate,
    completedValue: record.completedValue,
    targetSnapshot: record.targetSnapshot,
    statusSnapshot: record.statusSnapshot,
    completedAt: record.completedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeHabit(hydrated: HydratedHabitRecord) {
  const { habit, schedule, scheduledToday, todayLog, streak } = hydrated;
  const weekdays =
    schedule.frequencyType === 'weekdays'
      ? maskToWeekdays(schedule.weekdaysMask)
      : schedule.frequencyType === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : [0, 1, 2, 3, 4, 5, 6];

  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    category: habit.category,
    trackingType: habit.trackingType,
    targetValue: habit.targetValue,
    unit: habit.unit,
    status: habit.status,
    goalId: habit.goalId,
    archivedAt: habit.archivedAt ? habit.archivedAt.toISOString() : null,
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
    schedule: {
      id: schedule.id,
      frequencyType: schedule.frequencyType,
      weekdays,
      weekdaysMask: schedule.weekdaysMask,
      targetPerWeek: schedule.targetPerWeek,
      label: formatScheduleLabel({
        frequencyType: schedule.frequencyType,
        weekdays,
        weekdaysMask: schedule.weekdaysMask,
        targetPerWeek: schedule.targetPerWeek,
      }),
    },
    scheduledToday,
    todayLog: todayLog ? serializeHabitLog(todayLog) : null,
    streak,
  };
}
