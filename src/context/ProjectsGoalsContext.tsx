import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createGoalMilestoneRequest,
  createGoalRequest,
  createProjectMilestoneRequest,
  createProjectRequest,
  deleteGoalMilestoneRequest,
  deleteGoalRequest,
  deleteProjectMilestoneRequest,
  deleteProjectRequest,
  fetchGoals,
  fetchProjects,
  ProjectsGoalsApiError,
  reorderGoalMilestonesRequest,
  reorderProjectMilestonesRequest,
  updateGoalMilestoneRequest,
  updateGoalRequest,
  updateProjectMilestoneRequest,
  updateProjectRequest,
} from '../services/projectsGoalsApi';
import type {
  CreateGoalInput,
  CreateGoalMilestoneInput,
  CreateProjectInput,
  CreateProjectMilestoneInput,
  Goal,
  Project,
  UpdateGoalInput,
  UpdateGoalMilestoneInput,
  UpdateProjectInput,
  UpdateProjectMilestoneInput,
} from '../types/projectGoal';
import { useAuth } from './AuthContext';
import { useTasksContext } from './TasksContext';
import { useToast } from './ToastContext';

export interface ProjectDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  project: Project | null;
  defaultGoalId: number | null;
}

export interface GoalDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  goal: Goal | null;
}

