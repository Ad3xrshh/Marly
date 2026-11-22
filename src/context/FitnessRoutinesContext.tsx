import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  addRoutineStepRequest,
  createRoutineRequest,
  createWorkoutRequest,
  deleteRoutineLogRequest,
  deleteRoutineRequest,
  deleteRoutineStepRequest,
  deleteWorkoutRequest,
  fetchRoutineLogs,
  fetchRoutines,
  fetchWorkouts,
  FitnessRoutinesApiError,
  reorderRoutineStepsRequest,
  updateRoutineRequest,
  updateRoutineStepRequest,
  updateWorkoutRequest,
  upsertRoutineLogRequest,
} from '../services/fitnessRoutinesApi';
import type {
  CreateRoutineInput,
  CreateRoutineStepInput,
  CreateWorkoutInput,
  Routine,
  RoutineLog,
  UpdateRoutineInput,
  UpdateWorkoutInput,
  UpsertRoutineLogInput,
  WorkoutSession,
  WorkoutSummary,
} from '../types/fitnessRoutines';
import { getTodayLocalDate } from '../types/task';
import { useAuth } from './AuthContext';
import { useHabitsContext } from './HabitsContext';
import { useToast } from './ToastContext';

export interface WorkoutDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  workout: WorkoutSession | null;
}

export interface RoutineDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  routine: Routine | null;
}

const EMPTY_WORKOUT_SUMMARY: WorkoutSummary = {
  weekWorkoutsCount: 0,
  weekDurationMinutes: 0,
  thirtyDayWorkoutsCount: 0,
  thirtyDayDurationMinutes: 0,
  totalWorkoutsCount: 0,
  totalDurationMinutes: 0,
  byType: [],
};

const INITIAL_WORKOUT_DIALOG: WorkoutDialogState = {
  open: false,
  mode: 'create',
  workout: null,
};

const INITIAL_ROUTINE_DIALOG: RoutineDialogState = {
  open: false,
  mode: 'create',
  routine: null,
};

interface FitnessRoutinesContextValue {
  workouts: WorkoutSession[];
  workoutSummary: WorkoutSummary;
  routines: Routine[];
  todayLocalDate: string;
  effectiveTimezone: string;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  workoutDialog: WorkoutDialogState;
  routineDialog: RoutineDialogState;
  refreshFitnessAndRoutines: () => Promise<void>;
  createWorkout: (input: CreateWorkoutInput) => Promise<WorkoutSession | null>;
  updateWorkout: (workoutId: number, patch: UpdateWorkoutInput) => Promise<WorkoutSession | null>;
  deleteWorkout: (workoutId: number) => Promise<boolean>;
  createRoutine: (input: CreateRoutineInput) => Promise<Routine | null>;
  updateRoutine: (routineId: number, patch: UpdateRoutineInput) => Promise<Routine | null>;
  archiveRoutine: (routine: Routine) => Promise<Routine | null>;
  restoreRoutine: (routine: Routine) => Promise<Routine | null>;
  deleteRoutine: (routineId: number) => Promise<boolean>;
  addRoutineStep: (routineId: number, input: CreateRoutineStepInput) => Promise<Routine | null>;
  updateRoutineStep: (
    routineId: number,
    stepId: number,
    patch: { title?: string; durationMinutes?: number | null }
  ) => Promise<Routine | null>;
  deleteRoutineStep: (routineId: number, stepId: number) => Promise<Routine | null>;
  reorderRoutineSteps: (routineId: number, stepIds: number[]) => Promise<Routine | null>;
  upsertRoutineLog: (routineId: number, input: UpsertRoutineLogInput) => Promise<Routine | null>;
  resetRoutineLog: (routineId: number, localDate: string) => Promise<Routine | null>;
  loadRoutineLogsRange: (
    routineId: number,
    from?: string,
    to?: string
  ) => Promise<RoutineLog[]>;
  openCreateWorkout: () => void;
  openEditWorkout: (workout: WorkoutSession) => void;
  closeWorkoutDialog: () => void;
  openCreateRoutine: () => void;
  openEditRoutine: (routine: Routine) => void;
  closeRoutineDialog: () => void;
}

const FitnessRoutinesContext = createContext<FitnessRoutinesContextValue | null>(null);

