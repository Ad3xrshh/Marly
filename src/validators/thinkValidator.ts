import { z } from 'zod';
import type { ThinkActionPayloadByType, ThinkActionType } from '../types/think.ts';
import { createCalendarEventSchema } from './calendarEventValidator.ts';
import {
  createRoutineSchema,
  createWorkoutSchema,
  ROUTINE_SCHEDULE_TYPES_VALUES,
  ROUTINE_TIME_OF_DAY_VALUES,
  WORKOUT_ACTIVITY_TYPES_VALUES,
} from './fitnessRoutinesValidator.ts';
import {
  createHabitSchema,
  HABIT_FREQUENCY_TYPES,
  HABIT_TRACKING_TYPES,
} from './habitValidator.ts';
import {
  createGoalMilestoneSchema,
  createProjectMilestoneSchema,
} from './projectGoalValidator.ts';
import {
  createTaskSchema,
  formatZodError,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTaskSchema,
} from './taskValidator.ts';

export const THINK_CONTEXT_SOURCES = [
  'general',
  'home',
  'plan',
  'live',
  'statistics',
] as const;

export const THINK_ACTION_TYPES = [
  'create_task',
  'update_task',
  'create_calendar_event',
  'create_project_milestone',
  'create_goal_milestone',
  'create_habit',
  'create_routine',
  'create_workout',
] as const;

export const MAX_THINK_USER_MESSAGE_LENGTH = 2000;
export const MAX_THINK_PROPOSED_ACTIONS_PER_MESSAGE = 4;

export const conversationIdParamSchema = z.coerce
  .number()
  .int('Conversation ID must be a whole number')
  .positive('Conversation ID must be a positive integer');

export const actionIdParamSchema = z.coerce
  .number()
  .int('Action ID must be a whole number')
  .positive('Action ID must be a positive integer');

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .max(120, 'Conversation title must be 120 characters or fewer')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  contextSource: z.enum(THINK_CONTEXT_SOURCES).optional().default('general'),
});

export const updateConversationContextSchema = z.object({
  contextSource: z.enum(THINK_CONTEXT_SOURCES),
});

export type UpdateConversationContextInputValidated = z.infer<
  typeof updateConversationContextSchema
>;

export const sendThinkMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Please enter a message for THINK')
    .max(
      MAX_THINK_USER_MESSAGE_LENGTH,
      `Message must be ${MAX_THINK_USER_MESSAGE_LENGTH} characters or fewer`
    ),
});

export const approveThinkActionSchema = z.object({
  editedPayload: z.record(z.string(), z.unknown()).optional(),
});

