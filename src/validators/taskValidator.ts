import { z } from 'zod';

export const TASK_STATUSES = ['todo', 'in_progress', 'completed'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TASK_CATEGORIES = ['Work', 'Health', 'Family', 'Study', 'Personal'] as const;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
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

const dueDateSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || isValidCalendarDate(val), {
    message: 'Due date must be a valid YYYY-MM-DD calendar date',
  });

const descriptionSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || val.length <= 2000, {
    message: 'Description must be 2000 characters or fewer',
  });

const nullableRelationIdSchema = z.union([
  z.number().int('ID must be a whole number').positive('ID must be a positive integer'),
  z.null(),
]);

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(160, 'Task title must be 160 characters or fewer'),
  description: descriptionSchema.optional(),
  status: z.enum(TASK_STATUSES).optional().default('todo'),
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
  category: z.enum(TASK_CATEGORIES).optional().default('Work'),
  dueDate: dueDateSchema.optional(),
  projectId: nullableRelationIdSchema.optional(),
  goalId: nullableRelationIdSchema.optional(),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title cannot be empty')
      .max(160, 'Task title must be 160 characters or fewer')
      .optional(),
    description: descriptionSchema.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    dueDate: dueDateSchema.optional(),
    projectId: nullableRelationIdSchema.optional(),
    goalId: nullableRelationIdSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one task field must be provided for update',
  });

export const taskFilterQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  goalId: z.coerce.number().int().positive().optional(),
});

export const taskIdParamSchema = z.coerce
  .number()
  .int('Task ID must be a whole number')
  .positive('Task ID must be a positive integer');

export function formatZodError(error: z.ZodError) {
  return {
    error: error.issues[0]?.message || 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