export function FitnessRoutinesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading, getAccessToken } = useAuth();
  const { profile } = useHabitsContext();
  const { pushToast } = useToast();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary>(EMPTY_WORKOUT_SUMMARY);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [todayLocalDate, setTodayLocalDate] = useState<string>(() => getTodayLocalDate());
  const [effectiveTimezone, setEffectiveTimezone] = useState<string>('UTC');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workoutDialog, setWorkoutDialog] = useState<WorkoutDialogState>(INITIAL_WORKOUT_DIALOG);
  const [routineDialog, setRoutineDialog] = useState<RoutineDialogState>(INITIAL_ROUTINE_DIALOG);

  const loadFitnessAndRoutines = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setWorkoutSummary(EMPTY_WORKOUT_SUMMARY);
      setRoutines([]);
      setTodayLocalDate(getTodayLocalDate());
      setEffectiveTimezone('UTC');
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setWorkouts([]);
        setWorkoutSummary(EMPTY_WORKOUT_SUMMARY);
        setRoutines([]);
        return;
      }

      const [workoutsResult, routinesResult] = await Promise.all([
        fetchWorkouts(token),
        fetchRoutines(token),
      ]);

      setWorkouts(workoutsResult.workouts);
      setWorkoutSummary(workoutsResult.summary);
      setRoutines(routinesResult.routines);
      setTodayLocalDate(routinesResult.meta.todayLocalDate);
      setEffectiveTimezone(routinesResult.meta.timezone);
    } catch (err) {
      const message =
        err instanceof FitnessRoutinesApiError
          ? err.message
          : 'Unable to load fitness and routines right now. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAccessToken]);

  // Reload when auth settles or persisted timezone updates in Settings
  const persistedTimezone = profile?.effectiveTimezone;
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setWorkouts([]);
      setWorkoutSummary(EMPTY_WORKOUT_SUMMARY);
      setRoutines([]);
      setTodayLocalDate(getTodayLocalDate());
      setEffectiveTimezone('UTC');
      setError(null);
      setIsLoading(false);
      setWorkoutDialog(INITIAL_WORKOUT_DIALOG);
      setRoutineDialog(INITIAL_ROUTINE_DIALOG);
      return;
    }
    void loadFitnessAndRoutines();
  }, [user, isAuthLoading, persistedTimezone, loadFitnessAndRoutines]);

  const reloadWorkoutsOnly = useCallback(
    async (token: string) => {
      const workoutsResult = await fetchWorkouts(token);
      setWorkouts(workoutsResult.workouts);
      setWorkoutSummary(workoutsResult.summary);
      setTodayLocalDate(workoutsResult.meta.todayLocalDate);
      setEffectiveTimezone(workoutsResult.meta.timezone);
    },
    []
  );

  const createWorkout = useCallback(
    async (input: CreateWorkoutInput): Promise<WorkoutSession | null> => {
      const token = await getAccessToken();
      if (!token) {
        pushToast({
          title: 'Sign in required',
          description: 'Sign in with Google to log workouts to your workspace.',
          variant: 'info',
        });
        return null;
      }

      setIsMutating(true);
      try {
        const created = await createWorkoutRequest(token, input);
        await reloadWorkoutsOnly(token);
        pushToast({
          title: 'Workout logged',
          description: `${created.title} · ${created.durationMinutes} min`,
          variant: 'success',
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to log workout.';
        pushToast({
          title: 'Could not log workout',
          description: message,
          variant: 'info',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, reloadWorkoutsOnly, pushToast]
  );

  const updateWorkout = useCallback(
    async (workoutId: number, patch: UpdateWorkoutInput): Promise<WorkoutSession | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateWorkoutRequest(token, workoutId, patch);
        await reloadWorkoutsOnly(token);
        pushToast({
          title: 'Workout updated',
          description: updated.title,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update workout.';
        pushToast({
          title: 'Could not update workout',
          description: message,
          variant: 'info',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, reloadWorkoutsOnly, pushToast]
  );

  const deleteWorkout = useCallback(
    async (workoutId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;

      const target = workouts.find((w) => w.id === workoutId);
      setIsMutating(true);
      try {
        await deleteWorkoutRequest(token, workoutId);
        await reloadWorkoutsOnly(token);
        pushToast({
          title: 'Workout deleted',
          description: target ? target.title : 'Removed from workout log.',
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete workout.';
        pushToast({
          title: 'Could not delete workout',
          description: message,
          variant: 'info',
        });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, workouts, reloadWorkoutsOnly, pushToast]
  );

  const createRoutine = useCallback(
    async (input: CreateRoutineInput): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) {
        pushToast({
          title: 'Sign in required',
          description: 'Sign in with Google to save routines to your workspace.',
          variant: 'info',
        });
        return null;
      }

      setIsMutating(true);
      try {
        const created = await createRoutineRequest(token, input);
        setRoutines((prev) => [created, ...prev]);
        pushToast({
          title: 'Routine created',
          description: created.name,
          variant: 'success',
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create routine.';
        pushToast({
          title: 'Could not create routine',
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

  const updateRoutine = useCallback(
    async (routineId: number, patch: UpdateRoutineInput): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateRoutineRequest(token, routineId, patch);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? updated : r)));
        pushToast({
          title: 'Routine updated',
          description: updated.name,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update routine.';
        pushToast({
          title: 'Could not update routine',
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

  const archiveRoutine = useCallback(
    async (routine: Routine): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateRoutineRequest(token, routine.id, { status: 'archived' });
        setRoutines((prev) => prev.map((r) => (r.id === routine.id ? updated : r)));
        pushToast({
          title: 'Routine archived',
          description: `${updated.name} moved to Archived with execution history preserved.`,
          variant: 'info',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to archive routine.';
        pushToast({
          title: 'Archive failed',
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

  const restoreRoutine = useCallback(
    async (routine: Routine): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateRoutineRequest(token, routine.id, { status: 'active' });
        setRoutines((prev) => prev.map((r) => (r.id === routine.id ? updated : r)));
        pushToast({
          title: 'Routine restored',
          description: `${updated.name} is active again.`,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to restore routine.';
        pushToast({
          title: 'Restore failed',
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

  const deleteRoutine = useCallback(
    async (routineId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;

      const target = routines.find((r) => r.id === routineId);
      setIsMutating(true);
      try {
        await deleteRoutineRequest(token, routineId);
        setRoutines((prev) => prev.filter((r) => r.id !== routineId));
        pushToast({
          title: 'Routine permanently deleted',
          description: target ? target.name : 'Routine and its execution logs were deleted.',
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete routine.';
        pushToast({
          title: 'Could not delete routine',
          description: message,
          variant: 'info',
        });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, routines, pushToast]
  );

  const addRoutineStep = useCallback(
    async (routineId: number, input: CreateRoutineStepInput): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const res = await addRoutineStepRequest(token, routineId, input);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? res.routine : r)));
        return res.routine;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to add step.';
        pushToast({
          title: 'Could not add step',
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

  const updateRoutineStep = useCallback(
    async (
      routineId: number,
      stepId: number,
      patch: { title?: string; durationMinutes?: number | null }
    ): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const res = await updateRoutineStepRequest(token, routineId, stepId, patch);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? res.routine : r)));
        return res.routine;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update step.';
        pushToast({
          title: 'Could not update step',
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

  const deleteRoutineStep = useCallback(
    async (routineId: number, stepId: number): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const res = await deleteRoutineStepRequest(token, routineId, stepId);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? res.routine : r)));
        return res.routine;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to remove step.';
        pushToast({
          title: 'Could not remove step',
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

  const reorderRoutineSteps = useCallback(
    async (routineId: number, stepIds: number[]): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await reorderRoutineStepsRequest(token, routineId, stepIds);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? updated : r)));
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to reorder steps.';
        pushToast({
          title: 'Could not reorder steps',
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

  const upsertRoutineLog = useCallback(
    async (routineId: number, input: UpsertRoutineLogInput): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const res = await upsertRoutineLogRequest(token, routineId, input);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? res.routine : r)));
        if (res.log.status === 'completed') {
          pushToast({
            title: 'Routine completed',
            description: `${res.routine.name} · ${res.log.localDate}`,
            variant: 'success',
          });
        }
        return res.routine;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save routine progress.';
        pushToast({
          title: 'Could not save routine progress',
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

  const resetRoutineLog = useCallback(
    async (routineId: number, localDate: string): Promise<Routine | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const res = await deleteRoutineLogRequest(token, routineId, localDate);
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? res.routine : r)));
        pushToast({
          title: 'Routine progress cleared',
          description: `${res.routine.name} · ${localDate}`,
          variant: 'info',
        });
        return res.routine;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to clear routine progress.';
        pushToast({
          title: 'Could not reset routine log',
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

  const loadRoutineLogsRange = useCallback(
    async (routineId: number, from?: string, to?: string): Promise<RoutineLog[]> => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await fetchRoutineLogs(token, routineId, { from, to });
      return res.logs;
    },
    [getAccessToken]
  );

  const openCreateWorkout = useCallback(() => {
    setWorkoutDialog({ open: true, mode: 'create', workout: null });
  }, []);

  const openEditWorkout = useCallback((workout: WorkoutSession) => {
    setWorkoutDialog({ open: true, mode: 'edit', workout });
  }, []);

  const closeWorkoutDialog = useCallback(() => {
    setWorkoutDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const openCreateRoutine = useCallback(() => {
    setRoutineDialog({ open: true, mode: 'create', routine: null });
  }, []);

  const openEditRoutine = useCallback((routine: Routine) => {
    setRoutineDialog({ open: true, mode: 'edit', routine });
  }, []);

  const closeRoutineDialog = useCallback(() => {
    setRoutineDialog((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <FitnessRoutinesContext.Provider
      value={{
        workouts,
        workoutSummary,
        routines,
        todayLocalDate,
        effectiveTimezone,
        isLoading,
        isMutating,
        error,
        workoutDialog,
        routineDialog,
        refreshFitnessAndRoutines: loadFitnessAndRoutines,
        createWorkout,
        updateWorkout,
        deleteWorkout,
        createRoutine,
        updateRoutine,
        archiveRoutine,
        restoreRoutine,
        deleteRoutine,
        addRoutineStep,
        updateRoutineStep,
        deleteRoutineStep,
        reorderRoutineSteps,
        upsertRoutineLog,
        resetRoutineLog,
        loadRoutineLogsRange,
        openCreateWorkout,
        openEditWorkout,
        closeWorkoutDialog,
        openCreateRoutine,
        openEditRoutine,
        closeRoutineDialog,
      }}
    >
      {children}
    </FitnessRoutinesContext.Provider>
  );
}

export function useFitnessRoutinesContext() {
  const ctx = useContext(FitnessRoutinesContext);
  if (!ctx) {
    throw new Error('useFitnessRoutinesContext must be used within FitnessRoutinesProvider');
  }
  return ctx;
}
