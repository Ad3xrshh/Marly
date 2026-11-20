import { z } from 'zod';
import {
  ALL_WEEKDAYS_MASK,
  isValidCalendarDate,
  isValidIanaTimeZone,
  normalizeTimeZoneOrNull,
  weekdaysToMask,
} from '../lib/habitSchedule.ts';
import { TASK_CATEGORIES } from './taskValidator.ts';

export const HABIT_STATUSES = ['active', 'archived'] as const;
export const HABIT_TRACKING_TYPES = ['boolean', 'measurable'] as const;
export const HABIT_FREQUENCY_TYPES = ['daily', 'weekdays', 'times_per_week'] as const;

const descriptionSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 1000, {
    message: 'Description must be 1000 characters or fewer',
  });

const unitSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 24, {
    message: 'Unit must be 24 characters or fewer',
  });

const nullableGoalIdSchema = z.union([
  z.number().int('Goal ID must be a whole number').positive('Goal ID must be a positive integer'),
  z.null(),
]);

export const habitScheduleInputSchema = z
  .object({
    frequencyType: z.enum(HABIT_FREQUENCY_TYPES),
    weekdays: z
      .array(z.number().int().min(0, 'Weekday must be 0-6').max(6, 'Weekday must be 0-6'))
      .optional(),
    targetPerWeek: z
      .union([
        z.number().int('Weekly target must be a whole number').min(1).max(7),
        z.null(),
      ])
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.frequencyType === 'daily') {
      if (val.targetPerWeek !== undefined && val.targetPerWeek !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetPerWeek'],
          message: 'Daily schedules do not accept targetPerWeek',
        });
      }
      return;
    }

    if (val.frequencyType === 'weekdays') {
      const uniqueDays = Array.from(new Set(val.weekdays ?? []));
      if (uniqueDays.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Select at least one weekday for a selected-weekdays schedule',
        });
      }
      if (val.targetPerWeek !== undefined && val.targetPerWeek !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetPerWeek'],
          message: 'Weekday schedules do not accept targetPerWeek',
        });
      }
      return;
    }

    if (val.frequencyType === 'times_per_week') {
      if (val.targetPerWeek === undefined || val.targetPerWeek === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetPerWeek'],
          message: 'Provide a weekly target between 1 and 7 completions',
        });
      }
    }
  })
  .transform((val) => {
    if (val.frequencyType === 'daily') {
      return {
        frequencyType: 'daily' as const,
        weekdaysMask: ALL_WEEKDAYS_MASK,
        targetPerWeek: null,
      };
    }
    if (val.frequencyType === 'weekdays') {
      const uniqueDays = Array.from(new Set(val.weekdays ?? [])).sort((a, b) => a - b);
      return {
        frequencyType: 'weekdays' as const,
        weekdaysMask: weekdaysToMask(uniqueDays),
        targetPerWeek: null,
      };
    }
    return {
      frequencyType: 'times_per_week' as const,
      // Normalized neutral value; never consulted by schedule evaluation for times_per_week
      weekdaysMask: ALL_WEEKDAYS_MASK,
      targetPerWeek: val.targetPerWeek ?? 1,
    };
  });

export type ValidatedHabitScheduleInput = z.infer<typeof habitScheduleInputSchema>;

export const createHabitSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Habit name is required')
      .max(120, 'Habit name must be 120 characters or fewer'),
    description: descriptionSchema.optional(),
    category: z.enum(TASK_CATEGORIES).optional().default('Health'),
    trackingType: z.enum(HABIT_TRACKING_TYPES).optional().default('boolean'),
    targetValue: z
      .union([
        z.number().finite('Target value must be a valid number').positive('Target value must be greater than 0').max(100000),
        z.null(),
      ])
      .optional(),
    unit: unitSchema.optional(),
    goalId: nullableGoalIdSchema.optional(),
    schedule: habitScheduleInputSchema.optional().default({
      frequencyType: 'daily',
      weekdaysMask: ALL_WEEKDAYS_MASK,
      targetPerWeek: null,
    }),
  })
  .superRefine((data, ctx) => {
    if (data.trackingType === 'measurable') {
      if (data.targetValue === undefined || data.targetValue === null || data.targetValue <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetValue'],
          message: 'Measurable habits require a target value greater than 0',
        });
      }
    } else if (data.targetValue !== undefined && data.targetValue !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetValue'],
        message: 'Boolean habits do not accept a numeric target value',
      });
    }
  });

export const updateHabitSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Habit name cannot be empty')
      .max(120, 'Habit name must be 120 characters or fewer')
      .optional(),
    description: descriptionSchema.optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    trackingType: z.enum(HABIT_TRACKING_TYPES).optional(),
    targetValue: z
      .union([
        z.number().finite('Target value must be a valid number').positive('Target value must be greater than 0').max(100000),
        z.null(),
      ])
      .optional(),
    unit: unitSchema.optional(),
    status: z.enum(HABIT_STATUSES).optional(),
    goalId: nullableGoalIdSchema.optional(),
    schedule: habitScheduleInputSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one habit field must be provided for update',
  });

export const listHabitsQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('all'),
  date: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'Date must be a valid YYYY-MM-DD calendar date' })
    .optional(),
});

export const habitIdParamSchema = z.coerce
  .number()
  .int('Habit ID must be a whole number')
  .positive('Habit ID must be a positive integer');

export const localDateParamSchema = z
  .string()
  .trim()
  .refine(isValidCalendarDate, { message: 'Date must be a valid YYYY-MM-DD calendar date' });

export const upsertHabitLogSchema = z.object({
  localDate: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'localDate must be a valid YYYY-MM-DD calendar date' })
    .optional(),
  completedValue: z
    .number()
    .finite('completedValue must be a finite number')
    .min(0, 'completedValue cannot be negative')
    .max(1000000, 'completedValue is too large')
    .optional(),
});

export const habitLogRangeQuerySchema = z
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
      const diffDays = Math.round((toMs - fromMs) / 86400000);
      if (diffDays > 400) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Requested log range cannot exceed 400 days',
        });
      }
    }
  });

export const updateTimezoneSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, 'Timezone is required')
    .refine(isValidIanaTimeZone, { message: 'Timezone must be a valid IANA timezone identifier' })
    .transform((val) => normalizeTimeZoneOrNull(val) ?? val),
});

export type CreateHabitInputValidated = z.infer<typeof createHabitSchema>;
export type UpdateHabitInputValidated = z.infer<typeof updateHabitSchema>;
export type UpsertHabitLogInputValidated = z.infer<typeof upsertHabitLogSchema>;
