import {
  DemoCalendarDay,
  DemoCalendarMonth,
  DemoDayPill,
  DemoGoalPreview,
  DemoHabit,
  DemoHeatmapCell,
  DemoMatrixHabit,
  DemoProjectPreview,
  DemoRoutinePreview,
  DemoScheduleBlock,
  DemoStatisticsSummary,
  DemoTask,
  DemoWorkoutPreview,
  HabitCalendarDayState,
} from '../types/marly';

// Unified Phase 1 demo anchor: Tuesday, March 24, 2026
export const DEMO_TODAY_LABEL = 'Tue, Mar 24, 2026';
export const DEMO_TOMORROW_LABEL = 'Tomorrow · Mar 25';
export const DEMO_WEEK_RANGE_LABEL = 'Week of Mar 23 – Mar 29, 2026';

// March 2026 week: Sun Mar 22 -> Sat Mar 28 (real 2026 calendar weekdays)
export const DEMO_WEEK_DAYS: DemoDayPill[] = [
  { key: 'sun-22', weekday: 'Sun', dayNumber: '22' },
  { key: 'mon-23', weekday: 'Mon', dayNumber: '23' },
  { key: 'tue-24', weekday: 'Tue', dayNumber: '24' },
  { key: 'wed-25', weekday: 'Wed', dayNumber: '25' },
  { key: 'thu-26', weekday: 'Thu', dayNumber: '26' },
  { key: 'fri-27', weekday: 'Fri', dayNumber: '27' },
  { key: 'sat-28', weekday: 'Sat', dayNumber: '28' },
];

// 7 days ending on Today (Tue Mar 24, 2026): Mar 18 W -> Mar 24 T
export const DEMO_SEVEN_DAY_HABIT_RATES = [
  { day: '18W', percent: 100 },
  { day: '19T', percent: 100 },
  { day: '20F', percent: 100 },
  { day: '21S', percent: 82 },
  { day: '22S', percent: 100 },
  { day: '23M', percent: 64 },
  { day: '24T', percent: 50 },
];

export const INITIAL_DEMO_TASKS: DemoTask[] = [
  {
    id: 'task-1',
    title: 'Morning stand-up & scope review',
    category: 'Work',
    priority: 'High',
    bucket: 'today',
    completed: true,
    dueLabel: 'Mar 24 · 09:00',
    durationLabel: '30m',
  },
  {
    id: 'task-2',
    title: 'English conversation practice',
    category: 'Study',
    priority: 'Medium',
    bucket: 'today',
    completed: false,
    dueLabel: 'Mar 24 · 12:00',
    durationLabel: '45m',
  },
  {
    id: 'task-3',
    title: '45-minute strength & mobility session',
    category: 'Health',
    priority: 'High',
    bucket: 'today',
    completed: true,
    dueLabel: 'Mar 24 · 07:30',
    durationLabel: '45m',
  },
  {
    id: 'task-4',
    title: 'Prepare product roadmap brief for Q2',
    category: 'Work',
    priority: 'Urgent',
    bucket: 'today',
    completed: false,
    dueLabel: 'Mar 24 · 16:00',
    subtaskProgress: '2/4 subtasks',
  },
  {
    id: 'task-5',
    title: 'Refine onboarding flow personas',
    category: 'Work',
    priority: 'Medium',
    bucket: 'today',
    completed: false,
    dueLabel: 'Mar 24',
  },
  {
    id: 'task-6',
    title: 'Read systems architecture chapter',
    category: 'Study',
    priority: 'Low',
    bucket: 'today',
    completed: false,
    dueLabel: 'Mar 24 · Evening',
  },
  {
    id: 'task-7',
    title: 'Call Mom & confirm Sunday dinner',
    category: 'Family',
    priority: 'Medium',
    bucket: 'today',
    completed: false,
    dueLabel: 'Mar 24 · 19:30',
  },
  {
    id: 'task-8',
    title: 'Morning stand-up & sprint check-in',
    category: 'Work',
    priority: 'Medium',
    bucket: 'tomorrow',
    completed: false,
    dueLabel: 'Mar 25 · 09:00',
  },
  {
    id: 'task-9',
    title: 'Zone 2 cardio & core recovery',
    category: 'Health',
    priority: 'Medium',
    bucket: 'tomorrow',
    completed: false,
    dueLabel: 'Mar 25 · 07:30',
  },
  {
    id: 'task-10',
    title: 'Reschedule client architecture sync',
    category: 'Work',
    priority: 'High',
    bucket: 'tomorrow',
    completed: false,
    dueLabel: 'Mar 25 · 11:00',
  },
  {
    id: 'task-11',
    title: 'Pick up groceries for family dinner',
    category: 'Family',
    priority: 'Low',
    bucket: 'tomorrow',
    completed: false,
    dueLabel: 'Mar 25 · 18:00',
  },
  {
    id: 'task-12',
    title: 'Add upcoming birthdays to calendar',
    category: 'Family',
    priority: 'Low',
    bucket: 'tomorrow',
    completed: false,
    dueLabel: 'Mar 25',
  },
];

