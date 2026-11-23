import type {
  ThinkEntityReferenceTypeValue,
  ThinkEvidenceSourceDomainValue,
  ThinkMessageContextMetaRecord,
  ThinkMessageEvidenceRecord,
  ThinkMessageReferenceRecord,
} from '../../db/schema.ts';
import type { OwnedActionRefSets } from '../../validators/thinkValidator.ts';
import { sanitizeContextText, sanitizeRequiredContextLabel } from './sanitize.ts';
import {
  THINK_CONTEXT_RETRIEVAL_LIMITS,
  type ThinkContextAssemblyResult,
  type ThinkWorkspaceContextPacket,
} from './types.ts';

export const MAX_VERIFIED_REFERENCES = 8;
export const MAX_VERIFIED_EVIDENCE = 4;
export const MAX_EVIDENCE_CLAIM_LENGTH = 280;
export const MAX_UNCERTAINTY_NOTE_LENGTH = 300;
export const MAX_REFERENCE_DETAIL_LENGTH = 140;

const ALLOWED_REFERENCE_TYPES = new Set<ThinkEntityReferenceTypeValue>([
  'task',
  'calendar_event',
  'project',
  'goal',
  'habit',
  'routine',
  'workout',
]);

const PLAN_REFERENCE_TYPES = new Set<ThinkEntityReferenceTypeValue>([
  'task',
  'calendar_event',
  'project',
  'goal',
]);

const LIVE_REFERENCE_TYPES = new Set<ThinkEntityReferenceTypeValue>([
  'habit',
  'routine',
  'workout',
]);

const ALLOWED_EVIDENCE_DOMAINS = new Set<ThinkEvidenceSourceDomainValue>([
  'plan',
  'live',
  'statistics',
]);

interface TrustedEntityEntry {
  entityType: ThinkEntityReferenceTypeValue;
  entityId: number;
  label: string;
  detail: string | null;
  targetRoute: string;
}

export function buildCanonicalEntityRoute(
  entityType: ThinkEntityReferenceTypeValue,
  entityId: number
): string {
  switch (entityType) {
    case 'task':
      return `/plan/tasks?highlight=${entityId}`;
    case 'calendar_event':
      return `/plan/calendar?eventId=${entityId}`;
    case 'project':
      return `/plan/projects?projectId=${entityId}`;
    case 'goal':
      return `/plan/goals?goalId=${entityId}`;
    case 'habit':
      return `/live/habits?habitId=${entityId}`;
    case 'routine':
      return `/live/fitness?routineId=${entityId}`;
    case 'workout':
      return `/live/fitness?workoutId=${entityId}`;
  }
}

function makeTrustedKey(entityType: ThinkEntityReferenceTypeValue, entityId: number): string {
  return `${entityType}:${entityId}`;
}

function formatBoundedDetail(parts: Array<string | null | undefined>): string | null {
  const joined = parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' · ');
  return sanitizeContextText(joined, MAX_REFERENCE_DETAIL_LENGTH).text;
}

function isOwnedReference(
  entityType: ThinkEntityReferenceTypeValue,
  entityId: number,
  ownedRefs?: OwnedActionRefSets
): boolean {
  if (!ownedRefs) return true;
  if (entityType === 'task') return ownedRefs.taskIds.has(entityId);
  if (entityType === 'project') return ownedRefs.projectIds.has(entityId);
  if (entityType === 'goal') return ownedRefs.goalIds.has(entityId);
  return true;
}

