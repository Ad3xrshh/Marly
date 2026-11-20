import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import { GOAL_STATUS_OPTIONS, type GoalStatus } from '../../types/projectGoal';
import { TASK_CATEGORY_OPTIONS, type TaskCategory } from '../../types/task';

export function GoalFormDialog() {
  const {
    goalDialogState,
    closeGoalDialog,
    createGoal,
    updateGoal,
    deleteGoal,
    isMutating,
  } = useProjectsGoalsContext();

  const { open, mode, goal } = goalDialogState;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<GoalStatus>('active');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [targetDate, setTargetDate] = useState('');
  const [targetMetricLabel, setTargetMetricLabel] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && goal) {
      setTitle(goal.title);
      setDescription(goal.description ?? '');
      setStatus(goal.status);
      setCategory(goal.category);
      setTargetDate(goal.targetDate ?? '');
      setTargetMetricLabel(goal.targetMetricLabel ?? '');
      setCurrentValue(goal.currentValue !== null ? String(goal.currentValue) : '');
      setTargetValue(goal.targetValue !== null ? String(goal.targetValue) : '');
      setUnit(goal.unit ?? '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('active');
      setCategory('Work');
      setTargetDate('');
      setTargetMetricLabel('');
      setCurrentValue('');
      setTargetValue('');
      setUnit('');
    }
  }, [open, mode, goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Goal title is required');
      return;
    }

    const parsedTarget = targetValue.trim() ? Number(targetValue.trim()) : null;
    const parsedCurrent = currentValue.trim() ? Number(currentValue.trim()) : null;

    if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget <= 0)) {
      setFormError('Target value must be a number greater than zero');
      return;
    }
    if (parsedCurrent !== null && (!Number.isFinite(parsedCurrent) || parsedCurrent < 0)) {
      setFormError('Current value must be zero or greater');
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      status,
      category,
      targetDate: targetDate.trim() ? targetDate.trim() : null,
      targetMetricLabel: targetMetricLabel.trim() ? targetMetricLabel.trim() : null,
      targetValue: parsedTarget,
      currentValue: parsedCurrent,
      unit: unit.trim() ? unit.trim() : null,
    };

    if (mode === 'edit' && goal) {
      const updated = await updateGoal(goal.id, payload);
      if (updated) closeGoalDialog();
    } else {
      const created = await createGoal(payload);
      if (created) closeGoalDialog();
    }
  };

  const handleDelete = async () => {
    if (!goal) return;
    const deleted = await deleteGoal(goal.id);
    if (deleted) closeGoalDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeGoalDialog}
      title={mode === 'edit' ? 'Edit Goal' : 'New Goal'}
      subtitle={
        mode === 'edit'
          ? 'Refine your goal intention, measurable target, or status.'
          : 'Define a meaningful outcome with milestones, linked projects, or a measurable target.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Goal Title"
          placeholder="e.g. Run a half-marathon under 2 hours"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (formError) setFormError(null);
          }}
          onClear={() => setTitle('')}
          error={formError ?? undefined}
          maxLength={160}
          autoFocus
        />

        <div>
          <label
            htmlFor="goal-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description
          </label>
          <textarea
            id="goal-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Why this goal matters and what completion looks like..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="goal-status"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Status
            </label>
            <select
              id="goal-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as GoalStatus)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
            >
              {GOAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="goal-category"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Category
            </label>
            <select
              id="goal-category"
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
              htmlFor="goal-target-date"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Target Date
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="goal-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-2.5 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70"
              />
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate('')}
                  className="shrink-0 rounded-lg px-1.5 py-2 text-xs text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Optional Measurable Target */}
        <div className="rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5 space-y-3">
          <p className="text-xs font-medium text-[#F2F2F2]">
            Optional Measurable Target
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Metric Label"
              placeholder="e.g. Books read"
              value={targetMetricLabel}
              onChange={(e) => setTargetMetricLabel(e.target.value)}
              maxLength={80}
            />
            <Input
              label="Unit"
              placeholder="e.g. books, km, hrs"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={24}
            />
            <Input
              label="Current Value"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 6"
              value={currentValue}
              onChange={(e) => {
                setCurrentValue(e.target.value);
                if (formError) setFormError(null);
              }}
            />
            <Input
              label="Target Value"
              type="number"
              min="0.01"
              step="any"
              placeholder="e.g. 24"
              value={targetValue}
              onChange={(e) => {
                setTargetValue(e.target.value);
                if (formError) setFormError(null);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' && goal && (
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
              onClick={closeGoalDialog}
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
                  : 'Create Goal'}
            </Button>
          </div>
        </div>
        {mode === 'edit' && confirmingDelete && (
          <p className="text-[11px] text-[#A3A3A8]">
            Deleting this goal removes its goal milestones, while linked projects and tasks are preserved and unlinked.
          </p>
        )}
      </form>
    </Dialog>
  );
}
