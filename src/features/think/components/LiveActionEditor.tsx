import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import {
  WEEKDAY_MONDAY_FIRST_ORDER,
  WEEKDAY_SHORT_LABELS,
} from '../../../lib/habitSchedule';
import {
  ROUTINE_TIME_OF_DAY_OPTIONS,
  WORKOUT_ACTIVITY_TYPES,
  type RoutineScheduleType,
} from '../../../types/fitnessRoutines';
import type { Goal } from '../../../types/projectGoal';
import { TASK_CATEGORY_OPTIONS } from '../../../types/task';
import type { ThinkActionType } from '../../../types/think';

const ROUTINE_SCHEDULE_TYPE_OPTIONS: Array<{ value: RoutineScheduleType; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'as_needed', label: 'As needed' },
];

interface LiveActionEditorProps {
  actionType: Extract<ThinkActionType, 'create_habit' | 'create_routine' | 'create_workout'>;
  draftPayload: Record<string, unknown>;
  onChange: (nextPayload: Record<string, unknown>) => void;
  goals: Goal[];
}

const SELECT_CLASS =
  'w-full rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 text-xs text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';
const DATE_CLASS =
  'w-full rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 font-mono text-xs text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';
const TEXTAREA_CLASS =
  'w-full resize-none rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';

export function LiveActionEditor({
  actionType,
  draftPayload,
  onChange,
  goals,
}: LiveActionEditorProps) {
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDuration, setNewStepDuration] = useState('');

  const updateField = (key: string, value: unknown) => {
    onChange({ ...draftPayload, [key]: value });
  };

  if (actionType === 'create_habit') {
    const trackingType =
      draftPayload.trackingType === 'measurable' ? 'measurable' : 'boolean';
    const rawSchedule =
      draftPayload.schedule &&
      typeof draftPayload.schedule === 'object' &&
      !Array.isArray(draftPayload.schedule)
        ? (draftPayload.schedule as Record<string, unknown>)
        : { frequencyType: 'daily' };
    const frequencyType =
      rawSchedule.frequencyType === 'weekdays' || rawSchedule.frequencyType === 'times_per_week'
        ? rawSchedule.frequencyType
        : 'daily';
    const weekdays = Array.isArray(rawSchedule.weekdays)
      ? rawSchedule.weekdays.filter((d): d is number => typeof d === 'number')
      : [1, 2, 3, 4, 5];
    const targetPerWeek =
      typeof rawSchedule.targetPerWeek === 'number' ? rawSchedule.targetPerWeek : 3;

    const updateSchedule = (nextSchedule: Record<string, unknown>) => {
      updateField('schedule', nextSchedule);
    };

    const toggleWeekday = (day: number) => {
      const next = weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : [...weekdays, day].sort((a, b) => a - b);
      updateSchedule({ frequencyType: 'weekdays', weekdays: next });
    };

    return (
      <div className="space-y-3">
        <Input
          label="Habit Name"
          value={typeof draftPayload.name === 'string' ? draftPayload.name : ''}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Habit name"
          maxLength={120}
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Category</label>
            <select
              value={typeof draftPayload.category === 'string' ? draftPayload.category : 'Health'}
              onChange={(e) => updateField('category', e.target.value)}
              className={SELECT_CLASS}
            >
              {TASK_CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Tracking Type
            </label>
            <select
              value={trackingType}
              onChange={(e) => {
                const nextType = e.target.value === 'measurable' ? 'measurable' : 'boolean';
                onChange({
                  ...draftPayload,
                  trackingType: nextType,
                  targetValue:
                    nextType === 'measurable'
                      ? typeof draftPayload.targetValue === 'number' &&
                        draftPayload.targetValue > 0
                        ? draftPayload.targetValue
                        : 1
                      : null,
                  unit:
                    nextType === 'measurable' && typeof draftPayload.unit === 'string'
                      ? draftPayload.unit
                      : null,
                });
              }}
              className={SELECT_CLASS}
            >
              <option value="boolean">Check-in (Done / Not Done)</option>
              <option value="measurable">Measurable Target</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Linked Goal (optional)
            </label>
            <select
              value={typeof draftPayload.goalId === 'number' ? String(draftPayload.goalId) : ''}
              onChange={(e) =>
                updateField('goalId', e.target.value ? Number(e.target.value) : null)
              }
              className={SELECT_CLASS}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {trackingType === 'measurable' && (
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Target Value"
              type="number"
              min="0.1"
              step="any"
              value={
                typeof draftPayload.targetValue === 'number'
                  ? String(draftPayload.targetValue)
                  : ''
              }
              onChange={(e) => {
                const num = Number(e.target.value);
                updateField('targetValue', e.target.value === '' ? null : num);
              }}
              placeholder="e.g. 2"
            />
            <Input
              label="Unit"
              value={typeof draftPayload.unit === 'string' ? draftPayload.unit : ''}
              onChange={(e) => updateField('unit', e.target.value.trim() ? e.target.value : null)}
              placeholder="e.g. L, pages, mins"
              maxLength={24}
            />
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#1E1E22] p-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                Cadence
              </label>
              <select
                value={frequencyType}
                onChange={(e) => {
                  const nextFreq = e.target.value;
                  if (nextFreq === 'weekdays') {
                    updateSchedule({
                      frequencyType: 'weekdays',
                      weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5],
                    });
                  } else if (nextFreq === 'times_per_week') {
                    updateSchedule({
                      frequencyType: 'times_per_week',
                      targetPerWeek,
                    });
                  } else {
                    updateSchedule({ frequencyType: 'daily' });
                  }
                }}
                className={SELECT_CLASS}
              >
                <option value="daily">Every Day</option>
                <option value="weekdays">Specific Weekdays</option>
                <option value="times_per_week">Times per Week</option>
              </select>
            </div>

            {frequencyType === 'times_per_week' && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                  Target Per Week (1–7)
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={targetPerWeek}
                  onChange={(e) => {
                    const num = Math.max(1, Math.min(7, Math.round(Number(e.target.value) || 1)));
                    updateSchedule({ frequencyType: 'times_per_week', targetPerWeek: num });
                  }}
                  className={DATE_CLASS}
                />
              </div>
            )}
          </div>

          {frequencyType === 'weekdays' && (
            <div>
              <div className="mb-1.5 text-[11px] text-[#A3A3A8]">Scheduled Weekdays</div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_MONDAY_FIRST_ORDER.map((day) => {
                  const selected = weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                        selected
                          ? 'border-[#33C4B8]/60 bg-[#33C4B8]/20 text-[#F2F2F2]'
                          : 'border-white/[0.1] bg-[#292929] text-[#A3A3A8] hover:text-[#F2F2F2]'
                      )}
                    >
                      {WEEKDAY_SHORT_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Description</label>
          <textarea
            rows={2}
            value={typeof draftPayload.description === 'string' ? draftPayload.description : ''}
            onChange={(e) =>
              updateField('description', e.target.value.trim() ? e.target.value : null)
            }
            placeholder="Optional habit cue or intention..."
            maxLength={1000}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    );
  }

  if (actionType === 'create_routine') {
    const scheduleType =
      draftPayload.scheduleType === 'weekdays' || draftPayload.scheduleType === 'as_needed'
        ? draftPayload.scheduleType
        : 'daily';
    const weekdays = Array.isArray(draftPayload.weekdays)
      ? draftPayload.weekdays.filter((d): d is number => typeof d === 'number')
      : [1, 2, 3, 4, 5];
    const steps: Array<{ title: string; durationMinutes: number | null }> = Array.isArray(
      draftPayload.steps
    )
      ? draftPayload.steps.map((item) => {
          const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            title: typeof obj.title === 'string' ? obj.title : '',
            durationMinutes:
              typeof obj.durationMinutes === 'number' ? obj.durationMinutes : null,
          };
        })
      : [];

    const toggleWeekday = (day: number) => {
      const next = weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : [...weekdays, day].sort((a, b) => a - b);
      updateField('weekdays', next);
    };

    const updateStepAt = (
      index: number,
      patch: Partial<{ title: string; durationMinutes: number | null }>
    ) => {
      const next = steps.map((s, idx) => (idx === index ? { ...s, ...patch } : s));
      updateField('steps', next);
    };

    const moveStep = (index: number, delta: -1 | 1) => {
      const target = index + delta;
      if (target < 0 || target >= steps.length) return;
      const next = [...steps];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      updateField('steps', next);
    };

    const removeStep = (index: number) => {
      updateField(
        'steps',
        steps.filter((_, idx) => idx !== index)
      );
    };

    const handleAddStep = () => {
      const trimmed = newStepTitle.trim();
      if (!trimmed || steps.length >= 50) return;
      const parsedDur = newStepDuration.trim() ? Number(newStepDuration.trim()) : null;
      const validDur =
        parsedDur !== null && Number.isInteger(parsedDur) && parsedDur >= 1 && parsedDur <= 720
          ? parsedDur
          : null;
      updateField('steps', [...steps, { title: trimmed, durationMinutes: validDur }]);
      setNewStepTitle('');
      setNewStepDuration('');
    };

    return (
      <div className="space-y-3">
        <Input
          label="Routine Name"
          value={typeof draftPayload.name === 'string' ? draftPayload.name : ''}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Routine name"
          maxLength={120}
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Time of Day
            </label>
            <select
              value={
                typeof draftPayload.timeOfDay === 'string'
                  ? draftPayload.timeOfDay
                  : 'Anytime'
              }
              onChange={(e) => updateField('timeOfDay', e.target.value)}
              className={SELECT_CLASS}
            >
              {ROUTINE_TIME_OF_DAY_OPTIONS.map((tod) => (
                <option key={tod} value={tod}>
                  {tod}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Preferred Time
            </label>
            <input
              type="time"
              value={typeof draftPayload.preferredTime === 'string' ? draftPayload.preferredTime : ''}
              onChange={(e) => updateField('preferredTime', e.target.value || null)}
              className={DATE_CLASS}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Cadence</label>
            <select
              value={scheduleType}
              onChange={(e) => {
                const nextType = e.target.value;
                onChange({
                  ...draftPayload,
                  scheduleType: nextType,
                  ...(nextType === 'weekdays'
                    ? { weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5] }
                    : {}),
                });
              }}
              className={SELECT_CLASS}
            >
              {ROUTINE_SCHEDULE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {scheduleType === 'weekdays' && (
          <div className="rounded-xl border border-white/[0.08] bg-[#1E1E22] p-3">
            <div className="mb-1.5 text-[11px] text-[#A3A3A8]">Scheduled Weekdays</div>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_MONDAY_FIRST_ORDER.map((day) => {
                const selected = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                      selected
                        ? 'border-[#33C4B8]/60 bg-[#33C4B8]/20 text-[#F2F2F2]'
                        : 'border-white/[0.1] bg-[#292929] text-[#A3A3A8] hover:text-[#F2F2F2]'
                    )}
                  >
                    {WEEKDAY_SHORT_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ordered routine steps */}
        <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#1E1E22] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#A3A3A8]">
              Ordered Steps ({steps.length})
            </span>
          </div>

          {steps.length > 0 && (
            <div className="space-y-1.5">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span className="w-5 shrink-0 text-center font-mono text-[11px] text-[#737378]">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStepAt(index, { title: e.target.value })}
                    placeholder="Step title"
                    maxLength={160}
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-[#292929] px-2.5 py-1.5 text-xs text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={step.durationMinutes ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      const num = val ? Math.round(Number(val)) : null;
                      updateStepAt(index, {
                        durationMinutes: num && num >= 1 ? num : null,
                      });
                    }}
                    placeholder="min"
                    aria-label={`Step ${index + 1} duration minutes`}
                    className="w-16 shrink-0 rounded-lg border border-white/[0.09] bg-[#292929] px-2 py-1.5 font-mono text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                    aria-label="Move step up"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                    aria-label="Move step down"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    aria-label="Remove step"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737378] hover:bg-[#E06C75]/15 hover:text-[#E06C75] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddStep();
                }
              }}
              placeholder="Add a step..."
              maxLength={160}
              className="min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-[#292929] px-2.5 py-1.5 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none"
            />
            <input
              type="number"
              min={1}
              max={720}
              value={newStepDuration}
              onChange={(e) => setNewStepDuration(e.target.value)}
              placeholder="min"
              className="w-16 shrink-0 rounded-lg border border-white/[0.09] bg-[#292929] px-2 py-1.5 font-mono text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leadingIcon={<Plus className="h-3 w-3" />}
              disabled={!newStepTitle.trim()}
              onClick={handleAddStep}
            >
              Add
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Description</label>
          <textarea
            rows={2}
            value={typeof draftPayload.description === 'string' ? draftPayload.description : ''}
            onChange={(e) =>
              updateField('description', e.target.value.trim() ? e.target.value : null)
            }
            placeholder="Optional routine purpose..."
            maxLength={1000}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        label="Workout Title"
        value={typeof draftPayload.title === 'string' ? draftPayload.title : ''}
        onChange={(e) => updateField('title', e.target.value)}
        placeholder="e.g. Morning Tempo Run"
        maxLength={120}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
            Activity Type
          </label>
          <select
            value={
              typeof draftPayload.activityType === 'string'
                ? draftPayload.activityType
                : 'Strength'
            }
            onChange={(e) => updateField('activityType', e.target.value)}
            className={SELECT_CLASS}
          >
            {WORKOUT_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Date</label>
          <input
            type="date"
            value={typeof draftPayload.localDate === 'string' ? draftPayload.localDate : ''}
            onChange={(e) => updateField('localDate', e.target.value)}
            className={DATE_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
            Start Time
          </label>
          <input
            type="time"
            value={typeof draftPayload.startTime === 'string' ? draftPayload.startTime : ''}
            onChange={(e) => updateField('startTime', e.target.value || null)}
            className={DATE_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
            Duration (min)
          </label>
          <input
            type="number"
            min={1}
            max={1440}
            value={
              typeof draftPayload.durationMinutes === 'number'
                ? String(draftPayload.durationMinutes)
                : ''
            }
            onChange={(e) => {
              const num = Math.round(Number(e.target.value));
              updateField('durationMinutes', e.target.value === '' ? 0 : num);
            }}
            className={DATE_CLASS}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Notes</label>
        <textarea
          rows={2}
          value={typeof draftPayload.notes === 'string' ? draftPayload.notes : ''}
          onChange={(e) => updateField('notes', e.target.value.trim() ? e.target.value : null)}
          placeholder="Optional sets, pace, intensity, or recovery notes..."
          maxLength={2000}
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
}
