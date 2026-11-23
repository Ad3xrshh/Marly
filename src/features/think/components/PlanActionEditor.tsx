import React from 'react';
import { Checkbox, Input } from '../../../components/ui';
import {
  combineLocalDateAndTimeToIso,
  toLocalTimeInputValue,
} from '../../../types/calendar';
import type { Goal, Project } from '../../../types/projectGoal';
import {
  TASK_CATEGORY_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  toLocalDateString,
  type Task,
} from '../../../types/task';
import type { ThinkActionType } from '../../../types/think';

export interface ThinkEntityOptions {
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
}

interface PlanActionEditorProps {
  actionType: Extract<
    ThinkActionType,
    | 'create_task'
    | 'update_task'
    | 'create_calendar_event'
    | 'create_project_milestone'
    | 'create_goal_milestone'
  >;
  draftPayload: Record<string, unknown>;
  onChange: (nextPayload: Record<string, unknown>) => void;
  entityOptions: ThinkEntityOptions;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 text-xs text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';
const DATE_CLASS =
  'w-full rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 font-mono text-xs text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';
const TEXTAREA_CLASS =
  'w-full resize-none rounded-xl border border-white/[0.1] bg-[#292929] px-3 py-2 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40';

function parseIsoParts(
  isoValue: unknown,
  fallbackDate: string,
  fallbackTime: string
): { date: string; time: string } {
  if (typeof isoValue === 'string' && isoValue.trim().length > 0) {
    const parsed = new Date(isoValue);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: toLocalDateString(parsed),
        time: toLocalTimeInputValue(parsed),
      };
    }
  }
  return { date: fallbackDate, time: fallbackTime };
}

