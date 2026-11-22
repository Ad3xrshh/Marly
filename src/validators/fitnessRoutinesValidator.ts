import { z } from 'zod';
import {
  ALL_WEEKDAYS_MASK,
  isValidCalendarDate,
  weekdaysToMask,
} from '../lib/habitSchedule.ts';

export const WORKOUT_ACTIVITY_TYPES_VALUES = [
  'Strength',
  'Cardio',
  'Mobility',
  'Recovery',
  'Sport',
  'Other',
] as const;

export const ROUTINE_TIME_OF_DAY_VALUES = [
  'Morning',
  'Afternoon',
  'Evening',
  'Anytime',
] as const;

export const ROUTINE_SCHEDULE_TYPES_VALUES = [
  'daily',
  'weekdays',
  'as_needed',
] as const;

export const ROUTINE_STATUS_VALUES = ['active', 'archived'] as const;

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTimeSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || HHMM_REGEX.test(val), {
    message: 'Time must be formatted as HH:MM (24-hour clock)',
  });

const optionalNotesSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 2000, {
    message: 'Notes must be 2000 characters or fewer',
  });

const optionalDescriptionSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 1000, {
    message: 'Description must be 1000 characters or fewer',
  });

export const resourceIdParamSchema = z.coerce
  .number()
  .int('ID must be a whole number')
  .positive('ID must be a positive integer');

export const stepIdParamSchema = z.coerce
  .number()
  .int('Step ID must be a whole number')
  .positive('Step ID must be a positive integer');

export const workoutDateParamSchema = z
  .string()
  .trim()
  .refine(isValidCalendarDate, { message: 'Date must be a valid YYYY-MM-DD calendar date' });

export const listWorkoutsQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: 'from must be a valid YYYY-MM-DD calendar date' })
      .optional(),
    to: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: 'to must be a valid YYYY-MM-DD calendar date' })
      .optional(),
    activityType: z.enum(WORKOUT_ACTIVITY_TYPES_VALUES).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.from && val.to && val.from > val.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Start date (from) must be on or before end date (to)',
      });
    }
  });

export const createWorkoutSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Workout title is required')
    .max(120, 'Workout title must be 120 characters or fewer'),
  activityType: z.enum(WORKOUT_ACTIVITY_TYPES_VALUES).optional().default('Strength'),
  localDate: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'localDate must be a valid YYYY-MM-DD calendar date' })
    .optional(),
  startTime: optionalTimeSchema.optional(),
  durationMinutes: z
    .number()
    .int('Duration must be a whole number of minutes')
    .min(1, 'Duration must be at least 1 minute')
    .max(1440, 'Duration cannot exceed 1440 minutes'),
  notes: optionalNotesSchema.optional(),
});

export const updateWorkoutSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Workout title cannot be empty')
      .max(120, 'Workout title must be 120 characters or fewer')
      .optional(),
    activityType: z.enum(WORKOUT_ACTIVITY_TYPES_VALUES).optional(),
    localDate: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: 'localDate must be a valid YYYY-MM-DD calendar date' })
      .optional(),
    startTime: optionalTimeSchema.optional(),
    durationMinutes: z
      .number()
      .int('Duration must be a whole number of minutes')
      .min(1, 'Duration must be at least 1 minute')
      .max(1440, 'Duration cannot exceed 1440 minutes')
      .optional(),
    notes: optionalNotesSchema.optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one workout field must be provided for update',
  });

const routineStepInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Step title is required')
    .max(160, 'Step title must be 160 characters or fewer'),
  durationMinutes: z
    .union([
      z.number().int('Step duration must be whole minutes').min(1).max(720),
      z.null(),
    ])
    .optional(),
});

export const createRoutineStepSchema = routineStepInputSchema;

export const updateRoutineStepSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Step title cannot be empty')
      .max(160, 'Step title must be 160 characters or fewer')
      .optional(),
    durationMinutes: z
      .union([
        z.number().int('Step duration must be whole minutes').min(1).max(720),
        z.null(),
      ])
      .optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'Provide step title or duration to update',
  });

