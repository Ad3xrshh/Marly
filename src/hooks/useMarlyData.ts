import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCalendarContext } from '../context/CalendarContext';
import { useDemoState } from '../context/DemoStateContext';
import { useFitnessRoutinesContext } from '../context/FitnessRoutinesContext';
import { useHabitsContext } from '../context/HabitsContext';
import { useProjectsGoalsContext } from '../context/ProjectsGoalsContext';
import { useTasksContext } from '../context/TasksContext';
import {
  DEMO_SCHEDULE_BLOCKS,
  DEMO_SEVEN_DAY_HABIT_RATES,
  DEMO_TODAY_LABEL,
  DEMO_WEEK_DAYS,
} from '../data/demoData';
import {
  addDaysToLocalDate,
  formatTimestampInTimeZoneToLocalDate,
  getDayOfWeekFromLocalDate,
  isHabitScheduledOnDate,
  WEEKDAY_SHORT_LABELS,
} from '../lib/habitSchedule';
import { computeGoalProgress, computeProjectProgress } from '../lib/progress';
import {
  formatShortLocalDate,
  getTodayLocalDate,
  getTomorrowLocalDate,
  type TaskCategory,
} from '../types/task';

export type TaskCategoryFilterOption = 'All' | TaskCategory;

/**
 * Clean data-access boundary for Marly features.
 * Tasks, Calendar Events, Projects, Goals, Habits, Fitness/Routines, and Statistics resolve from PostgreSQL via authenticated Express/Drizzle endpoints;
 * HOME Schedule timeline and THINK remain preview/upcoming pillars.
 */

export function useTasksOverviewData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const { searchQuery, setSearchQuery } = useDemoState();
  const {
    tasks,
    isLoading,
    isMutating,
    error,
    refreshTasks,
    createTask,
    updateTask,
    toggleTaskCompleted,
    deleteTask,
    openCreateTask,
    openEditTask,
  } = useTasksContext();

  const [taskCategoryFilter, setTaskCategoryFilter] =
    useState<TaskCategoryFilterOption>('All');

  const todayIso = getTodayLocalDate();
  const tomorrowIso = getTomorrowLocalDate();

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    tasks,
    isLoading,
    isMutating,
    error,
    todayIso,
    tomorrowIso,
    todayLabel: `Today · ${formatShortLocalDate(todayIso)}`,
    tomorrowLabel: `Tomorrow · ${formatShortLocalDate(tomorrowIso)}`,
    taskCategoryFilter,
    setTaskCategoryFilter,
    searchQuery,
    setSearchQuery,
    refreshTasks,
    createTask,
    updateTask,
    toggleTaskCompleted,
    deleteTask,
    openCreateTask,
    openEditTask,
  };
}

export function usePlanCalendarData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const {
    events,
    isLoading: eventsLoading,
    isMutating,
    error: eventsError,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    openCreateEvent,
    openEditEvent,
  } = useCalendarContext();
  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    refreshTasks,
    toggleTaskCompleted,
    openEditTask,
  } = useTasksContext();

  const refreshCalendar = async () => {
    await Promise.all([refreshEvents(), refreshTasks()]);
  };

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    events,
    tasks,
    isLoading: eventsLoading || tasksLoading,
    isMutating,
    error: eventsError || tasksError,
    refreshCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    openCreateEvent,
    openEditEvent,
    openEditTask,
    toggleTaskCompleted,
  };
}