export const INITIAL_DEMO_HABITS: DemoHabit[] = [
  {
    id: 'hab-1',
    name: 'Sleep 8 hours',
    scheduleLabel: 'Every day',
    targetLabel: '8h target',
    completedToday: true,
    streakDays: 14,
    category: 'Recovery',
  },
  {
    id: 'hab-2',
    name: 'Morning hydration',
    scheduleLabel: 'Every day',
    targetLabel: '2.0 L',
    completedToday: true,
    streakDays: 9,
    category: 'Health',
  },
  {
    id: 'hab-3',
    name: 'Mindful meditation',
    scheduleLabel: 'Mon – Sat',
    targetLabel: '15 min',
    completedToday: false,
    streakDays: 7,
    category: 'Clarity',
  },
  {
    id: 'hab-4',
    name: 'Deep reading',
    scheduleLabel: '5x / week',
    targetLabel: '30 min',
    completedToday: false,
    streakDays: 5,
    category: 'Learning',
  },
];

export const DEMO_SCHEDULE_BLOCKS: DemoScheduleBlock[] = [
  {
    id: 'blk-1',
    dayKey: 'tue-24',
    period: 'Morning',
    time: '09:00',
    title: 'Stand-up & IA review',
    category: 'Work',
    featured: true,
    completed: true,
    notes: ['Review IA hierarchy', 'Introduce Q2 milestone plan', 'Confirm design scope'],
  },
  {
    id: 'blk-2',
    dayKey: 'tue-24',
    period: 'Morning',
    time: '09:30',
    title: 'Engineering architecture sync',
    category: 'Work',
  },
  {
    id: 'blk-3',
    dayKey: 'tue-24',
    period: 'Noon',
    time: '12:00',
    title: 'English lesson & speaking practice',
    category: 'Study',
  },
  {
    id: 'blk-4',
    dayKey: 'tue-24',
    period: 'Evening',
    time: '20:00',
    title: 'Finish dashboard wireframes',
    category: 'Work',
  },
  {
    id: 'blk-5',
    dayKey: 'tue-24',
    period: 'Evening',
    time: '21:00',
    title: 'Evening mobility & wind-down',
    category: 'Health',
    completed: true,
    notes: ['15 min stretching', 'Prepare hydration for tomorrow'],
  },
  {
    id: 'blk-6',
    dayKey: 'wed-25',
    period: 'Morning',
    time: '08:30',
    title: 'Deep work: Backend API specification',
    category: 'Work',
    featured: true,
    notes: ['Draft Drizzle entity schema', 'Define Zod request validation'],
  },
  {
    id: 'blk-7',
    dayKey: 'wed-25',
    period: 'Noon',
    time: '13:00',
    title: 'Strength training — Upper push/pull',
    category: 'Health',
  },
  {
    id: 'blk-8',
    dayKey: 'wed-25',
    period: 'Evening',
    time: '19:00',
    title: 'Weekly meal prep & reading',
    category: 'Family',
  },
];

export const DEMO_ACTIVE_GOALS: DemoGoalPreview[] = [
  {
    id: 'goal-1',
    title: 'Ship full-stack Marly v1 foundation',
    targetDate: 'Target · Q2 2026',
    completedMilestones: 2,
    totalMilestones: 4,
    progressPercent: 52,
  },
  {
    id: 'goal-2',
    title: 'Run 10 km under 50 minutes',
    targetDate: 'Target · May 2026',
    completedMilestones: 3,
    totalMilestones: 5,
    progressPercent: 68,
  },
];

function buildCalendarDays(states: HabitCalendarDayState[]): DemoCalendarDay[] {
  return states.map((state, idx) => {
    const day = idx + 1;
    if (state === 'completed') {
      return {
        day,
        state,
        completedCount: 6,
        scheduledCount: 6,
        summary: 'All 6 scheduled habits completed',
      };
    }
    if (state === 'partial') {
      const completed = (day % 3) + 3;
      return {
        day,
        state,
        completedCount: completed,
        scheduledCount: 6,
        summary: `${completed} of 6 scheduled habits completed`,
      };
    }
    if (state === 'missed') {
      return {
        day,
        state,
        completedCount: 1,
        scheduledCount: 6,
        summary: 'Missed core scheduled habits (1 of 6 completed)',
      };
    }
    if (state === 'unscheduled') {
      return {
        day,
        state,
        completedCount: 0,
        scheduledCount: 0,
        summary: 'Rest day · No habits scheduled',
      };
    }
    return {
      day,
      state: 'future',
      completedCount: 0,
      scheduledCount: 6,
      summary: 'Upcoming scheduled day',
    };
  });
}

