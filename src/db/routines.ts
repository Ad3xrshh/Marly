import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  ALL_WEEKDAYS_MASK,
  addDaysToLocalDate,
  formatScheduleLabel,
  getDayOfWeekFromLocalDate,
  getTodayLocalDateForTimeZone,
  maskToWeekdays,
} from '../lib/habitSchedule.ts';
import type {
  CreateRoutineStepValidated,
  CreateRoutineValidated,
  UpdateRoutineStepValidated,
  UpdateRoutineValidated,
  UpsertRoutineLogValidated,
} from '../validators/fitnessRoutinesValidator.ts';
import { db } from './index.ts';
import {
  routineLogs,
  routines,
  routineSteps,
  type RoutineLogRecord,
  type RoutineLogStatusValue,
  type RoutineRecord,
  type RoutineScheduleTypeValue,
  type RoutineStatusValue,
  type RoutineStepRecord,
  type RoutineStepSnapshotItem,
} from './schema.ts';

export class RoutineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutineValidationError';
  }
}

export interface HydratedRoutineRecord {
  routine: RoutineRecord;
  steps: RoutineStepRecord[];
  todayLog: RoutineLogRecord | null;
  scheduledToday: boolean;
  recentLogsCount: number;
  completedCount30d: number;
}

export function formatRoutineScheduleLabel(
  scheduleType: RoutineScheduleTypeValue,
  weekdaysMask: number
): string {
  if (scheduleType === 'daily') return 'Daily';
  if (scheduleType === 'as_needed') return 'As needed';
  return formatScheduleLabel({
    frequencyType: 'weekdays',
    weekdaysMask,
    targetPerWeek: null,
  });
}

export function isRoutineScheduledOnDate(
  scheduleType: RoutineScheduleTypeValue,
  weekdaysMask: number,
  localDate: string
): boolean {
  if (scheduleType === 'daily') return true;
  if (scheduleType === 'as_needed') return false;
  const dow = getDayOfWeekFromLocalDate(localDate);
  return (weekdaysMask & (1 << dow)) !== 0;
}

