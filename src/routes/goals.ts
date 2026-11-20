import { Router } from 'express';
import type { Response } from 'express';
import {
  createUserGoal,
  createUserGoalMilestone,
  deleteUserGoal,
  deleteUserGoalMilestone,
  getUserGoalById,
  GoalValidationError,
  listUserGoals,
  reorderUserGoalMilestones,
  updateUserGoal,
  updateUserGoalMilestone,
  type GoalWithDetails,
} from '../db/goals.ts';
import type { GoalMilestoneRecord } from '../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createGoalMilestoneSchema,
  createGoalSchema,
  entityIdParamSchema,
  formatZodError,
  goalFilterQuerySchema,
  reorderMilestonesSchema,
  updateGoalMilestoneSchema,
  updateGoalSchema,
} from '../validators/projectGoalValidator.ts';

const router = Router();

router.use(requireAuth);

function serializeGoalMilestone(record: GoalMilestoneRecord) {
  return {
    id: record.id,
    goalId: record.goalId,
    title: record.title,
    targetDate: record.targetDate,
    sortOrder: record.sortOrder,
    completed: record.completed,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeGoal(item: GoalWithDetails) {
  return {
    id: item.goal.id,
    title: item.goal.title,
    description: item.goal.description,
    status: item.goal.status,
    category: item.goal.category,
    targetDate: item.goal.targetDate,
    targetMetricLabel: item.goal.targetMetricLabel,
    targetValue: item.goal.targetValue,
    currentValue: item.goal.currentValue,
    unit: item.goal.unit,
    completedAt: item.goal.completedAt ? item.goal.completedAt.toISOString() : null,
    archivedAt: item.goal.archivedAt ? item.goal.archivedAt.toISOString() : null,
    createdAt: item.goal.createdAt.toISOString(),
    updatedAt: item.goal.updatedAt.toISOString(),
    milestones: item.milestones.map(serializeGoalMilestone),
    linkedProjects: item.linkedProjects,
    progress: item.progress,
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = goalFilterQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  try {
    const records = await listUserGoals(req.dbUser.id, parsedQuery.data);
    res.json({ goals: records.map(serializeGoal) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load goals right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const record = await getUserGoalById(req.dbUser.id, parsedId.data);
    if (!record) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ goal: serializeGoal(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load goal right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createGoalSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const created = await createUserGoal(req.dbUser.id, parsedBody.data);
    res.status(201).json({ goal: serializeGoal(created) });
  } catch (error) {
    if (error instanceof GoalValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to create goal right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = updateGoalSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const updated = await updateUserGoal(req.dbUser.id, parsedId.data, parsedBody.data);
    if (!updated) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ goal: serializeGoal(updated) });
  } catch (error) {
    if (error instanceof GoalValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to update goal right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserGoal(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete goal right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/milestones', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = createGoalMilestoneSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const milestone = await createUserGoalMilestone(req.dbUser.id, parsedId.data, parsedBody.data);
    if (!milestone) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    const goal = await getUserGoalById(req.dbUser.id, parsedId.data);
    res.status(201).json({
      milestone: serializeGoalMilestone(milestone),
      goal: goal ? serializeGoal(goal) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create goal milestone right now.';
    res.status(500).json({ error: message });
  }
});

router.put('/:id/milestones/reorder', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = reorderMilestonesSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const reordered = await reorderUserGoalMilestones(
      req.dbUser.id,
      parsedId.data,
      parsedBody.data.milestoneIds
    );
    if (!reordered) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    const goal = await getUserGoalById(req.dbUser.id, parsedId.data);
    res.json({
      milestones: reordered.map(serializeGoalMilestone),
      goal: goal ? serializeGoal(goal) : null,
    });
  } catch (error) {
    if (error instanceof GoalValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to reorder goal milestones right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id/milestones/:milestoneId', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  const parsedMilestoneId = entityIdParamSchema.safeParse(req.params.milestoneId);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }
  if (!parsedMilestoneId.success) {
    res.status(400).json(formatZodError(parsedMilestoneId.error));
    return;
  }

  const parsedBody = updateGoalMilestoneSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const milestone = await updateUserGoalMilestone(
      req.dbUser.id,
      parsedId.data,
      parsedMilestoneId.data,
      parsedBody.data
    );
    if (!milestone) {
      res.status(404).json({ error: 'Goal milestone not found' });
      return;
    }
    const goal = await getUserGoalById(req.dbUser.id, parsedId.data);
    res.json({
      milestone: serializeGoalMilestone(milestone),
      goal: goal ? serializeGoal(goal) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update goal milestone right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id/milestones/:milestoneId', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = entityIdParamSchema.safeParse(req.params.id);
  const parsedMilestoneId = entityIdParamSchema.safeParse(req.params.milestoneId);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }
  if (!parsedMilestoneId.success) {
    res.status(400).json(formatZodError(parsedMilestoneId.error));
    return;
  }

  try {
    const deleted = await deleteUserGoalMilestone(
      req.dbUser.id,
      parsedId.data,
      parsedMilestoneId.data
    );
    if (!deleted) {
      res.status(404).json({ error: 'Goal milestone not found' });
      return;
    }
    const goal = await getUserGoalById(req.dbUser.id, parsedId.data);
    res.json({
      deleted: true,
      id: deleted.id,
      goal: goal ? serializeGoal(goal) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete goal milestone right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
