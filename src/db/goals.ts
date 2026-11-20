import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  computeGoalProgress,
  computeProjectProgress,
  type GoalProgressSummary,
} from '../lib/progress.ts';
import { db } from './index.ts';
import {
  goalMilestones,
  goals,
  projectMilestones,
  projects,
  tasks,
  type GoalMilestoneRecord,
  type GoalRecord,
  type GoalStatusValue,
  type TaskCategoryValue,
} from './schema.ts';

export class GoalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalValidationError';
  }
}

export interface GoalFilterParams {
  status?: GoalStatusValue;
  category?: TaskCategoryValue;
}

export interface CreateGoalParams {
  title: string;
  description?: string | null;
  status?: GoalStatusValue;
  category?: TaskCategoryValue;
  targetDate?: string | null;
  targetMetricLabel?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
}

export interface UpdateGoalParams {
  title?: string;
  description?: string | null;
  status?: GoalStatusValue;
  category?: TaskCategoryValue;
  targetDate?: string | null;
  targetMetricLabel?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
}

export interface CreateGoalMilestoneParams {
  title: string;
  targetDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface UpdateGoalMilestoneParams {
  title?: string;
  targetDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface GoalLinkedProjectSummary {
  id: number;
  name: string;
  status: string;
  priority: string;
  targetDate: string | null;
  progressPercent: number;
}

export interface GoalWithDetails {
  goal: GoalRecord;
  milestones: GoalMilestoneRecord[];
  linkedProjects: GoalLinkedProjectSummary[];
  progress: GoalProgressSummary;
}

async function hydrateGoals(userId: number, goalRows: GoalRecord[]): Promise<GoalWithDetails[]> {
  if (goalRows.length === 0) return [];

  const goalIds = goalRows.map((g) => g.id);

  const [milestoneRows, linkedProjectRows, userTaskRows] = await Promise.all([
    db
      .select()
      .from(goalMilestones)
      .where(and(eq(goalMilestones.userId, userId), inArray(goalMilestones.goalId, goalIds)))
      .orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.id)),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), inArray(projects.goalId, goalIds)))
      .orderBy(asc(projects.targetDate), desc(projects.createdAt)),
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        projectId: tasks.projectId,
        goalId: tasks.goalId,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
  ]);

  const linkedProjectIds = linkedProjectRows.map((p) => p.id);
  const projMilestoneRows =
    linkedProjectIds.length > 0
      ? await db
          .select({
            id: projectMilestones.id,
            projectId: projectMilestones.projectId,
            completed: projectMilestones.completed,
          })
          .from(projectMilestones)
          .where(
            and(
              eq(projectMilestones.userId, userId),
              inArray(projectMilestones.projectId, linkedProjectIds)
            )
          )
      : [];

  return goalRows.map((goal) => {
    const milestones = milestoneRows.filter((m) => m.goalId === goal.id);
    const goalProjects = linkedProjectRows.filter((p) => p.goalId === goal.id);

    const projectInputs = goalProjects.map((proj) => {
      const pMilestones = projMilestoneRows.filter((pm) => pm.projectId === proj.id);
      const pTasks = userTaskRows.filter((t) => t.projectId === proj.id);
      const progress = computeProjectProgress({
        status: proj.status,
        milestones: pMilestones,
        tasks: pTasks,
      });

      return {
        record: proj,
        progress,
      };
    });

    const goalTasks = userTaskRows.filter((t) => t.goalId === goal.id);
    const progress = computeGoalProgress({
      goalId: goal.id,
      status: goal.status,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      milestones,
      linkedProjects: projectInputs.map((item) => ({
        id: item.record.id,
        status: item.record.status,
        progress: item.progress,
      })),
      goalTasks,
    });

    return {
      goal,
      milestones,
      linkedProjects: projectInputs.map((item) => ({
        id: item.record.id,
        name: item.record.name,
        status: item.record.status,
        priority: item.record.priority,
        targetDate: item.record.targetDate,
        progressPercent: item.progress.progressPercent,
      })),
      progress,
    };
  });
}

