import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import { useTasksContext } from '../../context/TasksContext';
import {
  TASK_CATEGORY_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '../../types/task';

export function TaskFormDialog() {
  const {
    dialogState,
    closeTaskDialog,
    createTask,
    updateTask,
    deleteTask,
    isMutating,
  } = useTasksContext();
  const { projects, goals } = useProjectsGoalsContext();

  const { open, mode, task, defaultDueDate, defaultProjectId, defaultGoalId } = dialogState;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitleError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setCategory(task.category);
      setStatus(task.status);
      setDueDate(task.dueDate ?? '');
      setProjectId(task.projectId ? String(task.projectId) : '');
      setGoalId(task.goalId ? String(task.goalId) : '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('Work');
      setStatus('todo');
      setDueDate(defaultDueDate ?? '');
      setProjectId(defaultProjectId ? String(defaultProjectId) : '');
      setGoalId(defaultGoalId ? String(defaultGoalId) : '');
    }
  }, [open, mode, task, defaultDueDate, defaultProjectId, defaultGoalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Task title is required');
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      priority,
      category,
      status,
      dueDate: dueDate.trim() ? dueDate.trim() : null,
      projectId: projectId ? Number(projectId) : null,
      goalId: goalId ? Number(goalId) : null,
    };

    if (mode === 'edit' && task) {
      const updated = await updateTask(task.id, payload);
      if (updated) closeTaskDialog();
    } else {
      const created = await createTask(payload);
      if (created) closeTaskDialog();
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    const deleted = await deleteTask(task.id);
    if (deleted) closeTaskDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeTaskDialog}
      title={mode === 'edit' ? 'Edit Task' : 'New Task'}
      subtitle={
        mode === 'edit'
          ? 'Update task details, status, priority, or deadline.'
          : 'Add a task to your Marly workspace.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g. Finalize Q2 product roadmap"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(null);
          }}
          onClear={() => setTitle('')}
          error={titleError ?? undefined}
          maxLength={160}
          autoFocus
        />

        <div>
          <label
            htmlFor="task-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description
          </label>
          <textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Optional notes, context, or definition of done..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="task-category"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Category
            </label>
            <select
              id="task-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {TASK_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-priority"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-status"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {TASK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-due-date"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Due Date
            </label>
            <div className="flex items-center gap-2">
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="task-project"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Project
            </label>
            <select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              <option value="">No project</option>
              {projects
                .filter((p) => p.status !== 'archived' || String(p.id) === projectId)
                .map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-goal"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Goal
            </label>
            <select
              id="task-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              <option value="">No goal</option>
              {goals
                .filter((g) => g.status !== 'archived' || String(g.id) === goalId)
                .map((goal) => (
                  <option key={goal.id} value={String(goal.id)}>
                    {goal.title}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' && task && (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={handleDelete}
                    className="bg-[#E06C75]/15 text-[#E06C75] hover:bg-[#E06C75]/25 hover:text-[#E06C75]"
                  >
                    Confirm delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={isMutating}
                  onClick={() => setConfirmingDelete(true)}
                  className="text-[#E06C75] hover:bg-[#E06C75]/10 hover:text-[#E06C75]"
                >
                  Delete
                </Button>
              )
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={closeTaskDialog}
            >
              Cancel
            </Button>
            <Button type="submit" variant="coral" size="sm" disabled={isMutating}>
              {isMutating
                ? mode === 'edit'
                  ? 'Saving...'
                  : 'Creating...'
                : mode === 'edit'
                  ? 'Save Changes'
                  : 'Create Task'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
