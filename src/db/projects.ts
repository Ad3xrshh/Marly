import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { computeProjectProgress, type ProjectProgressSummary } from '../lib/progress.ts';
import { db } from './index.ts';
import {
  goals,
  projectMilestones,
  projects,
  tasks,
  type ProjectMilestoneRecord,
  type ProjectRecord,
  type ProjectStatusValue,
  type TaskCategoryValue,
  type TaskPriorityValue,
} from './schema.ts';

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

export interface ProjectFilterParams {
  status?: ProjectStatusValue;
  priority?: TaskPriorityValue;
  category?: TaskCategoryValue;
  goalId?: number;
}

export interface CreateProjectParams {
  name: string;
  description?: string | null;
  status?: ProjectStatusValue;
  priority?: TaskPriorityValue;
  category?: TaskCategoryValue;
  goalId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string | null;
  status?: ProjectStatusValue;
  priority?: TaskPriorityValue;
  category?: TaskCategoryValue;
  goalId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface CreateProjectMilestoneParams {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface UpdateProjectMilestoneParams {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface ProjectWithDetails {
  project: ProjectRecord;
  goalTitle: string | null;
  milestones: ProjectMilestoneRecord[];
  progress: ProjectProgressSummary;
}

async function assertUserGoalOwnership(userId: number, goalId: number) {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ProjectValidationError('Selected goal was not found for your account');
  }
}

async function hydrateProjects(
  userId: number,
  projectRows: ProjectRecord[]
): Promise<ProjectWithDetails[]> {
  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);
  const goalIds = Array.from(
    new Set(projectRows.map((p) => p.goalId).filter((id): id is number => id !== null))
  );

  const [milestoneRows, taskRows, goalRows] = await Promise.all([
    db
      .select()
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.userId, userId),
          inArray(projectMilestones.projectId, projectIds)
        )
      )
      .orderBy(asc(projectMilestones.sortOrder), asc(projectMilestones.id)),
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        projectId: tasks.projectId,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.projectId, projectIds))),
    goalIds.length > 0
      ? db
          .select({ id: goals.id, title: goals.title })
          .from(goals)
          .where(and(eq(goals.userId, userId), inArray(goals.id, goalIds)))
      : Promise.resolve([]),
  ]);

  const goalTitleMap = new Map<number, string>(goalRows.map((g) => [g.id, g.title]));

  return projectRows.map((project) => {
    const milestones = milestoneRows.filter((m) => m.projectId === project.id);
    const projectTasks = taskRows.filter((t) => t.projectId === project.id);
    const progress = computeProjectProgress({
      status: project.status,
      milestones,
      tasks: projectTasks,
    });

    return {
      project,
      goalTitle: project.goalId ? (goalTitleMap.get(project.goalId) ?? null) : null,
      milestones,
      progress,
    };
  });
}

export async function listUserProjects(
  userId: number,
  filters?: ProjectFilterParams
): Promise<ProjectWithDetails[]> {
  try {
    const conditions = [eq(projects.userId, userId)];
    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(projects.priority, filters.priority));
    }
    if (filters?.category) {
      conditions.push(eq(projects.category, filters.category));
    }
    if (filters?.goalId !== undefined) {
      conditions.push(eq(projects.goalId, filters.goalId));
    }

    const rows = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(asc(projects.targetDate), desc(projects.createdAt));

    return await hydrateProjects(userId, rows);
  } catch (error) {
    console.error('Failed to list projects:', error);
    throw new Error('Unable to load projects right now.', { cause: error });
  }
}

export async function getUserProjectById(
  userId: number,
  projectId: number
): Promise<ProjectWithDetails | null> {
  try {
    const rows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!rows[0]) return null;
    const hydrated = await hydrateProjects(userId, rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Failed to load project:', error);
    throw new Error('Unable to load the requested project.', { cause: error });
  }
}

export async function createUserProject(
  userId: number,
  input: CreateProjectParams
): Promise<ProjectWithDetails> {
  try {
    if (input.goalId !== undefined && input.goalId !== null) {
      await assertUserGoalOwnership(userId, input.goalId);
    }

    if (input.startDate && input.targetDate && input.targetDate < input.startDate) {
      throw new ProjectValidationError('Target date cannot be earlier than start date');
    }

    const status: ProjectStatusValue = input.status ?? 'active';
    const now = new Date();

    const rows = await db
      .insert(projects)
      .values({
        userId,
        goalId: input.goalId ?? null,
        name: input.name,
        description: input.description ?? null,
        status,
        priority: input.priority ?? 'medium',
        category: input.category ?? 'Work',
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        completedAt: status === 'completed' ? now : null,
        archivedAt: status === 'archived' ? now : null,
      })
      .returning();

    const hydrated = await hydrateProjects(userId, rows);
    return hydrated[0];
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      throw error;
    }
    console.error('Failed to create project:', error);
    throw new Error('Unable to create project right now.', { cause: error });
  }
}

