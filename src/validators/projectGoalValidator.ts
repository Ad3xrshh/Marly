import { z } from 'zod';
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  formatZodError,
} from './taskValidator.ts';

export const GOAL_STATUSES = ['planned', 'active', 'completed', 'paused', 'archived'] as const;
export const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'completed', 'archived'] as const;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

const optionalDateOnlySchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || isValidCalendarDate(val), {
    message: 'Date must be a valid YYYY-MM-DD calendar date',
  });

const optionalDescriptionSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 2000, {
    message: 'Description must be 2000 characters or fewer',
  });

const optionalShortTextSchema = (maxLength: number, label: string) =>
  z
    .union([z.string(), z.null()])
    .transform((val) => {
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    })
    .refine((val) => val === null || val.length <= maxLength, {
      message: `${label} must be ${maxLength} characters or fewer`,
    });

const nullablePositiveIdSchema = z.union([
  z.number().int('ID must be a whole number').positive('ID must be positive'),
  z.null(),
]);

export const entityIdParamSchema = z.coerce
  .number()
  .int('ID must be a whole number')
  .positive('ID must be a positive integer');

export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Goal title is required')
    .max(160, 'Goal title must be 160 characters or fewer'),
  description: optionalDescriptionSchema.optional(),
  status: z.enum(GOAL_STATUSES).optional().default('active'),
  category: z.enum(TASK_CATEGORIES).optional().default('Work'),
  targetDate: optionalDateOnlySchema.optional(),
  targetMetricLabel: optionalShortTextSchema(80, 'Target metric label').optional(),
  targetValue: z
    .union([z.number().finite().positive('Target value must be greater than zero'), z.null()])
    .optional(),
  currentValue: z
    .union([z.number().finite().min(0, 'Current value cannot be negative'), z.null()])
    .optional(),
  unit: optionalShortTextSchema(24, 'Unit').optional(),
});

export const updateGoalSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Goal title cannot be empty')
      .max(160, 'Goal title must be 160 characters or fewer')
      .optional(),
    description: optionalDescriptionSchema.optional(),
    status: z.enum(GOAL_STATUSES).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    targetDate: optionalDateOnlySchema.optional(),
    targetMetricLabel: optionalShortTextSchema(80, 'Target metric label').optional(),
    targetValue: z
      .union([z.number().finite().positive('Target value must be greater than zero'), z.null()])
      .optional(),
    currentValue: z
      .union([z.number().finite().min(0, 'Current value cannot be negative'), z.null()])
      .optional(),
    unit: optionalShortTextSchema(24, 'Unit').optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one goal field must be provided for update',
  });

export const goalFilterQuerySchema = z.object({
  status: z.enum(GOAL_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
});

export const createGoalMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title is required')
    .max(160, 'Milestone title must be 160 characters or fewer'),
  targetDate: optionalDateOnlySchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  completed: z.boolean().optional().default(false),
});

export const updateGoalMilestoneSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Milestone title cannot be empty')
      .max(160, 'Milestone title must be 160 characters or fewer')
      .optional(),
    targetDate: optionalDateOnlySchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one milestone field must be provided for update',
  });

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name is required')
      .max(160, 'Project name must be 160 characters or fewer'),
    description: optionalDescriptionSchema.optional(),
    status: z.enum(PROJECT_STATUSES).optional().default('active'),
    priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
    category: z.enum(TASK_CATEGORIES).optional().default('Work'),
    goalId: nullablePositiveIdSchema.optional(),
    startDate: optionalDateOnlySchema.optional(),
    targetDate: optionalDateOnlySchema.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.targetDate) {
        return data.targetDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Target date cannot be earlier than start date',
      path: ['targetDate'],
    }
  );

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name cannot be empty')
      .max(160, 'Project name must be 160 characters or fewer')
      .optional(),
    description: optionalDescriptionSchema.optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    goalId: nullablePositiveIdSchema.optional(),
    startDate: optionalDateOnlySchema.optional(),
    targetDate: optionalDateOnlySchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one project field must be provided for update',
  })
  .refine(
    (data) => {
      if (data.startDate && data.targetDate) {
        return data.targetDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Target date cannot be earlier than start date',
      path: ['targetDate'],
    }
  );

export const projectFilterQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  goalId: z.coerce.number().int().positive().optional(),
});

export const createProjectMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title is required')
    .max(160, 'Milestone title must be 160 characters or fewer'),
  description: optionalDescriptionSchema.optional(),
  dueDate: optionalDateOnlySchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  completed: z.boolean().optional().default(false),
});

export const updateProjectMilestoneSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Milestone title cannot be empty')
      .max(160, 'Milestone title must be 160 characters or fewer')
      .optional(),
    description: optionalDescriptionSchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one milestone field must be provided for update',
  });

export const reorderMilestonesSchema = z.object({
  milestoneIds: z
    .array(z.number().int().positive('Milestone ID must be a positive integer'))
    .min(1, 'At least one milestone ID is required'),
});

export { formatZodError };