export function useHabitsMomentumData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const { searchQuery } = useDemoState();
  const {
    profile,
    habits,
    recentLogs,
    meta,
    isLoading,
    isMutating,
    error,
    refreshHabits,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
    openEditHabit,
  } = useHabitsContext();

  const todayLocalDate =
    meta?.todayLocalDate ?? profile?.todayLocalDate ?? getTodayLocalDate();
  const effectiveTimezone =
    meta?.timezone ?? profile?.effectiveTimezone ?? 'UTC';

  const activeHabits = useMemo(
    () => habits.filter((h) => h.status === 'active'),
    [habits]
  );

  const scheduledTodayHabits = useMemo(
    () => activeHabits.filter((h) => h.scheduledToday),
    [activeHabits]
  );

  const sevenDayRates = useMemo(() => {
    if (!user) return DEMO_SEVEN_DAY_HABIT_RATES;

    const completedLogKeys = new Set(
      recentLogs
        .filter((l) => l.statusSnapshot === 'completed')
        .map((l) => `${l.habitId}:${l.localDate}`)
    );
    const anyLogKeys = new Set(recentLogs.map((l) => `${l.habitId}:${l.localDate}`));

    return Array.from({ length: 7 }, (_, offset) => {
      const dateStr = addDaysToLocalDate(todayLocalDate, offset - 6);
      const dayLabel = WEEKDAY_SHORT_LABELS[getDayOfWeekFromLocalDate(dateStr)];

      const eligibleOnDay = activeHabits.filter((habit) => {
        if (habit.schedule.frequencyType === 'times_per_week') {
          return anyLogKeys.has(`${habit.id}:${dateStr}`);
        }
        const createdLocal = formatTimestampInTimeZoneToLocalDate(
          new Date(habit.createdAt),
          effectiveTimezone
        );
        const existedOnDay = createdLocal <= dateStr || anyLogKeys.has(`${habit.id}:${dateStr}`);
        return existedOnDay && isHabitScheduledOnDate(habit.schedule, dateStr);
      });

      const completedCount = eligibleOnDay.filter((h) =>
        completedLogKeys.has(`${h.id}:${dateStr}`)
      ).length;

      const percent =
        eligibleOnDay.length > 0
          ? Math.round((completedCount / eligibleOnDay.length) * 100)
          : 0;

      return {
        day: dayLabel,
        localDate: dateStr,
        percent,
      };
    });
  }, [user, recentLogs, todayLocalDate, activeHabits, effectiveTimezone]);

  const topDailyStreak = useMemo(() => {
    const dailyHabits = activeHabits.filter((h) => h.streak.streakUnit === 'days');
    return dailyHabits.reduce((max, h) => Math.max(max, h.streak.currentStreak), 0);
  }, [activeHabits]);

  const topWeeklyStreak = useMemo(() => {
    const weeklyHabits = activeHabits.filter((h) => h.streak.streakUnit === 'weeks');
    return weeklyHabits.reduce((max, h) => Math.max(max, h.streak.currentStreak), 0);
  }, [activeHabits]);

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    profile,
    habits: scheduledTodayHabits,
    allActiveHabits: activeHabits,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    searchQuery,
    sevenDayRates,
    topDailyStreak,
    topWeeklyStreak,
    refreshHabits,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
    openEditHabit,
  };
}

export function useHabitsManagementData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const { searchQuery } = useDemoState();
  const {
    profile,
    habits,
    meta,
    isLoading,
    isMutating,
    error,
    refreshHabits,
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
  } = useHabitsContext();

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    profile,
    habits,
    meta,
    todayLocalDate:
      meta?.todayLocalDate ?? profile?.todayLocalDate ?? getTodayLocalDate(),
    effectiveTimezone: meta?.timezone ?? profile?.effectiveTimezone ?? 'UTC',
    isLoading,
    isMutating,
    error,
    searchQuery,
    refreshHabits,
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
  };
}

export function useScheduleData() {
  const { selectedDayKey, setSelectedDayKey } = useDemoState();

  return {
    todayLabel: DEMO_TODAY_LABEL,
    weekDays: DEMO_WEEK_DAYS,
    blocks: DEMO_SCHEDULE_BLOCKS,
    selectedDayKey,
    setSelectedDayKey,
  };
}

