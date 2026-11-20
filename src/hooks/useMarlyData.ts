import { useDemoState } from '../context/DemoStateContext';
import {
  DEMO_ACTIVE_GOALS,
  DEMO_HEATMAP_CELLS,
  DEMO_HEATMAP_MONTHLY_TREND,
  DEMO_HEATMAP_STATS,
  DEMO_MONTHLY_CALENDARS,
  DEMO_PLAN_PROJECTS,
  DEMO_ROUTINES_PREVIEW,
  DEMO_SCHEDULE_BLOCKS,
  DEMO_SEVEN_DAY_HABIT_RATES,
  DEMO_STATISTICS_SUMMARY,
  DEMO_TODAY_LABEL,
  DEMO_TOMORROW_LABEL,
  DEMO_WEEK_DAYS,
  DEMO_WEEK_RANGE_LABEL,
  DEMO_WEEKDAY_FREQUENCY,
  DEMO_WORKOUTS_PREVIEW,
  MATRIX_WEEKDAYS,
} from '../data/demoData';

/**
 * Clean data-access boundary for Marly features.
 * Phase 1 resolves from isolated DemoStateContext and demoData;
 * Phase 3+ swaps these hooks to backend API / Drizzle queries without rewriting feature views.
 */

export function useTasksOverviewData() {
  const {
    tasks,
    taskCategoryFilter,
    setTaskCategoryFilter,
    toggleDemoTask,
    searchQuery,
    setSearchQuery,
  } = useDemoState();

  return {
    tasks,
    tomorrowLabel: DEMO_TOMORROW_LABEL,
    taskCategoryFilter,
    setTaskCategoryFilter,
    toggleTask: toggleDemoTask,
    searchQuery,
    setSearchQuery,
  };
}

export function useHabitsMomentumData() {
  const { habits, toggleDemoHabit, searchQuery } = useDemoState();

  return {
    habits,
    toggleHabit: toggleDemoHabit,
    searchQuery,
    sevenDayRates: DEMO_SEVEN_DAY_HABIT_RATES,
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
  return {
    projects: DEMO_PLAN_PROJECTS,
    goals: DEMO_ACTIVE_GOALS,
  };
}

export function useMonthlyCalendarData() {
  return {
    months: DEMO_MONTHLY_CALENDARS,
    defaultMonthIndex: 1, // March 2026
    defaultSelectedDay: 24, // Today: Tue Mar 24, 2026
  };
}

export function useWeeklyMatrixData() {
  const { matrixHabits, toggleMatrixCell } = useDemoState();

  return {
    weekRangeLabel: DEMO_WEEK_RANGE_LABEL,
    weekdays: MATRIX_WEEKDAYS,
    matrixHabits,
    toggleMatrixCell,
  };
}

export function useActivityHeatmapData() {
  return {
    cells: DEMO_HEATMAP_CELLS,
    stats: DEMO_HEATMAP_STATS,
    monthlyTrend: DEMO_HEATMAP_MONTHLY_TREND,
    weekdayFrequency: DEMO_WEEKDAY_FREQUENCY,
  };
}

export function useFitnessAndRoutinesData() {
  return {
    workouts: DEMO_WORKOUTS_PREVIEW,
    routines: DEMO_ROUTINES_PREVIEW,
  };
}

export function useStatisticsPreviewData() {
  const { tasks, habits } = useDemoState();
  const completedTodayTasks = tasks.filter((t) => t.bucket === 'today' && t.completed).length;
  const totalTodayTasks = tasks.filter((t) => t.bucket === 'today').length;
  const completedTodayHabits = habits.filter((h) => h.completedToday).length;

  return {
    summary: DEMO_STATISTICS_SUMMARY,
    todayTaskRate:
      totalTodayTasks > 0 ? Math.round((completedTodayTasks / totalTodayTasks) * 100) : 0,
    todayHabitCompleted: completedTodayHabits,
    todayHabitTotal: habits.length,
  };
}