// February 2026: 28 days, starts Sunday (0)
const FEB_2026_STATES: HabitCalendarDayState[] = [
  'completed', 'partial', 'completed', 'completed', 'partial', 'completed', 'unscheduled',
  'completed', 'completed', 'partial', 'missed', 'partial', 'completed', 'unscheduled',
  'partial', 'completed', 'completed', 'completed', 'partial', 'completed', 'unscheduled',
  'completed', 'partial', 'missed', 'completed', 'completed', 'partial', 'completed',
];

// March 2026: 31 days, starts Sunday (0), Today = Mar 24
const MAR_2026_STATES: HabitCalendarDayState[] = [
  'partial', 'partial', 'partial', 'partial', 'partial', 'partial', 'partial',
  'partial', 'partial', 'completed', 'completed', 'completed', 'completed', 'completed',
  'partial', 'completed', 'completed', 'missed', 'partial', 'completed', 'completed',
  'partial', 'partial', 'partial', 'future', 'future', 'unscheduled', 'unscheduled',
  'future', 'future', 'future',
];

// April 2026: 30 days, starts Wednesday (3)
const APR_2026_STATES: HabitCalendarDayState[] = Array.from({ length: 30 }, (_, idx) => {
  const weekday = (3 + idx) % 7;
  return weekday === 0 ? 'unscheduled' : 'future';
});

export const DEMO_MONTHLY_CALENDARS: DemoCalendarMonth[] = [
  {
    id: '2026-02',
    label: 'February 2026',
    shortMonth: 'Feb',
    year: 2026,
    startWeekday: 0, // Sun
    streakDays: 5,
    longestStreakDays: 11,
    monthlyRateLabel: '68%',
    days: buildCalendarDays(FEB_2026_STATES),
  },
  {
    id: '2026-03',
    label: 'March 2026',
    shortMonth: 'Mar',
    year: 2026,
    startWeekday: 0, // Sun
    streakDays: 7,
    longestStreakDays: 14,
    monthlyRateLabel: '72%',
    days: buildCalendarDays(MAR_2026_STATES),
  },
  {
    id: '2026-04',
    label: 'April 2026',
    shortMonth: 'Apr',
    year: 2026,
    startWeekday: 3, // Wed
    streakDays: 0,
    longestStreakDays: 14,
    monthlyRateLabel: '—',
    days: buildCalendarDays(APR_2026_STATES),
  },
];

// Reference 4 inspired Weekly Habit Matrix data (Mar 23 - Mar 29, 2026)
export const INITIAL_DEMO_MATRIX_HABITS: DemoMatrixHabit[] = [
  {
    id: 'mx-1',
    name: 'Sleep 8hrs',
    targetLabel: '8h / night',
    days: [true, true, true, true, true, true, true],
  },
  {
    id: 'mx-2',
    name: 'Healthy breakfast',
    targetLabel: 'Daily',
    days: [true, false, true, true, false, false, true],
  },
  {
    id: 'mx-3',
    name: 'Meditate',
    targetLabel: '15 min',
    days: [true, false, true, true, true, false, true],
  },
  {
    id: 'mx-4',
    name: 'Journal',
    targetLabel: 'Evening',
    days: [true, true, true, true, true, true, false],
  },
  {
    id: 'mx-5',
    name: 'Exercise',
    targetLabel: '45 min',
    days: [true, true, true, true, false, true, true],
  },
  {
    id: 'mx-6',
    name: 'Hydrate 2L',
    targetLabel: '2,000 ml',
    days: [true, true, true, true, false, true, true],
  },
];

export const MATRIX_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Reference 3 inspired 52-week x 7-day deterministic Activity Heatmap
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildDemoHeatmap(): DemoHeatmapCell[] {
  const cells: DemoHeatmapCell[] = [];
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      // Treat Sundays (day === 6 in Mon-Sun grid) on select weeks as explicit rest/unscheduled days
      const isRestSunday = day === 6 && week % 2 === 1;
      const monthName = MONTHS[Math.min(11, Math.floor((week / 52) * 12))];

      if (isRestSunday) {
        cells.push({
          dateLabel: `${monthName} · W${week + 1} D${day + 1}`,
          weekIndex: week,
          dayIndex: day,
          kind: 'unscheduled',
          level: 0,
          completionPercent: 0,
          summary: 'Rest day · No habits scheduled',
        });
        continue;
      }

      const seed = (week * 13 + day * 7 + (week % 5) * 3) % 19;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (week >= 42 && week <= 45 && day >= 2) {
        level = seed % 4 === 0 ? 1 : 0;
      } else if (seed > 15) {
        level = 4;
      } else if (seed > 11) {
        level = 3;
      } else if (seed > 7) {
        level = 2;
      } else if (seed > 4) {
        level = 1;
      }

      const completionPercent = level === 0 ? 0 : level * 25;
      cells.push({
        dateLabel: `${monthName} · W${week + 1} D${day + 1}`,
        weekIndex: week,
        dayIndex: day,
        kind: 'active',
        level,
        completionPercent,
        summary:
          level === 0
            ? '0% of scheduled habits completed (missed)'
            : `${completionPercent}% scheduled habit consistency`,
      });
    }
  }
  return cells;
}

