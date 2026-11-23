import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
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

export type WorkoutActivityTypeValue =
  | 'Strength'
  | 'Cardio'
  | 'Mobility'
  | 'Recovery'
  | 'Sport'
  | 'Other';
export type RoutineTimeOfDayValue = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';
export type RoutineScheduleTypeValue = 'daily' | 'weekdays' | 'as_needed';
export type RoutineStatusValue = 'active' | 'archived';
export type RoutineLogStatusValue = 'in_progress' | 'completed';

export interface RoutineStepSnapshotItem {
  stepId: number;
  title: string;
  durationMinutes: number | null;
}

export type ThinkContextSourceValue = 'general' | 'home' | 'plan' | 'live' | 'statistics';
export type ThinkMessageRoleValue = 'user' | 'assistant';
export type ThinkActionStatusValue = 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ThinkActionTypeValue =
  | 'create_task'
  | 'update_task'
  | 'create_calendar_event'
  | 'create_project_milestone'
  | 'create_goal_milestone'
  | 'create_habit'
  | 'create_routine'
  | 'create_workout';

export type ThinkEntityReferenceTypeValue =
  | 'task'
  | 'calendar_event'
  | 'project'
  | 'goal'
  | 'habit'
  | 'routine'
  | 'workout';

export type ThinkEvidenceSourceDomainValue = 'plan' | 'live' | 'statistics';

export interface ThinkMessageReferenceRecord {
  entityType: ThinkEntityReferenceTypeValue;
  entityId: number;
  label: string;
  detail: string | null;
  targetRoute: string;
}

export interface ThinkMessageEvidenceRecord {
  claim: string;
  sourceDomain: ThinkEvidenceSourceDomainValue;
  entityType?: ThinkEntityReferenceTypeValue;
  entityId?: number;
}

export interface ThinkMessageContextMetaRecord {
  intentCategory: string;
  selectedDomains: string[];
  domainsConsulted: string[];
  statsPreset?: string | null;
  windowLabel: string;
  timezone: string;
  timezoneInitialized: boolean;
  todayLocalDate: string;
  truncatedDomains: string[];
  degraded: boolean;
  degradedDomains: string[];
  retrievedAt: string;
}

export interface ThinkMessageMeta {
  highlights?: string[];
  followUpSuggestions?: string[];
  mode?: 'foundation' | 'actions' | 'context_grounded';
  references?: ThinkMessageReferenceRecord[];
  evidence?: ThinkMessageEvidenceRecord[];
  context?: ThinkMessageContextMetaRecord;
  insufficientContext?: boolean;
  uncertaintyNote?: string | null;
}

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

export const workoutSessions = pgTable(
  'workout_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    activityType: text('activity_type')
      .$type<WorkoutActivityTypeValue>()
      .notNull()
      .default('Strength'),
    // Explicit user-local calendar date (YYYY-MM-DD)
    localDate: text('local_date').notNull(),
    // Optional 24h local time string (HH:mm)
    startTime: text('start_time'),
    durationMinutes: integer('duration_minutes').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('workout_sessions_user_date_idx').on(table.userId, table.localDate),
    index('workout_sessions_user_type_idx').on(table.userId, table.activityType),
  ]
);

export const routines = pgTable(
  'routines',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    timeOfDay: text('time_of_day')
      .$type<RoutineTimeOfDayValue>()
      .notNull()
      .default('Anytime'),
    preferredTime: text('preferred_time'),
    scheduleType: text('schedule_type')
      .$type<RoutineScheduleTypeValue>()
      .notNull()
      .default('daily'),
    weekdaysMask: integer('weekdays_mask').notNull().default(127),
    status: text('status').$type<RoutineStatusValue>().notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('routines_user_id_idx').on(table.userId)]
);

