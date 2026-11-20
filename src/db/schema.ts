import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export type TaskStatusValue = 'todo' | 'in_progress' | 'completed';
export type TaskPriorityValue = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategoryValue = 'Work' | 'Health' | 'Family' | 'Study' | 'Personal';
export type CalendarEventCategoryValue = TaskCategoryValue;
export type GoalStatusValue = 'planned' | 'active' | 'completed' | 'paused' | 'archived';
export type ProjectStatusValue = 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';
export type HabitStatusValue = 'active' | 'archived';
export type HabitTrackingTypeValue = 'boolean' | 'measurable';
export type HabitFrequencyTypeValue = 'daily' | 'weekdays' | 'times_per_week';
export type HabitLogStatusSnapshotValue = 'completed' | 'partial';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  timezone: text('timezone'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const goals = pgTable(
  'goals',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<GoalStatusValue>().notNull().default('active'),
    category: text('category').$type<TaskCategoryValue>().notNull().default('Work'),
    // Date-only target deadline (YYYY-MM-DD)
    targetDate: text('target_date'),
    // Optional measurable target fields (e.g., 12 of 24 books)
    targetMetricLabel: text('target_metric_label'),
    targetValue: doublePrecision('target_value'),
    currentValue: doublePrecision('current_value'),
    unit: text('unit'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('goals_user_id_idx').on(table.userId)]
);

export const goalMilestones = pgTable(
  'goal_milestones',
  {
    id: serial('id').primaryKey(),
    goalId: integer('goal_id')
      .references(() => goals.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    targetDate: text('target_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('goal_milestones_goal_id_idx').on(table.goalId, table.sortOrder),
    index('goal_milestones_user_id_idx').on(table.userId),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').$type<ProjectStatusValue>().notNull().default('active'),
    priority: text('priority').$type<TaskPriorityValue>().notNull().default('medium'),
    category: text('category').$type<TaskCategoryValue>().notNull().default('Work'),
    // Date-only planning bounds (YYYY-MM-DD)
    startDate: text('start_date'),
    targetDate: text('target_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('projects_user_id_idx').on(table.userId),
    index('projects_goal_id_idx').on(table.goalId),
  ]
);

export const projectMilestones = pgTable(
  'project_milestones',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: text('due_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_milestones_project_id_idx').on(table.projectId, table.sortOrder),
    index('project_milestones_user_id_idx').on(table.userId),
  ]
);

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<TaskStatusValue>().notNull().default('todo'),
    priority: text('priority').$type<TaskPriorityValue>().notNull().default('medium'),
    category: text('category').$type<TaskCategoryValue>().notNull().default('Work'),
    // Date-only deadline (YYYY-MM-DD), distinct from scheduled calendar time blocks
    dueDate: text('due_date'),
    // Foundational nullable columns for time estimation and linking
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    estimatedMinutes: integer('estimated_minutes'),
    // Nullable links preserving tasks when a parent project or goal is deleted
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_goal_id_idx').on(table.goalId),
  ]
);

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').$type<CalendarEventCategoryValue>().notNull().default('Work'),
    allDay: boolean('all_day').notNull().default(false),
    // Date-only YYYY-MM-DD bounds for all-day events (prevents UTC day-shift bugs)
    startDate: text('start_date'),
    endDate: text('end_date'),
    // Timezone-aware timestamps for timed events
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    // Optional link reserved for future task time-blocking without duplicating tasks
    taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('calendar_events_user_id_idx').on(table.userId)]
);

export const habits = pgTable(
  'habits',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').$type<TaskCategoryValue>().notNull().default('Health'),
    trackingType: text('tracking_type')
      .$type<HabitTrackingTypeValue>()
      .notNull()
      .default('boolean'),
    targetValue: doublePrecision('target_value'),
    unit: text('unit'),
    status: text('status').$type<HabitStatusValue>().notNull().default('active'),
    goalId: integer('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('habits_user_id_idx').on(table.userId),
    index('habits_goal_id_idx').on(table.goalId),
  ]
);

export const habitSchedules = pgTable(
  'habit_schedules',
  {
    id: serial('id').primaryKey(),
    habitId: integer('habit_id')
      .references(() => habits.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    frequencyType: text('frequency_type')
      .$type<HabitFrequencyTypeValue>()
      .notNull()
      .default('daily'),
    // 7-bit weekday bitmask (bit 0 = Sunday .. bit 6 = Saturday; 127 = all days)
    weekdaysMask: integer('weekdays_mask').notNull().default(127),
    // Required (1..7) when frequencyType === 'times_per_week'; null otherwise
    targetPerWeek: integer('target_per_week'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('habit_schedules_user_id_idx').on(table.userId)]
);

export const habitLogs = pgTable(
  'habit_logs',
  {
    id: serial('id').primaryKey(),
    habitId: integer('habit_id')
      .references(() => habits.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    // Explicit user-local calendar date (YYYY-MM-DD)
    localDate: text('local_date').notNull(),
    completedValue: doublePrecision('completed_value').notNull().default(1),
    // Target preserved at the time the log was recorded
    targetSnapshot: doublePrecision('target_snapshot'),
    statusSnapshot: text('status_snapshot')
      .$type<HabitLogStatusSnapshotValue>()
      .notNull()
      .default('completed'),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('habit_logs_habit_local_date_uidx').on(table.habitId, table.localDate),
    index('habit_logs_user_local_date_idx').on(table.userId, table.localDate),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  calendarEvents: many(calendarEvents),
  projects: many(projects),
  goals: many(goals),
  habits: many(habits),
  habitSchedules: many(habitSchedules),
  habitLogs: many(habitLogs),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  owner: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  milestones: many(goalMilestones),
  projects: many(projects),
  tasks: many(tasks),
  habits: many(habits),
}));

export const goalMilestonesRelations = relations(goalMilestones, ({ one }) => ({
  goal: one(goals, {
    fields: [goalMilestones.goalId],
    references: [goals.id],
  }),
  owner: one(users, {
    fields: [goalMilestones.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [projects.goalId],
    references: [goals.id],
  }),
  milestones: many(projectMilestones),
  tasks: many(tasks),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [projectMilestones.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  owner: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  goal: one(goals, {
    fields: [tasks.goalId],
    references: [goals.id],
  }),
  calendarEvents: many(calendarEvents),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  owner: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  owner: one(users, {
    fields: [habits.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [habits.goalId],
    references: [goals.id],
  }),
  schedule: one(habitSchedules, {
    fields: [habits.id],
    references: [habitSchedules.habitId],
  }),
  logs: many(habitLogs),
}));

export const habitSchedulesRelations = relations(habitSchedules, ({ one }) => ({
  habit: one(habits, {
    fields: [habitSchedules.habitId],
    references: [habits.id],
  }),
  owner: one(users, {
    fields: [habitSchedules.userId],
    references: [users.id],
  }),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, {
    fields: [habitLogs.habitId],
    references: [habits.id],
  }),
  owner: one(users, {
    fields: [habitLogs.userId],
    references: [users.id],
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type GoalRecord = typeof goals.$inferSelect;
export type GoalMilestoneRecord = typeof goalMilestones.$inferSelect;
export type ProjectRecord = typeof projects.$inferSelect;
export type ProjectMilestoneRecord = typeof projectMilestones.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
export type CalendarEventRecord = typeof calendarEvents.$inferSelect;
export type HabitRecord = typeof habits.$inferSelect;
export type HabitScheduleRecord = typeof habitSchedules.$inferSelect;
export type HabitLogRecord = typeof habitLogs.$inferSelect;
