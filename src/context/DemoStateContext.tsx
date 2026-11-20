import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  INITIAL_DEMO_HABITS,
  INITIAL_DEMO_MATRIX_HABITS,
  INITIAL_DEMO_TASKS,
} from '../data/demoData';
import { DemoHabit, DemoMatrixHabit, DemoTask, TaskCategory } from '../types/marly';
import { useToast } from './ToastContext';

export type TaskFilterOption = 'All' | TaskCategory;

interface DemoStateContextValue {
  tasks: DemoTask[];
  habits: DemoHabit[];
  matrixHabits: DemoMatrixHabit[];
  selectedDayKey: string;
  taskCategoryFilter: TaskFilterOption;
  searchQuery: string;
  isModified: boolean;
  setSelectedDayKey: (dayKey: string) => void;
  setTaskCategoryFilter: (filter: TaskFilterOption) => void;
  setSearchQuery: (query: string) => void;
  toggleDemoTask: (taskId: string) => void;
  toggleDemoHabit: (habitId: string) => void;
  toggleMatrixCell: (habitId: string, dayIndex: number) => void;
  resetDemoState: () => void;
}

const DemoStateContext = createContext<DemoStateContextValue | null>(null);

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const { pushToast } = useToast();
  const [tasks, setTasks] = useState<DemoTask[]>(INITIAL_DEMO_TASKS);
  const [habits, setHabits] = useState<DemoHabit[]>(INITIAL_DEMO_HABITS);
  const [matrixHabits, setMatrixHabits] = useState<DemoMatrixHabit[]>(INITIAL_DEMO_MATRIX_HABITS);
  const [selectedDayKey, setSelectedDayKey] = useState<string>('tue-24');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<TaskFilterOption>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModified, setIsModified] = useState<boolean>(false);

  const toggleDemoTask = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const nextCompleted = !target.completed;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: nextCompleted } : task
        )
      );
      setIsModified(true);
      pushToast({
        title: nextCompleted ? 'Task checked in demo preview' : 'Task reopened in demo preview',
        description: `${target.title} · Local UI state only (not persisted)`,
        variant: 'demo',
      });
    },
    [tasks, pushToast]
  );

  const toggleDemoHabit = useCallback(
    (habitId: string) => {
      const target = habits.find((h) => h.id === habitId);
      if (!target) return;

      const nextCompleted = !target.completedToday;
      setHabits((prev) =>
        prev.map((habit) =>
          habit.id === habitId ? { ...habit, completedToday: nextCompleted } : habit
        )
      );
      setIsModified(true);
      pushToast({
        title: nextCompleted ? 'Habit marked in demo preview' : 'Habit unchecked in demo preview',
        description: `${target.name} · Local UI state only (Phase 6 adds real logs)`,
        variant: 'demo',
      });
    },
    [habits, pushToast]
  );

  const toggleMatrixCell = useCallback((habitId: string, dayIndex: number) => {
    setMatrixHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;
        const nextDays = [...habit.days];
        nextDays[dayIndex] = !nextDays[dayIndex];
        return { ...habit, days: nextDays };
      })
    );
    setIsModified(true);
  }, []);

  const resetDemoState = useCallback(() => {
    setTasks(INITIAL_DEMO_TASKS);
    setHabits(INITIAL_DEMO_HABITS);
    setMatrixHabits(INITIAL_DEMO_MATRIX_HABITS);
    setSelectedDayKey('tue-24');
    setTaskCategoryFilter('All');
    setSearchQuery('');
    setIsModified(false);
    pushToast({
      title: 'Demo preview restored',
      description: 'All demonstration tasks, habits, and matrix cells are back to baseline.',
      variant: 'info',
    });
  }, [pushToast]);

  return (
    <DemoStateContext.Provider
      value={{
        tasks,
        habits,
        matrixHabits,
        selectedDayKey,
        taskCategoryFilter,
        searchQuery,
        isModified,
        setSelectedDayKey,
        setTaskCategoryFilter,
        setSearchQuery,
        toggleDemoTask,
        toggleDemoHabit,
        toggleMatrixCell,
        resetDemoState,
      }}
    >
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemoState() {
  const ctx = useContext(DemoStateContext);
  if (!ctx) {
    throw new Error('useDemoState must be used within DemoStateProvider');
  }
  return ctx;
}
