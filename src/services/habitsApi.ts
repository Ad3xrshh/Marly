import type {
  CreateHabitInput,
  Habit,
  HabitLog,
  HabitScheduleInput,
  HabitsMeta,
  HabitStatus,
  UpdateHabitInput,
  UpsertHabitLogInput,
  UserProfile,
} from '../types/habit';

export class HabitsApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'HabitsApiError';
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
    throw new HabitsApiError(message, response.status, details);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HabitsApiError(
      'Received an unexpected or empty response from the server.',
      response.status || 502
    );
  }

  return payload as T;
}

export async function fetchMe(token: string): Promise<UserProfile> {
  const data = await requestJson<{ user: UserProfile }>('/api/me', token, {
    method: 'GET',
  });
  return data.user;
}

export async function updateMeTimeZone(
  token: string,
  timezone: string
): Promise<UserProfile> {
  const data = await requestJson<{ user: UserProfile }>('/api/me', token, {
    method: 'PATCH',
    body: JSON.stringify({ timezone }),
  });
  return data.user;
}

export async function fetchHabits(
  token: string,
  options?: { status?: HabitStatus | 'all'; date?: string }
): Promise<{ habits: Habit[]; meta: HabitsMeta }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.date) params.set('date', options.date);
  const query = params.toString();
  const url = query ? `/api/habits?${query}` : '/api/habits';
  return requestJson<{ habits: Habit[]; meta: HabitsMeta }>(url, token, {
    method: 'GET',
  });
}

export async function createHabitRequest(
  token: string,
  input: CreateHabitInput
): Promise<Habit> {
  const data = await requestJson<{ habit: Habit }>('/api/habits', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.habit;
}

export async function updateHabitRequest(
  token: string,
  habitId: number,
  patch: UpdateHabitInput
): Promise<Habit> {
  const data = await requestJson<{ habit: Habit }>(`/api/habits/${habitId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.habit;
}

export async function updateHabitScheduleRequest(
  token: string,
  habitId: number,
  schedule: HabitScheduleInput
): Promise<Habit> {
  const data = await requestJson<{ habit: Habit }>(
    `/api/habits/${habitId}/schedule`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(schedule),
    }
  );
  return data.habit;
}

export async function deleteHabitRequest(
  token: string,
  habitId: number
): Promise<{ deleted: boolean; id: number }> {
  return requestJson<{ deleted: boolean; id: number }>(`/api/habits/${habitId}`, token, {
    method: 'DELETE',
  });
}

export async function fetchHabitLogs(
  token: string,
  habitId: number,
  range?: { from?: string; to?: string }
): Promise<{ logs: HabitLog[]; range: { from: string; to: string; timezone: string } }> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  const url = query ? `/api/habits/${habitId}/logs?${query}` : `/api/habits/${habitId}/logs`;
  return requestJson<{
    logs: HabitLog[];
    range: { from: string; to: string; timezone: string };
  }>(url, token, { method: 'GET' });
}

export async function fetchAllHabitLogs(
  token: string,
  range?: { from?: string; to?: string }
): Promise<{ logs: HabitLog[]; range: { from: string; to: string; timezone: string } }> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  const url = query ? `/api/habit-logs?${query}` : '/api/habit-logs';
  return requestJson<{
    logs: HabitLog[];
    range: { from: string; to: string; timezone: string };
  }>(url, token, { method: 'GET' });
}

export async function upsertHabitLogRequest(
  token: string,
  habitId: number,
  input: UpsertHabitLogInput
): Promise<{ log: HabitLog; habit: Habit }> {
  return requestJson<{ log: HabitLog; habit: Habit }>(`/api/habits/${habitId}/logs`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteHabitLogRequest(
  token: string,
  habitId: number,
  localDate: string
): Promise<{ deleted: boolean; habitId: number; localDate: string; habit: Habit }> {
  return requestJson<{
    deleted: boolean;
    habitId: number;
    localDate: string;
    habit: Habit;
  }>(`/api/habits/${habitId}/logs/${localDate}`, token, {
    method: 'DELETE',
  });
}
