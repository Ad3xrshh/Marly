import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Dialog, Input } from '../../components/ui';
import { useFitnessRoutinesContext } from '../../context/FitnessRoutinesContext';
import {
  WORKOUT_ACTIVITY_TYPES,
  type WorkoutActivityType,
} from '../../types/fitnessRoutines';

export function WorkoutFormDialog() {
  const {
    workoutDialog,
    closeWorkoutDialog,
    todayLocalDate,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    isMutating,
  } = useFitnessRoutinesContext();

  const { open, mode, workout } = workoutDialog;

  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<WorkoutActivityType>('Strength');
  const [localDate, setLocalDate] = useState(todayLocalDate);
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && workout) {
      setTitle(workout.title);
      setActivityType(workout.activityType);
      setLocalDate(workout.localDate);
      setStartTime(workout.startTime ?? '');
      setDurationMinutes(String(workout.durationMinutes));
      setNotes(workout.notes ?? '');
    } else {
      setTitle('');
      setActivityType('Strength');
      setLocalDate(todayLocalDate);
      setStartTime('');
      setDurationMinutes('45');
      setNotes('');
    }
  }, [open, mode, workout, todayLocalDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Workout title is required.');
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
      setFormError('Duration must be a whole number between 1 and 1440 minutes.');
      return;
    }

    if (!localDate) {
      setFormError('Workout date is required.');
      return;
    }

    const payload = {
      title: trimmedTitle,
      activityType,
      localDate,
      startTime: startTime.trim() ? startTime.trim() : null,
      durationMinutes: parsedDuration,
      notes: notes.trim() ? notes.trim() : null,
    };

    if (mode === 'edit' && workout) {
      const updated = await updateWorkout(workout.id, payload);
      if (updated) closeWorkoutDialog();
    } else {
      const created = await createWorkout(payload);
      if (created) closeWorkoutDialog();
    }
  };

  const handleDelete = async () => {
    if (!workout) return;
    const deleted = await deleteWorkout(workout.id);
    if (deleted) closeWorkoutDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeWorkoutDialog}
      title={mode === 'edit' ? 'Edit Workout Session' : 'Log Workout'}
      subtitle={
        mode === 'edit'
          ? 'Update session details, duration, date, or notes.'
          : 'Record a completed workout or movement session.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Session Title"
          placeholder="e.g. Upper Body Strength, Tempo Run, Mobility Flow"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (formError) setFormError(null);
          }}
          onClear={() => setTitle('')}
          maxLength={120}
          autoFocus
        />

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="workout-activity-type"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Activity Type
            </label>
            <select
              id="workout-activity-type"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as WorkoutActivityType)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            >
              {WORKOUT_ACTIVITY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Duration (minutes)"
            type="number"
            min="1"
            max="1440"
            step="1"
            value={durationMinutes}
            onChange={(e) => {
              setDurationMinutes(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="45"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="workout-local-date"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Date
            </label>
            <input
              id="workout-local-date"
              type="date"
              value={localDate}
              onChange={(e) => {
                setLocalDate(e.target.value);
                if (formError) setFormError(null);
              }}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            />
          </div>

          <div>
            <label
              htmlFor="workout-start-time"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Start Time (optional)
            </label>
            <input
              id="workout-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="workout-notes"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Notes (optional)
          </label>
          <textarea
            id="workout-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Key exercises, pace, how energy felt, or recovery observations..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#96D2C5]/70"
          />
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-[#E06C75]">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' &&
              workout &&
              (confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => void handleDelete()}
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
              onClick={closeWorkoutDialog}
            >
              Cancel
            </Button>
            <Button type="submit" variant="mint" size="sm" disabled={isMutating}>
              {isMutating
                ? mode === 'edit'
                  ? 'Saving...'
                  : 'Logging...'
                : mode === 'edit'
                  ? 'Save Changes'
                  : 'Log Workout'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