function buildTrustedEntityIndex(
  packet: ThinkWorkspaceContextPacket,
  ownedRefs?: OwnedActionRefSets
): Map<string, TrustedEntityEntry> {
  const index = new Map<string, TrustedEntityEntry>();

  if (packet.plan?.tasks) {
    const allPacketTasks = [
      ...packet.plan.tasks.openTasks,
      ...packet.plan.tasks.recentlyCompletedTasks,
    ];
    for (const task of allPacketTasks) {
      if (!isOwnedReference('task', task.id, ownedRefs)) continue;
      const key = makeTrustedKey('task', task.id);
      if (index.has(key)) continue;
      const duePart = task.isOverdue
        ? `overdue (${task.dueDate ?? 'past due'})`
        : task.dueDate
          ? `due ${task.dueDate}`
          : 'no due date';
      index.set(key, {
        entityType: 'task',
        entityId: task.id,
        label: sanitizeRequiredContextLabel(task.title, 140, 'Untitled task'),
        detail: formatBoundedDetail([task.priority, task.status, duePart]),
        targetRoute: buildCanonicalEntityRoute('task', task.id),
      });
    }
  }

  if (packet.plan?.calendar) {
    for (const ev of packet.plan.calendar.events) {
      const key = makeTrustedKey('calendar_event', ev.id);
      if (index.has(key)) continue;
      const whenPart = ev.allDay
        ? `All-day (${ev.localStartDate ?? ev.startDate ?? 'date set'})`
        : [
            ev.localStartDate,
            ev.localStartTime,
            ev.durationMinutes ? `(${ev.durationMinutes}m)` : null,
          ]
            .filter(Boolean)
            .join(' ');
      index.set(key, {
        entityType: 'calendar_event',
        entityId: ev.id,
        label: sanitizeRequiredContextLabel(ev.title, 140, 'Untitled event'),
        detail: formatBoundedDetail([ev.category, whenPart || null]),
        targetRoute: buildCanonicalEntityRoute('calendar_event', ev.id),
      });
    }
  }

  if (packet.plan?.projectsGoals) {
    for (const proj of packet.plan.projectsGoals.projects) {
      if (!isOwnedReference('project', proj.id, ownedRefs)) continue;
      const key = makeTrustedKey('project', proj.id);
      if (index.has(key)) continue;
      index.set(key, {
        entityType: 'project',
        entityId: proj.id,
        label: sanitizeRequiredContextLabel(proj.name, 140, 'Untitled project'),
        detail: formatBoundedDetail([
          proj.status,
          `${proj.progressPercent}%`,
          proj.targetDate ? `target ${proj.targetDate}` : null,
        ]),
        targetRoute: buildCanonicalEntityRoute('project', proj.id),
      });
    }

    for (const goal of packet.plan.projectsGoals.goals) {
      if (!isOwnedReference('goal', goal.id, ownedRefs)) continue;
      const key = makeTrustedKey('goal', goal.id);
      if (index.has(key)) continue;
      index.set(key, {
        entityType: 'goal',
        entityId: goal.id,
        label: sanitizeRequiredContextLabel(goal.title, 140, 'Untitled goal'),
        detail: formatBoundedDetail([
          goal.status,
          `${goal.progressPercent}%`,
          goal.targetDate ? `target ${goal.targetDate}` : null,
        ]),
        targetRoute: buildCanonicalEntityRoute('goal', goal.id),
      });
    }
  }

  if (packet.live?.habits) {
    for (const habit of packet.live.habits.habits) {
      const key = makeTrustedKey('habit', habit.id);
      if (index.has(key)) continue;
      const streakUnitLabel = habit.streak.streakUnit === 'weeks' ? 'w' : 'd';
      const streakPart =
        habit.streak.currentStreak > 0
          ? `streak ${habit.streak.currentStreak}${streakUnitLabel}`
          : null;
      index.set(key, {
        entityType: 'habit',
        entityId: habit.id,
        label: sanitizeRequiredContextLabel(habit.name, 140, 'Untitled habit'),
        detail: formatBoundedDetail([
          habit.schedule.label,
          `today: ${habit.todayStatus.kind}`,
          streakPart,
        ]),
        targetRoute: buildCanonicalEntityRoute('habit', habit.id),
      });
    }
  }

  if (packet.live?.routines) {
    for (const routine of packet.live.routines.routines) {
      const key = makeTrustedKey('routine', routine.id);
      if (index.has(key)) continue;
      index.set(key, {
        entityType: 'routine',
        entityId: routine.id,
        label: sanitizeRequiredContextLabel(routine.name, 140, 'Untitled routine'),
        detail: formatBoundedDetail([
          routine.timeOfDay,
          routine.scheduleLabel,
          `${routine.stepsCount} steps`,
        ]),
        targetRoute: buildCanonicalEntityRoute('routine', routine.id),
      });
    }
  }

  if (packet.live?.workouts) {
    for (const workout of packet.live.workouts.recentSessions) {
      const key = makeTrustedKey('workout', workout.id);
      if (index.has(key)) continue;
      index.set(key, {
        entityType: 'workout',
        entityId: workout.id,
        label: sanitizeRequiredContextLabel(workout.title, 140, 'Untitled workout'),
        detail: formatBoundedDetail([
          workout.activityType,
          workout.localDate,
          `${workout.durationMinutes}m`,
        ]),
        targetRoute: buildCanonicalEntityRoute('workout', workout.id),
      });
    }
  }

  return index;
}

