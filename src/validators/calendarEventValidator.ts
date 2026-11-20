import { z } from 'zod';
import { TASK_CATEGORIES } from './taskValidator.ts';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_WITH_TZ_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

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

function parseIsoDateTime(value: string): Date | null {
  if (!ISO_DATETIME_WITH_TZ_REGEX.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const dateOnlyStringSchema = z
  .string()
  .trim()
  .refine((val) => isValidCalendarDate(val), {
    message: 'Date must be a valid YYYY-MM-DD calendar date',
  });

const nullableDateOnlySchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || isValidCalendarDate(val), {
    message: 'Date must be a valid YYYY-MM-DD calendar date',
  });

const nullableDateTimeSchema = z
  .union([z.string(), z.null()])
  .transform((val) => {
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((val) => val === null || parseIsoDateTime(val) !== null, {
    message: 'Date/time must be a valid ISO-8601 timestamp with timezone offset or Z',
  })
  .transform((val) => (val ? parseIsoDateTime(val) : null));

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

export const createCalendarEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Event title is required')
      .max(160, 'Event title must be 160 characters or fewer'),
    description: descriptionSchema.optional(),
    category: z.enum(TASK_CATEGORIES).optional().default('Work'),
    allDay: z.boolean().default(false),
    startDate: nullableDateOnlySchema.optional(),
    endDate: nullableDateOnlySchema.optional(),
    startAt: nullableDateTimeSchema.optional(),
    endAt: nullableDateTimeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.allDay) {
      if (!data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'All-day events require a start date (YYYY-MM-DD)',
        });
        return;
      }
      const effectiveEndDate = data.endDate ?? data.startDate;
      if (effectiveEndDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date cannot be earlier than start date',
        });
      }
    } else {
      if (!data.startAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startAt'],
          message: 'Start date and time are required',
        });
      }
      if (!data.endAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endAt'],
          message: 'End date and time are required',
        });
      }
      if (data.startAt && data.endAt && data.endAt.getTime() <= data.startAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endAt'],
          message: 'End date/time must be after start date/time',
        });
      }
    }
  });

export const updateCalendarEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Event title cannot be empty')
      .max(160, 'Event title must be 160 characters or fewer')
      .optional(),
    description: descriptionSchema.optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    allDay: z.boolean().optional(),
    startDate: nullableDateOnlySchema.optional(),
    endDate: nullableDateOnlySchema.optional(),
    startAt: nullableDateTimeSchema.optional(),
    endAt: nullableDateTimeSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one event field must be provided for update',
  });

export const calendarEventFilterQuerySchema = z
  .object({
    fromDate: dateOnlyStringSchema.optional(),
    toDate: dateOnlyStringSchema.optional(),
    rangeStart: z
      .string()
      .refine((val) => parseIsoDateTime(val) !== null, {
        message: 'rangeStart must be a valid ISO-8601 timestamp',
      })
      .transform((val) => parseIsoDateTime(val)!)
      .optional(),
    rangeEnd: z
      .string()
      .refine((val) => parseIsoDateTime(val) !== null, {
        message: 'rangeEnd must be a valid ISO-8601 timestamp',
      })
      .transform((val) => parseIsoDateTime(val)!)
      .optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
  })
  .superRefine((query, ctx) => {
    if ((query.fromDate && !query.toDate) || (!query.fromDate && query.toDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fromDate'],
        message: 'Both fromDate and toDate must be provided together',
      });
    }
    if (query.fromDate && query.toDate && query.toDate < query.fromDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'toDate cannot be earlier than fromDate',
      });
    }
    if ((query.rangeStart && !query.rangeEnd) || (!query.rangeStart && query.rangeEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rangeStart'],
        message: 'Both rangeStart and rangeEnd must be provided together',
      });
    }
    if (
      query.rangeStart &&
      query.rangeEnd &&
      query.rangeEnd.getTime() < query.rangeStart.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rangeEnd'],
        message: 'rangeEnd cannot be earlier than rangeStart',
      });
    }
  });

export const calendarEventIdParamSchema = z.coerce
  .number()
  .int('Event ID must be a whole number')
  .positive('Event ID must be a positive integer');

export function formatCalendarZodError(error: z.ZodError) {
  return {
    error: error.issues[0]?.message || 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
