import { Router } from 'express';
import type { Response } from 'express';
import {
  createUserWorkout,
  deleteUserWorkout,
  getUserWorkoutById,
  listUserWorkouts,
  serializeWorkout,
  updateUserWorkout,
} from '../db/workouts.ts';
import { getTodayLocalDateForTimeZone } from '../lib/habitSchedule.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createWorkoutSchema,
  listWorkoutsQuerySchema,
  resourceIdParamSchema,
  updateWorkoutSchema,
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

  const parsedQuery = listWorkoutsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);
  const todayLocalDate = getTodayLocalDateForTimeZone(userTimeZone);

  try {
    const result = await listUserWorkouts({
      userId: req.dbUser.id,
      userTimeZone,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      activityType: parsedQuery.data.activityType,
    });

    res.json({
      workouts: result.workouts.map(serializeWorkout),
      summary: result.summary,
      meta: {
        timezone: userTimeZone,
        todayLocalDate,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load workouts right now.';
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

  try {
    const workout = await getUserWorkoutById(req.dbUser.id, parsedId.data);
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ workout: serializeWorkout(workout) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load workout right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createWorkoutSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  const userTimeZone = resolveAuthoritativeTimeZone(req);

  try {
    const created = await createUserWorkout({
      userId: req.dbUser.id,
      userTimeZone,
      input: parsedBody.data,
    });
    res.status(201).json({ workout: serializeWorkout(created) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to log workout right now.';
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

  const parsedBody = updateWorkoutSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const updated = await updateUserWorkout({
      userId: req.dbUser.id,
      workoutId: parsedId.data,
      patch: parsedBody.data,
    });
    if (!updated) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ workout: serializeWorkout(updated) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update workout right now.';
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
    const deleted = await deleteUserWorkout(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete workout right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
