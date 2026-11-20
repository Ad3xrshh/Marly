import { Router } from 'express';
import type { Response } from 'express';
import {
  createUserProject,
  createUserProjectMilestone,
  deleteUserProject,
  deleteUserProjectMilestone,
  getUserProjectById,
  listUserProjects,
  ProjectValidationError,
  reorderUserProjectMilestones,
  updateUserProject,
  updateUserProjectMilestone,
  type ProjectWithDetails,
} from '../db/projects.ts';
import type { ProjectMilestoneRecord } from '../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  createProjectMilestoneSchema,
  createProjectSchema,
  entityIdParamSchema,
  formatZodError,
  projectFilterQuerySchema,
  reorderMilestonesSchema,
  updateProjectMilestoneSchema,
  updateProjectSchema,
} from '../validators/projectGoalValidator.ts';

const router = Router();

router.use(requireAuth);

function serializeProjectMilestone(record: ProjectMilestoneRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description,
    dueDate: record.dueDate,
    sortOrder: record.sortOrder,
    completed: record.completed,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeProject(item: ProjectWithDetails) {
  return {
    id: item.project.id,
    name: item.project.name,
    description: item.project.description,
    status: item.project.status,
    priority: item.project.priority,
    category: item.project.category,
    goalId: item.project.goalId,
    goalTitle: item.goalTitle,
    startDate: item.project.startDate,
    targetDate: item.project.targetDate,
    completedAt: item.project.completedAt ? item.project.completedAt.toISOString() : null,
    archivedAt: item.project.archivedAt ? item.project.archivedAt.toISOString() : null,
    createdAt: item.project.createdAt.toISOString(),
    updatedAt: item.project.updatedAt.toISOString(),
    milestones: item.milestones.map(serializeProjectMilestone),
    progress: item.progress,
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = projectFilterQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  try {
    const records = await listUserProjects(req.dbUser.id, parsedQuery.data);
    res.json({ projects: records.map(serializeProject) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load projects right now.';
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
    const record = await getUserProjectById(req.dbUser.id, parsedId.data);
    if (!record) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project: serializeProject(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load project right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createProjectSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const created = await createUserProject(req.dbUser.id, parsedBody.data);
    res.status(201).json({ project: serializeProject(created) });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to create project right now.';
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

  const parsedBody = updateProjectSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const updated = await updateUserProject(req.dbUser.id, parsedId.data, parsedBody.data);
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project: serializeProject(updated) });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to update project right now.';
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
    const deleted = await deleteUserProject(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete project right now.';
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

  const parsedBody = createProjectMilestoneSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const milestone = await createUserProjectMilestone(
      req.dbUser.id,
      parsedId.data,
      parsedBody.data
    );
    if (!milestone) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const project = await getUserProjectById(req.dbUser.id, parsedId.data);
    res.status(201).json({
      milestone: serializeProjectMilestone(milestone),
      project: project ? serializeProject(project) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create project milestone right now.';
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
    const reordered = await reorderUserProjectMilestones(
      req.dbUser.id,
      parsedId.data,
      parsedBody.data.milestoneIds
    );
    if (!reordered) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const project = await getUserProjectById(req.dbUser.id, parsedId.data);
    res.json({
      milestones: reordered.map(serializeProjectMilestone),
      project: project ? serializeProject(project) : null,
    });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to reorder project milestones right now.';
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

  const parsedBody = updateProjectMilestoneSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const milestone = await updateUserProjectMilestone(
      req.dbUser.id,
      parsedId.data,
      parsedMilestoneId.data,
      parsedBody.data
    );
    if (!milestone) {
      res.status(404).json({ error: 'Project milestone not found' });
      return;
    }
    const project = await getUserProjectById(req.dbUser.id, parsedId.data);
    res.json({
      milestone: serializeProjectMilestone(milestone),
      project: project ? serializeProject(project) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update project milestone right now.';
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
    const deleted = await deleteUserProjectMilestone(
      req.dbUser.id,
      parsedId.data,
      parsedMilestoneId.data
    );
    if (!deleted) {
      res.status(404).json({ error: 'Project milestone not found' });
      return;
    }
    const project = await getUserProjectById(req.dbUser.id, parsedId.data);
    res.json({
      deleted: true,
      id: deleted.id,
      project: project ? serializeProject(project) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete project milestone right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