export function serializeRoutineStep(record: RoutineStepRecord) {
  return {
    id: record.id,
    routineId: record.routineId,
    title: record.title,
    durationMinutes: record.durationMinutes,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeRoutineLog(record: RoutineLogRecord) {
  return {
    id: record.id,
    routineId: record.routineId,
    localDate: record.localDate,
    completedStepIds: record.completedStepIds,
    stepsSnapshot: record.stepsSnapshot,
    completedStepsSnapshot: record.completedStepsSnapshot,
    completedStepsCount: record.completedStepsCount,
    totalStepsSnapshot: record.totalStepsSnapshot,
    status: record.status,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeRoutine(hydrated: HydratedRoutineRecord) {
  const { routine, steps, todayLog, scheduledToday, recentLogsCount, completedCount30d } =
    hydrated;

  const weekdays =
    routine.scheduleType === 'weekdays'
      ? maskToWeekdays(routine.weekdaysMask)
      : [0, 1, 2, 3, 4, 5, 6];

  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    timeOfDay: routine.timeOfDay,
    preferredTime: routine.preferredTime,
    scheduleType: routine.scheduleType,
    weekdays,
    weekdaysMask: routine.weekdaysMask,
    scheduleLabel: formatRoutineScheduleLabel(routine.scheduleType, routine.weekdaysMask),
    status: routine.status,
    archivedAt: routine.archivedAt ? routine.archivedAt.toISOString() : null,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
    scheduledToday,
    steps: steps.map(serializeRoutineStep),
    todayLog: todayLog ? serializeRoutineLog(todayLog) : null,
    recentLogsCount,
    completedCount30d,
  };
}

function hydrateRoutine(params: {
  routine: RoutineRecord;
  steps: RoutineStepRecord[];
  logs: RoutineLogRecord[];
  targetLocalDate: string;
  userTodayLocalDate: string;
}): HydratedRoutineRecord {
  const { routine, steps, logs, targetLocalDate, userTodayLocalDate } = params;
  const thirtyDayStart = addDaysToLocalDate(userTodayLocalDate, -29);
  const todayLog = logs.find((log) => log.localDate === targetLocalDate) ?? null;

  let completedCount30d = 0;
  for (const log of logs) {
    if (
      log.status === 'completed' &&
      log.localDate >= thirtyDayStart &&
      log.localDate <= userTodayLocalDate
    ) {
      completedCount30d += 1;
    }
  }

  return {
    routine,
    steps,
    todayLog,
    scheduledToday: isRoutineScheduledOnDate(
      routine.scheduleType,
      routine.weekdaysMask,
      targetLocalDate
    ),
    recentLogsCount: logs.length,
    completedCount30d,
  };
}

export async function listUserRoutines(params: {
  userId: number;
  userTimeZone: string;
  status?: RoutineStatusValue | 'all';
  targetDate?: string;
}): Promise<HydratedRoutineRecord[]> {
  const { userId, userTimeZone, status = 'all', targetDate } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const targetLocalDate = targetDate ?? userTodayLocalDate;

  const conditions = [eq(routines.userId, userId)];
  if (status !== 'all') {
    conditions.push(eq(routines.status, status));
  }

  const routineRows = await db
    .select()
    .from(routines)
    .where(and(...conditions))
    .orderBy(desc(routines.createdAt), desc(routines.id));

  if (routineRows.length === 0) return [];

  const routineIds = routineRows.map((r) => r.id);
  const [stepRows, logRows] = await Promise.all([
    db
      .select()
      .from(routineSteps)
      .where(and(eq(routineSteps.userId, userId), inArray(routineSteps.routineId, routineIds)))
      .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id)),
    db
      .select()
      .from(routineLogs)
      .where(and(eq(routineLogs.userId, userId), inArray(routineLogs.routineId, routineIds)))
      .orderBy(desc(routineLogs.localDate)),
  ]);

  const stepsByRoutine = new Map<number, RoutineStepRecord[]>();
  for (const step of stepRows) {
    const bucket = stepsByRoutine.get(step.routineId) ?? [];
    bucket.push(step);
    stepsByRoutine.set(step.routineId, bucket);
  }

  const logsByRoutine = new Map<number, RoutineLogRecord[]>();
  for (const log of logRows) {
    const bucket = logsByRoutine.get(log.routineId) ?? [];
    bucket.push(log);
    logsByRoutine.set(log.routineId, bucket);
  }

  return routineRows.map((routine) =>
    hydrateRoutine({
      routine,
      steps: stepsByRoutine.get(routine.id) ?? [],
      logs: logsByRoutine.get(routine.id) ?? [],
      targetLocalDate,
      userTodayLocalDate,
    })
  );
}

export async function getUserRoutineById(params: {
  userId: number;
  routineId: number;
  userTimeZone: string;
  targetDate?: string;
}): Promise<HydratedRoutineRecord | null> {
  const { userId, routineId, userTimeZone, targetDate } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const targetLocalDate = targetDate ?? userTodayLocalDate;

  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

  if (!routine) return null;

  const [steps, logs] = await Promise.all([
    db
      .select()
      .from(routineSteps)
      .where(and(eq(routineSteps.routineId, routineId), eq(routineSteps.userId, userId)))
      .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id)),
    db
      .select()
      .from(routineLogs)
      .where(and(eq(routineLogs.routineId, routineId), eq(routineLogs.userId, userId)))
      .orderBy(desc(routineLogs.localDate)),
  ]);

  return hydrateRoutine({
    routine,
    steps,
    logs,
    targetLocalDate,
    userTodayLocalDate,
  });
}

export async function createUserRoutine(params: {
  userId: number;
  userTimeZone: string;
  input: CreateRoutineValidated;
}): Promise<HydratedRoutineRecord> {
  const { userId, userTimeZone, input } = params;
  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [routine] = await tx
      .insert(routines)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        timeOfDay: input.timeOfDay,
        preferredTime: input.preferredTime ?? null,
        scheduleType: input.scheduleType,
        weekdaysMask: input.weekdaysMask,
        status: 'active',
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    let steps: RoutineStepRecord[] = [];
    if (input.steps.length > 0) {
      steps = await tx
        .insert(routineSteps)
        .values(
          input.steps.map((step, index) => ({
            routineId: routine.id,
            userId,
            title: step.title,
            durationMinutes: step.durationMinutes ?? null,
            sortOrder: index,
            createdAt: now,
            updatedAt: now,
          }))
        )
        .returning();
    }

    return { routine, steps };
  });

  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  return hydrateRoutine({
    routine: created.routine,
    steps: created.steps,
    logs: [],
    targetLocalDate: userTodayLocalDate,
    userTodayLocalDate,
  });
}

