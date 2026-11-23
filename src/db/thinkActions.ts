import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type { ThinkActionTargetContext } from '../lib/gemini.ts';
import { getTodayLocalDateForTimeZone } from '../lib/habitSchedule.ts';
import type {
  ThinkActionExecutionResult,
  ThinkActionPayloadByType,
  ThinkActionRecordDTO,
  ThinkActionType,
} from '../types/think.ts';
import { createCalendarEventSchema } from '../validators/calendarEventValidator.ts';
import {
  createRoutineSchema,
  createWorkoutSchema,
} from '../validators/fitnessRoutinesValidator.ts';
import { createHabitSchema } from '../validators/habitValidator.ts';
import {
  createGoalMilestoneSchema,
  createProjectMilestoneSchema,
} from '../validators/projectGoalValidator.ts';
import { createTaskSchema, updateTaskSchema } from '../validators/taskValidator.ts';
import {
  THINK_ACTION_TYPES,
  validateAndNormalizeActionPayload,
  type OwnedActionRefSets,
} from '../validators/thinkValidator.ts';
import { createUserCalendarEvent } from './calendarEvents.ts';
import { createUserGoalMilestone } from './goals.ts';
import { createUserHabit, HabitValidationError } from './habits.ts';
import { db } from './index.ts';
import { createUserProjectMilestone } from './projects.ts';
import { createUserRoutine, RoutineValidationError } from './routines.ts';
import {
  aiActionRecords,
  goals,
  projects,
  tasks,
  type AiActionRecordRow,
} from './schema.ts';
import { createUserTask, TaskValidationError, updateUserTask } from './tasks.ts';
import { createUserWorkout } from './workouts.ts';

export class ThinkActionError extends Error {
  status: number;
  code: string;
  details?: Array<{ path: string; message: string }>;
  action?: ThinkActionRecordDTO;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    details?: Array<{ path: string; message: string }>;
    action?: ThinkActionRecordDTO;
  }) {
    super(params.message);
    this.name = 'ThinkActionError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.action = params.action;
  }
}

export function serializeThinkActionRecord(row: AiActionRecordRow): ThinkActionRecordDTO {
  const effectivePayload = row.editedPayload ?? row.payload;
  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    actionType: row.actionType,
    status: row.status,
    summary: row.summary,
    rationale: row.rationale ?? null,
    payload: row.payload,
    editedPayload: row.editedPayload ?? null,
    effectivePayload,
    executionResult:
      (row.executionResult as ThinkActionExecutionResult | null | undefined) ?? null,
    errorMessage: row.errorMessage ?? null,
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFullOwnedActionRefSets(
  userId: number
): Promise<OwnedActionRefSets> {
  const [taskIdRows, projectIdRows, goalIdRows] = await Promise.all([
    db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, userId)),
    db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)),
    db.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId)),
  ]);

  return {
    taskIds: new Set<number>(taskIdRows.map((t) => t.id)),
    projectIds: new Set<number>(projectIdRows.map((p) => p.id)),
    goalIds: new Set<number>(goalIdRows.map((g) => g.id)),
  };
}

export async function listUserActionTargetContextAndRefs(
  userId: number,
  userTimeZone: string
): Promise<{
  targetContext: ThinkActionTargetContext;
  ownedRefs: OwnedActionRefSets;
}> {
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);

  const [allTaskRows, allProjectRows, allGoalRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt)),
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.targetDate), desc(projects.createdAt)),
    db
      .select({
        id: goals.id,
        title: goals.title,
        status: goals.status,
      })
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(asc(goals.targetDate), desc(goals.createdAt)),
  ]);

  const taskIds = new Set<number>(allTaskRows.map((t) => t.id));
  const projectIds = new Set<number>(allProjectRows.map((p) => p.id));
  const goalIds = new Set<number>(allGoalRows.map((g) => g.id));

  const activeTasks = allTaskRows
    .filter((t) => t.status !== 'completed')
    .slice(0, 35);
  const activeProjects = allProjectRows
    .filter((p) => p.status !== 'archived' && p.status !== 'completed')
    .slice(0, 25);
  const activeGoals = allGoalRows
    .filter((g) => g.status !== 'archived' && g.status !== 'completed')
    .slice(0, 25);

  return {
    targetContext: {
      userTimeZone,
      todayLocalDate,
      tasks: activeTasks,
      projects: activeProjects,
      goals: activeGoals,
    },
    ownedRefs: {
      taskIds,
      projectIds,
      goalIds,
    },
  };
}

