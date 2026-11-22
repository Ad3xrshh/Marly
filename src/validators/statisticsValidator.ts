import { z } from 'zod';
import { isValidCalendarDate } from '../lib/habitSchedule.ts';
import { diffLocalDays } from '../lib/habitVisualizations.ts';

export const STATISTICS_PERIOD_PRESETS = [
  '7d',
  'week',
  '30d',
  'month',
  '90d',
  'ytd',
  'custom',
] as const;

export const MAX_STATISTICS_CUSTOM_SPAN_DAYS = 366;

export const statisticsQuerySchema = z
  .object({
    preset: z.enum(STATISTICS_PERIOD_PRESETS).optional().default('30d'),
    from: z
      .string()
      .trim()
      .refine((v) => isValidCalendarDate(v), {
        message: 'from must be a valid YYYY-MM-DD calendar date',
      })
      .optional(),
    to: z
      .string()
      .trim()
      .refine((v) => isValidCalendarDate(v), {
        message: 'to must be a valid YYYY-MM-DD calendar date',
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.preset === 'custom') {
      if (!data.from || !data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Both from and to dates are required for custom statistics ranges.',
          path: ['from'],
        });
        return;
      }
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date must be on or before end date.',
          path: ['from'],
        });
        return;
      }
      const spanDays = diffLocalDays(data.from, data.to) + 1;
      if (spanDays > MAX_STATISTICS_CUSTOM_SPAN_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Custom statistics ranges cannot exceed ${MAX_STATISTICS_CUSTOM_SPAN_DAYS} days.`,
          path: ['to'],
        });
      }
    } else if (data.from || data.to) {
      if (data.from && data.to && data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'from date must be on or before to date.',
          path: ['from'],
        });
      }
    }
  });

export type StatisticsQueryValidated = z.infer<typeof statisticsQuerySchema>;
