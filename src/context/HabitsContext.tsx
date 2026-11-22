import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { addDaysToLocalDate, isValidIanaTimeZone } from '../lib/habitSchedule';
import {
  mergeDateIntervals,
  splitDateRangeChunks,
  subtractCoveredIntervals,
  type DateRangeInterval,
} from '../lib/habitVisualizations';
import {
  createHabitRequest,
  deleteHabitLogRequest,
  deleteHabitRequest,
  fetchAllHabitLogs,
  fetchHabitLogs,
  fetchHabits,
  fetchMe,
  HabitsApiError,
  updateHabitRequest,
  updateHabitScheduleRequest,
  updateMeTimeZone,
  upsertHabitLogRequest,
} from '../services/habitsApi';
import type {
  CreateHabitInput,
  Habit,
  HabitLog,
  HabitScheduleInput,
  HabitsMeta,
  UpdateHabitInput,
  UpsertHabitLogInput,
  UserProfile,
} from '../types/habit';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface HabitDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  habit: Habit | null;
}

interface HabitsContextValue {
  profile: UserProfile | null;
  habits: Habit[];
  recentLogs: HabitLog[];
  logsByKey: Map<string, HabitLog>;
  meta: HabitsMeta | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  isRangeLoading: boolean;
  rangeError: string | null;
  dialogState: HabitDialogState;
  refreshHabits: () => Promise<void>;
  ensureLogRangeLoaded: (from: string, to: string, options?: { force?: boolean }) => Promise<void>;
  updateTimeZone: (timezone: string) => Promise<UserProfile | null>;
  createHabit: (input: CreateHabitInput) => Promise<Habit | null>;
  updateHabit: (habitId: number, patch: UpdateHabitInput) => Promise<Habit | null>;
  updateHabitSchedule: (habitId: number, schedule: HabitScheduleInput) => Promise<Habit | null>;
  archiveHabit: (habit: Habit) => Promise<Habit | null>;
  restoreHabit: (habit: Habit) => Promise<Habit | null>;
  deleteHabit: (habitId: number) => Promise<boolean>;
  upsertHabitLog: (habitId: number, input: UpsertHabitLogInput) => Promise<Habit | null>;
  undoHabitLog: (habitId: number, localDate: string) => Promise<Habit | null>;
  loadHabitLogsRange: (habitId: number, from?: string, to?: string) => Promise<HabitLog[]>;
  openCreateHabit: () => void;
  openEditHabit: (habit: Habit) => void;
  closeHabitDialog: () => void;
}

