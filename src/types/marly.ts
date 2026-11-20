export type PrimaryRoute = 'home' | 'plan' | 'live' | 'think' | 'statistics' | 'settings';

export type PlanSubTab = 'tasks' | 'calendar' | 'projects' | 'goals';
export type LiveSubTab = 'calendar' | 'matrix' | 'heatmap' | 'habits' | 'fitness';

export interface RouteState {
  path: string;
  section: PrimaryRoute;
  planTab: PlanSubTab;
  liveTab: LiveSubTab;
  isNotFound: boolean;
}

export type TaskCategory = 'Work' | 'Health' | 'Family' | 'Study';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface DemoTask {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  bucket: 'today' | 'tomorrow';
  completed: boolean;
  dueLabel: string;
  durationLabel?: string;
  subtaskProgress?: string;
}

export interface DemoHabit {
  id: string;
  name: string;
  scheduleLabel: string;
  targetLabel: string;
  completedToday: boolean;
  streakDays: number;
  category: string;
}

export interface DemoScheduleBlock {
  id: string;
  dayKey: string;
  period: 'Morning' | 'Noon' | 'Evening';
  time: string;
  title: string;
  category?: string;
  featured?: boolean;
  completed?: boolean;
  notes?: string[];
}

export interface DemoDayPill {
  key: string;
  weekday: string;
  dayNumber: string;
}

export interface DemoGoalPreview {
  id: string;
  title: string;
  targetDate: string;
  completedMilestones: number;
  totalMilestones: number;
  progressPercent: number;
}

export interface DemoProjectPreview {
  id: string;
  name: string;
  status: string;
  targetDate: string;
  completedTasks: number;
  totalTasks: number;
  goalName: string;
}

export type HabitCalendarDayState = 'completed' | 'partial' | 'missed' | 'unscheduled' | 'future';

export interface DemoCalendarDay {
  day: number;
  state: HabitCalendarDayState;
  completedCount: number;
  scheduledCount: number;
  summary: string;
}

export interface DemoCalendarMonth {
  id: string;
  label: string;
  shortMonth: string;
  year: number;
  startWeekday: number; // 0 = Sun .. 6 = Sat
  streakDays: number;
  longestStreakDays: number;
  monthlyRateLabel: string;
  days: DemoCalendarDay[];
}

export interface DemoMatrixHabit {
  id: string;
  name: string;
  targetLabel: string;
  days: boolean[]; // Mon..Sun (7 booleans)
}

export interface DemoHeatmapCell {
  dateLabel: string;
  weekIndex: number;
  dayIndex: number;
  kind: 'unscheduled' | 'active';
  level: 0 | 1 | 2 | 3 | 4; // 0 = missed (0%), 1..4 = intensity
  completionPercent: number;
  summary: string;
}

export interface DemoWorkoutPreview {
  id: string;
  name: string;
  type: string;
  duration: string;
  when: string;
}

export interface DemoRoutinePreview {
  id: string;
  name: string;
  schedule: string;
  steps: string[];
}

export interface DemoStatisticsSummary {
  tasksCompletedThisWeek: number;
  tasksPlannedThisWeek: number;
  habitAdherencePercent: number;
  milestonesCompleted: number;
  milestonesTotal: number;
  rhythmBreakdown: Array<{
    label: string;
    value: number;
    tone: 'coral' | 'mint' | 'orange' | 'blue';
  }>;
}