const rawCandidateActionSchema = z
  .object({
    actionType: z.enum(THINK_ACTION_TYPES),
    summary: z.string().trim().min(1).max(200),
    rationale: z.string().trim().max(400).optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.union([z.string(), z.null()]).optional(),
    notes: z.union([z.string(), z.null()]).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    dueDate: z.union([z.string(), z.null()]).optional(),
    targetDate: z.union([z.string(), z.null()]).optional(),
    localDate: z.union([z.string(), z.null()]).optional(),
    taskId: z.union([z.number().int().positive(), z.null()]).optional(),
    projectId: z.union([z.number().int().positive(), z.null()]).optional(),
    goalId: z.union([z.number().int().positive(), z.null()]).optional(),
    allDay: z.boolean().optional(),
    startDate: z.union([z.string(), z.null()]).optional(),
    endDate: z.union([z.string(), z.null()]).optional(),
    startAt: z.union([z.string(), z.null()]).optional(),
    endAt: z.union([z.string(), z.null()]).optional(),
    trackingType: z.enum(HABIT_TRACKING_TYPES).optional(),
    targetValue: z.union([z.number(), z.null()]).optional(),
    unit: z.union([z.string(), z.null()]).optional(),
    frequencyType: z.enum(HABIT_FREQUENCY_TYPES).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    targetPerWeek: z.union([z.number().int().min(1).max(7), z.null()]).optional(),
    timeOfDay: z.enum(ROUTINE_TIME_OF_DAY_VALUES).optional(),
    preferredTime: z.union([z.string(), z.null()]).optional(),
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES_VALUES).optional(),
    steps: z
      .array(
        z.object({
          title: z.string(),
          durationMinutes: z.union([z.number().int().min(1).max(720), z.null()]).optional(),
        })
      )
      .optional(),
    activityType: z.enum(WORKOUT_ACTIVITY_TYPES_VALUES).optional(),
    startTime: z.union([z.string(), z.null()]).optional(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .passthrough();

export const geminiStructuredMessageResponseSchema = z.object({
  reply: z
    .string()
    .trim()
    .min(1, 'Assistant reply cannot be empty')
    .max(12000),
  suggestedTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  highlights: z
    .array(z.string().trim().min(1).max(240))
    .max(4)
    .optional()
    .default([]),
  followUpSuggestions: z
    .array(z.string().trim().min(1).max(160))
    .max(3)
    .optional()
    .default([]),
  proposedActions: z.array(z.unknown()).optional().default([]),
  references: z.array(z.unknown()).optional().default([]),
  evidence: z.array(z.unknown()).optional().default([]),
  insufficientContext: z.boolean().optional().default(false),
  uncertaintyNote: z
    .union([z.string(), z.null()])
    .optional()
    .default(null),
});

export type CreateConversationInputValidated = z.infer<typeof createConversationSchema>;
export type SendThinkMessageInputValidated = z.infer<typeof sendThinkMessageSchema>;
export type GeminiStructuredMessageResponse = z.infer<
  typeof geminiStructuredMessageResponseSchema
>;

const updateTaskActionStoredSchema = updateTaskSchema.extend({
  taskId: z.number().int('Task ID must be a whole number').positive('Task ID must be positive'),
});

const createProjectMilestoneStoredSchema = createProjectMilestoneSchema
  .pick({ title: true, description: true, dueDate: true })
  .extend({
    projectId: z
      .number()
      .int('Project ID must be a whole number')
      .positive('Select a valid project'),
  });

const createGoalMilestoneStoredSchema = createGoalMilestoneSchema
  .pick({ title: true, targetDate: true })
  .extend({
    goalId: z
      .number()
      .int('Goal ID must be a whole number')
      .positive('Select a valid goal'),
  });

const rawHabitStoredSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Habit name is required')
      .max(120, 'Habit name must be 120 characters or fewer'),
    description: z
      .union([z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return null;
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }),
    category: z.enum(TASK_CATEGORIES).optional().default('Health'),
    trackingType: z.enum(HABIT_TRACKING_TYPES).optional().default('boolean'),
    targetValue: z.union([z.number().finite().positive().max(100000), z.null()]).optional(),
    unit: z
      .union([z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return null;
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }),
    goalId: z.union([z.number().int().positive(), z.null()]).optional().default(null),
    schedule: z
      .object({
        frequencyType: z.enum(HABIT_FREQUENCY_TYPES),
        weekdays: z.array(z.number().int().min(0).max(6)).optional(),
        targetPerWeek: z.union([z.number().int().min(1).max(7), z.null()]).optional(),
      })
      .optional()
      .default({ frequencyType: 'daily' }),
  })
  .strict();

const rawRoutineStoredSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Routine name is required')
      .max(120, 'Routine name must be 120 characters or fewer'),
    description: z
      .union([z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return null;
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }),
    timeOfDay: z.enum(ROUTINE_TIME_OF_DAY_VALUES).optional().default('Anytime'),
    preferredTime: z.union([z.string(), z.null()]).optional().default(null),
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES_VALUES).optional().default('daily'),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    steps: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'Step title is required').max(160),
          durationMinutes: z.union([z.number().int().min(1).max(720), z.null()]).optional().default(null),
        })
      )
      .max(50, 'Routines can contain up to 50 steps')
      .optional()
      .default([]),
  })
  .strict();

export type ValidatedActionValidationResult<T extends ThinkActionType = ThinkActionType> =
  | {
      success: true;
      storedPayload: ThinkActionPayloadByType[T];
    }
  | {
      success: false;
      error: string;
      details: Array<{ path: string; message: string }>;
    };

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates any raw/edited payload against both the stored action shape
 * AND the authoritative Marly domain Zod validator so stored actions remain
 * UI-editable while strictly enforcing backend domain rules.
 */
