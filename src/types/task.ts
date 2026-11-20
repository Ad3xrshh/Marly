export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'Work' | 'Health' | 'Family' | 'Study' | 'Personal';

export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const TASK_CATEGORY_OPTIONS: TaskCategory[] = [
  'Work',
  'Health',
  'Family',
  'Study',
  'Personal',
];

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string | null;
  scheduledStart: string | null;
  estimatedMinutes: number | null;
  projectId: number | null;
  goalId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  dueDate?: string | null;
  projectId?: number | null;
  goalId?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  dueDate?: string | null;
  projectId?: number | null;
  goalId?: number | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  projectId?: number;
  goalId?: number;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLocalDate(): string {
  return toLocalDateString(new Date());
}

export function getTomorrowLocalDate(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return toLocalDateString(next);
}

export function formatShortLocalDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const local = new Date(year, month - 1, day);
  return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTaskDueLabel(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  const today = getTodayLocalDate();
  const tomorrow = getTomorrowLocalDate();
  if (dueDate === today) return 'Today';
  if (dueDate === tomorrow) return 'Tomorrow';
  return formatShortLocalDate(dueDate);
}

export function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'completed') return false;
  return task.dueDate < getTodayLocalDate();
}

export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'urgent':
      return 'Urgent';
  }
}

export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return 'To Do';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
  }
}