export const reorderRoutineStepsSchema = z.object({
  stepIds: z
    .array(z.number().int().positive())
    .min(1, 'Provide at least one step ID to reorder'),
});

export const listRoutinesQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('all'),
  date: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'Date must be a valid YYYY-MM-DD calendar date' })
    .optional(),
});

export const createRoutineSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Routine name is required')
      .max(120, 'Routine name must be 120 characters or fewer'),
    description: optionalDescriptionSchema.optional(),
    timeOfDay: z.enum(ROUTINE_TIME_OF_DAY_VALUES).optional().default('Anytime'),
    preferredTime: optionalTimeSchema.optional(),
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES_VALUES).optional().default('daily'),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .optional(),
    steps: z.array(routineStepInputSchema).max(50, 'Routines can contain up to 50 steps').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scheduleType === 'weekdays') {
      const uniqueDays = Array.from(new Set(val.weekdays ?? []));
      if (uniqueDays.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Select at least one weekday for a weekday routine schedule',
        });
      }
    }
  })
  .transform((val) => ({
    name: val.name,
    description: val.description,
    timeOfDay: val.timeOfDay,
    preferredTime: val.preferredTime,
    scheduleType: val.scheduleType,
    weekdaysMask:
      val.scheduleType === 'weekdays'
        ? weekdaysToMask(Array.from(new Set(val.weekdays ?? [])).sort((a, b) => a - b))
        : ALL_WEEKDAYS_MASK,
    steps: val.steps ?? [],
  }));

export const updateRoutineSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Routine name cannot be empty')
      .max(120, 'Routine name must be 120 characters or fewer')
      .optional(),
    description: optionalDescriptionSchema.optional(),
    timeOfDay: z.enum(ROUTINE_TIME_OF_DAY_VALUES).optional(),
    preferredTime: optionalTimeSchema.optional(),
    scheduleType: z.enum(ROUTINE_SCHEDULE_TYPES_VALUES).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    status: z.enum(ROUTINE_STATUS_VALUES).optional(),
  })
  .superRefine((val, ctx) => {
    if (!Object.values(val).some((v) => v !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one routine field must be provided for update',
      });
    }
    if (val.scheduleType === 'weekdays') {
      const uniqueDays = Array.from(new Set(val.weekdays ?? []));
      if (uniqueDays.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Select at least one weekday for a weekday routine schedule',
        });
      }
    }
  });

export const upsertRoutineLogSchema = z.object({
  localDate: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'localDate must be a valid YYYY-MM-DD calendar date' })
    .optional(),
  completedStepIds: z.array(z.number().int().positive()).optional(),
  markAllCompleted: z.boolean().optional(),
});

export const routineLogsRangeQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: 'from must be a valid YYYY-MM-DD calendar date' })
      .optional(),
    to: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: 'to must be a valid YYYY-MM-DD calendar date' })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.from && val.to && val.from > val.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Start date (from) must be on or before end date (to)',
      });
    }
    if (val.from && val.to) {
      const fromMs = Date.parse(`${val.from}T00:00:00Z`);
      const toMs = Date.parse(`${val.to}T00:00:00Z`);
      if (Math.round((toMs - fromMs) / 86400000) > 400) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Requested log range cannot exceed 400 days',
        });
      }
    }
  });

export type CreateWorkoutValidated = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutValidated = z.infer<typeof updateWorkoutSchema>;
export type CreateRoutineValidated = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineValidated = z.infer<typeof updateRoutineSchema>;
export type CreateRoutineStepValidated = z.infer<typeof createRoutineStepSchema>;
export type UpdateRoutineStepValidated = z.infer<typeof updateRoutineStepSchema>;
export type UpsertRoutineLogValidated = z.infer<typeof upsertRoutineLogSchema>;
