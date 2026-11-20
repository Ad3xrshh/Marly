export interface ProgressMilestoneInput {
  completed: boolean;
}

export interface ProgressTaskInput {
  id: number;
  status: string;
  projectId: number | null;
  goalId: number | null;
}

export interface ProjectProgressSummary {
  progressPercent: number;
  totalMilestones: number;
  completedMilestones: number;
  totalTasks: number;
  completedTasks: number;
  totalUnits: number;
  completedUnits: number;
}

export interface GoalProgressProjectInput {
  id: number;
  status: string;
  progress: ProjectProgressSummary;
}

export type GoalProgressMode = 'milestones' | 'measurable' | 'linked_work' | 'status';

export interface GoalProgressSummary {
  progressPercent: number;
  mode: GoalProgressMode;
  totalMilestones: number;
  completedMilestones: number;
  linkedProjectsCount: number;
  completedProjectsCount: number;
  linkedTasksCount: number;
  standaloneTasksCount: number;
  measurablePercent: number | null;
}

/**
 * Computes deterministic project progress without double-counting:
 * Each project milestone and each directly linked task counts as one distinct unit.
 * When a project has neither milestones nor tasks, completion falls back to status.
 */
export function computeProjectProgress(params: {
  status: string;
  milestones: ProgressMilestoneInput[];
  tasks: Array<{ status: string }>;
}): ProjectProgressSummary {
  const totalMilestones = params.milestones.length;
  const completedMilestones = params.milestones.filter((m) => m.completed).length;
  const totalTasks = params.tasks.length;
  const completedTasks = params.tasks.filter((t) => t.status === 'completed').length;

  const totalUnits = totalMilestones + totalTasks;
  const completedUnits = completedMilestones + completedTasks;

  const progressPercent =
    totalUnits > 0
      ? Math.round((completedUnits / totalUnits) * 100)
      : params.status === 'completed'
        ? 100
        : 0;

  return {
    progressPercent,
    totalMilestones,
    completedMilestones,
    totalTasks,
    completedTasks,
    totalUnits,
    completedUnits,
  };
}

/**
 * Computes deterministic goal progress without double-counting:
 * 1. Primary: If the goal defines ordered milestones, use milestone completion ratio.
 * 2. Measurable Target: Else if targetValue > 0, use clamped currentValue / targetValue.
 * 3. Linked Work: Else aggregate unique units from linked projects plus standalone goal tasks
 *    (tasks that have both projectId inside linkedProjects and goalId are NOT counted twice).
 * 4. Fallback: Goal status ('completed' => 100%, otherwise 0%).
 */
export function computeGoalProgress(params: {
  goalId: number;
  status: string;
  targetValue: number | null;
  currentValue: number | null;
  milestones: ProgressMilestoneInput[];
  linkedProjects: GoalProgressProjectInput[];
  goalTasks: ProgressTaskInput[];
}): GoalProgressSummary {
  const totalMilestones = params.milestones.length;
  const completedMilestones = params.milestones.filter((m) => m.completed).length;

  const measurablePercent =
    params.targetValue !== null && params.targetValue > 0
      ? Math.min(100, Math.max(0, Math.round(((params.currentValue ?? 0) / params.targetValue) * 100)))
      : null;

  const linkedProjectIds = new Set(params.linkedProjects.map((p) => p.id));
  const standaloneTasks = params.goalTasks.filter(
    (t) => t.goalId === params.goalId && (!t.projectId || !linkedProjectIds.has(t.projectId))
  );
  const completedProjectsCount = params.linkedProjects.filter((p) => p.status === 'completed').length;

  if (totalMilestones > 0) {
    return {
      progressPercent: Math.round((completedMilestones / totalMilestones) * 100),
      mode: 'milestones',
      totalMilestones,
      completedMilestones,
      linkedProjectsCount: params.linkedProjects.length,
      completedProjectsCount,
      linkedTasksCount: params.goalTasks.length,
      standaloneTasksCount: standaloneTasks.length,
      measurablePercent,
    };
  }

  if (measurablePercent !== null) {
    return {
      progressPercent: measurablePercent,
      mode: 'measurable',
      totalMilestones: 0,
      completedMilestones: 0,
      linkedProjectsCount: params.linkedProjects.length,
      completedProjectsCount,
      linkedTasksCount: params.goalTasks.length,
      standaloneTasksCount: standaloneTasks.length,
      measurablePercent,
    };
  }

  if (params.linkedProjects.length > 0 || standaloneTasks.length > 0) {
    let totalUnits = 0;
    let completedUnits = 0;

    for (const project of params.linkedProjects) {
      if (project.progress.totalUnits > 0) {
        totalUnits += project.progress.totalUnits;
        completedUnits += project.progress.completedUnits;
      } else {
        totalUnits += 1;
        completedUnits += project.status === 'completed' ? 1 : 0;
      }
    }

    for (const task of standaloneTasks) {
      totalUnits += 1;
      if (task.status === 'completed') {
        completedUnits += 1;
      }
    }

    const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return {
      progressPercent,
      mode: 'linked_work',
      totalMilestones: 0,
      completedMilestones: 0,
      linkedProjectsCount: params.linkedProjects.length,
      completedProjectsCount,
      linkedTasksCount: params.goalTasks.length,
      standaloneTasksCount: standaloneTasks.length,
      measurablePercent: null,
    };
  }

  return {
    progressPercent: params.status === 'completed' ? 100 : 0,
    mode: 'status',
    totalMilestones: 0,
    completedMilestones: 0,
    linkedProjectsCount: 0,
    completedProjectsCount: 0,
    linkedTasksCount: 0,
    standaloneTasksCount: 0,
    measurablePercent: null,
  };
}