export async function updateUserRoutine(params: {
  userId: number;
  routineId: number;
  userTimeZone: string;
  patch: UpdateRoutineValidated;
}): Promise<HydratedRoutineRecord | null> {
  const { userId, routineId, userTimeZone, patch } = params;

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    if (!existing) return null;

    const nextScheduleType = patch.scheduleType ?? existing.scheduleType;
    let nextWeekdaysMask = existing.weekdaysMask;

    if (nextScheduleType === 'weekdays') {
      if (patch.weekdays !== undefined) {
        const uniqueDays = Array.from(new Set(patch.weekdays)).sort((a, b) => a - b);
        if (uniqueDays.length === 0) {
          throw new RoutineValidationError(
            'Select at least one weekday for a weekday routine schedule.'
          );
        }
        nextWeekdaysMask = uniqueDays.reduce((mask, day) => mask | (1 << day), 0);
      } else if (existing.scheduleType !== 'weekdays') {
        throw new RoutineValidationError(
          'Select at least one weekday when switching to a weekday schedule.'
        );
      }
    } else if (patch.scheduleType !== undefined) {
      nextWeekdaysMask = ALL_WEEKDAYS_MASK;
    }

    const nextStatus = patch.status ?? existing.status;
    let nextArchivedAt = existing.archivedAt;
    if (patch.status === 'archived' && existing.status !== 'archived') {
      nextArchivedAt = new Date();
    } else if (patch.status === 'active' && existing.status !== 'active') {
      nextArchivedAt = null;
    }

    const now = new Date();
    const [routine] = await tx
      .update(routines)
      .set({
        name: patch.name !== undefined ? patch.name : existing.name,
        description:
          patch.description !== undefined ? patch.description : existing.description,
        timeOfDay: patch.timeOfDay !== undefined ? patch.timeOfDay : existing.timeOfDay,
        preferredTime:
          patch.preferredTime !== undefined ? patch.preferredTime : existing.preferredTime,
        scheduleType: nextScheduleType,
        weekdaysMask: nextWeekdaysMask,
        status: nextStatus,
        archivedAt: nextArchivedAt,
        updatedAt: now,
      })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
      .returning();

    const [steps, logs] = await Promise.all([
      tx
        .select()
        .from(routineSteps)
        .where(and(eq(routineSteps.routineId, routineId), eq(routineSteps.userId, userId)))
        .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id)),
      tx
        .select()
        .from(routineLogs)
        .where(and(eq(routineLogs.routineId, routineId), eq(routineLogs.userId, userId)))
        .orderBy(desc(routineLogs.localDate)),
    ]);

    return { routine, steps, logs };
  });

  if (!updated) return null;

  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  return hydrateRoutine({
    routine: updated.routine,
    steps: updated.steps,
    logs: updated.logs,
    targetLocalDate: userTodayLocalDate,
    userTodayLocalDate,
  });
}

export async function deleteUserRoutine(
  userId: number,
  routineId: number
): Promise<RoutineRecord | null> {
  const [deleted] = await db
    .delete(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .returning();

  return deleted ?? null;
}

export async function addRoutineStep(params: {
  userId: number;
  routineId: number;
  userTimeZone: string;
  input: CreateRoutineStepValidated;
}): Promise<{ step: RoutineStepRecord; hydratedRoutine: HydratedRoutineRecord } | null> {
  const { userId, routineId, userTimeZone, input } = params;

  const created = await db.transaction(async (tx) => {
    const [routine] = await tx
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    if (!routine) return null;

    const existingSteps = await tx
      .select()
      .from(routineSteps)
      .where(and(eq(routineSteps.routineId, routineId), eq(routineSteps.userId, userId)))
      .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id));

    if (existingSteps.length >= 50) {
      throw new RoutineValidationError('Routines can contain at most 50 steps.');
    }

    const nextOrder =
      existingSteps.length === 0
        ? 0
        : existingSteps[existingSteps.length - 1].sortOrder + 1;

    const now = new Date();
    const [step] = await tx
      .insert(routineSteps)
      .values({
        routineId,
        userId,
        title: input.title,
        durationMinutes: input.durationMinutes ?? null,
        sortOrder: nextOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx
      .update(routines)
      .set({ updatedAt: now })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    return step;
  });

  if (!created) return null;

  const hydratedRoutine = await getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
  });

  if (!hydratedRoutine) return null;
  return { step: created, hydratedRoutine };
}

