import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useFitnessRoutinesContext } from '../../context/FitnessRoutinesContext';
import { cn } from '../../lib/cn';
import {
  WEEKDAY_MONDAY_FIRST_ORDER,
  WEEKDAY_SHORT_LABELS,
} from '../../lib/habitSchedule';
import {
  ROUTINE_TIME_OF_DAY_OPTIONS,
  type RoutineScheduleType,
  type RoutineTimeOfDay,
} from '../../types/fitnessRoutines';

interface DraftStep {
  key: string;
  title: string;
  durationMinutes: string;
}

export function RoutineFormDialog() {
  const {
    routineDialog,
    closeRoutineDialog,
    createRoutine,
    updateRoutine,
    archiveRoutine,
    deleteRoutine,
    isMutating,
  } = useFitnessRoutinesContext();

  const { open, mode, routine } = routineDialog;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<RoutineTimeOfDay>('Morning');
  const [preferredTime, setPreferredTime] = useState('');
  const [scheduleType, setScheduleType] = useState<RoutineScheduleType>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDuration, setNewStepDuration] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setConfirmingDelete(false);
    setNewStepTitle('');
    setNewStepDuration('');

    if (mode === 'edit' && routine) {
      setName(routine.name);
      setDescription(routine.description ?? '');
      setTimeOfDay(routine.timeOfDay);
      setPreferredTime(routine.preferredTime ?? '');
      setScheduleType(routine.scheduleType);
      setWeekdays(
        routine.scheduleType === 'weekdays' && routine.weekdays.length > 0
          ? routine.weekdays
          : [1, 2, 3, 4, 5]
      );
      setSteps([]);
    } else {
      setName('');
      setDescription('');
      setTimeOfDay('Morning');
      setPreferredTime('');
      setScheduleType('daily');
      setWeekdays([1, 2, 3, 4, 5]);
      setSteps([]);
    }
  }, [open, mode, routine]);

  const toggleWeekday = (day: number) => {
    setFormError(null);
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleAddDraftStep = () => {
    const trimmed = newStepTitle.trim();
    if (!trimmed) return;
    if (steps.length >= 50) {
      setFormError('Routines can contain up to 50 steps.');
      return;
    }
    if (newStepDuration.trim()) {
      const parsed = Number(newStepDuration);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) {
        setFormError('Step duration must be a whole number between 1 and 720 minutes.');
        return;
      }
    }
    setSteps((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: trimmed,
        durationMinutes: newStepDuration.trim(),
      },
    ]);
    setNewStepTitle('');
    setNewStepDuration('');
    setFormError(null);
  };

  const handleMoveDraftStep = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleRemoveDraftStep = (index: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Routine name is required.');
      return;
    }

    if (scheduleType === 'weekdays' && weekdays.length === 0) {
      setFormError('Select at least one weekday for a weekday schedule.');
      return;
    }

    if (mode === 'edit' && routine) {
      const updated = await updateRoutine(routine.id, {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        timeOfDay,
        preferredTime: preferredTime.trim() ? preferredTime.trim() : null,
        scheduleType,
        ...(scheduleType === 'weekdays' ? { weekdays } : {}),
      });
      if (updated) closeRoutineDialog();
      return;
    }

    const preparedSteps = steps.map((step) => ({
      title: step.title.trim(),
      durationMinutes: step.durationMinutes ? Number(step.durationMinutes) : null,
    }));

    // Include unsaved draft step if user typed one directly before clicking Create
    if (newStepTitle.trim()) {
      const trimmedDraft = newStepTitle.trim();
      let draftDuration: number | null = null;
      if (newStepDuration.trim()) {
        const parsed = Number(newStepDuration);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) {
          setFormError('Step duration must be a whole number between 1 and 720 minutes.');
          return;
        }
        draftDuration = parsed;
      }
      preparedSteps.push({ title: trimmedDraft, durationMinutes: draftDuration });
    }

    const created = await createRoutine({
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      timeOfDay,
      preferredTime: preferredTime.trim() ? preferredTime.trim() : null,
      scheduleType,
      ...(scheduleType === 'weekdays' ? { weekdays } : {}),
      steps: preparedSteps,
    });
    if (created) closeRoutineDialog();
  };

  const handleArchiveAlternative = async () => {
    if (!routine) return;
    const archived = await archiveRoutine(routine);
    if (archived) closeRoutineDialog();
  };

  const handlePermanentDelete = async () => {
    if (!routine) return;
    const deleted = await deleteRoutine(routine.id);
    if (deleted) closeRoutineDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeRoutineDialog}
      title={mode === 'edit' ? 'Edit Routine' : 'New Routine'}
      subtitle={
        mode === 'edit'
          ? 'Manage routine schedule, timing, or archive settings. Past execution logs remain intact.'
          : 'Build a repeatable sequence of steps for morning, evening, or recovery blocks.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <Input
          label="Routine Name"
          placeholder="e.g. Morning Mobility Reset, Post-Run Recovery"
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
            htmlFor="routine-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description (optional)
          </label>
          <textarea
            id="routine-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Optional intention, warm-up cue, or context..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="routine-time-of-day"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Time of Day
            </label>
            <select
              id="routine-time-of-day"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as RoutineTimeOfDay)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            >
              {ROUTINE_TIME_OF_DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="routine-preferred-time"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Preferred Time (optional)
            </label>
            <input
              id="routine-preferred-time"
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            />
          </div>
        </div>

        {/* Cadence */}
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#F2F2F2]">Cadence</span>
            <div className="inline-flex rounded-lg bg-[#262626] p-0.5">
              {(
                [
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekdays', label: 'Weekdays' },
                  { value: 'as_needed', label: 'As needed' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setScheduleType(option.value);
                    setFormError(null);
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                    scheduleType === option.value
                      ? 'bg-[#96D2C5] text-[#151515]'
                      : 'text-[#A3A3A8] hover:text-[#F2F2F2]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {scheduleType === 'daily' && (
            <p className="text-xs text-[#A3A3A8]">
              Appears as scheduled every day.
            </p>
          )}

          {scheduleType === 'weekdays' && (
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
                        ? 'border-[#96D2C5] bg-[#96D2C5] font-semibold text-[#151515]'
                        : 'border-white/[0.08] bg-[#262626] text-[#A3A3A8] hover:text-[#F2F2F2]'
                    )}
                  >
                    {WEEKDAY_SHORT_LABELS[dayIndex]}
                  </button>
                );
              })}
            </div>
          )}

          {scheduleType === 'as_needed' && (
            <p className="text-xs text-[#A3A3A8]">
              Available whenever you want to run it, without daily schedule pressure.
            </p>
          )}
        </div>

        {/* Ordered Steps Builder (Create mode) */}
        {mode === 'create' ? (
          <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#F2F2F2]">
                Routine Steps ({steps.length})
              </span>
              <span className="text-[11px] text-[#737378]">Optional during creation</span>
            </div>

            {steps.length > 0 && (
              <ol className="space-y-1.5">
                {steps.map((step, index) => (
                  <li
                    key={step.key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-[#262626] px-2.5 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[11px] text-[#737378]">
                        {index + 1}.
                      </span>
                      <span className="truncate text-[#F2F2F2]">{step.title}</span>
                      {step.durationMinutes && (
                        <span className="shrink-0 font-mono text-[11px] text-[#96D2C5]">
                          {step.durationMinutes}m
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveDraftStep(index, -1)}
                        aria-label={`Move ${step.title} up`}
                        className="rounded p-1 text-[#A3A3A8] hover:bg-white/[0.08] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === steps.length - 1}
                        onClick={() => handleMoveDraftStep(index, 1)}
                        aria-label={`Move ${step.title} down`}
                        className="rounded p-1 text-[#A3A3A8] hover:bg-white/[0.08] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftStep(index)}
                        aria-label={`Remove ${step.title}`}
                        className="rounded p-1 text-[#A3A3A8] hover:bg-[#E06C75]/15 hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Step title (e.g. Foam roll quads)"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftStep();
                  }
                }}
                maxLength={160}
                className="h-9 min-w-[180px] flex-1 rounded-lg border border-white/[0.08] bg-[#262626] px-3 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
              />
              <input
                type="number"
                min="1"
                max="720"
                placeholder="Min"
                value={newStepDuration}
                onChange={(e) => setNewStepDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftStep();
                  }
                }}
                className="h-9 w-20 rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 font-mono text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leadingIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={handleAddDraftStep}
              >
                Add Step
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.07] bg-[#1A1A1A] px-3.5 py-2.5 text-xs text-[#A3A3A8]">
            Add, rename, reorder, or remove steps directly from the routine card. Historical execution snapshots stay preserved as logged.
          </div>
        )}

        {formError && (
          <p role="alert" className="text-xs font-medium text-[#E06C75]">
            {formError}
          </p>
        )}

        {/* Permanent Deletion Warning Panel recommending Archive */}
        {mode === 'edit' && routine && confirmingDelete && (
          <div className="space-y-3 rounded-xl border border-[#E06C75]/35 bg-[#E06C75]/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E06C75]" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-[#F2F2F2]">
                  Permanently delete “{routine.name}”?
                </p>
                <p className="leading-relaxed text-[#A3A3A8]">
                  This will permanently remove its {routine.steps.length}{' '}
                  {routine.steps.length === 1 ? 'step' : 'steps'} and all{' '}
                  {routine.recentLogsCount}{' '}
                  {routine.recentLogsCount === 1 ? 'execution log' : 'execution logs'}.
                  {routine.status === 'active'
                    ? ' Archiving is recommended instead so your past execution history stays intact.'
                    : ' This action cannot be undone.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep Editing
              </Button>
              {routine.status === 'active' && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Archive className="h-3.5 w-3.5" />}
                  disabled={isMutating}
                  onClick={() => void handleArchiveAlternative()}
                >
                  Archive Instead (Recommended)
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isMutating}
                onClick={() => void handlePermanentDelete()}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' && routine && !confirmingDelete && (
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
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={closeRoutineDialog}
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
                  : 'Create Routine'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
