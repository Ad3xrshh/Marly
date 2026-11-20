import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createTaskRequest,
  deleteTaskRequest,
  fetchTasks,
  TaskApiError,
  updateTaskRequest,
} from '../services/taskApi';
import type { CreateTaskInput, Task, UpdateTaskInput } from '../types/task';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface TaskDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  task: Task | null;
  defaultDueDate: string | null;
  defaultProjectId: number | null;
  defaultGoalId: number | null;
}

interface TasksContextValue {
  tasks: Task[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  dialogState: TaskDialogState;
  refreshTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task | null>;
  updateTask: (taskId: number, patch: UpdateTaskInput) => Promise<Task | null>;
  toggleTaskCompleted: (task: Task) => Promise<void>;
  deleteTask: (taskId: number) => Promise<boolean>;
  openCreateTask: (options?: {
    defaultDueDate?: string | null;
    defaultProjectId?: number | null;
    defaultGoalId?: number | null;
  }) => void;
  openEditTask: (task: Task) => void;
  closeTaskDialog: () => void;
}

const INITIAL_DIALOG_STATE: TaskDialogState = {
  open: false,
  mode: 'create',
  task: null,
  defaultDueDate: null,
  defaultProjectId: null,
  defaultGoalId: null,
};

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading, getAccessToken } = useAuth();
  const { pushToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<TaskDialogState>(INITIAL_DIALOG_STATE);

  const refreshTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setTasks([]);
        return;
      }
      const nextTasks = await fetchTasks(token);
      setTasks(nextTasks);
    } catch (err) {
      const message =
        err instanceof TaskApiError
          ? err.message
          : 'Unable to load your tasks right now. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      setDialogState(INITIAL_DIALOG_STATE);
      return;
    }
    void refreshTasks();
  }, [user, isAuthLoading, refreshTasks]);

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      const token = await getAccessToken();
      if (!token) {
        pushToast({
          title: 'Sign in required',
          description: 'Sign in with Google to save tasks to your workspace.',
          variant: 'info',
        });
        return null;
      }

      setIsMutating(true);
      try {
        const created = await createTaskRequest(token, input);
        setTasks((prev) => [created, ...prev]);
        pushToast({
          title: 'Task created',
          description: created.title,
          variant: 'success',
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create task.';
        pushToast({
          title: 'Could not create task',
          description: message,
          variant: 'info',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const updateTask = useCallback(
    async (taskId: number, patch: UpdateTaskInput): Promise<Task | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateTaskRequest(token, taskId, patch);
        setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)));
        pushToast({
          title: 'Task updated',
          description: updated.title,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update task.';
        pushToast({
          title: 'Could not update task',
          description: message,
          variant: 'info',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const toggleTaskCompleted = useCallback(
    async (task: Task): Promise<void> => {
      const token = await getAccessToken();
      if (!token) return;

      const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
      const optimisticCompletedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

      // Optimistic update with immediate rollback on API error
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? { ...item, status: nextStatus, completedAt: optimisticCompletedAt }
            : item
        )
      );

      try {
        const updated = await updateTaskRequest(token, task.id, { status: nextStatus });
        setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
        pushToast({
          title: nextStatus === 'completed' ? 'Task completed' : 'Task reopened',
          description: updated.title,
          variant: 'success',
        });
      } catch (err) {
        setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
        const message = err instanceof Error ? err.message : 'Unable to update task status.';
        pushToast({
          title: 'Status update failed',
          description: message,
          variant: 'info',
        });
      }
    },
    [getAccessToken, pushToast]
  );

  const deleteTask = useCallback(
    async (taskId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;

      const target = tasks.find((t) => t.id === taskId);
      setIsMutating(true);
      try {
        await deleteTaskRequest(token, taskId);
        setTasks((prev) => prev.filter((item) => item.id !== taskId));
        pushToast({
          title: 'Task deleted',
          description: target ? target.title : 'Removed from your task list.',
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete task.';
        pushToast({
          title: 'Could not delete task',
          description: message,
          variant: 'info',
        });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, tasks, pushToast]
  );

  const openCreateTask = useCallback(
    (options?: {
      defaultDueDate?: string | null;
      defaultProjectId?: number | null;
      defaultGoalId?: number | null;
    }) => {
      setDialogState({
        open: true,
        mode: 'create',
        task: null,
        defaultDueDate: options?.defaultDueDate ?? null,
        defaultProjectId: options?.defaultProjectId ?? null,
        defaultGoalId: options?.defaultGoalId ?? null,
      });
    },
    []
  );

  const openEditTask = useCallback((task: Task) => {
    setDialogState({
      open: true,
      mode: 'edit',
      task,
      defaultDueDate: task.dueDate,
      defaultProjectId: task.projectId,
      defaultGoalId: task.goalId,
    });
  }, []);

  const closeTaskDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <TasksContext.Provider
      value={{
        tasks,
        isLoading,
        isMutating,
        error,
        dialogState,
        refreshTasks,
        createTask,
        updateTask,
        toggleTaskCompleted,
        deleteTask,
        openCreateTask,
        openEditTask,
        closeTaskDialog,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasksContext() {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error('useTasksContext must be used within TasksProvider');
  }
  return ctx;
}