const INITIAL_DIALOG_STATE: HabitDialogState = {
  open: false,
  mode: 'create',
  habit: null,
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading, getAccessToken } = useAuth();
  const { pushToast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logsByKey, setLogsByKey] = useState<Map<string, HabitLog>>(() => new Map());
  const [meta, setMeta] = useState<HabitsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCount, setLoadingCount] = useState(0);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<HabitDialogState>(INITIAL_DIALOG_STATE);

  const coveredIntervalsRef = useRef<DateRangeInterval[]>([]);
  const inFlightRequestsRef = useRef<Map<string, Promise<void>>>(new Map());

  const resetRangeCache = useCallback(() => {
    coveredIntervalsRef.current = [];
    inFlightRequestsRef.current.clear();
    setLogsByKey(new Map());
    setRangeError(null);
  }, []);

  const mergeLogsIntoCache = useCallback((incoming: HabitLog[]) => {
    if (incoming.length === 0) return;
    setLogsByKey((prev) => {
      const next = new Map(prev);
      for (const log of incoming) {
        next.set(`${log.habitId}:${log.localDate}`, log);
      }
      return next;
    });
  }, []);

  const loadWorkspaceHabits = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setHabits([]);
      resetRangeCache();
      setMeta(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setProfile(null);
        setHabits([]);
        resetRangeCache();
        setMeta(null);
        return;
      }

      // 1. Load authenticated user profile & initialize persisted IANA timezone once if unset
      let currentProfile = await fetchMe(token);
      if (!currentProfile.timezoneInitialized) {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected && isValidIanaTimeZone(detected)) {
          currentProfile = await updateMeTimeZone(token, detected);
        }
      }
      setProfile(currentProfile);

      // 2. Load habits (evaluated in authoritative persisted user timezone) and 7-day recent logs
      const from7Days = addDaysToLocalDate(currentProfile.todayLocalDate, -6);
      const [habitsResult, logsResult] = await Promise.all([
        fetchHabits(token),
        fetchAllHabitLogs(token, {
          from: from7Days,
          to: currentProfile.todayLocalDate,
        }),
      ]);

      setHabits(habitsResult.habits);
      setMeta(habitsResult.meta);

      const nextMap = new Map<string, HabitLog>();
      for (const log of logsResult.logs) {
        nextMap.set(`${log.habitId}:${log.localDate}`, log);
      }
      coveredIntervalsRef.current = [
        { from: from7Days, to: currentProfile.todayLocalDate },
      ];
      inFlightRequestsRef.current.clear();
      setRangeError(null);
      setLogsByKey(nextMap);
    } catch (err) {
      const message =
        err instanceof HabitsApiError
          ? err.message
          : 'Unable to load your habits right now. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAccessToken, resetRangeCache]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setProfile(null);
      setHabits([]);
      resetRangeCache();
      setMeta(null);
      setError(null);
      setIsLoading(false);
      setDialogState(INITIAL_DIALOG_STATE);
      return;
    }
    void loadWorkspaceHabits();
  }, [user, isAuthLoading, loadWorkspaceHabits, resetRangeCache]);

  const ensureLogRangeLoaded = useCallback(
    async (from: string, to: string, options?: { force?: boolean }): Promise<void> => {
      if (!user || from > to) return;

      const missingGaps = options?.force
        ? [{ from, to }]
        : subtractCoveredIntervals(from, to, coveredIntervalsRef.current);

      if (missingGaps.length === 0) return;

      // Split any gap larger than 365 days into bounded chunks under the 400-day API ceiling
      const chunks = missingGaps.flatMap((gap) => splitDateRangeChunks(gap.from, gap.to, 365));
      if (chunks.length === 0) return;

      const batchKey = `${options?.force ? 'force:' : ''}${chunks
        .map((c) => `${c.from}..${c.to}`)
        .join(',')}`;
      const existingPromise = inFlightRequestsRef.current.get(batchKey);
      if (existingPromise) {
        return existingPromise;
      }

      const promise = (async () => {
        setLoadingCount((c) => c + 1);
        setRangeError(null);
        try {
          const token = await getAccessToken();
          if (!token) return;

          const chunkResults = await Promise.all(
            chunks.map((chunk) =>
              fetchAllHabitLogs(token, { from: chunk.from, to: chunk.to })
            )
          );

          const allFetchedLogs = chunkResults.flatMap((res) => res.logs);
          if (options?.force) {
            setLogsByKey((prev) => {
              const next = new Map(prev);
              for (const key of next.keys()) {
                const log = next.get(key);
                if (log && log.localDate >= from && log.localDate <= to) {
                  next.delete(key);
                }
              }
              for (const log of allFetchedLogs) {
                next.set(`${log.habitId}:${log.localDate}`, log);
              }
              return next;
            });
          } else {
            mergeLogsIntoCache(allFetchedLogs);
          }

          coveredIntervalsRef.current = mergeDateIntervals([
            ...coveredIntervalsRef.current,
            ...chunks,
          ]);
        } catch (err) {
          const message =
            err instanceof HabitsApiError
              ? err.message
              : 'Unable to load historical habit logs right now. Please try again.';
          setRangeError(message);
        } finally {
          inFlightRequestsRef.current.delete(batchKey);
          setLoadingCount((c) => Math.max(0, c - 1));
        }
      })();

      inFlightRequestsRef.current.set(batchKey, promise);
      return promise;
    },
    [user, getAccessToken, mergeLogsIntoCache]
  );

  const updateTimeZone = useCallback(
    async (timezone: string): Promise<UserProfile | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updatedProfile = await updateMeTimeZone(token, timezone);
        setProfile(updatedProfile);

        const from7Days = addDaysToLocalDate(updatedProfile.todayLocalDate, -6);
        const [habitsResult, logsResult] = await Promise.all([
          fetchHabits(token),
          fetchAllHabitLogs(token, {
            from: from7Days,
            to: updatedProfile.todayLocalDate,
          }),
        ]);
        setHabits(habitsResult.habits);
        setMeta(habitsResult.meta);

        const nextMap = new Map<string, HabitLog>();
        for (const log of logsResult.logs) {
          nextMap.set(`${log.habitId}:${log.localDate}`, log);
        }
        coveredIntervalsRef.current = [
          { from: from7Days, to: updatedProfile.todayLocalDate },
        ];
        inFlightRequestsRef.current.clear();
        setRangeError(null);
        setLogsByKey(nextMap);

        pushToast({
          title: 'Timezone saved',
          description: `Local habit dates now use ${updatedProfile.effectiveTimezone}.`,
          variant: 'success',
        });
        return updatedProfile;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to save timezone preference.';
        pushToast({
          title: 'Could not update timezone',
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

  const createHabit = useCallback(
    async (input: CreateHabitInput): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) {
        pushToast({
          title: 'Sign in required',
          description: 'Sign in with Google to save habits to your workspace.',
          variant: 'info',
        });
        return null;
      }

      setIsMutating(true);
      try {
        const created = await createHabitRequest(token, input);
        setHabits((prev) => [created, ...prev]);
        pushToast({
          title: 'Habit created',
          description: created.name,
          variant: 'success',
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create habit.';
        pushToast({
          title: 'Could not create habit',
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

  const updateHabit = useCallback(
    async (habitId: number, patch: UpdateHabitInput): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateHabitRequest(token, habitId, patch);
        setHabits((prev) => prev.map((item) => (item.id === habitId ? updated : item)));
        pushToast({
          title: 'Habit updated',
          description: updated.name,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update habit.';
        pushToast({
          title: 'Could not update habit',
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

  const updateHabitSchedule = useCallback(
    async (habitId: number, schedule: HabitScheduleInput): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateHabitScheduleRequest(token, habitId, schedule);
        setHabits((prev) => prev.map((item) => (item.id === habitId ? updated : item)));
        pushToast({
          title: 'Schedule updated',
          description: `${updated.name} · ${updated.schedule.label}`,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update schedule.';
        pushToast({
          title: 'Could not update schedule',
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

  const archiveHabit = useCallback(
    async (habit: Habit): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateHabitRequest(token, habit.id, { status: 'archived' });
        setHabits((prev) => prev.map((item) => (item.id === habit.id ? updated : item)));
        pushToast({
          title: 'Habit archived',
          description: `${updated.name} moved to Archived while keeping historical logs intact.`,
          variant: 'info',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to archive habit.';
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

  const restoreHabit = useCallback(
    async (habit: Habit): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateHabitRequest(token, habit.id, { status: 'active' });
        setHabits((prev) => prev.map((item) => (item.id === habit.id ? updated : item)));
        pushToast({
          title: 'Habit restored',
          description: `${updated.name} is active again.`,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to restore habit.';
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

  const deleteHabit = useCallback(
    async (habitId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;

      const target = habits.find((h) => h.id === habitId);
      setIsMutating(true);
      try {
        await deleteHabitRequest(token, habitId);
        setHabits((prev) => prev.filter((item) => item.id !== habitId));
        setLogsByKey((prev) => {
          const next = new Map(prev);
          for (const [key, log] of next.entries()) {
            if (log.habitId === habitId) {
              next.delete(key);
            }
          }
          return next;
        });
        pushToast({
          title: 'Habit deleted',
          description: target ? target.name : 'Removed from your habits.',
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete habit.';
        pushToast({
          title: 'Could not delete habit',
          description: message,
          variant: 'info',
        });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, habits, pushToast]
  );

  const upsertHabitLog = useCallback(
    async (habitId: number, input: UpsertHabitLogInput): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const result = await upsertHabitLogRequest(token, habitId, input);
        setHabits((prev) => prev.map((item) => (item.id === habitId ? result.habit : item)));
        setLogsByKey((prev) => {
          const next = new Map(prev);
          next.set(`${habitId}:${result.log.localDate}`, result.log);
          return next;
        });
        pushToast({
          title:
            result.log.statusSnapshot === 'completed'
              ? 'Habit completed'
              : 'Partial progress saved',
          description: `${result.habit.name} · ${result.log.localDate}`,
          variant: result.log.statusSnapshot === 'completed' ? 'success' : 'info',
        });
        return result.habit;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save habit log.';
        pushToast({
          title: 'Could not save habit log',
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

  const undoHabitLog = useCallback(
    async (habitId: number, localDate: string): Promise<Habit | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const result = await deleteHabitLogRequest(token, habitId, localDate);
        setHabits((prev) => prev.map((item) => (item.id === habitId ? result.habit : item)));
        setLogsByKey((prev) => {
          const next = new Map(prev);
          next.delete(`${habitId}:${localDate}`);
          return next;
        });
        pushToast({
          title: 'Completion undone',
          description: `${result.habit.name} · ${localDate}`,
          variant: 'info',
        });
        return result.habit;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to undo habit log.';
        pushToast({
          title: 'Undo failed',
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

  const loadHabitLogsRange = useCallback(
    async (habitId: number, from?: string, to?: string): Promise<HabitLog[]> => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await fetchHabitLogs(token, habitId, { from, to });
      mergeLogsIntoCache(res.logs);
      return res.logs;
    },
    [getAccessToken, mergeLogsIntoCache]
  );

  const recentLogs = useMemo(() => Array.from(logsByKey.values()), [logsByKey]);

  const openCreateHabit = useCallback(() => {
    setDialogState({ open: true, mode: 'create', habit: null });
  }, []);

  const openEditHabit = useCallback((habit: Habit) => {
    setDialogState({ open: true, mode: 'edit', habit });
  }, []);

  const closeHabitDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <HabitsContext.Provider
      value={{
        profile,
        habits,
        recentLogs,
        logsByKey,
        meta,
        isLoading,
        isMutating,
        error,
        isRangeLoading: loadingCount > 0,
        rangeError,
        dialogState,
        refreshHabits: loadWorkspaceHabits,
        ensureLogRangeLoaded,
        updateTimeZone,
        createHabit,
        updateHabit,
        updateHabitSchedule,
        archiveHabit,
        restoreHabit,
        deleteHabit,
        upsertHabitLog,
        undoHabitLog,
        loadHabitLogsRange,
        openCreateHabit,
        openEditHabit,
        closeHabitDialog,
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabitsContext() {
  const ctx = useContext(HabitsContext);
  if (!ctx) {
    throw new Error('useHabitsContext must be used within HabitsProvider');
  }
  return ctx;
}