export async function listThinkActionsGroupedByMessage(
  userId: number,
  conversationId: number
): Promise<Map<number, ThinkActionRecordDTO[]>> {
  const rows = await db
    .select()
    .from(aiActionRecords)
    .where(
      and(
        eq(aiActionRecords.conversationId, conversationId),
        eq(aiActionRecords.userId, userId)
      )
    )
    .orderBy(asc(aiActionRecords.createdAt), asc(aiActionRecords.id));

  const map = new Map<number, ThinkActionRecordDTO[]>();
  for (const row of rows) {
    const dto = serializeThinkActionRecord(row);
    const list = map.get(row.messageId) ?? [];
    list.push(dto);
    map.set(row.messageId, list);
  }
  return map;
}

async function executeValidatedActionAgainstDomain(params: {
  userId: number;
  userTimeZone: string;
  actionType: ThinkActionType;
  storedPayload: Record<string, unknown>;
}): Promise<ThinkActionExecutionResult> {
  const { userId, userTimeZone, actionType, storedPayload } = params;

  switch (actionType) {
    case 'create_task': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_task'];
      const parsed = createTaskSchema.parse(p);
      const created = await createUserTask(userId, parsed);
      return {
        entityType: 'task',
        entityId: created.id,
        label: created.title,
        targetRoute: `/plan/tasks?highlight=${created.id}`,
      };
    }

    case 'update_task': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['update_task'];
      const { taskId, ...patch } = p;
      const parsedPatch = updateTaskSchema.parse(patch);
      const updated = await updateUserTask(userId, taskId, parsedPatch);
      if (!updated) {
        throw new ThinkActionError({
          message: 'Target task was not found for your account.',
          status: 422,
          code: 'TARGET_ENTITY_NOT_FOUND',
        });
      }
      return {
        entityType: 'task',
        entityId: updated.id,
        label: updated.title,
        targetRoute: `/plan/tasks?highlight=${updated.id}`,
      };
    }

    case 'create_calendar_event': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_calendar_event'];
      const parsed = createCalendarEventSchema.parse(p);
      const created = await createUserCalendarEvent(userId, {
        title: parsed.title,
        description: parsed.description ?? null,
        category: parsed.category,
        allDay: parsed.allDay,
        startDate: parsed.allDay ? (parsed.startDate ?? null) : null,
        endDate: parsed.allDay ? (parsed.endDate ?? parsed.startDate ?? null) : null,
        startAt: !parsed.allDay ? (parsed.startAt ?? null) : null,
        endAt: !parsed.allDay ? (parsed.endAt ?? null) : null,
      });
      return {
        entityType: 'calendar_event',
        entityId: created.id,
        label: created.title,
        targetRoute: `/plan/calendar?eventId=${created.id}`,
      };
    }

    case 'create_project_milestone': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_project_milestone'];
      const parsed = createProjectMilestoneSchema.parse({
        title: p.title,
        description: p.description ?? null,
        dueDate: p.dueDate ?? null,
      });
      const created = await createUserProjectMilestone(userId, p.projectId, parsed);
      if (!created) {
        throw new ThinkActionError({
          message: 'Selected project was not found for your account.',
          status: 422,
          code: 'TARGET_ENTITY_NOT_FOUND',
        });
      }
      return {
        entityType: 'project_milestone',
        entityId: created.id,
        parentId: p.projectId,
        label: created.title,
        targetRoute: `/plan/projects?projectId=${p.projectId}`,
      };
    }

    case 'create_goal_milestone': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_goal_milestone'];
      const parsed = createGoalMilestoneSchema.parse({
        title: p.title,
        targetDate: p.targetDate ?? null,
      });
      const created = await createUserGoalMilestone(userId, p.goalId, parsed);
      if (!created) {
        throw new ThinkActionError({
          message: 'Selected goal was not found for your account.',
          status: 422,
          code: 'TARGET_ENTITY_NOT_FOUND',
        });
      }
      return {
        entityType: 'goal_milestone',
        entityId: created.id,
        parentId: p.goalId,
        label: created.title,
        targetRoute: `/plan/goals?goalId=${p.goalId}`,
      };
    }

    case 'create_habit': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_habit'];
      const parsed = createHabitSchema.parse(p);
      const created = await createUserHabit({
        userId,
        userTimeZone,
        input: parsed,
      });
      return {
        entityType: 'habit',
        entityId: created.habit.id,
        label: created.habit.name,
        targetRoute: `/live/habits?habitId=${created.habit.id}`,
      };
    }

    case 'create_routine': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_routine'];
      const parsed = createRoutineSchema.parse(p);
      const created = await createUserRoutine({
        userId,
        userTimeZone,
        input: parsed,
      });
      return {
        entityType: 'routine',
        entityId: created.routine.id,
        label: created.routine.name,
        targetRoute: `/live/fitness?routineId=${created.routine.id}`,
      };
    }

    case 'create_workout': {
      const p = storedPayload as unknown as ThinkActionPayloadByType['create_workout'];
      const parsed = createWorkoutSchema.parse(p);
      const created = await createUserWorkout({
        userId,
        userTimeZone,
        input: parsed,
      });
      return {
        entityType: 'workout',
        entityId: created.id,
        label: created.title,
        targetRoute: `/live/fitness?workoutId=${created.id}`,
      };
    }
  }
}