export async function updateRoutineStep(params: {
  userId: number;
  routineId: number;
  stepId: number;
  userTimeZone: string;
  patch: UpdateRoutineStepValidated;
}): Promise<{ step: RoutineStepRecord; hydratedRoutine: HydratedRoutineRecord } | null> {
  const { userId, routineId, stepId, userTimeZone, patch } = params;

  // Step renames/edits NEVER retroactively alter historical routine_logs snapshots
  const updatedStep = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(routineSteps)
      .where(
        and(
          eq(routineSteps.id, stepId),
          eq(routineSteps.routineId, routineId),
          eq(routineSteps.userId, userId)
        )
      );

    if (!existing) return null;

    const now = new Date();
    const [step] = await tx
      .update(routineSteps)
      .set({
        title: patch.title !== undefined ? patch.title : existing.title,
        durationMinutes:
          patch.durationMinutes !== undefined
            ? patch.durationMinutes
            : existing.durationMinutes,
        updatedAt: now,
      })
      .where(
        and(
          eq(routineSteps.id, stepId),
          eq(routineSteps.routineId, routineId),
          eq(routineSteps.userId, userId)
        )
      )
      .returning();

    await tx
      .update(routines)
      .set({ updatedAt: now })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    return step;
  });

  if (!updatedStep) return null;

  const hydratedRoutine = await getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
  });

  if (!hydratedRoutine) return null;
  return { step: updatedStep, hydratedRoutine };
}

export async function deleteRoutineStep(params: {
  userId: number;
  routineId: number;
  stepId: number;
  userTimeZone: string;
}): Promise<{ deletedStep: RoutineStepRecord; hydratedRoutine: HydratedRoutineRecord } | null> {
  const { userId, routineId, stepId, userTimeZone } = params;

  // Deleting a step preserves historical routine_logs snapshots untouched
  const deletedStep = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(routineSteps)
      .where(
        and(
          eq(routineSteps.id, stepId),
          eq(routineSteps.routineId, routineId),
          eq(routineSteps.userId, userId)
        )
      )
      .returning();

    if (!deleted) return null;

    await tx
      .update(routines)
      .set({ updatedAt: new Date() })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    return deleted;
  });

  if (!deletedStep) return null;

  const hydratedRoutine = await getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
  });

  if (!hydratedRoutine) return null;
  return { deletedStep, hydratedRoutine };
}

export async function reorderRoutineSteps(params: {
  userId: number;
  routineId: number;
  userTimeZone: string;
  stepIds: number[];
}): Promise<HydratedRoutineRecord | null> {
  const { userId, routineId, userTimeZone, stepIds } = params;

  const reordered = await db.transaction(async (tx) => {
    const [routine] = await tx
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    if (!routine) return null;

    const existingSteps = await tx
      .select()
      .from(routineSteps)
      .where(and(eq(routineSteps.routineId, routineId), eq(routineSteps.userId, userId)))
      .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id));

    const uniqueRequested = Array.from(new Set(stepIds));
    if (
      uniqueRequested.length !== stepIds.length ||
      uniqueRequested.length !== existingSteps.length
    ) {
      throw new RoutineValidationError(
        'Reorder payload must contain every step of this routine exactly once.'
      );
    }

    const existingIdSet = new Set(existingSteps.map((s) => s.id));
    for (const id of uniqueRequested) {
      if (!existingIdSet.has(id)) {
        throw new RoutineValidationError(
          'One or more step IDs do not belong to this routine.'
        );
      }
    }

    const now = new Date();
    for (let index = 0; index < uniqueRequested.length; index += 1) {
      await tx
        .update(routineSteps)
        .set({ sortOrder: index, updatedAt: now })
        .where(
          and(
            eq(routineSteps.id, uniqueRequested[index]),
            eq(routineSteps.routineId, routineId),
            eq(routineSteps.userId, userId)
          )
        );
    }

    await tx
      .update(routines)
      .set({ updatedAt: now })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    return true;
  });

  if (!reordered) return null;

  return getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
  });
}

