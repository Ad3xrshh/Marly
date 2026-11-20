import type { GoalProgressSummary, ProjectProgressSummary } from '../lib/progress';
import type { TaskCategory, TaskPriority } from './task';

export type GoalStatus = 'planned' | 'active' | 'completed' | 'paused' | 'archived';
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';

export const GOAL_STATUS_OPTIONS: Array<{ value: GoalStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const PROJECT_STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export function getGoalStatusLabel(status: GoalStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned';
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
  }
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned';
    case 'active':
      return 'Active';
    case 'on_hold':
      return 'On Hold';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
  }
}

export interface GoalMilestone {
  id: number;
  goalId: number;
  title: string;
  targetDate: string | null;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalLinkedProjectSummary {
  id: number;
  name: string;
  status: ProjectStatus;
  priority: TaskPriority;
  targetDate: string | null;
  progressPercent: number;
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  status: GoalStatus;
  category: TaskCategory;
  targetDate: string | null;
  targetMetricLabel: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  milestones: GoalMilestone[];
  linkedProjects: GoalLinkedProjectSummary[];
  progress: GoalProgressSummary;
}

export interface CreateGoalInput {
  title: string;
  description?: string | null;
  status?: GoalStatus;
  category?: TaskCategory;
  targetDate?: string | null;
  targetMetricLabel?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  category?: TaskCategory;
  targetDate?: string | null;
  targetMetricLabel?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
}

export interface CreateGoalMilestoneInput {
  title: string;
  targetDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface UpdateGoalMilestoneInput {
  title?: string;
  targetDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface ProjectMilestone {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  category: TaskCategory;
  goalId: number | null;
  goalTitle: string | null;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  milestones: ProjectMilestone[];
  progress: ProjectProgressSummary;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  goalId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  goalId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface CreateProjectMilestoneInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}

export interface UpdateProjectMilestoneInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  completed?: boolean;
}
