import type { RoutineScheduleType, RoutineTimeOfDay, WorkoutActivityType } from './fitnessRoutines';
import type { HabitFrequencyType, HabitTrackingType } from './habit';
import type { TaskCategory, TaskPriority, TaskStatus } from './task';

export type ThinkContextSource = 'general' | 'home' | 'plan' | 'live' | 'statistics';
export type ThinkMessageRole = 'user' | 'assistant';
export type ThinkActionStatus = 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ThinkActionType =
  | 'create_task'
  | 'update_task'
  | 'create_calendar_event'
  | 'create_project_milestone'
  | 'create_goal_milestone'
  | 'create_habit'
  | 'create_routine'
  | 'create_workout';

export interface CreateTaskActionPayload {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string | null;
  projectId: number | null;
  goalId: number | null;
}

export interface UpdateTaskActionPayload {
  taskId: number;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  dueDate?: string | null;
  projectId?: number | null;
  goalId?: number | null;
}

export interface CreateCalendarEventActionPayload {
  title: string;
  description: string | null;
  category: TaskCategory;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAt: string | null;
  endAt: string | null;
}

export interface CreateProjectMilestoneActionPayload {
  projectId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
}

export interface CreateGoalMilestoneActionPayload {
  goalId: number;
  title: string;
  targetDate: string | null;
}

export interface CreateHabitActionPayload {
  name: string;
  description: string | null;
  category: TaskCategory;
  trackingType: HabitTrackingType;
  targetValue: number | null;
  unit: string | null;
  goalId: number | null;
  schedule: {
    frequencyType: HabitFrequencyType;
    weekdays?: number[];
    targetPerWeek?: number | null;
  };
}

export interface CreateRoutineStepActionPayload {
  title: string;
  durationMinutes: number | null;
}

export interface CreateRoutineActionPayload {
  name: string;
  description: string | null;
  timeOfDay: RoutineTimeOfDay;
  preferredTime: string | null;
  scheduleType: RoutineScheduleType;
  weekdays?: number[];
  steps: CreateRoutineStepActionPayload[];
}

export interface CreateWorkoutActionPayload {
  title: string;
  activityType: WorkoutActivityType;
  localDate: string;
  startTime: string | null;
  durationMinutes: number;
  notes: string | null;
}

export type ThinkActionPayloadByType = {
  create_task: CreateTaskActionPayload;
  update_task: UpdateTaskActionPayload;
  create_calendar_event: CreateCalendarEventActionPayload;
  create_project_milestone: CreateProjectMilestoneActionPayload;
  create_goal_milestone: CreateGoalMilestoneActionPayload;
  create_habit: CreateHabitActionPayload;
  create_routine: CreateRoutineActionPayload;
  create_workout: CreateWorkoutActionPayload;
};

export type ThinkActionPayload = ThinkActionPayloadByType[ThinkActionType];

export interface ThinkActionExecutionResult {
  entityType:
    | 'task'
    | 'calendar_event'
    | 'project_milestone'
    | 'goal_milestone'
    | 'habit'
    | 'routine'
    | 'workout';
  entityId: number;
  parentId?: number | null;
  label: string;
  targetRoute: string;
}

export interface ThinkActionRecordDTO {
  id: number;
  conversationId: number;
  messageId: number;
  actionType: ThinkActionType;
  status: ThinkActionStatus;
  summary: string;
  rationale: string | null;
  payload: Record<string, unknown>;
  editedPayload: Record<string, unknown> | null;
  effectivePayload: Record<string, unknown>;
  executionResult: ThinkActionExecutionResult | null;
  errorMessage: string | null;
  executedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ThinkEntityReferenceType =
  | 'task'
  | 'calendar_event'
  | 'project'
  | 'goal'
  | 'habit'
  | 'routine'
  | 'workout';

export type ThinkEvidenceSourceDomain = 'plan' | 'live' | 'statistics';

export interface ThinkMessageReferenceDTO {
  entityType: ThinkEntityReferenceType;
  entityId: number;
  label: string;
  detail: string | null;
  targetRoute: string;
}

export interface ThinkMessageEvidenceDTO {
  claim: string;
  sourceDomain: ThinkEvidenceSourceDomain;
  entityType?: ThinkEntityReferenceType;
  entityId?: number;
}

export interface ThinkMessageContextMetaDTO {
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

export interface ThinkMessageMetaDTO {
  highlights?: string[];
  followUpSuggestions?: string[];
  mode?: 'foundation' | 'actions' | 'context_grounded';
  references?: ThinkMessageReferenceDTO[];
  evidence?: ThinkMessageEvidenceDTO[];
  context?: ThinkMessageContextMetaDTO;
  insufficientContext?: boolean;
  uncertaintyNote?: string | null;
}

export interface ThinkQuotaStatus {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  windowHours: number;
  resetsAt: string | null;
}

export interface ThinkConversationSummary {
  id: number;
  title: string;
  contextSource: ThinkContextSource;
  messageCount: number;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThinkMessageDTO {
  id: number;
  conversationId: number;
  role: ThinkMessageRole;
  content: string;
  meta: ThinkMessageMetaDTO | null;
  actions?: ThinkActionRecordDTO[];
  createdAt: string;
}

export interface ThinkConversationDetail {
  conversation: ThinkConversationSummary;
  messages: ThinkMessageDTO[];
}

export interface ThinkSendMessageResult {
  conversation: ThinkConversationSummary;
  userMessage: ThinkMessageDTO;
  assistantMessage: ThinkMessageDTO;
  quota: ThinkQuotaStatus;
}

export interface ThinkActionApproveResult {
  action: ThinkActionRecordDTO;
}

export interface ThinkActionRejectResult {
  action: ThinkActionRecordDTO;
}