function isSourceDomainSupportedInPacket(
  sourceDomain: ThinkEvidenceSourceDomainValue,
  packet: ThinkWorkspaceContextPacket
): boolean {
  if (sourceDomain === 'plan') {
    return Boolean(
      packet.plan &&
        (packet.plan.tasks || packet.plan.calendar || packet.plan.projectsGoals)
    );
  }
  if (sourceDomain === 'live') {
    return Boolean(
      packet.live &&
        (packet.live.habits || packet.live.workouts || packet.live.routines)
    );
  }
  if (sourceDomain === 'statistics') {
    return Boolean(packet.statistics);
  }
  return false;
}

function isEntityAllowedForEvidenceDomain(
  sourceDomain: ThinkEvidenceSourceDomainValue,
  entityType: ThinkEntityReferenceTypeValue
): boolean {
  if (sourceDomain === 'plan') return PLAN_REFERENCE_TYPES.has(entityType);
  if (sourceDomain === 'live') return LIVE_REFERENCE_TYPES.has(entityType);
  return ALLOWED_REFERENCE_TYPES.has(entityType);
}

function deriveWindowLabel(assembly: ThinkContextAssemblyResult): string {
  const { packet } = assembly;
  if (packet.statistics?.meta) {
    return `${packet.statistics.meta.preset}: ${packet.statistics.meta.from} to ${packet.statistics.meta.to}`;
  }
  if (packet.plan?.calendar) {
    return `${packet.plan.calendar.windowFrom} to ${packet.plan.calendar.windowTo}`;
  }
  if (packet.live?.habits) {
    return `Last ${packet.live.habits.windowDays} days (${packet.live.habits.windowFrom} to ${packet.live.habits.windowTo})`;
  }
  if (packet.live?.workouts) {
    return `Last ${packet.live.workouts.windowDays} days (${packet.live.workouts.windowFrom} to ${packet.live.workouts.windowTo})`;
  }
  if (packet.live?.routines) {
    return `Last ${packet.live.routines.windowDays} days (${packet.live.routines.windowFrom} to ${packet.live.routines.windowTo})`;
  }
  if (packet.plan?.tasks) {
    return `Open snapshot & ${THINK_CONTEXT_RETRIEVAL_LIMITS.RECENT_COMPLETED_TASKS_DAYS}d recent completions (as of ${packet.anchor.todayLocalDate})`;
  }
  return `As of ${packet.anchor.todayLocalDate}`;
}

export function buildServerContextMetadata(
  assembly: ThinkContextAssemblyResult
): ThinkMessageContextMetaRecord {
  const truncatedSet = new Set<string>();
  for (const record of assembly.packet.truncation) {
    if (record.truncated) {
      truncatedSet.add(record.domain);
    }
  }
  for (const trimmedDomain of assembly.budget.trimmedDomains) {
    truncatedSet.add(trimmedDomain);
  }

  return {
    intentCategory: assembly.classification.intentCategory,
    selectedDomains: [...assembly.classification.selectedDomains],
    domainsConsulted: [...assembly.domainsConsulted],
    statsPreset:
      assembly.packet.statistics?.meta.preset ??
      (assembly.domainsConsulted.includes('statistics')
        ? assembly.classification.statsPreset
        : null),
    windowLabel: deriveWindowLabel(assembly),
    timezone: assembly.packet.anchor.effectiveTimeZone,
    timezoneInitialized: assembly.packet.anchor.timezoneInitialized,
    todayLocalDate: assembly.packet.anchor.todayLocalDate,
    truncatedDomains: Array.from(truncatedSet),
    degraded: assembly.degraded,
    degradedDomains: [...assembly.degradedDomains],
    retrievedAt: assembly.retrievedAt,
  };
}

export interface VerifyGroundingParams {
  assembly: ThinkContextAssemblyResult;
  ownedRefs?: OwnedActionRefSets;
  candidateReferences?: unknown[];
  candidateEvidence?: unknown[];
  candidateInsufficientContext?: boolean;
  candidateUncertaintyNote?: string | null;
}

export interface VerifiedGroundingResult {
  references: ThinkMessageReferenceRecord[];
  evidence: ThinkMessageEvidenceRecord[];
  context: ThinkMessageContextMetaRecord;
  insufficientContext: boolean;
  uncertaintyNote: string | null;
}