export const routineSteps = pgTable(
  'routine_steps',
  {
    id: serial('id').primaryKey(),
    routineId: integer('routine_id')
      .references(() => routines.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    durationMinutes: integer('duration_minutes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('routine_steps_routine_order_idx').on(table.routineId, table.sortOrder, table.id),
    index('routine_steps_user_id_idx').on(table.userId),
  ]
);

export const routineLogs = pgTable(
  'routine_logs',
  {
    id: serial('id').primaryKey(),
    routineId: integer('routine_id')
      .references(() => routines.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    localDate: text('local_date').notNull(),
    completedStepIds: jsonb('completed_step_ids')
      .$type<number[]>()
      .notNull()
      .default([]),
    // Lightweight historical snapshots preserved even if routine steps are later renamed, reordered, or deleted
    stepsSnapshot: jsonb('steps_snapshot')
      .$type<RoutineStepSnapshotItem[]>()
      .notNull()
      .default([]),
    completedStepsSnapshot: jsonb('completed_steps_snapshot')
      .$type<RoutineStepSnapshotItem[]>()
      .notNull()
      .default([]),
    completedStepsCount: integer('completed_steps_count').notNull().default(0),
    totalStepsSnapshot: integer('total_steps_snapshot').notNull().default(0),
    status: text('status')
      .$type<RoutineLogStatusValue>()
      .notNull()
      .default('in_progress'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('routine_logs_routine_local_date_uidx').on(table.routineId, table.localDate),
    index('routine_logs_user_local_date_idx').on(table.userId, table.localDate),
  ]
);

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull().default('New thread'),
    contextSource: text('context_source')
      .$type<ThinkContextSourceValue>()
      .notNull()
      .default('general'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('ai_conversations_user_updated_idx').on(table.userId, table.updatedAt)]
);

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => aiConversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').$type<ThinkMessageRoleValue>().notNull(),
    content: text('content').notNull(),
    responseMeta: jsonb('response_meta').$type<ThinkMessageMeta | null>(),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_messages_conv_created_idx').on(table.conversationId, table.createdAt, table.id),
    index('ai_messages_user_role_created_idx').on(table.userId, table.role, table.createdAt),
  ]
);

// Phase 10B approval-gated action records
export const aiActionRecords = pgTable(
  'ai_action_records',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => aiConversations.id, { onDelete: 'cascade' })
      .notNull(),
    messageId: integer('message_id')
      .references(() => aiMessages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    actionType: text('action_type').$type<ThinkActionTypeValue>().notNull(),
    status: text('status')
      .$type<ThinkActionStatusValue>()
      .notNull()
      .default('proposed'),
    summary: text('summary').notNull(),
    rationale: text('rationale'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    editedPayload: jsonb('edited_payload').$type<Record<string, unknown> | null>(),
    executionResult: jsonb('execution_result').$type<Record<string, unknown> | null>(),
    errorMessage: text('error_message'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_action_records_conv_created_idx').on(table.conversationId, table.createdAt, table.id),
    index('ai_action_records_msg_idx').on(table.messageId),
    index('ai_action_records_user_status_idx').on(table.userId, table.status),
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
  workoutSessions: many(workoutSessions),
  routines: many(routines),
  routineSteps: many(routineSteps),
  routineLogs: many(routineLogs),
  aiConversations: many(aiConversations),
  aiMessages: many(aiMessages),
  aiActionRecords: many(aiActionRecords),
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

export const workoutSessionsRelations = relations(workoutSessions, ({ one }) => ({
  owner: one(users, {
    fields: [workoutSessions.userId],
    references: [users.id],
  }),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  owner: one(users, {
    fields: [routines.userId],
    references: [users.id],
  }),
  steps: many(routineSteps),
  logs: many(routineLogs),
}));

export const routineStepsRelations = relations(routineSteps, ({ one }) => ({
  routine: one(routines, {
    fields: [routineSteps.routineId],
    references: [routines.id],
  }),
  owner: one(users, {
    fields: [routineSteps.userId],
    references: [users.id],
  }),
}));

export const routineLogsRelations = relations(routineLogs, ({ one }) => ({
  routine: one(routines, {
    fields: [routineLogs.routineId],
    references: [routines.id],
  }),
  owner: one(users, {
    fields: [routineLogs.userId],
    references: [users.id],
  }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  owner: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
  messages: many(aiMessages),
  actions: many(aiActionRecords),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one, many }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
  owner: one(users, {
    fields: [aiMessages.userId],
    references: [users.id],
  }),
  actions: many(aiActionRecords),
}));

export const aiActionRecordsRelations = relations(aiActionRecords, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiActionRecords.conversationId],
    references: [aiConversations.id],
  }),
  message: one(aiMessages, {
    fields: [aiActionRecords.messageId],
    references: [aiMessages.id],
  }),
  owner: one(users, {
    fields: [aiActionRecords.userId],
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
export type WorkoutSessionRecord = typeof workoutSessions.$inferSelect;
export type RoutineRecord = typeof routines.$inferSelect;
export type RoutineStepRecord = typeof routineSteps.$inferSelect;
export type RoutineLogRecord = typeof routineLogs.$inferSelect;
export type AiConversationRecord = typeof aiConversations.$inferSelect;
export type AiMessageRecord = typeof aiMessages.$inferSelect;
export type AiActionRecordRow = typeof aiActionRecords.$inferSelect;