export const DEMO_HEATMAP_CELLS = buildDemoHeatmap();

export const DEMO_HEATMAP_STATS = {
  totalCompletions: 110,
  activeDays: 108,
  scheduledDays: 263,
  completionRate: 41,
  currentStreak: 9,
  peakDayName: 'Tuesday',
};

export const DEMO_HEATMAP_MONTHLY_TREND = [
  { month: 'Jan', value: 14 },
  { month: 'Feb', value: 16 },
  { month: 'Mar', value: 12 },
  { month: 'Apr', value: 15 },
  { month: 'May', value: 11 },
  { month: 'Jun', value: 13 },
  { month: 'Jul', value: 7 },
  { month: 'Aug', value: 8 },
  { month: 'Sep', value: 9 },
  { month: 'Oct', value: 9 },
  { month: 'Nov', value: 10 },
  { month: 'Dec', value: 10 },
];

export const DEMO_WEEKDAY_FREQUENCY = [
  { day: 'Mon', count: 18 },
  { day: 'Tue', count: 24 },
  { day: 'Wed', count: 21 },
  { day: 'Thu', count: 16 },
  { day: 'Fri', count: 19 },
  { day: 'Sat', count: 6 },
  { day: 'Sun', count: 6 },
];

export const DEMO_PLAN_PROJECTS: DemoProjectPreview[] = [
  {
    id: 'proj-1',
    name: 'Marly Core Foundation',
    status: 'Active',
    targetDate: 'Apr 2026',
    completedTasks: 6,
    totalTasks: 10,
    goalName: 'Ship full-stack Marly v1 foundation',
  },
  {
    id: 'proj-2',
    name: '10K Spring Conditioning',
    status: 'Active',
    targetDate: 'May 2026',
    completedTasks: 8,
    totalTasks: 12,
    goalName: 'Run 10 km under 50 minutes',
  },
  {
    id: 'proj-3',
    name: 'TypeScript & SQL Architecture Study',
    status: 'Planned',
    targetDate: 'Jun 2026',
    completedTasks: 2,
    totalTasks: 8,
    goalName: 'Ship full-stack Marly v1 foundation',
  },
];

export const DEMO_WORKOUTS_PREVIEW: DemoWorkoutPreview[] = [
  { id: 'wo-1', name: 'Upper Body Push / Pull', type: 'Strength', duration: '45 min', when: 'Mon, Mar 23 · 07:30' },
  { id: 'wo-2', name: 'Zone 2 Tempo Run (6.5 km)', type: 'Cardio', duration: '38 min', when: 'Sat, Mar 21 · 08:15' },
  { id: 'wo-3', name: 'Mobility & Core Reset', type: 'Recovery', duration: '25 min', when: 'Thu, Mar 19 · 19:30' },
];

export const DEMO_ROUTINES_PREVIEW: DemoRoutinePreview[] = [
  {
    id: 'rt-1',
    name: 'Calm Morning Anchor',
    schedule: 'Daily · 07:00',
    steps: ['Hydrate 500 ml before coffee', '15 min breathing & meditation', 'Review Today top 3 tasks'],
  },
  {
    id: 'rt-2',
    name: 'Evening Shutdown',
    schedule: 'Weekdays · 21:30',
    steps: ['Log final habit check-ins', 'Verify tomorrow schedule blocks', 'Dim screens 30 min before sleep'],
  },
];

export const DEMO_STATISTICS_SUMMARY: DemoStatisticsSummary = {
  tasksCompletedThisWeek: 18,
  tasksPlannedThisWeek: 24,
  habitAdherencePercent: 72,
  milestonesCompleted: 5,
  milestonesTotal: 9,
  rhythmBreakdown: [
    { label: 'Work & Deep Focus Tasks', value: 78, tone: 'coral' },
    { label: 'Daily Core Habits', value: 84, tone: 'mint' },
    { label: 'Fitness & Recovery Sessions', value: 67, tone: 'orange' },
    { label: 'Active Goal Milestones', value: 56, tone: 'blue' },
  ],
};
