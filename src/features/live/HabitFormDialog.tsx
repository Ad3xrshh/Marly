import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useHabitsContext } from '../../context/HabitsContext';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import { cn } from '../../lib/cn';
import {
  WEEKDAY_MONDAY_FIRST_ORDER,
  WEEKDAY_SHORT_LABELS,
} from '../../lib/habitSchedule';
import type {
  HabitFrequencyType,
  HabitTrackingType,
} from '../../types/habit';
import { TASK_CATEGORY_OPTIONS, type TaskCategory } from '../../types/task';

export function HabitFormDialog() {
  const {
    dialogState,
    closeHabitDialog,
    createHabit,
    updateHabit,
    deleteHabit,
    isMutating,
  } = useHabitsContext();
  const { goals } = useProjectsGoalsContext();

  const { open, mode, habit } = dialogState;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Health');
  const [trackingType, setTrackingType] = useState<HabitTrackingType>('boolean');
  const [targetValue, setTargetValue] = useState('2');
  const [unit, setUnit] = useState('');
  const [goalId, setGoalId] = useState('');
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetPerWeek, setTargetPerWeek] = useState('3');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && habit) {
      setName(habit.name);
      setDescription(habit.description ?? '');
      setCategory(habit.category);
      setTrackingType(habit.trackingType);
      setTargetValue(habit.targetValue !== null ? String(habit.targetValue) : '2');
      setUnit(habit.unit ?? '');
      setGoalId(habit.goalId ? String(habit.goalId) : '');
      setFrequencyType(habit.schedule.frequencyType);
      setWeekdays(
        habit.schedule.frequencyType === 'weekdays' && habit.schedule.weekdays.length > 0
          ? habit.schedule.weekdays
          : [1, 2, 3, 4, 5]
      );
      setTargetPerWeek(String(habit.schedule.targetPerWeek ?? 3));
    } else {
      setName('');
      setDescription('');
      setCategory('Health');
      setTrackingType('boolean');
      setTargetValue('2');
      setUnit('');
      setGoalId('');
      setFrequencyType('daily');
      setWeekdays([1, 2, 3, 4, 5]);
      setTargetPerWeek('3');
    }
  }, [open, mode, habit]);

  const toggleWeekday = (day: number) => {
    setFormError(null);
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Habit name is required.');
      return;
    }

    let parsedTarget: number | null = null;
    if (trackingType === 'measurable') {
      const numeric = Number(targetValue);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setFormError('Measurable habits require a target greater than 0.');
        return;
      }
      parsedTarget = numeric;
    }

    if (frequencyType === 'weekdays' && weekdays.length === 0) {
      setFormError('Select at least one weekday for your schedule.');
      return;
    }

    const parsedWeeklyTarget = Number(targetPerWeek);
    if (
      frequencyType === 'times_per_week' &&
      (!Number.isInteger(parsedWeeklyTarget) || parsedWeeklyTarget < 1 || parsedWeeklyTarget > 7)
    ) {
      setFormError('Weekly target must be a whole number between 1 and 7.');
      return;
    }

    const schedule =
      frequencyType === 'daily'
        ? { frequencyType: 'daily' as const }
        : frequencyType === 'weekdays'
          ? { frequencyType: 'weekdays' as const, weekdays }
          : {
              frequencyType: 'times_per_week' as const,
              targetPerWeek: parsedWeeklyTarget,
            };

    const payload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      category,
      trackingType,
      targetValue: trackingType === 'measurable' ? parsedTarget : null,
      unit: trackingType === 'measurable' && unit.trim() ? unit.trim() : null,
      goalId: goalId ? Number(goalId) : null,
      schedule,
    };

    if (mode === 'edit' && habit) {
      const updated = await updateHabit(habit.id, payload);
      if (updated) closeHabitDialog();
    } else {
      const created = await createHabit(payload);
      if (created) closeHabitDialog();
    }
  };

  const handleDelete = async () => {
    if (!habit) return;
    const deleted = await deleteHabit(habit.id);
    if (deleted) closeHabitDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeHabitDialog}
      title={mode === 'edit' ? 'Edit Habit' : 'New Habit'}
      subtitle={
        mode === 'edit'
          ? 'Update habit targets or schedule. Past historical logs remain preserved.'
          : 'Define a daily, weekday, or flexible weekly habit.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Habit Name"
          placeholder="e.g. Morning Walk, Hydrate, Deep Reading"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (formError) setFormError(null);
          }}
          onClear={() => setName('')}
          maxLength={120}
          autoFocus
        />

        <div>
          <label
            htmlFor="habit-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description
          </label>
          <textarea
            id="habit-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Optional cue, anchor routine, or intention..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="habit-category"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Category
            </label>
            <select
              id="habit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
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
              htmlFor="habit-goal"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Linked Goal (optional)
            </label>
            <select
              id="habit-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            >
              <option value="">No linked goal</option>
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

        {/* Tracking Mode */}
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#F2F2F2]">Tracking Mode</span>
            <div className="inline-flex rounded-lg bg-[#262626] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setTrackingType('boolean');
                  setFormError(null);
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  trackingType === 'boolean'
                    ? 'bg-[#96D2C5] text-[#151515]'
                    : 'text-[#A3A3A8] hover:text-[#F2F2F2]'
                )}
              >
                Check-off
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackingType('measurable');
                  setFormError(null);
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  trackingType === 'measurable'
                    ? 'bg-[#96D2C5] text-[#151515]'
                    : 'text-[#A3A3A8] hover:text-[#F2F2F2]'
                )}
              >
                Measurable
              </button>
            </div>
          </div>

          {trackingType === 'measurable' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Daily Target"
                type="number"
                min="0.1"
                step="any"
                value={targetValue}
                onChange={(e) => {
                  setTargetValue(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. 2"
              />
              <Input
                label="Unit (optional)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. L, min, pages"
                maxLength={24}
              />
            </div>
          ) : (
            <p className="text-xs text-[#A3A3A8]">
              Binary check-off: completed or not completed each scheduled day.
            </p>
          )}
        </div>

        {/* Schedule Configuration */}
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#F2F2F2]">Schedule</span>
            <div className="inline-flex rounded-lg bg-[#262626] p-0.5">
              {(
                [
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekdays', label: 'Weekdays' },
                  { value: 'times_per_week', label: 'Weekly Target' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFrequencyType(option.value);
                    setFormError(null);
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                    frequencyType === option.value
                      ? 'bg-[#96D2C5] text-[#151515]'
                      : 'text-[#A3A3A8] hover:text-[#F2F2F2]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {frequencyType === 'daily' && (
            <p className="text-xs text-[#A3A3A8]">
              Scheduled every day of the week. Daily streaks count consecutive days completed.
            </p>
          )}

          {frequencyType === 'weekdays' && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_MONDAY_FIRST_ORDER.map((dayIndex) => {
                  const selected = weekdays.includes(dayIndex);
                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      onClick={() => toggleWeekday(dayIndex)}
                      aria-pressed={selected}
                      className={cn(
                        'h-9 rounded-lg border text-xs font-medium transition-colors cursor-pointer',
                        selected
                          ? 'border-[#96D2C5] bg-[#96D2C5] text-[#151515] font-semibold'
                          : 'border-white/[0.08] bg-[#262626] text-[#A3A3A8] hover:text-[#F2F2F2]'
                      )}
                    >
                      {WEEKDAY_SHORT_LABELS[dayIndex]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#737378]">
                Unscheduled rest days never break your weekday streak.
              </p>
            </div>
          )}

          {frequencyType === 'times_per_week' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="habit-weekly-target"
                  className="text-xs font-medium text-[#A3A3A8]"
                >
                  Completions per Monday–Sunday week
                </label>
                <select
                  id="habit-weekly-target"
                  value={targetPerWeek}
                  onChange={(e) => setTargetPerWeek(e.target.value)}
                  className="h-9 rounded-lg border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                    <option key={count} value={String(count)}>
                      {count}x / week
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[#737378]">
                Flexible across any days of the week; tracks consecutive qualifying weeks.
              </p>
            </div>
          )}
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-[#E06C75]">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' &&
              habit &&
              (confirmingDelete ? (
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
              ))}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={closeHabitDialog}
            >
              Cancel
            </Button>
            <Button type="submit" variant="mint" size="sm" disabled={isMutating}>
              {isMutating
                ? mode === 'edit'
                  ? 'Saving...'
                  : 'Creating...'
                : mode === 'edit'
                  ? 'Save Changes'
                  : 'Create Habit'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