export function useProjectsAndGoalsData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const { tasks } = useTasksContext();
  const {
    projects,
    goals,
    isLoading,
    isMutating,
    error,
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
    openCreateGoal,
    openEditGoal,
  } = useProjectsGoalsContext();

  // Recompute project progress reactively when tasks or milestones change
  const liveProjects = useMemo(() => {
    const goalTitleMap = new Map(goals.map((g) => [g.id, g.title]));
    return projects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const progress = computeProjectProgress({
        status: project.status,
        milestones: project.milestones,
        tasks: projectTasks,
      });
      return {
        ...project,
        goalTitle: project.goalId ? (goalTitleMap.get(project.goalId) ?? project.goalTitle) : null,
        progress,
      };
    });
  }, [projects, goals, tasks]);

  // Recompute goal progress reactively from milestones, measurable targets, linked projects, and standalone tasks
  const liveGoals = useMemo(() => {
    return goals.map((goal) => {
      const goalProjects = liveProjects.filter((p) => p.goalId === goal.id);
      const goalTasks = tasks.filter((t) => t.goalId === goal.id);
      const progress = computeGoalProgress({
        goalId: goal.id,
        status: goal.status,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        milestones: goal.milestones,
        linkedProjects: goalProjects.map((p) => ({
          id: p.id,
          status: p.status,
          progress: p.progress,
        })),
        goalTasks,
      });

      return {
        ...goal,
        linkedProjects: goalProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          targetDate: p.targetDate,
          progressPercent: p.progress.progressPercent,
        })),
        progress,
      };
    });
  }, [goals, liveProjects, tasks]);

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    projects: liveProjects,
    goals: liveGoals,
    tasks,
    isLoading,
    isMutating,
    error,
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
    openCreateGoal,
    openEditGoal,
  };
}

export function useMonthlyCalendarData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const {
    profile,
    habits,
    logsByKey,
    meta,
    isLoading,
    isMutating,
    error,
    isRangeLoading,
    rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  } = useHabitsContext();

  const todayLocalDate =
    meta?.todayLocalDate ?? profile?.todayLocalDate ?? getTodayLocalDate();
  const effectiveTimezone = meta?.timezone ?? profile?.effectiveTimezone ?? 'UTC';

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    logsByKey,
    todayLocalDate,
    effectiveTimezone,
    isLoading: isLoading || isRangeLoading,
    isMutating,
    error: error || rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  };
}

export function useWeeklyMatrixData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const {
    profile,
    habits,
    logsByKey,
    meta,
    isLoading,
    isMutating,
    error,
    isRangeLoading,
    rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  } = useHabitsContext();

  const todayLocalDate =
    meta?.todayLocalDate ?? profile?.todayLocalDate ?? getTodayLocalDate();
  const effectiveTimezone = meta?.timezone ?? profile?.effectiveTimezone ?? 'UTC';

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    logsByKey,
    todayLocalDate,
    effectiveTimezone,
    isLoading: isLoading || isRangeLoading,
    isMutating,
    error: error || rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    upsertHabitLog,
    undoHabitLog,
    openCreateHabit,
  };
}

export function useActivityHeatmapData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const {
    profile,
    habits,
    logsByKey,
    meta,
    isLoading,
    error,
    isRangeLoading,
    rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    openCreateHabit,
  } = useHabitsContext();

  const todayLocalDate =
    meta?.todayLocalDate ?? profile?.todayLocalDate ?? getTodayLocalDate();
  const effectiveTimezone = meta?.timezone ?? profile?.effectiveTimezone ?? 'UTC';

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    habits,
    logsByKey,
    todayLocalDate,
    effectiveTimezone,
    isLoading: isLoading || isRangeLoading,
    error: error || rangeError,
    refreshHabits,
    ensureLogRangeLoaded,
    openCreateHabit,
  };
}

export function useFitnessAndRoutinesData() {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle } = useAuth();
  const { searchQuery } = useDemoState();
  const {
    workouts,
    workoutSummary,
    routines,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    refreshFitnessAndRoutines,
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
    openCreateRoutine,
    openEditRoutine,
  } = useFitnessRoutinesContext();

  return {
    isAuthenticated: Boolean(user),
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    workouts,
    workoutSummary,
    routines,
    todayLocalDate,
    effectiveTimezone,
    isLoading,
    isMutating,
    error,
    searchQuery,
    refreshFitnessAndRoutines,
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
    openCreateRoutine,
    openEditRoutine,
  };
}

export { useStatisticsData } from './useStatisticsData';