interface ProjectsGoalsContextValue {
  projects: Project[];
  goals: Goal[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  projectDialogState: ProjectDialogState;
  goalDialogState: GoalDialogState;
  refreshProjectsAndGoals: () => Promise<void>;
  createGoal: (input: CreateGoalInput) => Promise<Goal | null>;
  updateGoal: (goalId: number, patch: UpdateGoalInput) => Promise<Goal | null>;
  deleteGoal: (goalId: number) => Promise<boolean>;
  createGoalMilestone: (goalId: number, input: CreateGoalMilestoneInput) => Promise<boolean>;
  updateGoalMilestone: (
    goalId: number,
    milestoneId: number,
    patch: UpdateGoalMilestoneInput
  ) => Promise<boolean>;
  deleteGoalMilestone: (goalId: number, milestoneId: number) => Promise<boolean>;
  reorderGoalMilestones: (goalId: number, milestoneIds: number[]) => Promise<boolean>;
  createProject: (input: CreateProjectInput) => Promise<Project | null>;
  updateProject: (projectId: number, patch: UpdateProjectInput) => Promise<Project | null>;
  deleteProject: (projectId: number) => Promise<boolean>;
  createProjectMilestone: (
    projectId: number,
    input: CreateProjectMilestoneInput
  ) => Promise<boolean>;
  updateProjectMilestone: (
    projectId: number,
    milestoneId: number,
    patch: UpdateProjectMilestoneInput
  ) => Promise<boolean>;
  deleteProjectMilestone: (projectId: number, milestoneId: number) => Promise<boolean>;
  reorderProjectMilestones: (projectId: number, milestoneIds: number[]) => Promise<boolean>;
  openCreateProject: (options?: { defaultGoalId?: number | null }) => void;
  openEditProject: (project: Project) => void;
  closeProjectDialog: () => void;
  openCreateGoal: () => void;
  openEditGoal: (goal: Goal) => void;
  closeGoalDialog: () => void;
}

const INITIAL_PROJECT_DIALOG: ProjectDialogState = {
  open: false,
  mode: 'create',
  project: null,
  defaultGoalId: null,
};

const INITIAL_GOAL_DIALOG: GoalDialogState = {
  open: false,
  mode: 'create',
  goal: null,
};

const ProjectsGoalsContext = createContext<ProjectsGoalsContextValue | null>(null);

export function ProjectsGoalsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading, getAccessToken } = useAuth();
  const { refreshTasks } = useTasksContext();
  const { pushToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectDialogState, setProjectDialogState] =
    useState<ProjectDialogState>(INITIAL_PROJECT_DIALOG);
  const [goalDialogState, setGoalDialogState] = useState<GoalDialogState>(INITIAL_GOAL_DIALOG);

  const refreshProjectsAndGoals = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setGoals([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setProjects([]);
        setGoals([]);
        return;
      }
      const [nextProjects, nextGoals] = await Promise.all([
        fetchProjects(token),
        fetchGoals(token),
      ]);
      setProjects(nextProjects);
      setGoals(nextGoals);
    } catch (err) {
      const message =
        err instanceof ProjectsGoalsApiError
          ? err.message
          : 'Unable to load your projects and goals right now. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setProjects([]);
      setGoals([]);
      setError(null);
      setIsLoading(false);
      setProjectDialogState(INITIAL_PROJECT_DIALOG);
      setGoalDialogState(INITIAL_GOAL_DIALOG);
      return;
    }
    void refreshProjectsAndGoals();
  }, [user, isAuthLoading, refreshProjectsAndGoals]);

  const syncGoalsSilently = useCallback(async (token: string) => {
    try {
      const nextGoals = await fetchGoals(token);
      setGoals(nextGoals);
    } catch {
      // Non-blocking secondary refresh
    }
  }, []);

  const syncProjectsSilently = useCallback(async (token: string) => {
    try {
      const nextProjects = await fetchProjects(token);
      setProjects(nextProjects);
    } catch {
      // Non-blocking secondary refresh
    }
  }, []);

  const createGoal = useCallback(
    async (input: CreateGoalInput): Promise<Goal | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      setIsMutating(true);
      try {
        const created = await createGoalRequest(token, input);
        setGoals((prev) => [created, ...prev]);
        pushToast({ title: 'Goal created', description: created.title, variant: 'success' });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create goal.';
        pushToast({ title: 'Could not create goal', description: message, variant: 'info' });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const updateGoal = useCallback(
    async (goalId: number, patch: UpdateGoalInput): Promise<Goal | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      setIsMutating(true);
      try {
        const updated = await updateGoalRequest(token, goalId, patch);
        setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
        void syncProjectsSilently(token);
        pushToast({ title: 'Goal updated', description: updated.title, variant: 'success' });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update goal.';
        pushToast({ title: 'Could not update goal', description: message, variant: 'info' });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncProjectsSilently]
  );

  const deleteGoal = useCallback(
    async (goalId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      const target = goals.find((g) => g.id === goalId);
      setIsMutating(true);
      try {
        await deleteGoalRequest(token, goalId);
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        setProjects((prev) =>
          prev.map((p) => (p.goalId === goalId ? { ...p, goalId: null, goalTitle: null } : p))
        );
        void refreshTasks();
        pushToast({
          title: 'Goal deleted',
          description: target ? `${target.title} removed; linked projects & tasks were preserved.` : undefined,
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete goal.';
        pushToast({ title: 'Could not delete goal', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, goals, pushToast, refreshTasks]
  );

  const createGoalMilestone = useCallback(
    async (goalId: number, input: CreateGoalMilestoneInput): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await createGoalMilestoneRequest(token, goalId, input);
        if (res.goal) {
          setGoals((prev) => prev.map((g) => (g.id === goalId ? res.goal! : g)));
        }
        pushToast({ title: 'Milestone added', description: res.milestone.title, variant: 'success' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to add milestone.';
        pushToast({ title: 'Could not add milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const updateGoalMilestone = useCallback(
    async (
      goalId: number,
      milestoneId: number,
      patch: UpdateGoalMilestoneInput
    ): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await updateGoalMilestoneRequest(token, goalId, milestoneId, patch);
        if (res.goal) {
          setGoals((prev) => prev.map((g) => (g.id === goalId ? res.goal! : g)));
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update milestone.';
        pushToast({ title: 'Could not update milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const deleteGoalMilestone = useCallback(
    async (goalId: number, milestoneId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await deleteGoalMilestoneRequest(token, goalId, milestoneId);
        if (res.goal) {
          setGoals((prev) => prev.map((g) => (g.id === goalId ? res.goal! : g)));
        }
        pushToast({ title: 'Milestone removed', variant: 'info' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete milestone.';
        pushToast({ title: 'Could not remove milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const reorderGoalMilestones = useCallback(
    async (goalId: number, milestoneIds: number[]): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await reorderGoalMilestonesRequest(token, goalId, milestoneIds);
        if (res.goal) {
          setGoals((prev) => prev.map((g) => (g.id === goalId ? res.goal! : g)));
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to reorder milestones.';
        pushToast({ title: 'Could not reorder milestones', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      setIsMutating(true);
      try {
        const created = await createProjectRequest(token, input);
        setProjects((prev) => [created, ...prev]);
        if (created.goalId) {
          void syncGoalsSilently(token);
        }
        pushToast({ title: 'Project created', description: created.name, variant: 'success' });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create project.';
        pushToast({ title: 'Could not create project', description: message, variant: 'info' });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncGoalsSilently]
  );

  const updateProject = useCallback(
    async (projectId: number, patch: UpdateProjectInput): Promise<Project | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      setIsMutating(true);
      try {
        const updated = await updateProjectRequest(token, projectId, patch);
        setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
        void syncGoalsSilently(token);
        pushToast({
          title: updated.status === 'archived' ? 'Project archived' : 'Project updated',
          description: updated.name,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update project.';
        pushToast({ title: 'Could not update project', description: message, variant: 'info' });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncGoalsSilently]
  );

  const deleteProject = useCallback(
    async (projectId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      const target = projects.find((p) => p.id === projectId);
      setIsMutating(true);
      try {
        await deleteProjectRequest(token, projectId);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        void syncGoalsSilently(token);
        void refreshTasks();
        pushToast({
          title: 'Project deleted',
          description: target ? `${target.name} removed; linked tasks were preserved.` : undefined,
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete project.';
        pushToast({ title: 'Could not delete project', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, projects, pushToast, refreshTasks, syncGoalsSilently]
  );

  const createProjectMilestone = useCallback(
    async (projectId: number, input: CreateProjectMilestoneInput): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await createProjectMilestoneRequest(token, projectId, input);
        if (res.project) {
          setProjects((prev) => prev.map((p) => (p.id === projectId ? res.project! : p)));
        }
        void syncGoalsSilently(token);
        pushToast({ title: 'Milestone added', description: res.milestone.title, variant: 'success' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to add milestone.';
        pushToast({ title: 'Could not add milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncGoalsSilently]
  );

  const updateProjectMilestone = useCallback(
    async (
      projectId: number,
      milestoneId: number,
      patch: UpdateProjectMilestoneInput
    ): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await updateProjectMilestoneRequest(token, projectId, milestoneId, patch);
        if (res.project) {
          setProjects((prev) => prev.map((p) => (p.id === projectId ? res.project! : p)));
        }
        void syncGoalsSilently(token);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update milestone.';
        pushToast({ title: 'Could not update milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncGoalsSilently]
  );

  const deleteProjectMilestone = useCallback(
    async (projectId: number, milestoneId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await deleteProjectMilestoneRequest(token, projectId, milestoneId);
        if (res.project) {
          setProjects((prev) => prev.map((p) => (p.id === projectId ? res.project! : p)));
        }
        void syncGoalsSilently(token);
        pushToast({ title: 'Milestone removed', variant: 'info' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete milestone.';
        pushToast({ title: 'Could not remove milestone', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast, syncGoalsSilently]
  );

  const reorderProjectMilestones = useCallback(
    async (projectId: number, milestoneIds: number[]): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;
      setIsMutating(true);
      try {
        const res = await reorderProjectMilestonesRequest(token, projectId, milestoneIds);
        if (res.project) {
          setProjects((prev) => prev.map((p) => (p.id === projectId ? res.project! : p)));
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to reorder milestones.';
        pushToast({ title: 'Could not reorder milestones', description: message, variant: 'info' });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const openCreateProject = useCallback((options?: { defaultGoalId?: number | null }) => {
    setProjectDialogState({
      open: true,
      mode: 'create',
      project: null,
      defaultGoalId: options?.defaultGoalId ?? null,
    });
  }, []);

  const openEditProject = useCallback((project: Project) => {
    setProjectDialogState({
      open: true,
      mode: 'edit',
      project,
      defaultGoalId: project.goalId,
    });
  }, []);

  const closeProjectDialog = useCallback(() => {
    setProjectDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  const openCreateGoal = useCallback(() => {
    setGoalDialogState({ open: true, mode: 'create', goal: null });
  }, []);

  const openEditGoal = useCallback((goal: Goal) => {
    setGoalDialogState({ open: true, mode: 'edit', goal });
  }, []);

  const closeGoalDialog = useCallback(() => {
    setGoalDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ProjectsGoalsContext.Provider
      value={{
        projects,
        goals,
        isLoading,
        isMutating,
        error,
        projectDialogState,
        goalDialogState,
        refreshProjectsAndGoals,
        createGoal,
        updateGoal,
        deleteGoal,
        createGoalMilestone,
        updateGoalMilestone,
        deleteGoalMilestone,
        reorderGoalMilestones,
        createProject,
        updateProject,
        deleteProject,
        createProjectMilestone,
        updateProjectMilestone,
        deleteProjectMilestone,
        reorderProjectMilestones,
        openCreateProject,
        openEditProject,
        closeProjectDialog,
        openCreateGoal,
        openEditGoal,
        closeGoalDialog,
      }}
    >
      {children}
    </ProjectsGoalsContext.Provider>
  );
}

export function useProjectsGoalsContext() {
  const ctx = useContext(ProjectsGoalsContext);
  if (!ctx) {
    throw new Error('useProjectsGoalsContext must be used within ProjectsGoalsProvider');
  }
  return ctx;
}
