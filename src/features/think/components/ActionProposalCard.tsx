import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Dumbbell,
  Flag,
  ListChecks,
  Pencil,
  Repeat,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { WEEKDAY_SHORT_LABELS } from '../../../lib/habitSchedule';
import { formatLocalTime } from '../../../types/calendar';
import type { ThinkActionRecordDTO, ThinkActionType } from '../../../types/think';
import { LiveActionEditor } from './LiveActionEditor';
import { PlanActionEditor, type ThinkEntityOptions } from './PlanActionEditor';
import { isSafeMarlyTargetRoute } from '../utils/groundingUi';

interface ActionProposalCardProps {
  action: ThinkActionRecordDTO;
  entityOptions: ThinkEntityOptions;
  isBusy: boolean;
  inlineError?: string | null;
  onApprove: (actionId: number, editedPayload?: Record<string, unknown>) => Promise<void>;
  onReject: (actionId: number) => Promise<void>;
  onNavigate?: (path: string) => void;
}

const ACTION_META: Record<
  ThinkActionType,
  {
    label: string;
    pillar: 'PLAN' | 'LIVE';
    icon: React.ReactNode;
  }
> = {
  create_task: {
    label: 'Create Task',
    pillar: 'PLAN',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  update_task: {
    label: 'Update Task',
    pillar: 'PLAN',
    icon: <Pencil className="h-3.5 w-3.5" />,
  },
  create_calendar_event: {
    label: 'Schedule Event',
    pillar: 'PLAN',
    icon: <Calendar className="h-3.5 w-3.5" />,
  },
  create_project_milestone: {
    label: 'Project Milestone',
    pillar: 'PLAN',
    icon: <Flag className="h-3.5 w-3.5" />,
  },
  create_goal_milestone: {
    label: 'Goal Milestone',
    pillar: 'PLAN',
    icon: <Flag className="h-3.5 w-3.5" />,
  },
  create_habit: {
    label: 'Create Habit',
    pillar: 'LIVE',
    icon: <Repeat className="h-3.5 w-3.5" />,
  },
  create_routine: {
    label: 'Create Routine',
    pillar: 'LIVE',
    icon: <ListChecks className="h-3.5 w-3.5" />,
  },
  create_workout: {
    label: 'Log Workout',
    pillar: 'LIVE',
    icon: <Dumbbell className="h-3.5 w-3.5" />,
  },
};

function isPlanAction(
  actionType: ThinkActionType
): actionType is Extract<
  ThinkActionType,
  | 'create_task'
  | 'update_task'
  | 'create_calendar_event'
  | 'create_project_milestone'
  | 'create_goal_milestone'
> {
  return (
    actionType === 'create_task' ||
    actionType === 'update_task' ||
    actionType === 'create_calendar_event' ||
    actionType === 'create_project_milestone' ||
    actionType === 'create_goal_milestone'
  );
}

function formatWeekdaysList(days: unknown): string {
  if (!Array.isArray(days)) return '';
  return days
    .filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    .map((d) => WEEKDAY_SHORT_LABELS[d])
    .join(', ');
}

function buildPayloadPreviewLines(
  actionType: ThinkActionType,
  payload: Record<string, unknown>,
  entityOptions: ThinkEntityOptions
): Array<{ label: string; value: string }> {
  const findProjectName = (id: unknown) => {
    if (typeof id !== 'number') return null;
    return entityOptions.projects.find((p) => p.id === id)?.name ?? `Project #${id}`;
  };
  const findGoalTitle = (id: unknown) => {
    if (typeof id !== 'number') return null;
    return entityOptions.goals.find((g) => g.id === id)?.title ?? `Goal #${id}`;
  };
  const findTaskTitle = (id: unknown) => {
    if (typeof id !== 'number') return null;
    return entityOptions.tasks.find((t) => t.id === id)?.title ?? `Task #${id}`;
  };

  switch (actionType) {
    case 'create_task': {
      const items: Array<{ label: string; value: string }> = [
        { label: 'Title', value: String(payload.title ?? '—') },
        {
          label: 'Priority · Category',
          value: `${String(payload.priority ?? 'medium')} · ${String(payload.category ?? 'Work')}`,
        },
      ];
      if (payload.dueDate) items.push({ label: 'Due', value: String(payload.dueDate) });
      const proj = findProjectName(payload.projectId);
      if (proj) items.push({ label: 'Project', value: proj });
      const goal = findGoalTitle(payload.goalId);
      if (goal) items.push({ label: 'Goal', value: goal });
      if (payload.description) {
        items.push({ label: 'Notes', value: String(payload.description) });
      }
      return items;
    }

    case 'update_task': {
      const items: Array<{ label: string; value: string }> = [
        { label: 'Target Task', value: findTaskTitle(payload.taskId) ?? `#${payload.taskId}` },
      ];
      if (payload.title !== undefined) items.push({ label: 'Title', value: String(payload.title) });
      if (payload.status !== undefined) items.push({ label: 'Status', value: String(payload.status) });
      if (payload.priority !== undefined) {
        items.push({ label: 'Priority', value: String(payload.priority) });
      }
      if (payload.category !== undefined) {
        items.push({ label: 'Category', value: String(payload.category) });
      }
      if (payload.dueDate !== undefined) {
        items.push({
          label: 'Due Date',
          value: payload.dueDate ? String(payload.dueDate) : 'Cleared',
        });
      }
      if (payload.description !== undefined) {
        items.push({
          label: 'Description',
          value: payload.description ? String(payload.description) : 'Cleared',
        });
      }
      return items;
    }

    case 'create_calendar_event': {
      const allDay = Boolean(payload.allDay);
      let timing = '—';
      if (allDay) {
        const s = String(payload.startDate ?? '');
        const e = String(payload.endDate ?? s);
        timing = s && e && e !== s ? `All day · ${s} → ${e}` : `All day · ${s}`;
      } else if (typeof payload.startAt === 'string' && typeof payload.endAt === 'string') {
        const startDate = new Date(payload.startAt);
        const dateLabel = Number.isNaN(startDate.getTime())
          ? payload.startAt
          : startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        timing = `${dateLabel} · ${formatLocalTime(payload.startAt)} – ${formatLocalTime(payload.endAt)}`;
      }
      const items: Array<{ label: string; value: string }> = [
        { label: 'Event', value: String(payload.title ?? '—') },
        { label: 'When', value: timing },
        { label: 'Category', value: String(payload.category ?? 'Work') },
      ];
      if (payload.description) {
        items.push({ label: 'Details', value: String(payload.description) });
      }
      return items;
    }

    case 'create_project_milestone': {
      const items: Array<{ label: string; value: string }> = [
        { label: 'Project', value: findProjectName(payload.projectId) ?? '—' },
        { label: 'Milestone', value: String(payload.title ?? '—') },
      ];
      if (payload.dueDate) items.push({ label: 'Due', value: String(payload.dueDate) });
      if (payload.description) {
        items.push({ label: 'Notes', value: String(payload.description) });
      }
      return items;
    }

    case 'create_goal_milestone': {
      const items: Array<{ label: string; value: string }> = [
        { label: 'Goal', value: findGoalTitle(payload.goalId) ?? '—' },
        { label: 'Milestone', value: String(payload.title ?? '—') },
      ];
      if (payload.targetDate) {
        items.push({ label: 'Target Date', value: String(payload.targetDate) });
      }
      return items;
    }

    case 'create_habit': {
      const schedule =
        payload.schedule && typeof payload.schedule === 'object'
          ? (payload.schedule as Record<string, unknown>)
          : {};
      let cadence = 'Daily';
      if (schedule.frequencyType === 'weekdays') {
        cadence = `Weekdays (${formatWeekdaysList(schedule.weekdays) || 'selected'})`;
      } else if (schedule.frequencyType === 'times_per_week') {
        cadence = `${schedule.targetPerWeek ?? 3}x / week`;
      }
      const targetStr =
        payload.trackingType === 'measurable'
          ? `${payload.targetValue ?? ''}${payload.unit ? ` ${payload.unit}` : ''}`.trim()
          : 'Check-in';
      const items: Array<{ label: string; value: string }> = [
        { label: 'Habit', value: String(payload.name ?? '—') },
        { label: 'Cadence · Target', value: `${cadence} · ${targetStr}` },
        { label: 'Category', value: String(payload.category ?? 'Health') },
      ];
      const goal = findGoalTitle(payload.goalId);
      if (goal) items.push({ label: 'Goal', value: goal });
      return items;
    }

    case 'create_routine': {
      let cadence = 'Daily';
      if (payload.scheduleType === 'weekdays') {
        cadence = `Weekdays (${formatWeekdaysList(payload.weekdays) || 'selected'})`;
      } else if (payload.scheduleType === 'as_needed') {
        cadence = 'As needed';
      }
      const timeLabel = payload.preferredTime
        ? `${payload.timeOfDay ?? 'Anytime'} (${payload.preferredTime})`
        : String(payload.timeOfDay ?? 'Anytime');
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      const items: Array<{ label: string; value: string }> = [
        { label: 'Routine', value: String(payload.name ?? '—') },
        { label: 'Timing · Cadence', value: `${timeLabel} · ${cadence}` },
        { label: 'Steps', value: `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}` },
      ];
      return items;
    }

    case 'create_workout': {
      const timeSuffix = payload.startTime ? ` at ${payload.startTime}` : '';
      const items: Array<{ label: string; value: string }> = [
        { label: 'Session', value: String(payload.title ?? '—') },
        {
          label: 'Type · Duration',
          value: `${String(payload.activityType ?? 'Strength')} · ${String(payload.durationMinutes ?? 0)} min`,
        },
        { label: 'Date', value: `${String(payload.localDate ?? 'Today')}${timeSuffix}` },
      ];
      if (payload.notes) items.push({ label: 'Notes', value: String(payload.notes) });
      return items;
    }
  }
}

export function ActionProposalCard({
  action,
  entityOptions,
  isBusy,
  inlineError,
  onApprove,
  onReject,
  onNavigate,
}: ActionProposalCardProps) {
  const meta = ACTION_META[action.actionType];
  const [isEditing, setIsEditing] = useState(false);
  const [draftPayload, setDraftPayload] = useState<Record<string, unknown>>(
    action.effectivePayload
  );

  useEffect(() => {
    setDraftPayload(action.effectivePayload);
    if (action.status === 'executed' || action.status === 'rejected') {
      setIsEditing(false);
    }
  }, [action.id, action.status, action.effectivePayload]);

  const hasUnsavedDraftChanges = useMemo(
    () => JSON.stringify(draftPayload) !== JSON.stringify(action.effectivePayload),
    [draftPayload, action.effectivePayload]
  );

  const canAct = action.status === 'proposed' || action.status === 'failed';
  const wasPersistedEdited = action.editedPayload !== null;

  const previewItems = useMemo(
    () =>
      buildPayloadPreviewLines(
        action.actionType,
        isEditing ? draftPayload : action.effectivePayload,
        entityOptions
      ),
    [action.actionType, action.effectivePayload, draftPayload, entityOptions, isEditing]
  );

  const routineStepsPreview = useMemo(() => {
    if (action.actionType !== 'create_routine') return [];
    const source = isEditing ? draftPayload : action.effectivePayload;
    if (!Array.isArray(source.steps)) return [];
    return source.steps
      .filter((s): s is { title: string; durationMinutes?: number | null } =>
        Boolean(s && typeof s === 'object' && typeof (s as { title?: unknown }).title === 'string')
      )
      .slice(0, 6);
  }, [action.actionType, action.effectivePayload, draftPayload, isEditing]);

  const statusBadge = (() => {
    switch (action.status) {
      case 'proposed':
        return <Badge tone="purple">Awaiting approval</Badge>;
      case 'approved':
        return <Badge tone="purple">Applying...</Badge>;
      case 'executed':
        return (
          <Badge tone="mint" icon={<Check className="h-3 w-3" />}>
            Applied
          </Badge>
        );
      case 'rejected':
        return <Badge tone="neutral">Dismissed</Badge>;
      case 'failed':
        return (
          <Badge
            tone="coral"
            icon={<AlertTriangle className="h-3 w-3" />}
            className="border-[#E06C75]/35 bg-[#E06C75]/15 text-[#F2B8BE]"
          >
            Failed
          </Badge>
        );
    }
  })();

  const handleApproveClick = async () => {
    await onApprove(action.id, hasUnsavedDraftChanges ? draftPayload : undefined);
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-3.5 transition-colors sm:p-4',
        action.status === 'executed'
          ? 'border-[#73C39F]/35 bg-[#1D2522]'
          : action.status === 'rejected'
            ? 'border-white/[0.06] bg-[#1E1E21] opacity-75'
            : action.status === 'failed'
              ? 'border-[#E06C75]/40 bg-[#251E20]'
              : 'border-[#8C82E8]/30 bg-[#1F1F24]'
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={meta.pillar === 'PLAN' ? 'coral' : 'mint'}
              icon={meta.icon}
            >
              {meta.pillar} · {meta.label}
            </Badge>
            {statusBadge}
            {(wasPersistedEdited || hasUnsavedDraftChanges) && action.status !== 'rejected' && (
              <Badge tone="neutral">Edited</Badge>
            )}
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[#F2F2F2]">{action.summary}</h4>
          {action.rationale && (
            <p className="mt-0.5 text-xs leading-relaxed text-[#A3A3A8]">{action.rationale}</p>
          )}
        </div>
      </div>

      {/* Body: either inline editor or concise read-only preview */}
      {action.status !== 'rejected' && (
        <div className="mt-3">
          {isEditing && canAct ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#17171A] p-3">
              {isPlanAction(action.actionType) ? (
                <PlanActionEditor
                  actionType={action.actionType}
                  draftPayload={draftPayload}
                  onChange={setDraftPayload}
                  entityOptions={entityOptions}
                />
              ) : (
                <LiveActionEditor
                  actionType={action.actionType}
                  draftPayload={draftPayload}
                  onChange={setDraftPayload}
                  goals={entityOptions.goals}
                />
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-2.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setDraftPayload(action.payload)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A3A3A8] hover:text-[#F2F2F2] disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to AI suggestion
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setIsEditing(false)}
                >
                  Done editing
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.07] bg-[#17171A] px-3 py-2.5">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                {previewItems.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-[#737378]">
                      {item.label}
                    </dt>
                    <dd className="truncate text-[#E3E3E7]">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {routineStepsPreview.length > 0 && (
                <ol className="mt-2 space-y-1 border-t border-white/[0.06] pt-2 text-[11px] text-[#C6C6CC]">
                  {routineStepsPreview.map((step, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="mr-1.5 font-mono text-[#737378]">{i + 1}.</span>
                        {step.title}
                      </span>
                      {typeof step.durationMinutes === 'number' && (
                        <span className="shrink-0 font-mono text-[10px] text-[#737378]">
                          {step.durationMinutes}m
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* Failure message */}
      {(action.status === 'failed' || inlineError) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#E06C75]/35 bg-[#E06C75]/10 px-3 py-2 text-xs text-[#F2B8BE]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E06C75]" />
          <span>{inlineError || action.errorMessage || 'Unable to execute this action.'}</span>
        </div>
      )}

      {/* Executed confirmation + navigation */}
      {action.status === 'executed' && action.executionResult && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#73C39F]/30 bg-[#73C39F]/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-[#B9EAD3]">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#73C39F]" />
            <span>
              Saved in {meta.pillar}: <strong className="font-semibold">{action.executionResult.label}</strong>
            </span>
          </div>
          {onNavigate && isSafeMarlyTargetRoute(action.executionResult.targetRoute) && (
            <button
              type="button"
              onClick={() => onNavigate(action.executionResult!.targetRoute)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#73C39F]/20 px-2.5 py-1 text-[11px] font-semibold text-[#D6F5E7] transition-colors hover:bg-[#73C39F]/30 cursor-pointer"
            >
              <span>View in {meta.pillar}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Action buttons (only while proposed or failed) */}
      {canAct && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            leadingIcon={<X className="h-3.5 w-3.5" />}
            onClick={() => void onReject(action.id)}
            className="text-[#A3A3A8] hover:text-[#E06C75]"
          >
            Dismiss
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isBusy}
              leadingIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isBusy}
            leadingIcon={<Check className="h-3.5 w-3.5" />}
            onClick={() => void handleApproveClick()}
            className="bg-[#8C82E8] text-[#151515] hover:bg-[#9D94EE]"
          >
            {isBusy
              ? 'Applying...'
              : action.status === 'failed'
                ? 'Retry & Apply'
                : hasUnsavedDraftChanges || isEditing
                  ? 'Save & Apply'
                  : 'Approve & Apply'}
          </Button>
        </div>
      )}
    </div>
  );
}