export function verifyAndCanonicalizeGrounding(
  params: VerifyGroundingParams
): VerifiedGroundingResult {
  const { assembly, ownedRefs } = params;
  const trustedIndex = buildTrustedEntityIndex(assembly.packet, ownedRefs);

  // 1. Canonicalize & filter entity references against trusted packet & ownership
  const verifiedReferences: ThinkMessageReferenceRecord[] = [];
  const seenRefs = new Set<string>();

  for (const rawItem of params.candidateReferences ?? []) {
    if (verifiedReferences.length >= MAX_VERIFIED_REFERENCES) break;
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;

    const record = rawItem as Record<string, unknown>;
    const rawType = record.entityType;
    const rawId = record.entityId;

    if (
      typeof rawType !== 'string' ||
      !ALLOWED_REFERENCE_TYPES.has(rawType as ThinkEntityReferenceTypeValue)
    ) {
      continue;
    }
    if (typeof rawId !== 'number' || !Number.isSafeInteger(rawId) || rawId <= 0) {
      continue;
    }

    const entityType = rawType as ThinkEntityReferenceTypeValue;
    const key = makeTrustedKey(entityType, rawId);
    if (seenRefs.has(key)) continue;

    const trusted = trustedIndex.get(key);
    if (!trusted) continue;

    seenRefs.add(key);
    verifiedReferences.push({
      entityType: trusted.entityType,
      entityId: trusted.entityId,
      label: trusted.label,
      detail: trusted.detail,
      targetRoute: trusted.targetRoute,
    });
  }

  // 2. Verify evidence claims & optional entity anchors
  const verifiedEvidence: ThinkMessageEvidenceRecord[] = [];
  const seenClaims = new Set<string>();

  for (const rawItem of params.candidateEvidence ?? []) {
    if (verifiedEvidence.length >= MAX_VERIFIED_EVIDENCE) break;
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;

    const record = rawItem as Record<string, unknown>;
    const rawClaim = typeof record.claim === 'string' ? record.claim : null;
    const sanitizedClaim = sanitizeContextText(rawClaim, MAX_EVIDENCE_CLAIM_LENGTH).text;
    if (!sanitizedClaim) continue;

    const rawDomain = record.sourceDomain;
    if (
      typeof rawDomain !== 'string' ||
      !ALLOWED_EVIDENCE_DOMAINS.has(rawDomain as ThinkEvidenceSourceDomainValue)
    ) {
      continue;
    }

    const sourceDomain = rawDomain as ThinkEvidenceSourceDomainValue;
    if (!isSourceDomainSupportedInPacket(sourceDomain, assembly.packet)) {
      continue;
    }

    const hasEntityType =
      record.entityType !== undefined && record.entityType !== null && record.entityType !== '';
    const hasEntityId = record.entityId !== undefined && record.entityId !== null;

    let verifiedEntityType: ThinkEntityReferenceTypeValue | undefined;
    let verifiedEntityId: number | undefined;

    if (hasEntityType || hasEntityId) {
      if (
        typeof record.entityType !== 'string' ||
        !ALLOWED_REFERENCE_TYPES.has(record.entityType as ThinkEntityReferenceTypeValue)
      ) {
        continue;
      }
      if (
        typeof record.entityId !== 'number' ||
        !Number.isSafeInteger(record.entityId) ||
        record.entityId <= 0
      ) {
        continue;
      }

      const candidateType = record.entityType as ThinkEntityReferenceTypeValue;
      if (!isEntityAllowedForEvidenceDomain(sourceDomain, candidateType)) {
        continue;
      }

      const trusted = trustedIndex.get(makeTrustedKey(candidateType, record.entityId));
      if (!trusted) {
        continue;
      }

      verifiedEntityType = trusted.entityType;
      verifiedEntityId = trusted.entityId;
    }

    const claimDedupKey = `${sourceDomain}|${verifiedEntityType ?? ''}|${verifiedEntityId ?? ''}|${sanitizedClaim.toLowerCase()}`;
    if (seenClaims.has(claimDedupKey)) continue;
    seenClaims.add(claimDedupKey);

    verifiedEvidence.push({
      claim: sanitizedClaim,
      sourceDomain,
      ...(verifiedEntityType !== undefined && verifiedEntityId !== undefined
        ? { entityType: verifiedEntityType, entityId: verifiedEntityId }
        : {}),
    });
  }

  // 3. Uncertainty & degraded note handling
  let uncertaintyNote = sanitizeContextText(
    params.candidateUncertaintyNote ?? null,
    MAX_UNCERTAINTY_NOTE_LENGTH
  ).text;

  if (assembly.degraded && !uncertaintyNote) {
    uncertaintyNote = sanitizeContextText(
      `Some workspace context could not be retrieved (${assembly.degradedDomains.join(', ')}); answer reflects available data only.`,
      MAX_UNCERTAINTY_NOTE_LENGTH
    ).text;
  }

  const insufficientContext = Boolean(params.candidateInsufficientContext);
  const context = buildServerContextMetadata(assembly);

  return {
    references: verifiedReferences,
    evidence: verifiedEvidence,
    context,
    insufficientContext,
    uncertaintyNote,
  };
}