export async function upsertUserRoutineLog(params: {
  userId: number;
  routineId: number;
  userTimeZone: string;
  input: UpsertRoutineLogValidated;
}): Promise<{ log: RoutineLogRecord; hydratedRoutine: HydratedRoutineRecord } | null> {
  const { userId, routineId, userTimeZone, input } = params;
  const userTodayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const localDate = input.localDate ?? userTodayLocalDate;

  if (localDate > userTodayLocalDate) {
    throw new RoutineValidationError(
      `Cannot log a routine execution for a future date (${localDate}).`
    );
  }

  const saved = await db.transaction(async (tx) => {
    const [routine] = await tx
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    if (!routine) return null;

    if (routine.status === 'archived') {
      throw new RoutineValidationError(
        'Restore this archived routine before logging an execution.'
      );
    }

    const currentSteps = await tx
      .select()
      .from(routineSteps)
      .where(and(eq(routineSteps.routineId, routineId), eq(routineSteps.userId, userId)))
      .orderBy(asc(routineSteps.sortOrder), asc(routineSteps.id));

    const currentStepIdSet = new Set(currentSteps.map((s) => s.id));

    let validCompletedIds: number[];
    if (input.markAllCompleted) {
      validCompletedIds = currentSteps.map((s) => s.id);
    } else {
      const requestedIds = Array.from(new Set(input.completedStepIds ?? []));
      for (const stepId of requestedIds) {
        if (!currentStepIdSet.has(stepId)) {
          throw new RoutineValidationError(
            'One or more completed step IDs do not belong to this routine.'
          );
        }
      }
      const requestedSet = new Set(requestedIds);
      validCompletedIds = currentSteps
        .filter((s) => requestedSet.has(s.id))
        .map((s) => s.id);
    }

    const completedSet = new Set(validCompletedIds);
    const stepsSnapshot: RoutineStepSnapshotItem[] = currentSteps.map((s) => ({
      stepId: s.id,
      title: s.title,
      durationMinutes: s.durationMinutes,
    }));
    const completedStepsSnapshot: RoutineStepSnapshotItem[] = currentSteps
      .filter((s) => completedSet.has(s.id))
      .map((s) => ({
        stepId: s.id,
        title: s.title,
        durationMinutes: s.durationMinutes,
      }));

    const totalStepsSnapshot = currentSteps.length;
    const completedStepsCount = completedStepsSnapshot.length;
    const status: RoutineLogStatusValue =
      input.markAllCompleted ||
      (totalStepsSnapshot > 0 && completedStepsCount >= totalStepsSnapshot)
        ? 'completed'
        : 'in_progress';

    const now = new Date();
    const completedAt = status === 'completed' ? now : null;

    const [upsertedLog] = await tx
      .insert(routineLogs)
      .values({
        routineId,
        userId,
        localDate,
        completedStepIds: validCompletedIds,
        stepsSnapshot,
        completedStepsSnapshot,
        completedStepsCount,
        totalStepsSnapshot,
        status,
        completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [routineLogs.routineId, routineLogs.localDate],
        set: {
          completedStepIds: validCompletedIds,
          stepsSnapshot,
          completedStepsSnapshot,
          completedStepsCount,
          totalStepsSnapshot,
          status,
          completedAt,
          updatedAt: now,
        },
      })
      .returning();

    return upsertedLog;
  });

  if (!saved) return null;

  const hydratedRoutine = await getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
    targetDate: userTodayLocalDate,
  });

  if (!hydratedRoutine) return null;
  return { log: saved, hydratedRoutine };
}

export async function deleteUserRoutineLog(params: {
  userId: number;
  routineId: number;
  localDate: string;
  userTimeZone: string;
}): Promise<{
  routineExists: boolean;
  deletedLog: RoutineLogRecord | null;
  hydratedRoutine: HydratedRoutineRecord | null;
}> {
  const { userId, routineId, localDate, userTimeZone } = params;

  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

  if (!routine) {
    return { routineExists: false, deletedLog: null, hydratedRoutine: null };
  }

  const [deletedLog] = await db
    .delete(routineLogs)
    .where(
      and(
        eq(routineLogs.routineId, routineId),
        eq(routineLogs.userId, userId),
        eq(routineLogs.localDate, localDate)
      )
    )
    .returning();

  const hydratedRoutine = await getUserRoutineById({
    userId,
    routineId,
    userTimeZone,
  });

  return {
    routineExists: true,
    deletedLog: deletedLog ?? null,
    hydratedRoutine,
  };
}

export async function listRoutineLogsForRoutine(params: {
  userId: number;
  routineId: number;
  from?: string;
  to?: string;
}): Promise<{ routine: RoutineRecord; logs: RoutineLogRecord[] } | null> {
  const { userId, routineId, from, to } = params;

  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

  if (!routine) return null;

  const conditions = [eq(routineLogs.routineId, routineId), eq(routineLogs.userId, userId)];
  if (from) conditions.push(gte(routineLogs.localDate, from));
  if (to) conditions.push(lte(routineLogs.localDate, to));

  const logs = await db
    .select()
    .from(routineLogs)
    .where(and(...conditions))
    .orderBy(desc(routineLogs.localDate));

  return { routine, logs };
}