export async function updateUserProject(
  userId: number,
  projectId: number,
  patch: UpdateProjectParams
): Promise<ProjectWithDetails | null> {
  try {
    const existingRows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return null;

    if (patch.goalId !== undefined && patch.goalId !== null) {
      await assertUserGoalOwnership(userId, patch.goalId);
    }

    const nextStartDate = patch.startDate !== undefined ? patch.startDate : existing.startDate;
    const nextTargetDate =
      patch.targetDate !== undefined ? patch.targetDate : existing.targetDate;

    if (nextStartDate && nextTargetDate && nextTargetDate < nextStartDate) {
      throw new ProjectValidationError('Target date cannot be earlier than start date');
    }

    const nextStatus = patch.status ?? existing.status;
    let nextCompletedAt = existing.completedAt;
    let nextArchivedAt = existing.archivedAt;

    if (patch.status !== undefined) {
      if (patch.status === 'completed' && existing.status !== 'completed') {
        nextCompletedAt = new Date();
      } else if (patch.status !== 'completed') {
        nextCompletedAt = null;
      }

      if (patch.status === 'archived' && existing.status !== 'archived') {
        nextArchivedAt = new Date();
      } else if (patch.status !== 'archived') {
        nextArchivedAt = null;
      }
    }

    const updatedRows = await db
      .update(projects)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: nextStatus } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
        ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
        ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {}),
        completedAt: nextCompletedAt,
        archivedAt: nextArchivedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    if (!updatedRows[0]) return null;
    const hydrated = await hydrateProjects(userId, updatedRows);
    return hydrated[0] ?? null;
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      throw error;
    }
    console.error('Failed to update project:', error);
    throw new Error('Unable to update project right now.', { cause: error });
  }
}

export async function deleteUserProject(
  userId: number,
  projectId: number
): Promise<ProjectRecord | null> {
  try {
    const rows = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw new Error('Unable to delete project right now.', { cause: error });
  }
}

export async function createUserProjectMilestone(
  userId: number,
  projectId: number,
  input: CreateProjectMilestoneParams
): Promise<ProjectMilestoneRecord | null> {
  try {
    const parentRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!parentRows[0]) return null;

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const existing = await db
        .select({ sortOrder: projectMilestones.sortOrder })
        .from(projectMilestones)
        .where(
          and(
            eq(projectMilestones.projectId, projectId),
            eq(projectMilestones.userId, userId)
          )
        )
        .orderBy(desc(projectMilestones.sortOrder))
        .limit(1);
      sortOrder = existing[0] ? existing[0].sortOrder + 1 : 0;
    }

    const completed = input.completed ?? false;
    const rows = await db
      .insert(projectMilestones)
      .values({
        projectId,
        userId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        sortOrder,
        completed,
        completedAt: completed ? new Date() : null,
      })
      .returning();

    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    return rows[0];
  } catch (error) {
    console.error('Failed to create project milestone:', error);
    throw new Error('Unable to create project milestone right now.', { cause: error });
  }
}

export async function updateUserProjectMilestone(
  userId: number,
  projectId: number,
  milestoneId: number,
  patch: UpdateProjectMilestoneParams
): Promise<ProjectMilestoneRecord | null> {
  try {
    const existingRows = await db
      .select()
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.id, milestoneId),
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.userId, userId)
        )
      )
      .limit(1);

    const existing = existingRows[0];
    if (!existing) return null;

    let nextCompletedAt = existing.completedAt;
    if (patch.completed !== undefined) {
      if (patch.completed && !existing.completed) {
        nextCompletedAt = new Date();
      } else if (!patch.completed) {
        nextCompletedAt = null;
      }
    }

    const rows = await db
      .update(projectMilestones)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
        completedAt: nextCompletedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectMilestones.id, milestoneId),
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.userId, userId)
        )
      )
      .returning();

    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to update project milestone:', error);
    throw new Error('Unable to update project milestone right now.', { cause: error });
  }
}

export async function deleteUserProjectMilestone(
  userId: number,
  projectId: number,
  milestoneId: number
): Promise<ProjectMilestoneRecord | null> {
  try {
    const rows = await db
      .delete(projectMilestones)
      .where(
        and(
          eq(projectMilestones.id, milestoneId),
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.userId, userId)
        )
      )
      .returning();

    if (rows[0]) {
      await db
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    }

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete project milestone:', error);
    throw new Error('Unable to delete project milestone right now.', { cause: error });
  }
}

export async function reorderUserProjectMilestones(
  userId: number,
  projectId: number,
  milestoneIds: number[]
): Promise<ProjectMilestoneRecord[] | null> {
  try {
    const parentRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!parentRows[0]) return null;

    const existing = await db
      .select()
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.userId, userId)
        )
      );

    const existingIds = new Set(existing.map((m) => m.id));
    if (
      milestoneIds.length !== existing.length ||
      new Set(milestoneIds).size !== existing.length ||
      milestoneIds.some((id) => !existingIds.has(id))
    ) {
      throw new ProjectValidationError('Milestone order must include every milestone in this project');
    }

    await db.transaction(async (tx) => {
      for (let idx = 0; idx < milestoneIds.length; idx += 1) {
        await tx
          .update(projectMilestones)
          .set({ sortOrder: idx, updatedAt: new Date() })
          .where(
            and(
              eq(projectMilestones.id, milestoneIds[idx]),
              eq(projectMilestones.projectId, projectId),
              eq(projectMilestones.userId, userId)
            )
          );
      }
      await tx
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    });

    return await db
      .select()
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.projectId, projectId),
          eq(projectMilestones.userId, userId)
        )
      )
      .orderBy(asc(projectMilestones.sortOrder), asc(projectMilestones.id));
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      throw error;
    }
    console.error('Failed to reorder project milestones:', error);
    throw new Error('Unable to reorder project milestones right now.', { cause: error });
  }
}
