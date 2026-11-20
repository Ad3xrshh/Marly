import React, { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import {
  PROJECT_STATUS_OPTIONS,
  type ProjectStatus,
} from '../../types/projectGoal';
import {
  TASK_CATEGORY_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  type TaskCategory,
  type TaskPriority,
} from '../../types/task';

export function ProjectFormDialog() {
  const {
    goals,
    projectDialogState,
    closeProjectDialog,
    createProject,
    updateProject,
    deleteProject,
    isMutating,
  } = useProjectsGoalsContext();

  const { open, mode, project, defaultGoalId } = projectDialogState;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [goalId, setGoalId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStatus(project.status);
      setPriority(project.priority);
      setCategory(project.category);
      setGoalId(project.goalId ? String(project.goalId) : '');
      setStartDate(project.startDate ?? '');
      setTargetDate(project.targetDate ?? '');
    } else {
      setName('');
      setDescription('');
      setStatus('active');
      setPriority('medium');
      setCategory('Work');
      setGoalId(defaultGoalId ? String(defaultGoalId) : '');
      setStartDate('');
      setTargetDate('');
    }
  }, [open, mode, project, defaultGoalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Project name is required');
      return;
    }

    const cleanStart = startDate.trim() ? startDate.trim() : null;
    const cleanTarget = targetDate.trim() ? targetDate.trim() : null;
    if (cleanStart && cleanTarget && cleanTarget < cleanStart) {
      setFormError('Target date cannot be earlier than start date');
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      status,
      priority,
      category,
      goalId: goalId ? Number(goalId) : null,
      startDate: cleanStart,
      targetDate: cleanTarget,
    };

    if (mode === 'edit' && project) {
      const updated = await updateProject(project.id, payload);
      if (updated) closeProjectDialog();
    } else {
      const created = await createProject(payload);
      if (created) closeProjectDialog();
    }
  };

  const handleToggleArchive = async () => {
    if (!project) return;
    const nextStatus: ProjectStatus = project.status === 'archived' ? 'active' : 'archived';
    const updated = await updateProject(project.id, { status: nextStatus });
    if (updated) closeProjectDialog();
  };

  const handleDelete = async () => {
    if (!project) return;
    const deleted = await deleteProject(project.id);
    if (deleted) closeProjectDialog();
  };

  const availableGoals = goals.filter(
    (g) => g.status !== 'archived' || (project && project.goalId === g.id)
  );

  return (
    <Dialog
      open={open}
      onClose={closeProjectDialog}
      title={mode === 'edit' ? 'Edit Project' : 'New Project'}
      subtitle={
        mode === 'edit'
          ? 'Update project details, timeline, goal link, or archive status.'
          : 'Group milestones and tasks under a focused project.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          placeholder="e.g. Marly Mobile Companion"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (formError) setFormError(null);
          }}
          onClear={() => setName('')}
          error={formError ?? undefined}
          maxLength={160}
          autoFocus
        />

        <div>
          <label
            htmlFor="project-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description
          </label>
          <textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Scope, key deliverables, or success criteria..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="project-status"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Status
            </label>
            <select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-priority"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Priority
            </label>
            <select
              id="project-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {TASK_PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-category"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Category
            </label>
            <select
              id="project-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {TASK_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-goal"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Linked Goal
            </label>
            <select
              id="project-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              <option value="">No linked goal</option>
              {availableGoals.map((goal) => (
                <option key={goal.id} value={String(goal.id)}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-start-date"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Start Date
            </label>
            <div className="flex items-center gap-2">
              <input
                id="project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
              />
              {startDate && (
                <button
                  type="button"
                  onClick={() => setStartDate('')}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="project-target-date"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Target Date
            </label>
            <div className="flex items-center gap-2">
              <input
                id="project-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
              />
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate('')}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'edit' && project && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leadingIcon={
                    project.status === 'archived' ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )
                  }
                  disabled={isMutating}
                  onClick={handleToggleArchive}
                >
                  {project.status === 'archived' ? 'Restore' : 'Archive'}
                </Button>

                {confirmingDelete ? (
                  <div className="flex items-center gap-1.5">
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
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={closeProjectDialog}
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
                  : 'Create Project'}
            </Button>
          </div>
        </div>
        {mode === 'edit' && confirmingDelete && (
          <p className="text-[11px] text-[#A3A3A8]">
            Deleting this project removes its project milestones, while any linked tasks stay in your task list.
          </p>
        )}
      </form>
    </Dialog>
  );
}