export function validateAndNormalizeActionPayload<T extends ThinkActionType>(
  actionType: T,
  rawPayload: unknown,
  defaultLocalDate?: string
): ValidatedActionValidationResult<T> {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return {
      success: false,
      error: 'Action payload must be an object',
      details: [{ path: 'payload', message: 'Action payload must be an object' }],
    };
  }

  const record = rawPayload as Record<string, unknown>;

  switch (actionType) {
    case 'create_task': {
      const domainParsed = createTaskSchema.safeParse({
        title: record.title,
        description: record.description ?? null,
        status: record.status ?? 'todo',
        priority: record.priority ?? 'medium',
        category: record.category ?? 'Work',
        dueDate: record.dueDate ?? null,
        projectId: record.projectId ?? null,
        goalId: record.goalId ?? null,
      });
      if (!domainParsed.success) {
        const formatted = formatZodError(domainParsed.error);
        return { success: false, ...formatted };
      }
      const normalized: ThinkActionPayloadByType['create_task'] = {
        title: domainParsed.data.title,
        description: domainParsed.data.description ?? null,
        status: domainParsed.data.status,
        priority: domainParsed.data.priority,
        category: domainParsed.data.category,
        dueDate: domainParsed.data.dueDate ?? null,
        projectId: domainParsed.data.projectId ?? null,
        goalId: domainParsed.data.goalId ?? null,
      };
      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'update_task': {
      const candidate: Record<string, unknown> = { taskId: record.taskId };
      if (record.title !== undefined) candidate.title = record.title;
      if (record.description !== undefined) candidate.description = record.description;
      if (record.status !== undefined) candidate.status = record.status;
      if (record.priority !== undefined) candidate.priority = record.priority;
      if (record.category !== undefined) candidate.category = record.category;
      if (record.dueDate !== undefined) candidate.dueDate = record.dueDate;
      if (record.projectId !== undefined) candidate.projectId = record.projectId;
      if (record.goalId !== undefined) candidate.goalId = record.goalId;

      const parsedStored = updateTaskActionStoredSchema.safeParse(candidate);
      if (!parsedStored.success) {
        const formatted = formatZodError(parsedStored.error);
        return { success: false, ...formatted };
      }
      const { taskId, ...patch } = parsedStored.data;
      const domainPatchCheck = updateTaskSchema.safeParse(patch);
      if (!domainPatchCheck.success) {
        const formatted = formatZodError(domainPatchCheck.error);
        return { success: false, ...formatted };
      }
      const normalized: ThinkActionPayloadByType['update_task'] = {
        taskId,
        ...domainPatchCheck.data,
      };
      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_calendar_event': {
      const allDay = Boolean(record.allDay);
      const domainCandidate = allDay
        ? {
            title: record.title,
            description: record.description ?? null,
            category: record.category ?? 'Work',
            allDay: true,
            startDate: record.startDate ?? null,
            endDate: record.endDate ?? record.startDate ?? null,
            startAt: null,
            endAt: null,
          }
        : {
            title: record.title,
            description: record.description ?? null,
            category: record.category ?? 'Work',
            allDay: false,
            startDate: null,
            endDate: null,
            startAt: record.startAt ?? null,
            endAt: record.endAt ?? null,
          };

      const domainParsed = createCalendarEventSchema.safeParse(domainCandidate);
      if (!domainParsed.success) {
        const formatted = formatZodError(domainParsed.error);
        return { success: false, ...formatted };
      }

      const normalized: ThinkActionPayloadByType['create_calendar_event'] = {
        title: domainParsed.data.title,
        description: domainParsed.data.description ?? null,
        category: domainParsed.data.category,
        allDay: domainParsed.data.allDay,
        startDate: domainParsed.data.allDay ? (domainParsed.data.startDate ?? null) : null,
        endDate: domainParsed.data.allDay
          ? (domainParsed.data.endDate ?? domainParsed.data.startDate ?? null)
          : null,
        startAt:
          !domainParsed.data.allDay && domainParsed.data.startAt
            ? domainParsed.data.startAt.toISOString()
            : null,
        endAt:
          !domainParsed.data.allDay && domainParsed.data.endAt
            ? domainParsed.data.endAt.toISOString()
            : null,
      };

      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_project_milestone': {
      const parsedStored = createProjectMilestoneStoredSchema.safeParse({
        projectId: record.projectId,
        title: record.title,
        description: record.description ?? null,
        dueDate: record.dueDate ?? null,
      });
      if (!parsedStored.success) {
        const formatted = formatZodError(parsedStored.error);
        return { success: false, ...formatted };
      }
      const domainCheck = createProjectMilestoneSchema.safeParse({
        title: parsedStored.data.title,
        description: parsedStored.data.description,
        dueDate: parsedStored.data.dueDate,
      });
      if (!domainCheck.success) {
        const formatted = formatZodError(domainCheck.error);
        return { success: false, ...formatted };
      }
      const normalized: ThinkActionPayloadByType['create_project_milestone'] = {
        projectId: parsedStored.data.projectId,
        title: domainCheck.data.title,
        description: domainCheck.data.description ?? null,
        dueDate: domainCheck.data.dueDate ?? null,
      };
      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_goal_milestone': {
      const parsedStored = createGoalMilestoneStoredSchema.safeParse({
        goalId: record.goalId,
        title: record.title,
        targetDate: record.targetDate ?? null,
      });
      if (!parsedStored.success) {
        const formatted = formatZodError(parsedStored.error);
        return { success: false, ...formatted };
      }
      const domainCheck = createGoalMilestoneSchema.safeParse({
        title: parsedStored.data.title,
        targetDate: parsedStored.data.targetDate,
      });
      if (!domainCheck.success) {
        const formatted = formatZodError(domainCheck.error);
        return { success: false, ...formatted };
      }
      const normalized: ThinkActionPayloadByType['create_goal_milestone'] = {
        goalId: parsedStored.data.goalId,
        title: domainCheck.data.title,
        targetDate: domainCheck.data.targetDate ?? null,
      };
      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_habit': {
      const candidateSchedule =
        record.schedule && typeof record.schedule === 'object' && !Array.isArray(record.schedule)
          ? (record.schedule as Record<string, unknown>)
          : {
              frequencyType: record.frequencyType ?? 'daily',
              weekdays: record.weekdays,
              targetPerWeek: record.targetPerWeek,
            };

      const rawScheduleForDomain =
        candidateSchedule.frequencyType === 'weekdays'
          ? {
              frequencyType: 'weekdays',
              weekdays: Array.isArray(candidateSchedule.weekdays) ? candidateSchedule.weekdays : [],
            }
          : candidateSchedule.frequencyType === 'times_per_week'
            ? {
                frequencyType: 'times_per_week',
                targetPerWeek: candidateSchedule.targetPerWeek ?? 3,
              }
            : { frequencyType: 'daily' };

      const trackingType = record.trackingType === 'measurable' ? 'measurable' : 'boolean';
      const domainCandidate = {
        name: record.name,
        description: record.description ?? null,
        category: record.category ?? 'Health',
        trackingType,
        targetValue: trackingType === 'measurable' ? (record.targetValue ?? null) : null,
        unit: trackingType === 'measurable' ? (record.unit ?? null) : null,
        goalId: record.goalId ?? null,
        schedule: rawScheduleForDomain,
      };

      const domainParsed = createHabitSchema.safeParse(domainCandidate);
      if (!domainParsed.success) {
        const formatted = formatZodError(domainParsed.error);
        return { success: false, ...formatted };
      }

      const rawParsed = rawHabitStoredSchema.safeParse(domainCandidate);
      if (!rawParsed.success) {
        const formatted = formatZodError(rawParsed.error);
        return { success: false, ...formatted };
      }

      const uniqueWeekdays =
        rawParsed.data.schedule.frequencyType === 'weekdays'
          ? Array.from(new Set(rawParsed.data.schedule.weekdays ?? [])).sort((a, b) => a - b)
          : undefined;

      const normalized: ThinkActionPayloadByType['create_habit'] = {
        name: domainParsed.data.name,
        description: domainParsed.data.description ?? null,
        category: domainParsed.data.category,
        trackingType: domainParsed.data.trackingType,
        targetValue: domainParsed.data.targetValue ?? null,
        unit: domainParsed.data.unit ?? null,
        goalId: domainParsed.data.goalId ?? null,
        schedule: {
          frequencyType: rawParsed.data.schedule.frequencyType,
          ...(uniqueWeekdays ? { weekdays: uniqueWeekdays } : {}),
          ...(rawParsed.data.schedule.frequencyType === 'times_per_week'
            ? { targetPerWeek: domainParsed.data.schedule.targetPerWeek ?? 1 }
            : {}),
        },
      };

      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_routine': {
      const candidateSteps = Array.isArray(record.steps)
        ? record.steps.map((step) => {
            if (!step || typeof step !== 'object') return step;
            const s = step as Record<string, unknown>;
            return {
              title: s.title,
              durationMinutes: s.durationMinutes ?? null,
            };
          })
        : [];

      const scheduleType = record.scheduleType ?? 'daily';
      const rawCandidate = {
        name: record.name,
        description: record.description ?? null,
        timeOfDay: record.timeOfDay ?? 'Anytime',
        preferredTime: record.preferredTime ?? null,
        scheduleType,
        ...(scheduleType === 'weekdays'
          ? { weekdays: Array.isArray(record.weekdays) ? record.weekdays : [] }
          : {}),
        steps: candidateSteps,
      };

      const domainParsed = createRoutineSchema.safeParse(rawCandidate);
      if (!domainParsed.success) {
        const formatted = formatZodError(domainParsed.error);
        return { success: false, ...formatted };
      }

      const rawParsed = rawRoutineStoredSchema.safeParse(rawCandidate);
      if (!rawParsed.success) {
        const formatted = formatZodError(rawParsed.error);
        return { success: false, ...formatted };
      }

      const uniqueWeekdays =
        domainParsed.data.scheduleType === 'weekdays'
          ? Array.from(new Set(rawParsed.data.weekdays ?? [])).sort((a, b) => a - b)
          : undefined;

      const normalized: ThinkActionPayloadByType['create_routine'] = {
        name: domainParsed.data.name,
        description: domainParsed.data.description ?? null,
        timeOfDay: domainParsed.data.timeOfDay,
        preferredTime: domainParsed.data.preferredTime ?? null,
        scheduleType: domainParsed.data.scheduleType,
        ...(uniqueWeekdays ? { weekdays: uniqueWeekdays } : {}),
        steps: domainParsed.data.steps.map((s) => ({
          title: s.title,
          durationMinutes: s.durationMinutes ?? null,
        })),
      };

      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }

    case 'create_workout': {
      const providedDate = normalizeNullableString(record.localDate);
      const effectiveDate = providedDate ?? defaultLocalDate;
      const domainCandidate = {
        title: record.title,
        activityType: record.activityType ?? 'Strength',
        ...(effectiveDate ? { localDate: effectiveDate } : {}),
        startTime: record.startTime ?? null,
        durationMinutes: record.durationMinutes,
        notes: record.notes ?? null,
      };

      const domainParsed = createWorkoutSchema.safeParse(domainCandidate);
      if (!domainParsed.success) {
        const formatted = formatZodError(domainParsed.error);
        return { success: false, ...formatted };
      }

      const normalized: ThinkActionPayloadByType['create_workout'] = {
        title: domainParsed.data.title,
        activityType: domainParsed.data.activityType,
        localDate: domainParsed.data.localDate ?? defaultLocalDate ?? new Date().toISOString().slice(0, 10),
        startTime: domainParsed.data.startTime ?? null,
        durationMinutes: domainParsed.data.durationMinutes,
        notes: domainParsed.data.notes ?? null,
      };

      return {
        success: true,
        storedPayload: normalized as ThinkActionPayloadByType[T],
      };
    }
  }
}