export function PlanActionEditor({
  actionType,
  draftPayload,
  onChange,
  entityOptions,
}: PlanActionEditorProps) {
  const updateField = (key: string, value: unknown) => {
    onChange({ ...draftPayload, [key]: value });
  };

  if (actionType === 'create_task' || actionType === 'update_task') {
    const isUpdate = actionType === 'update_task';
    const targetTaskId =
      typeof draftPayload.taskId === 'number' ? draftPayload.taskId : null;
    const matchedTask = targetTaskId
      ? entityOptions.tasks.find((t) => t.id === targetTaskId)
      : undefined;

    const currentTitle =
      typeof draftPayload.title === 'string'
        ? draftPayload.title
        : isUpdate && matchedTask
          ? matchedTask.title
          : '';
    const currentDescription =
      typeof draftPayload.description === 'string'
        ? draftPayload.description
        : draftPayload.description === null
          ? ''
          : isUpdate && matchedTask?.description
            ? matchedTask.description
            : '';
    const currentStatus =
      typeof draftPayload.status === 'string'
        ? draftPayload.status
        : isUpdate && matchedTask
          ? matchedTask.status
          : 'todo';
    const currentPriority =
      typeof draftPayload.priority === 'string'
        ? draftPayload.priority
        : isUpdate && matchedTask
          ? matchedTask.priority
          : 'medium';
    const currentCategory =
      typeof draftPayload.category === 'string'
        ? draftPayload.category
        : isUpdate && matchedTask
          ? matchedTask.category
          : 'Work';
    const currentDueDate =
      typeof draftPayload.dueDate === 'string'
        ? draftPayload.dueDate
        : draftPayload.dueDate === null
          ? ''
          : isUpdate && matchedTask?.dueDate
            ? matchedTask.dueDate
            : '';
    const currentProjectId =
      draftPayload.projectId !== undefined
        ? draftPayload.projectId
        : isUpdate && matchedTask
          ? matchedTask.projectId
          : null;
    const currentGoalId =
      draftPayload.goalId !== undefined
        ? draftPayload.goalId
        : isUpdate && matchedTask
          ? matchedTask.goalId
          : null;

    return (
      <div className="space-y-3">
        {isUpdate && (
          <div className="rounded-lg border border-white/[0.08] bg-[#1E1E22] px-3 py-2 text-[11px] text-[#A3A3A8]">
            Updating task{' '}
            <span className="font-mono text-[#F2F2F2]">#{targetTaskId ?? '—'}</span>
            {matchedTask ? (
              <span className="text-[#D6D6DC]"> · {matchedTask.title}</span>
            ) : null}
          </div>
        )}

        <Input
          label="Title"
          value={currentTitle}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Task title"
          maxLength={160}
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Status</label>
            <select
              value={currentStatus}
              onChange={(e) => updateField('status', e.target.value)}
              className={SELECT_CLASS}
            >
              {TASK_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Priority</label>
            <select
              value={currentPriority}
              onChange={(e) => updateField('priority', e.target.value)}
              className={SELECT_CLASS}
            >
              {TASK_PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Category</label>
            <select
              value={currentCategory}
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
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Due Date</label>
            <input
              type="date"
              value={currentDueDate}
              onChange={(e) => updateField('dueDate', e.target.value ? e.target.value : null)}
              className={DATE_CLASS}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Project (optional)
            </label>
            <select
              value={typeof currentProjectId === 'number' ? String(currentProjectId) : ''}
              onChange={(e) =>
                updateField('projectId', e.target.value ? Number(e.target.value) : null)
              }
              className={SELECT_CLASS}
            >
              <option value="">No project</option>
              {entityOptions.projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
              Goal (optional)
            </label>
            <select
              value={typeof currentGoalId === 'number' ? String(currentGoalId) : ''}
              onChange={(e) =>
                updateField('goalId', e.target.value ? Number(e.target.value) : null)
              }
              className={SELECT_CLASS}
            >
              <option value="">No goal</option>
              {entityOptions.goals.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Description</label>
          <textarea
            rows={2}
            value={currentDescription}
            onChange={(e) =>
              updateField('description', e.target.value.trim() ? e.target.value : null)
            }
            placeholder="Optional notes or checklist context..."
            maxLength={2000}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    );
  }

  if (actionType === 'create_calendar_event') {
    const allDay = Boolean(draftPayload.allDay);
    const todayFallback = toLocalDateString(new Date());
    const startParts = parseIsoParts(draftPayload.startAt, todayFallback, '09:00');
    const endParts = parseIsoParts(draftPayload.endAt, startParts.date, '10:00');

    const handleToggleAllDay = (nextAllDay: boolean) => {
      if (nextAllDay) {
        const sDate =
          typeof draftPayload.startDate === 'string' && draftPayload.startDate
            ? draftPayload.startDate
            : startParts.date;
        const eDate =
          typeof draftPayload.endDate === 'string' && draftPayload.endDate
            ? draftPayload.endDate
            : sDate;
        onChange({
          ...draftPayload,
          allDay: true,
          startDate: sDate,
          endDate: eDate < sDate ? sDate : eDate,
          startAt: null,
          endAt: null,
        });
      } else {
        const baseDate =
          typeof draftPayload.startDate === 'string' && draftPayload.startDate
            ? draftPayload.startDate
            : startParts.date;
        onChange({
          ...draftPayload,
          allDay: false,
          startDate: null,
          endDate: null,
          startAt: combineLocalDateAndTimeToIso(baseDate, startParts.time || '09:00'),
          endAt: combineLocalDateAndTimeToIso(baseDate, endParts.time || '10:00'),
        });
      }
    };

    const handleTimedChange = (
      nextStartDate: string,
      nextStartTime: string,
      nextEndDate: string,
      nextEndTime: string
    ) => {
      const effectiveStartDate = nextStartDate || todayFallback;
      const effectiveEndDate = nextEndDate || effectiveStartDate;
      onChange({
        ...draftPayload,
        allDay: false,
        startDate: null,
        endDate: null,
        startAt: combineLocalDateAndTimeToIso(effectiveStartDate, nextStartTime || '09:00'),
        endAt: combineLocalDateAndTimeToIso(effectiveEndDate, nextEndTime || '10:00'),
      });
    };

    return (
      <div className="space-y-3">
        <Input
          label="Event Title"
          value={typeof draftPayload.title === 'string' ? draftPayload.title : ''}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Calendar event title"
          maxLength={160}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Category</label>
            <select
              value={typeof draftPayload.category === 'string' ? draftPayload.category : 'Work'}
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

          <div className="pt-4">
            <Checkbox
              checked={allDay}
              onChange={() => handleToggleAllDay(!allDay)}
              label="All-day event"
            />
          </div>
        </div>

        {allDay ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                Start Date
              </label>
              <input
                type="date"
                value={typeof draftPayload.startDate === 'string' ? draftPayload.startDate : ''}
                onChange={(e) => updateField('startDate', e.target.value || null)}
                className={DATE_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                End Date
              </label>
              <input
                type="date"
                value={typeof draftPayload.endDate === 'string' ? draftPayload.endDate : ''}
                onChange={(e) => updateField('endDate', e.target.value || null)}
                className={DATE_CLASS}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                Start Date
              </label>
              <input
                type="date"
                value={startParts.date}
                onChange={(e) =>
                  handleTimedChange(
                    e.target.value,
                    startParts.time,
                    endParts.date < e.target.value ? e.target.value : endParts.date,
                    endParts.time
                  )
                }
                className={DATE_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                Start Time
              </label>
              <input
                type="time"
                value={startParts.time}
                onChange={(e) =>
                  handleTimedChange(startParts.date, e.target.value, endParts.date, endParts.time)
                }
                className={DATE_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                End Date
              </label>
              <input
                type="date"
                value={endParts.date}
                onChange={(e) =>
                  handleTimedChange(
                    startParts.date,
                    startParts.time,
                    e.target.value,
                    endParts.time
                  )
                }
                className={DATE_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
                End Time
              </label>
              <input
                type="time"
                value={endParts.time}
                onChange={(e) =>
                  handleTimedChange(startParts.date, startParts.time, endParts.date, e.target.value)
                }
                className={DATE_CLASS}
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Description</label>
          <textarea
            rows={2}
            value={typeof draftPayload.description === 'string' ? draftPayload.description : ''}
            onChange={(e) =>
              updateField('description', e.target.value.trim() ? e.target.value : null)
            }
            placeholder="Optional agenda or location..."
            maxLength={2000}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    );
  }

  if (actionType === 'create_project_milestone') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Project</label>
            <select
              value={typeof draftPayload.projectId === 'number' ? String(draftPayload.projectId) : ''}
              onChange={(e) =>
                updateField('projectId', e.target.value ? Number(e.target.value) : null)
              }
              className={SELECT_CLASS}
            >
              <option value="">Select project...</option>
              {entityOptions.projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Due Date</label>
            <input
              type="date"
              value={typeof draftPayload.dueDate === 'string' ? draftPayload.dueDate : ''}
              onChange={(e) => updateField('dueDate', e.target.value || null)}
              className={DATE_CLASS}
            />
          </div>
        </div>

        <Input
          label="Milestone Title"
          value={typeof draftPayload.title === 'string' ? draftPayload.title : ''}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Milestone title"
          maxLength={160}
        />

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Description</label>
          <textarea
            rows={2}
            value={typeof draftPayload.description === 'string' ? draftPayload.description : ''}
            onChange={(e) =>
              updateField('description', e.target.value.trim() ? e.target.value : null)
            }
            placeholder="Optional milestone criteria..."
            maxLength={2000}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">Goal</label>
          <select
            value={typeof draftPayload.goalId === 'number' ? String(draftPayload.goalId) : ''}
            onChange={(e) =>
              updateField('goalId', e.target.value ? Number(e.target.value) : null)
            }
            className={SELECT_CLASS}
          >
            <option value="">Select goal...</option>
            {entityOptions.goals.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#A3A3A8]">
            Target Date
          </label>
          <input
            type="date"
            value={typeof draftPayload.targetDate === 'string' ? draftPayload.targetDate : ''}
            onChange={(e) => updateField('targetDate', e.target.value || null)}
            className={DATE_CLASS}
          />
        </div>
      </div>

      <Input
        label="Milestone Title"
        value={typeof draftPayload.title === 'string' ? draftPayload.title : ''}
        onChange={(e) => updateField('title', e.target.value)}
        placeholder="Goal milestone title"
        maxLength={160}
      />
    </div>
  );
}
