import { Router } from 'express';
import type { Response } from 'express';
import {
  createUserHabit,
  deleteUserHabit,
  deleteUserHabitLog,
  getUserHabitById,
  HabitValidationError,
  listHabitLogsForHabit,
  listUserHabitLogsInRange,
  listUserHabits,
  serializeHabit,
  serializeHabitLog,
  updateUserHabit,
  updateUserHabitSchedule,
  upsertUserHabitLog,
} from '../db/habits.ts';
import {
  addDaysToLocalDate,
  getTodayLocalDateForTimeZone,
} from '../lib/habitSchedule.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createHabitSchema,
  habitIdParamSchema,
  habitLogRangeQuerySchema,
  habitScheduleInputSchema,
  listHabitsQuerySchema,
  localDateParamSchema,
  updateHabitSchema,
  upsertHabitLogSchema,
} from '../validators/habitValidator.ts';
import { formatZodError } from '../validators/taskValidator.ts';

const router = Router();
router.use(requireAuth);

function resolveAuthoritativeTimeZone(req: AuthRequest): string {
  return req.dbUser?.timezone || 'UTC';
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = listHabitsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);

  try {
    const hydrated = await listUserHabits({
      userId: req.dbUser.id,
      userTimeZone,
      status: parsedQuery.data.status,
      targetDate: parsedQuery.data.date,
    });

    res.json({
      habits: hydrated.map(serializeHabit),
      meta: {
        timezone: userTimeZone,
        timezoneInitialized: Boolean(req.dbUser.timezone),
        todayLocalDate,
        targetLocalDate: parsedQuery.data.date ?? todayLocalDate,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load habits right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const habit = await getUserHabitById({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      userTimeZone,
    });
    if (!habit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({ habit: serializeHabit(habit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load habit right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createHabitSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const created = await createUserHabit({
      userId: req.dbUser.id,
      userTimeZone,
      input: parsedBody.data,
    });
    res.status(201).json({ habit: serializeHabit(created) });
  } catch (error) {
    if (error instanceof HabitValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to create habit right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = updateHabitSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const updated = await updateUserHabit({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      userTimeZone,
      patch: parsedBody.data,
    });
    if (!updated) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({ habit: serializeHabit(updated) });
  } catch (error) {
    if (error instanceof HabitValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to update habit right now.';
    res.status(500).json({ error: message });
  }
});

router.put('/:id/schedule', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = habitScheduleInputSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const updated = await updateUserHabitSchedule({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      userTimeZone,
      scheduleInput: parsedBody.data,
    });
    if (!updated) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({ habit: serializeHabit(updated) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update habit schedule right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserHabit(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete habit right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedRange = habitLogRangeQuerySchema.safeParse(req.query);
  if (!parsedRange.success) {
    res.status(400).json(formatZodError(parsedRange.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const to = parsedRange.data.to ?? todayLocalDate;
  const from = parsedRange.data.from ?? addDaysToLocalDate(to, -89);

  if (from > to) {
    res.status(400).json({ error: 'Start date (from) must be on or before end date (to)' });
    return;
  }

  try {
    const result = await listHabitLogsForHabit({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      from,
      to,
    });
    if (!result) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({
      logs: result.logs.map(serializeHabitLog),
      range: { from, to, timezone: userTimeZone },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load habit logs right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/logs', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = upsertHabitLogSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await upsertUserHabitLog({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      userTimeZone,
      input: parsedBody.data,
    });
    if (!result) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({
      log: serializeHabitLog(result.log),
      habit: serializeHabit(result.hydratedHabit),
    });
  } catch (error) {
    if (error instanceof HabitValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to save habit completion right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id/logs/:localDate', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = habitIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedDate = localDateParamSchema.safeParse(req.params.localDate);
  if (!parsedDate.success) {
    res.status(400).json(formatZodError(parsedDate.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await deleteUserHabitLog({
      userId: req.dbUser.id,
      habitId: parsedId.data,
      localDate: parsedDate.data,
      userTimeZone,
    });
    if (!result.habitExists || !result.hydratedHabit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    if (!result.deletedLog) {
      res.status(404).json({ error: 'Habit log not found for the specified date' });
      return;
    }
    res.json({
      deleted: true,
      habitId: parsedId.data,
      localDate: parsedDate.data,
      habit: serializeHabit(result.hydratedHabit),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to undo habit completion right now.';
    res.status(500).json({ error: message });
  }
});

export const habitLogsRouter = Router();
habitLogsRouter.use(requireAuth);

habitLogsRouter.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedRange = habitLogRangeQuerySchema.safeParse(req.query);
  if (!parsedRange.success) {
    res.status(400).json(formatZodError(parsedRange.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);
  const to = parsedRange.data.to ?? todayLocalDate;
  const from = parsedRange.data.from ?? addDaysToLocalDate(to, -29);

  if (from > to) {
    res.status(400).json({ error: 'Start date (from) must be on or before end date (to)' });
    return;
  }

  try {
    const logs = await listUserHabitLogsInRange({
      userId: req.dbUser.id,
      from,
      to,
    });
    res.json({
      logs: logs.map(serializeHabitLog),
      range: { from, to, timezone: userTimeZone },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load habit logs right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
