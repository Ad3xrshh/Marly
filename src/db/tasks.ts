import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  goals,
  projects,
  tasks,
  type TaskCategoryValue,
  type TaskPriorityValue,
  type TaskRecord,
  type TaskStatusValue,
} from './schema.ts';

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

export interface CreateTaskParams {
  title: string;
  description?: string | null;
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  category?: TaskCategoryValue;
  dueDate?: string | null;
  projectId?: number | null;
  goalId?: number | null;
}

export interface UpdateTaskParams {
  title?: string;
  description?: string | null;
  status?: TaskStatusValue;
  priority?: TaskPriorityValue;
  category?: TaskCategoryValue;
  dueDate?: string | null;
  projectId?: number | null;
  goalId?: number | null;
}

export interface TaskFilterParams {
  status?: TaskStatusValue;
  category?: TaskCategoryValue;
  priority?: TaskPriorityValue;
  projectId?: number;
  goalId?: number;
}

async function assertTaskAssociationsOwnership(
  userId: number,
  projectId: number | null | undefined,
  goalId: number | null | undefined
) {
  if (projectId !== undefined && projectId !== null) {
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!projectRows[0]) {
      throw new TaskValidationError('Selected project was not found for your account');
    }
  }

  if (goalId !== undefined && goalId !== null) {
    const goalRows = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goalRows[0]) {
      throw new TaskValidationError('Selected goal was not found for your account');
    }
  }
}

export async function listUserTasks(
  userId: number,
  filters?: TaskFilterParams
): Promise<TaskRecord[]> {
  try {
    const conditions = [eq(tasks.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(tasks.category, filters.category));
    }
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    if (filters?.projectId !== undefined) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }
    if (filters?.goalId !== undefined) {
      conditions.push(eq(tasks.goalId, filters.goalId));
    }

    return await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
  } catch (error) {
    console.error('Failed to list tasks:', error);
    throw new Error('Unable to load tasks right now.', { cause: error });
  }
}

export async function getUserTaskById(
  userId: number,
  taskId: number
): Promise<TaskRecord | null> {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to fetch task:', error);
    throw new Error('Unable to load the requested task.', { cause: error });
  }
}

export async function createUserTask(
  userId: number,
  input: CreateTaskParams
): Promise<TaskRecord> {
  try {
    await assertTaskAssociationsOwnership(userId, input.projectId, input.goalId);

    const status: TaskStatusValue = input.status ?? 'todo';
    const completedAt = status === 'completed' ? new Date() : null;

    const rows = await db
      .insert(tasks)
      .values({
        userId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? 'medium',
        category: input.category ?? 'Work',
        dueDate: input.dueDate ?? null,
        projectId: input.projectId ?? null,
        goalId: input.goalId ?? null,
        completedAt,
      })
      .returning();

    return rows[0];
  } catch (error) {
    if (error instanceof TaskValidationError) {
      throw error;
    }
    console.error('Failed to create task:', error);
    throw new Error('Unable to create task right now.', { cause: error });
  }
}

export async function updateUserTask(
  userId: number,
  taskId: number,
  patch: UpdateTaskParams
): Promise<TaskRecord | null> {
  try {
    const existing = await getUserTaskById(userId, taskId);
    if (!existing) {
      return null;
    }

    await assertTaskAssociationsOwnership(userId, patch.projectId, patch.goalId);

    const nextStatus = patch.status ?? existing.status;
    let nextCompletedAt = existing.completedAt;
    if (patch.status !== undefined) {
      if (patch.status === 'completed' && existing.status !== 'completed') {
        nextCompletedAt = new Date();
      } else if (patch.status !== 'completed') {
        nextCompletedAt = null;
      }
    }

    const rows = await db
      .update(tasks)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: nextStatus } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
        ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
        ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
        completedAt: nextCompletedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof TaskValidationError) {
      throw error;
    }
    console.error('Failed to update task:', error);
    throw new Error('Unable to update task right now.', { cause: error });
  }
}

export async function deleteUserTask(
  userId: number,
  taskId: number
): Promise<TaskRecord | null> {
  try {
    const rows = await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw new Error('Unable to delete task right now.', { cause: error });
  }
}
