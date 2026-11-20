import type { CreateTaskInput, Task, TaskFilters, UpdateTaskInput } from '../types/task';

export class TaskApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'TaskApiError';
    this.status = status;
    this.details = details;
  }
}

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const details =
      payload && Array.isArray(payload.details) ? payload.details : undefined;
    throw new TaskApiError(message, response.status, details);
  }

  return payload as T;
}

export async function fetchTasks(token: string, filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.projectId !== undefined) params.set('projectId', String(filters.projectId));
  if (filters?.goalId !== undefined) params.set('goalId', String(filters.goalId));

  const query = params.toString();
  const url = query ? `/api/tasks?${query}` : '/api/tasks';
  const data = await requestJson<{ tasks: Task[] }>(url, token, { method: 'GET' });
  return data.tasks;
}

export async function createTaskRequest(token: string, input: CreateTaskInput): Promise<Task> {
  const data = await requestJson<{ task: Task }>('/api/tasks', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.task;
}

export async function updateTaskRequest(
  token: string,
  taskId: number,
  patch: UpdateTaskInput
): Promise<Task> {
  const data = await requestJson<{ task: Task }>(`/api/tasks/${taskId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.task;
}

export async function deleteTaskRequest(token: string, taskId: number): Promise<{ id: number }> {
  return requestJson<{ deleted: boolean; id: number }>(`/api/tasks/${taskId}`, token, {
    method: 'DELETE',
  });
}
