import type {
  CreateGoalInput,
  CreateGoalMilestoneInput,
  CreateProjectInput,
  CreateProjectMilestoneInput,
  Goal,
  GoalMilestone,
  Project,
  ProjectMilestone,
  UpdateGoalInput,
  UpdateGoalMilestoneInput,
  UpdateProjectInput,
  UpdateProjectMilestoneInput,
} from '../types/projectGoal';

export class ProjectsGoalsApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ProjectsGoalsApiError';
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
    throw new ProjectsGoalsApiError(message, response.status, details);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ProjectsGoalsApiError(
      'Received an unexpected or empty response from the server.',
      response.status || 502
    );
  }

  return payload as T;
}

// Goals API
export async function fetchGoals(token: string): Promise<Goal[]> {
  const data = await requestJson<{ goals: Goal[] }>('/api/goals', token, { method: 'GET' });
  return data.goals;
}

export async function createGoalRequest(token: string, input: CreateGoalInput): Promise<Goal> {
  const data = await requestJson<{ goal: Goal }>('/api/goals', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.goal;
}

export async function updateGoalRequest(
  token: string,
  goalId: number,
  patch: UpdateGoalInput
): Promise<Goal> {
  const data = await requestJson<{ goal: Goal }>(`/api/goals/${goalId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.goal;
}

export async function deleteGoalRequest(token: string, goalId: number): Promise<{ id: number }> {
  return requestJson<{ deleted: boolean; id: number }>(`/api/goals/${goalId}`, token, {
    method: 'DELETE',
  });
}

export async function createGoalMilestoneRequest(
  token: string,
  goalId: number,
  input: CreateGoalMilestoneInput
): Promise<{ milestone: GoalMilestone; goal: Goal | null }> {
  return requestJson<{ milestone: GoalMilestone; goal: Goal | null }>(
    `/api/goals/${goalId}/milestones`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function updateGoalMilestoneRequest(
  token: string,
  goalId: number,
  milestoneId: number,
  patch: UpdateGoalMilestoneInput
): Promise<{ milestone: GoalMilestone; goal: Goal | null }> {
  return requestJson<{ milestone: GoalMilestone; goal: Goal | null }>(
    `/api/goals/${goalId}/milestones/${milestoneId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

export async function deleteGoalMilestoneRequest(
  token: string,
  goalId: number,
  milestoneId: number
): Promise<{ deleted: boolean; id: number; goal: Goal | null }> {
  return requestJson<{ deleted: boolean; id: number; goal: Goal | null }>(
    `/api/goals/${goalId}/milestones/${milestoneId}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

export async function reorderGoalMilestonesRequest(
  token: string,
  goalId: number,
  milestoneIds: number[]
): Promise<{ milestones: GoalMilestone[]; goal: Goal | null }> {
  return requestJson<{ milestones: GoalMilestone[]; goal: Goal | null }>(
    `/api/goals/${goalId}/milestones/reorder`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ milestoneIds }),
    }
  );
}

// Projects API
export async function fetchProjects(token: string): Promise<Project[]> {
  const data = await requestJson<{ projects: Project[] }>('/api/projects', token, {
    method: 'GET',
  });
  return data.projects;
}

export async function createProjectRequest(
  token: string,
  input: CreateProjectInput
): Promise<Project> {
  const data = await requestJson<{ project: Project }>('/api/projects', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function updateProjectRequest(
  token: string,
  projectId: number,
  patch: UpdateProjectInput
): Promise<Project> {
  const data = await requestJson<{ project: Project }>(`/api/projects/${projectId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.project;
}

export async function deleteProjectRequest(
  token: string,
  projectId: number
): Promise<{ id: number }> {
  return requestJson<{ deleted: boolean; id: number }>(`/api/projects/${projectId}`, token, {
    method: 'DELETE',
  });
}

export async function createProjectMilestoneRequest(
  token: string,
  projectId: number,
  input: CreateProjectMilestoneInput
): Promise<{ milestone: ProjectMilestone; project: Project | null }> {
  return requestJson<{ milestone: ProjectMilestone; project: Project | null }>(
    `/api/projects/${projectId}/milestones`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function updateProjectMilestoneRequest(
  token: string,
  projectId: number,
  milestoneId: number,
  patch: UpdateProjectMilestoneInput
): Promise<{ milestone: ProjectMilestone; project: Project | null }> {
  return requestJson<{ milestone: ProjectMilestone; project: Project | null }>(
    `/api/projects/${projectId}/milestones/${milestoneId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

export async function deleteProjectMilestoneRequest(
  token: string,
  projectId: number,
  milestoneId: number
): Promise<{ deleted: boolean; id: number; project: Project | null }> {
  return requestJson<{ deleted: boolean; id: number; project: Project | null }>(
    `/api/projects/${projectId}/milestones/${milestoneId}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

export async function reorderProjectMilestonesRequest(
  token: string,
  projectId: number,
  milestoneIds: number[]
): Promise<{ milestones: ProjectMilestone[]; project: Project | null }> {
  return requestJson<{ milestones: ProjectMilestone[]; project: Project | null }>(
    `/api/projects/${projectId}/milestones/reorder`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ milestoneIds }),
    }
  );
}