export async function approveAndExecuteThinkAction(params: {
  userId: number;
  userTimeZone: string;
  actionId: number;
  editedPayload?: Record<string, unknown>;
}): Promise<ThinkActionRecordDTO> {
  const { userId, userTimeZone, actionId, editedPayload } = params;

  const [existing] = await db
    .select()
    .from(aiActionRecords)
    .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ThinkActionError({
      message: 'Action proposal not found.',
      status: 404,
      code: 'ACTION_NOT_FOUND',
    });
  }

  if (!THINK_ACTION_TYPES.includes(existing.actionType)) {
    throw new ThinkActionError({
      message: `Action type "${existing.actionType}" is not supported.`,
      status: 400,
      code: 'UNSUPPORTED_ACTION_TYPE',
    });
  }

  if (existing.status === 'executed') {
    throw new ThinkActionError({
      message: 'This action has already been executed.',
      status: 409,
      code: 'ACTION_ALREADY_EXECUTED',
      action: serializeThinkActionRecord(existing),
    });
  }

  if (existing.status === 'rejected') {
    throw new ThinkActionError({
      message: 'This action was rejected and cannot be executed.',
      status: 409,
      code: 'ACTION_ALREADY_REJECTED',
      action: serializeThinkActionRecord(existing),
    });
  }

  if (existing.status === 'approved') {
    throw new ThinkActionError({
      message: 'This action is already being executed.',
      status: 409,
      code: 'ACTION_IN_PROGRESS',
      action: serializeThinkActionRecord(existing),
    });
  }

  // Validate payload BEFORE transitioning away from 'proposed'/'failed' so invalid
  // user edits can be corrected cleanly without breaking the action lifecycle.
  if (
    editedPayload &&
    typeof editedPayload.actionType === 'string' &&
    editedPayload.actionType !== existing.actionType
  ) {
    throw new ThinkActionError({
      message: 'Changing the action type of an existing proposal is not permitted.',
      status: 400,
      code: 'ACTION_TYPE_IMMUTABLE',
    });
  }

  const candidatePayload: Record<string, unknown> = editedPayload
    ? {
        ...(existing.actionType === 'update_task' &&
        editedPayload.taskId === undefined &&
        existing.payload.taskId !== undefined
          ? { taskId: existing.payload.taskId }
          : {}),
        ...editedPayload,
      }
    : (existing.editedPayload ?? existing.payload);

  const defaultLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const validated = validateAndNormalizeActionPayload(
    existing.actionType,
    candidatePayload,
    defaultLocalDate
  );

  if (!validated.success) {
    throw new ThinkActionError({
      message: validated.error,
      status: 400,
      code: 'INVALID_ACTION_PAYLOAD',
      details: validated.details,
    });
  }

  const storedNormalized = validated.storedPayload as unknown as Record<string, unknown>;
  const now = new Date();

  // Atomically claim proposed/failed -> approved so concurrent clicks cannot run twice.
  // All 8 domain executors below are atomic (single statement or db.transaction),
  // so retrying a 'failed' action never duplicates a prior partial write.
  const [claimed] = await db
    .update(aiActionRecords)
    .set({
      status: 'approved',
      ...(editedPayload ? { editedPayload: storedNormalized } : {}),
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiActionRecords.id, actionId),
        eq(aiActionRecords.userId, userId),
        inArray(aiActionRecords.status, ['proposed', 'failed'])
      )
    )
    .returning();

  if (!claimed) {
    const [latest] = await db
      .select()
      .from(aiActionRecords)
      .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
      .limit(1);

    throw new ThinkActionError({
      message: 'This action has already been resolved.',
      status: 409,
      code: 'ACTION_CONFLICT',
      ...(latest ? { action: serializeThinkActionRecord(latest) } : {}),
    });
  }

  try {
    const executionResult = await executeValidatedActionAgainstDomain({
      userId,
      userTimeZone,
      actionType: existing.actionType,
      storedPayload: storedNormalized,
    });

    const finishedAt = new Date();
    const [executedRow] = await db
      .update(aiActionRecords)
      .set({
        status: 'executed',
        executionResult: executionResult as unknown as Record<string, unknown>,
        errorMessage: null,
        executedAt: finishedAt,
        resolvedAt: finishedAt,
        updatedAt: finishedAt,
      })
      .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
      .returning();

    return serializeThinkActionRecord(executedRow);
  } catch (error) {
    const errMsg =
      error instanceof ThinkActionError ||
      error instanceof TaskValidationError ||
      error instanceof HabitValidationError ||
      error instanceof RoutineValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Action execution failed.';

    const failedAt = new Date();
    const [failedRow] = await db
      .update(aiActionRecords)
      .set({
        status: 'failed',
        errorMessage: errMsg,
        resolvedAt: failedAt,
        updatedAt: failedAt,
      })
      .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
      .returning();

    throw new ThinkActionError({
      message: errMsg,
      status: 422,
      code:
        error instanceof ThinkActionError ? error.code : 'ACTION_EXECUTION_FAILED',
      action: serializeThinkActionRecord(failedRow),
    });
  }
}

