import type {
  CreateRoutineInput,
  CreateRoutineStepInput,
  CreateWorkoutInput,
  Routine,
  RoutineLog,
  RoutineStatus,
  RoutineStep,
  UpdateRoutineInput,
  UpdateWorkoutInput,
  UpsertRoutineLogInput,
  WorkoutActivityType,
  WorkoutSession,
  WorkoutSummary,
} from '../types/fitnessRoutines';

export class FitnessRoutinesApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'FitnessRoutinesApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errObj =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message =
      errObj && typeof errObj.error === 'string'
        ? errObj.error
        : `Request failed with status ${response.status}`;
    const fieldErrors =
      errObj && typeof errObj.fieldErrors === 'object' && errObj.fieldErrors !== null
        ? (errObj.fieldErrors as Record<string, string[]>)
        : undefined;
    throw new FitnessRoutinesApiError(message, response.status, fieldErrors);
  }

  return data as T;
}

function authHeaders(token: string, json = false): HeadersInit {
  return json
    ? {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    : {
        Authorization: `Bearer ${token}`,
      };
}

export async function fetchWorkouts(
  token: string,
  params?: { from?: string; to?: string; activityType?: WorkoutActivityType }
): Promise<{
  workouts: WorkoutSession[];
  summary: WorkoutSummary;
  meta: { timezone: string; todayLocalDate: string };
}> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.activityType) query.set('activityType', params.activityType);

  const qs = query.toString();
  const response = await fetch(`/api/workouts${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
  });
  return handleApiResponse(response);
}

export async function createWorkoutRequest(
  token: string,
  input: CreateWorkoutInput
): Promise<WorkoutSession> {
  const response = await fetch('/api/workouts', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  const data = await handleApiResponse<{ workout: WorkoutSession }>(response);
  return data.workout;
}

export async function updateWorkoutRequest(
  token: string,
  workoutId: number,
  patch: UpdateWorkoutInput
): Promise<WorkoutSession> {
  const response = await fetch(`/api/workouts/${workoutId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  });
  const data = await handleApiResponse<{ workout: WorkoutSession }>(response);
  return data.workout;
}

export async function deleteWorkoutRequest(token: string, workoutId: number): Promise<void> {
  const response = await fetch(`/api/workouts/${workoutId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await handleApiResponse<{ deleted: boolean; id: number }>(response);
}

export async function fetchRoutines(
  token: string,
  params?: { status?: RoutineStatus | 'all'; date?: string }
): Promise<{
  routines: Routine[];
  meta: { timezone: string; todayLocalDate: string; targetLocalDate: string };
}> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.date) query.set('date', params.date);

  const qs = query.toString();
  const response = await fetch(`/api/routines${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
  });
  return handleApiResponse(response);
}

export async function createRoutineRequest(
  token: string,
  input: CreateRoutineInput
): Promise<Routine> {
  const response = await fetch('/api/routines', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  const data = await handleApiResponse<{ routine: Routine }>(response);
  return data.routine;
}

export async function updateRoutineRequest(
  token: string,
  routineId: number,
  patch: UpdateRoutineInput
): Promise<Routine> {
  const response = await fetch(`/api/routines/${routineId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  });
  const data = await handleApiResponse<{ routine: Routine }>(response);
  return data.routine;
}

export async function deleteRoutineRequest(token: string, routineId: number): Promise<void> {
  const response = await fetch(`/api/routines/${routineId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await handleApiResponse<{ deleted: boolean; id: number }>(response);
}

export async function addRoutineStepRequest(
  token: string,
  routineId: number,
  input: CreateRoutineStepInput
): Promise<{ step: RoutineStep; routine: Routine }> {
  const response = await fetch(`/api/routines/${routineId}/steps`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  return handleApiResponse(response);
}

export async function updateRoutineStepRequest(
  token: string,
  routineId: number,
  stepId: number,
  patch: { title?: string; durationMinutes?: number | null }
): Promise<{ step: RoutineStep; routine: Routine }> {
  const response = await fetch(`/api/routines/${routineId}/steps/${stepId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(patch),
  });
  return handleApiResponse(response);
}

export async function deleteRoutineStepRequest(
  token: string,
  routineId: number,
  stepId: number
): Promise<{ deleted: boolean; id: number; routine: Routine }> {
  const response = await fetch(`/api/routines/${routineId}/steps/${stepId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return handleApiResponse(response);
}

export async function reorderRoutineStepsRequest(
  token: string,
  routineId: number,
  stepIds: number[]
): Promise<Routine> {
  const response = await fetch(`/api/routines/${routineId}/steps/reorder`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify({ stepIds }),
  });
  const data = await handleApiResponse<{ routine: Routine }>(response);
  return data.routine;
}

export async function fetchRoutineLogs(
  token: string,
  routineId: number,
  params?: { from?: string; to?: string }
): Promise<{
  logs: RoutineLog[];
  range: { from: string; to: string; timezone: string };
}> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();

  const response = await fetch(`/api/routines/${routineId}/logs${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
  });
  return handleApiResponse(response);
}

export async function upsertRoutineLogRequest(
  token: string,
  routineId: number,
  input: UpsertRoutineLogInput
): Promise<{ log: RoutineLog; routine: Routine }> {
  const response = await fetch(`/api/routines/${routineId}/logs`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  return handleApiResponse(response);
}

export async function deleteRoutineLogRequest(
  token: string,
  routineId: number,
  localDate: string
): Promise<{ deleted: boolean; routineId: number; localDate: string; routine: Routine }> {
  const response = await fetch(`/api/routines/${routineId}/logs/${localDate}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return handleApiResponse(response);
}
