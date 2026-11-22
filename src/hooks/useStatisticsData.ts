import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHabitsContext } from '../context/HabitsContext';
import { addDaysToLocalDate, isValidCalendarDate } from '../lib/habitSchedule';
import { diffLocalDays } from '../lib/habitVisualizations';
import { fetchStatisticsOverview } from '../services/statisticsApi';
import type {
  StatisticsOverviewResponse,
  StatisticsPeriodPreset,
} from '../types/statistics';
import { getTodayLocalDate } from '../types/task';

const MAX_CUSTOM_SPAN_DAYS = 366;

export function useStatisticsData() {
  const {
    user,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    getAccessToken,
  } = useAuth();
  const { profile } = useHabitsContext();

  const defaultToday = profile?.todayLocalDate ?? getTodayLocalDate();

  const [preset, setPreset] = useState<StatisticsPeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState<string>(() =>
    addDaysToLocalDate(defaultToday, -29)
  );
  const [customTo, setCustomTo] = useState<string>(() => defaultToday);

  const [data, setData] = useState<StatisticsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const customValidationError = useMemo(() => {
    if (preset !== 'custom') return null;
    if (!isValidCalendarDate(customFrom) || !isValidCalendarDate(customTo)) {
      return 'Enter valid YYYY-MM-DD start and end dates.';
    }
    if (customFrom > customTo) {
      return 'Start date must be on or before end date.';
    }
    const span = diffLocalDays(customFrom, customTo) + 1;
    if (span > MAX_CUSTOM_SPAN_DAYS) {
      return `Custom range cannot exceed ${MAX_CUSTOM_SPAN_DAYS} days (currently ${span} days).`;
    }
    return null;
  }, [preset, customFrom, customTo]);

  const effectiveTimezoneKey = profile?.effectiveTimezone ?? 'default';

  const loadStatistics = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) {
        setData(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      if (preset === 'custom' && customValidationError) {
        setError(customValidationError);
        setIsLoading(false);
        return;
      }

      const seq = ++requestSeqRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Authentication session unavailable.');
        }

        const response = await fetchStatisticsOverview(token, {
          preset,
          from: preset === 'custom' ? customFrom : undefined,
          to: preset === 'custom' ? customTo : undefined,
          signal,
        });

        if (seq === requestSeqRef.current) {
          setData(response);
          setError(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (seq === requestSeqRef.current) {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load statistics right now.';
          setError(message);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [user, preset, customFrom, customTo, customValidationError, getAccessToken]
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    void loadStatistics(controller.signal);
    return () => controller.abort();
  }, [isAuthLoading, user, effectiveTimezoneKey, loadStatistics]);

  const selectPreset = useCallback(
    (nextPreset: StatisticsPeriodPreset) => {
      setPreset(nextPreset);
      if (nextPreset === 'custom' && data?.meta) {
        setCustomFrom(data.meta.from);
        setCustomTo(data.meta.to);
      }
    },
    [data]
  );

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    preset,
    selectPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    customValidationError,
    data,
    isLoading,
    error,
    refresh: () => loadStatistics(),
  };
}