export interface OwnedActionRefSets {
  taskIds: Set<number>;
  projectIds: Set<number>;
  goalIds: Set<number>;
}

export interface NormalizedCandidateAction {
  actionType: ThinkActionType;
  summary: string;
  rationale: string | null;
  payload: Record<string, unknown>;
}

/**
 * Validates each Gemini-proposed action individually against Zod schemas and
 * real user-owned entity IDs. Invalid or hallucinated proposals are safely
 * discarded without failing the assistant's conversational reply.
 */
export function normalizeAndFilterGeminiProposedActions(
  rawCandidates: unknown[],
  ownedRefs: OwnedActionRefSets,
  defaultLocalDate: string
): NormalizedCandidateAction[] {
  const accepted: NormalizedCandidateAction[] = [];

  for (const rawItem of rawCandidates) {
    if (accepted.length >= MAX_THINK_PROPOSED_ACTIONS_PER_MESSAGE) break;

    const parsedCandidate = rawCandidateActionSchema.safeParse(rawItem);
    if (!parsedCandidate.success) continue;

    const c = parsedCandidate.data;

    let rawPayload: Record<string, unknown> | null = null;

    switch (c.actionType) {
      case 'create_task': {
        if (c.projectId !== undefined && c.projectId !== null && !ownedRefs.projectIds.has(c.projectId)) {
          continue;
        }
        if (c.goalId !== undefined && c.goalId !== null && !ownedRefs.goalIds.has(c.goalId)) {
          continue;
        }
        rawPayload = {
          title: c.title ?? c.name,
          description: c.description ?? null,
          status: c.status ?? 'todo',
          priority: c.priority ?? 'medium',
          category: c.category ?? 'Work',
          dueDate: c.dueDate ?? null,
          projectId: c.projectId ?? null,
          goalId: c.goalId ?? null,
        };
        break;
      }

      case 'update_task': {
        if (!c.taskId || !ownedRefs.taskIds.has(c.taskId)) {
          continue;
        }
        if (c.projectId !== undefined && c.projectId !== null && !ownedRefs.projectIds.has(c.projectId)) {
          continue;
        }
        if (c.goalId !== undefined && c.goalId !== null && !ownedRefs.goalIds.has(c.goalId)) {
          continue;
        }
        rawPayload = {
          taskId: c.taskId,
          ...(c.title !== undefined ? { title: c.title } : {}),
          ...(c.description !== undefined ? { description: c.description } : {}),
          ...(c.status !== undefined ? { status: c.status } : {}),
          ...(c.priority !== undefined ? { priority: c.priority } : {}),
          ...(c.category !== undefined ? { category: c.category } : {}),
          ...(c.dueDate !== undefined ? { dueDate: c.dueDate } : {}),
          ...(c.projectId !== undefined ? { projectId: c.projectId } : {}),
          ...(c.goalId !== undefined ? { goalId: c.goalId } : {}),
        };
        break;
      }

      case 'create_calendar_event': {
        rawPayload = {
          title: c.title ?? c.name,
          description: c.description ?? null,
          category: c.category ?? 'Work',
          allDay: Boolean(c.allDay),
          startDate: c.startDate ?? null,
          endDate: c.endDate ?? null,
          startAt: c.startAt ?? null,
          endAt: c.endAt ?? null,
        };
        break;
      }

      case 'create_project_milestone': {
        if (!c.projectId || !ownedRefs.projectIds.has(c.projectId)) {
          continue;
        }
        rawPayload = {
          projectId: c.projectId,
          title: c.title ?? c.name,
          description: c.description ?? null,
          dueDate: c.dueDate ?? c.targetDate ?? null,
        };
        break;
      }

      case 'create_goal_milestone': {
        if (!c.goalId || !ownedRefs.goalIds.has(c.goalId)) {
          continue;
        }
        rawPayload = {
          goalId: c.goalId,
          title: c.title ?? c.name,
          targetDate: c.targetDate ?? c.dueDate ?? null,
        };
        break;
      }

      case 'create_habit': {
        if (c.goalId !== undefined && c.goalId !== null && !ownedRefs.goalIds.has(c.goalId)) {
          continue;
        }
        rawPayload = {
          name: c.name ?? c.title,
          description: c.description ?? null,
          category: c.category ?? 'Health',
          trackingType: c.trackingType ?? 'boolean',
          targetValue: c.trackingType === 'measurable' ? (c.targetValue ?? null) : null,
          unit: c.trackingType === 'measurable' ? (c.unit ?? null) : null,
          goalId: c.goalId ?? null,
          schedule: {
            frequencyType: c.frequencyType ?? 'daily',
            ...(c.frequencyType === 'weekdays' ? { weekdays: c.weekdays ?? [] } : {}),
            ...(c.frequencyType === 'times_per_week' ? { targetPerWeek: c.targetPerWeek ?? 3 } : {}),
          },
        };
        break;
      }

      case 'create_routine': {
        rawPayload = {
          name: c.name ?? c.title,
          description: c.description ?? null,
          timeOfDay: c.timeOfDay ?? 'Anytime',
          preferredTime: c.preferredTime ?? null,
          scheduleType: c.scheduleType ?? 'daily',
          ...(c.scheduleType === 'weekdays' ? { weekdays: c.weekdays ?? [] } : {}),
          steps: c.steps ?? [],
        };
        break;
      }

      case 'create_workout': {
        rawPayload = {
          title: c.title ?? c.name,
          activityType: c.activityType ?? 'Strength',
          localDate: c.localDate ?? defaultLocalDate,
          startTime: c.startTime ?? null,
          durationMinutes: c.durationMinutes,
          notes: c.notes ?? c.description ?? null,
        };
        break;
      }
    }

    if (!rawPayload) continue;

    const validated = validateAndNormalizeActionPayload(c.actionType, rawPayload, defaultLocalDate);
    if (!validated.success) continue;

    accepted.push({
      actionType: c.actionType,
      summary: c.summary.trim(),
      rationale: c.rationale && c.rationale.trim().length > 0 ? c.rationale.trim() : null,
      payload: validated.storedPayload as unknown as Record<string, unknown>,
    });
  }

  return accepted;
}
