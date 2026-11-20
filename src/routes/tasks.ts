import { Router } from 'express';
import type { Response } from 'express';
import type { TaskRecord } from '../db/schema.ts';
import {
  createUserTask,
  deleteUserTask,
  getUserTaskById,
  listUserTasks,
  TaskValidationError,
  updateUserTask,
} from '../db/tasks.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createTaskSchema,
  formatZodError,
  taskFilterQuerySchema,
  taskIdParamSchema,
  updateTaskSchema,
} from '../validators/taskValidator.ts';

const router = Router();

router.use(requireAuth);

function serializeTask(record: TaskRecord) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: record.status,
    priority: record.priority,
    category: record.category,
    dueDate: record.dueDate,
    scheduledStart: record.scheduledStart ? record.scheduledStart.toISOString() : null,
    estimatedMinutes: record.estimatedMinutes,
    projectId: record.projectId,
    goalId: record.goalId,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = taskFilterQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  try {
    const records = await listUserTasks(req.dbUser.id, parsedQuery.data);
    res.json({ tasks: records.map(serializeTask) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load tasks right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = taskIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const record = await getUserTaskById(req.dbUser.id, parsedId.data);
    if (!record) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ task: serializeTask(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load the requested task.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createTaskSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const created = await createUserTask(req.dbUser.id, parsedBody.data);
    res.status(201).json({ task: serializeTask(created) });
  } catch (error) {
    if (error instanceof TaskValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to create task right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = taskIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = updateTaskSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const updated = await updateUserTask(req.dbUser.id, parsedId.data, parsedBody.data);
    if (!updated) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ task: serializeTask(updated) });
  } catch (error) {
    if (error instanceof TaskValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to update task right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = taskIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserTask(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete task right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