export async function listUserGoals(
  userId: number,
  filters?: GoalFilterParams
): Promise<GoalWithDetails[]> {
  try {
    const conditions = [eq(goals.userId, userId)];
    if (filters?.status) {
      conditions.push(eq(goals.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(goals.category, filters.category));
    }

    const goalRows = await db
      .select()
      .from(goals)
      .where(and(...conditions))
      .orderBy(asc(goals.targetDate), desc(goals.createdAt));

    return await hydrateGoals(userId, goalRows);
  } catch (error) {
    console.error('Failed to list goals:', error);
    throw new Error('Unable to load goals right now.', { cause: error });
  }
}

export async function getUserGoalById(
  userId: number,
  goalId: number
): Promise<GoalWithDetails | null> {
  try {
    const rows = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!rows[0]) return null;
    const hydrated = await hydrateGoals(userId, rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Failed to load goal:', error);
    throw new Error('Unable to load the requested goal.', { cause: error });
  }
}

export async function createUserGoal(
  userId: number,
  input: CreateGoalParams
): Promise<GoalWithDetails> {
  try {
    const status: GoalStatusValue = input.status ?? 'active';
    const now = new Date();

    const rows = await db
      .insert(goals)
      .values({
        userId,
        title: input.title,
        description: input.description ?? null,
        status,
        category: input.category ?? 'Work',
        targetDate: input.targetDate ?? null,
        targetMetricLabel: input.targetMetricLabel ?? null,
        targetValue: input.targetValue ?? null,
        currentValue: input.currentValue ?? null,
        unit: input.unit ?? null,
        completedAt: status === 'completed' ? now : null,
        archivedAt: status === 'archived' ? now : null,
      })
      .returning();

    const hydrated = await hydrateGoals(userId, rows);
    return hydrated[0];
  } catch (error) {
    console.error('Failed to create goal:', error);
    throw new Error('Unable to create goal right now.', { cause: error });
  }
}

export async function updateUserGoal(
  userId: number,
  goalId: number,
  patch: UpdateGoalParams
): Promise<GoalWithDetails | null> {
  try {
    const existingRows = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return null;

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
      .update(goals)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: nextStatus } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {}),
        ...(patch.targetMetricLabel !== undefined
          ? { targetMetricLabel: patch.targetMetricLabel }
          : {}),
        ...(patch.targetValue !== undefined ? { targetValue: patch.targetValue } : {}),
        ...(patch.currentValue !== undefined ? { currentValue: patch.currentValue } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
        completedAt: nextCompletedAt,
        archivedAt: nextArchivedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();

    if (!updatedRows[0]) return null;
    const hydrated = await hydrateGoals(userId, updatedRows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Failed to update goal:', error);
    throw new Error('Unable to update goal right now.', { cause: error });
  }
}

export async function deleteUserGoal(
  userId: number,
  goalId: number
): Promise<GoalRecord | null> {
  try {
    const rows = await db
      .delete(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete goal:', error);
    throw new Error('Unable to delete goal right now.', { cause: error });
  }
}

export async function createUserGoalMilestone(
  userId: number,
  goalId: number,
  input: CreateGoalMilestoneParams
): Promise<GoalMilestoneRecord | null> {
  try {
    const parentRows = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!parentRows[0]) return null;

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const existing = await db
        .select({ sortOrder: goalMilestones.sortOrder })
        .from(goalMilestones)
        .where(and(eq(goalMilestones.goalId, goalId), eq(goalMilestones.userId, userId)))
        .orderBy(desc(goalMilestones.sortOrder))
        .limit(1);
      sortOrder = existing[0] ? existing[0].sortOrder + 1 : 0;
    }

    const completed = input.completed ?? false;
    const rows = await db
      .insert(goalMilestones)
      .values({
        goalId,
        userId,
        title: input.title,
        targetDate: input.targetDate ?? null,
        sortOrder,
        completed,
        completedAt: completed ? new Date() : null,
      })
      .returning();

    await db
      .update(goals)
      .set({ updatedAt: new Date() })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

    return rows[0];
  } catch (error) {
    console.error('Failed to create goal milestone:', error);
    throw new Error('Unable to create goal milestone right now.', { cause: error });
  }
}

export async function updateUserGoalMilestone(
  userId: number,
  goalId: number,
  milestoneId: number,
  patch: UpdateGoalMilestoneParams
): Promise<GoalMilestoneRecord | null> {
  try {
    const existingRows = await db
      .select()
      .from(goalMilestones)
      .where(
        and(
          eq(goalMilestones.id, milestoneId),
          eq(goalMilestones.goalId, goalId),
          eq(goalMilestones.userId, userId)
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
      .update(goalMilestones)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
        completedAt: nextCompletedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(goalMilestones.id, milestoneId),
          eq(goalMilestones.goalId, goalId),
          eq(goalMilestones.userId, userId)
        )
      )
      .returning();

    await db
      .update(goals)
      .set({ updatedAt: new Date() })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to update goal milestone:', error);
    throw new Error('Unable to update goal milestone right now.', { cause: error });
  }
}

export async function deleteUserGoalMilestone(
  userId: number,
  goalId: number,
  milestoneId: number
): Promise<GoalMilestoneRecord | null> {
  try {
    const rows = await db
      .delete(goalMilestones)
      .where(
        and(
          eq(goalMilestones.id, milestoneId),
          eq(goalMilestones.goalId, goalId),
          eq(goalMilestones.userId, userId)
        )
      )
      .returning();

    if (rows[0]) {
      await db
        .update(goals)
        .set({ updatedAt: new Date() })
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
    }

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete goal milestone:', error);
    throw new Error('Unable to delete goal milestone right now.', { cause: error });
  }
}

export async function reorderUserGoalMilestones(
  userId: number,
  goalId: number,
  milestoneIds: number[]
): Promise<GoalMilestoneRecord[] | null> {
  try {
    const parentRows = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!parentRows[0]) return null;

    const existing = await db
      .select()
      .from(goalMilestones)
      .where(and(eq(goalMilestones.goalId, goalId), eq(goalMilestones.userId, userId)));

    const existingIds = new Set(existing.map((m) => m.id));
    if (
      milestoneIds.length !== existing.length ||
      new Set(milestoneIds).size !== existing.length ||
      milestoneIds.some((id) => !existingIds.has(id))
    ) {
      throw new GoalValidationError('Milestone order must include every milestone in this goal');
    }

    await db.transaction(async (tx) => {
      for (let idx = 0; idx < milestoneIds.length; idx += 1) {
        await tx
          .update(goalMilestones)
          .set({ sortOrder: idx, updatedAt: new Date() })
          .where(
            and(
              eq(goalMilestones.id, milestoneIds[idx]),
              eq(goalMilestones.goalId, goalId),
              eq(goalMilestones.userId, userId)
            )
          );
      }
      await tx
        .update(goals)
        .set({ updatedAt: new Date() })
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
    });

    return await db
      .select()
      .from(goalMilestones)
      .where(and(eq(goalMilestones.goalId, goalId), eq(goalMilestones.userId, userId)))
      .orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.id));
  } catch (error) {
    if (error instanceof GoalValidationError) {
      throw error;
    }
    console.error('Failed to reorder goal milestones:', error);
    throw new Error('Unable to reorder goal milestones right now.', { cause: error });
  }
}