export async function rejectThinkAction(params: {
  userId: number;
  actionId: number;
}): Promise<ThinkActionRecordDTO> {
  const { userId, actionId } = params;

  const [existing] = await db
    .select()
    .from(aiActionRecords)
    .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new ThinkActionError({
      message: 'Action proposal not found.',
      status: 404,
      code: 'ACTION_NOT_FOUND',
    });
  }

  if (existing.status === 'executed') {
    throw new ThinkActionError({
      message: 'This action has already been executed and cannot be rejected.',
      status: 409,
      code: 'ACTION_ALREADY_EXECUTED',
      action: serializeThinkActionRecord(existing),
    });
  }

  if (existing.status === 'rejected') {
    throw new ThinkActionError({
      message: 'This action has already been rejected.',
      status: 409,
      code: 'ACTION_ALREADY_REJECTED',
      action: serializeThinkActionRecord(existing),
    });
  }

  if (existing.status === 'approved') {
    throw new ThinkActionError({
      message: 'This action is currently executing and cannot be rejected.',
      status: 409,
      code: 'ACTION_IN_PROGRESS',
      action: serializeThinkActionRecord(existing),
    });
  }

  const now = new Date();
  const [rejectedRow] = await db
    .update(aiActionRecords)
    .set({
      status: 'rejected',
      resolvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiActionRecords.id, actionId),
        eq(aiActionRecords.userId, userId),
        inArray(aiActionRecords.status, ['proposed', 'failed']),
        ne(aiActionRecords.status, 'executed')
      )
    )
    .returning();

  if (!rejectedRow) {
    const [latest] = await db
      .select()
      .from(aiActionRecords)
      .where(and(eq(aiActionRecords.id, actionId), eq(aiActionRecords.userId, userId)))
      .limit(1);

    throw new ThinkActionError({
      message: 'This action has already been resolved.',
      status: 409,
      code: 'ACTION_CONFLICT',
      ...(latest ? { action: serializeThinkActionRecord(latest) } : {}),
    });
  }

  return serializeThinkActionRecord(rejectedRow);
}
