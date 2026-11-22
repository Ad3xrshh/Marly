import { Router } from 'express';
import type { Response } from 'express';
import {
  addRoutineStep,
  createUserRoutine,
  deleteRoutineStep,
  deleteUserRoutine,
  deleteUserRoutineLog,
  getUserRoutineById,
  listRoutineLogsForRoutine,
  listUserRoutines,
  reorderRoutineSteps,
  RoutineValidationError,
  serializeRoutine,
  serializeRoutineLog,
  serializeRoutineStep,
  updateRoutineStep,
  updateUserRoutine,
  upsertUserRoutineLog,
} from '../db/routines.ts';
import {
  addDaysToLocalDate,
  getTodayLocalDateForTimeZone,
} from '../lib/habitSchedule.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createRoutineSchema,
  createRoutineStepSchema,
  listRoutinesQuerySchema,
  reorderRoutineStepsSchema,
  resourceIdParamSchema,
  routineLogsRangeQuerySchema,
  stepIdParamSchema,
  updateRoutineSchema,
  updateRoutineStepSchema,
  upsertRoutineLogSchema,
  workoutDateParamSchema,
} from '../validators/fitnessRoutinesValidator.ts';
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

  const parsedQuery = listRoutinesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);

  try {
    const routinesList = await listUserRoutines({
      userId: req.dbUser.id,
      userTimeZone,
      status: parsedQuery.data.status,
      targetDate: parsedQuery.data.date,
    });

    res.json({
      routines: routinesList.map(serializeRoutine),
      meta: {
        timezone: userTimeZone,
        todayLocalDate,
        targetLocalDate: parsedQuery.data.date ?? todayLocalDate,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load routines right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const routine = await getUserRoutineById({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      userTimeZone,
    });
    if (!routine) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({ routine: serializeRoutine(routine) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load routine right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createRoutineSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const created = await createUserRoutine({
      userId: req.dbUser.id,
      userTimeZone,
      input: parsedBody.data,
    });
    res.status(201).json({ routine: serializeRoutine(created) });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to create routine right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = updateRoutineSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const updated = await updateUserRoutine({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      userTimeZone,
      patch: parsedBody.data,
    });
    if (!updated) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({ routine: serializeRoutine(updated) });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to update routine right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserRoutine(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete routine right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/steps', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = createRoutineStepSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await addRoutineStep({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      userTimeZone,
      input: parsedBody.data,
    });
    if (!result) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.status(201).json({
      step: serializeRoutineStep(result.step),
      routine: serializeRoutine(result.hydratedRoutine),
    });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to add routine step right now.';
    res.status(500).json({ error: message });
  }
});

router.put('/:id/steps/reorder', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = reorderRoutineStepsSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const hydrated = await reorderRoutineSteps({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      userTimeZone,
      stepIds: parsedBody.data.stepIds,
    });
    if (!hydrated) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({ routine: serializeRoutine(hydrated) });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to reorder routine steps right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id/steps/:stepId', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedStepId = stepIdParamSchema.safeParse(req.params.stepId);
  if (!parsedStepId.success) {
    res.status(400).json(formatZodError(parsedStepId.error));
    return;
  }

  const parsedBody = updateRoutineStepSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await updateRoutineStep({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      stepId: parsedStepId.data,
      userTimeZone,
      patch: parsedBody.data,
    });
    if (!result) {
      res.status(404).json({ error: 'Routine step not found' });
      return;
    }
    res.json({
      step: serializeRoutineStep(result.step),
      routine: serializeRoutine(result.hydratedRoutine),
    });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to update routine step right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id/steps/:stepId', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedStepId = stepIdParamSchema.safeParse(req.params.stepId);
  if (!parsedStepId.success) {
    res.status(400).json(formatZodError(parsedStepId.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await deleteRoutineStep({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      stepId: parsedStepId.data,
      userTimeZone,
    });
    if (!result) {
      res.status(404).json({ error: 'Routine step not found' });
      return;
    }
    res.json({
      deleted: true,
      id: result.deletedStep.id,
      routine: serializeRoutine(result.hydratedRoutine),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete routine step right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedRange = routineLogsRangeQuerySchema.safeParse(req.query);
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
    const result = await listRoutineLogsForRoutine({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      from,
      to,
    });
    if (!result) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({
      logs: result.logs.map(serializeRoutineLog),
      range: { from, to, timezone: userTimeZone },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load routine logs right now.';
    res.status(500).json({ error: message });
  }
});

router.put('/:id/logs', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = upsertRoutineLogSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await upsertUserRoutineLog({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      userTimeZone,
      input: parsedBody.data,
    });
    if (!result) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    res.json({
      log: serializeRoutineLog(result.log),
      routine: serializeRoutine(result.hydratedRoutine),
    });
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to save routine progress right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id/logs/:localDate', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = resourceIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedDate = workoutDateParamSchema.safeParse(req.params.localDate);
  if (!parsedDate.success) {
    res.status(400).json(formatZodError(parsedDate.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const result = await deleteUserRoutineLog({
      userId: req.dbUser.id,
      routineId: parsedId.data,
      localDate: parsedDate.data,
      userTimeZone,
    });
    if (!result.routineExists || !result.hydratedRoutine) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }
    if (!result.deletedLog) {
      res.status(404).json({ error: 'Routine log not found for the specified date' });
      return;
    }
    res.json({
      deleted: true,
      routineId: parsedId.data,
      localDate: parsedDate.data,
      routine: serializeRoutine(result.hydratedRoutine),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to reset routine log right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
