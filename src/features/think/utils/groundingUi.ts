import type {
  ThinkContextSource,
  ThinkEntityReferenceType,
  ThinkEvidenceSourceDomain,
  ThinkMessageContextMetaDTO,
  ThinkMessageEvidenceDTO,
  ThinkMessageReferenceDTO,
} from '../../../types/think';

export interface ThinkContextSourceOption {
  value: ThinkContextSource;
  label: string;
  shortLabel: string;
  description: string;
  starterPrompts: string[];
}

export const THINK_CONTEXT_SOURCE_OPTIONS: ThinkContextSourceOption[] = [
  {
    value: 'general',
    label: 'Balanced (All Pillars)',
    shortLabel: 'All Pillars',
    description: 'Selects relevant slices across PLAN, LIVE, and Statistics based on your question.',
    starterPrompts: [
      'Review my current tasks, calendar blocks, and habits to help me plan today realistically.',
      'What should I prioritize next across my active projects and goals without overloading my week?',
      'Design a balanced 3-step morning mobility routine and a hydration habit for weekdays.',
    ],
  },
  {
    value: 'home',
    label: 'Daily Focus (Home)',
    shortLabel: 'Home Focus',
    description: 'Prioritizes today’s schedule, overdue or upcoming tasks, habits, and daily routines.',
    starterPrompts: [
      'Give me a realistic plan for today based on my scheduled events, due tasks, and habits.',
      'Which overdue or high-priority tasks need attention today, and when could I block time for them?',
      'Check what I have scheduled for the rest of today and propose a lighter fallback if needed.',
    ],
  },
  {
    value: 'plan',
    label: 'PLAN (Tasks, Calendar & Goals)',
    shortLabel: 'PLAN Focus',
    description: 'Biases context toward tasks, calendar commitments, projects, and goals.',
    starterPrompts: [
      'Review my open tasks and upcoming calendar to find conflicts or realistic focus blocks this week.',
      'Look at my active projects and goals and suggest the next concrete milestone or task.',
      'Create a high-priority task for tomorrow and schedule a 45-minute focus block around existing events.',
    ],
  },
  {
    value: 'live',
    label: 'LIVE (Habits, Fitness & Routines)',
    shortLabel: 'LIVE Focus',
    description: 'Biases context toward habit streaks, recent logs, workouts, and repeatable routines.',
    starterPrompts: [
      'How have my habits and routines been holding up lately, and where am I slipping?',
      'Summarize my recent workouts and suggest a recovery or strength session that fits this week.',
      'Propose a realistic weekday habit and a short step-based evening routine I can actually stick to.',
    ],
  },
  {
    value: 'statistics',
    label: 'STATISTICS (Trends & Progress)',
    shortLabel: 'Statistics Focus',
    description: 'Biases context toward completion throughput, follow-through rates, and habit trends.',
    starterPrompts: [
      'What patterns stand out in my recent task follow-through, habit consistency, and activity trends?',
      'Compare my last 7 days vs. the past month and suggest one realistic adjustment for next week.',
      'Based on my recent pace, am I overcommitting on planned tasks relative to what I complete?',
    ],
  },
];

export function getContextSourceOption(
  source: ThinkContextSource | null | undefined
): ThinkContextSourceOption {
  return (
    THINK_CONTEXT_SOURCE_OPTIONS.find((opt) => opt.value === source) ??
    THINK_CONTEXT_SOURCE_OPTIONS[0]
  );
}

const ALLOWED_ROUTE_PREFIXES = [
  '/plan/tasks',
  '/plan/calendar',
  '/plan/projects',
  '/plan/goals',
  '/live/habits',
  '/live/fitness',
] as const;

export function isSafeMarlyTargetRoute(rawRoute: unknown): rawRoute is string {
  if (typeof rawRoute !== 'string') return false;
  const trimmed = rawRoute.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  const [pathnamePart] = trimmed.split(/[?#]/, 1);
  if (!ALLOWED_ROUTE_PREFIXES.includes(pathnamePart as (typeof ALLOWED_ROUTE_PREFIXES)[number])) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, 'https://marly.local');
    return parsed.origin === 'https://marly.local' && parsed.pathname === pathnamePart;
  } catch {
    return false;
  }
}

const ALLOWED_ENTITY_TYPES = new Set<ThinkEntityReferenceType>([
  'task',
  'calendar_event',
  'project',
  'goal',
  'habit',
  'routine',
  'workout',
]);

export function sanitizeThinkReferences(rawReferences: unknown): ThinkMessageReferenceDTO[] {
  if (!Array.isArray(rawReferences)) return [];
  const seen = new Set<string>();
  const clean: ThinkMessageReferenceDTO[] = [];

  for (const item of rawReferences) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ThinkMessageReferenceDTO>;
    if (!candidate.entityType || !ALLOWED_ENTITY_TYPES.has(candidate.entityType)) continue;
    if (
      typeof candidate.entityId !== 'number' ||
      !Number.isSafeInteger(candidate.entityId) ||
      candidate.entityId <= 0
    ) {
      continue;
    }
    if (typeof candidate.label !== 'string' || candidate.label.trim().length === 0) continue;
    if (!isSafeMarlyTargetRoute(candidate.targetRoute)) continue;

    const dedupeKey = `${candidate.entityType}:${candidate.entityId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    clean.push({
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      label: candidate.label.trim(),
      detail:
        typeof candidate.detail === 'string' && candidate.detail.trim().length > 0
          ? candidate.detail.trim()
          : null,
      targetRoute: candidate.targetRoute.trim(),
    });
  }

  return clean;
}

const ALLOWED_EVIDENCE_DOMAINS = new Set<ThinkEvidenceSourceDomain>([
  'plan',
  'live',
  'statistics',
]);

export function sanitizeThinkEvidence(rawEvidence: unknown): ThinkMessageEvidenceDTO[] {
  if (!Array.isArray(rawEvidence)) return [];
  const clean: ThinkMessageEvidenceDTO[] = [];

  for (const item of rawEvidence) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ThinkMessageEvidenceDTO>;
    if (typeof candidate.claim !== 'string' || candidate.claim.trim().length === 0) continue;
    if (!candidate.sourceDomain || !ALLOWED_EVIDENCE_DOMAINS.has(candidate.sourceDomain)) {
      continue;
    }

    const hasValidRef =
      candidate.entityType &&
      ALLOWED_ENTITY_TYPES.has(candidate.entityType) &&
      typeof candidate.entityId === 'number' &&
      Number.isSafeInteger(candidate.entityId) &&
      candidate.entityId > 0;

    clean.push({
      claim: candidate.claim.trim(),
      sourceDomain: candidate.sourceDomain,
      ...(hasValidRef
        ? {
            entityType: candidate.entityType,
            entityId: candidate.entityId,
          }
        : {}),
    });
  }

  return clean;
}

export function formatEntityTypeLabel(entityType: ThinkEntityReferenceType): string {
  switch (entityType) {
    case 'task':
      return 'Task';
    case 'calendar_event':
      return 'Event';
    case 'project':
      return 'Project';
    case 'goal':
      return 'Goal';
    case 'habit':
      return 'Habit';
    case 'routine':
      return 'Routine';
    case 'workout':
      return 'Workout';
  }
}

const DOMAIN_KEY_LABELS: Record<string, string> = {
  plan_tasks: 'Tasks',
  plan_calendar: 'Calendar',
  plan_projects_goals: 'Projects & Goals',
  live_habits: 'Habits',
  live_workouts: 'Workouts',
  live_routines: 'Routines',
  statistics: 'Statistics',
  plan: 'PLAN',
  live: 'LIVE',
};

export function formatDomainLabel(domainKey: string): string {
  return DOMAIN_KEY_LABELS[domainKey] ?? domainKey.replace(/_/g, ' ');
}

export function formatDomainListLabels(domains: string[] | undefined | null): string[] {
  if (!Array.isArray(domains)) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of domains) {
    if (typeof raw !== 'string' || raw.trim().length === 0) continue;
    const label = formatDomainLabel(raw.trim());
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

export function formatEvidenceDomainLabel(domain: ThinkEvidenceSourceDomain): string {
  switch (domain) {
    case 'plan':
      return 'PLAN';
    case 'live':
      return 'LIVE';
    case 'statistics':
      return 'Statistics';
  }
}

export function formatContextSummaryLine(
  context: ThinkMessageContextMetaDTO | undefined | null
): string | null {
  if (!context) return null;
  const consulted = formatDomainListLabels(context.domainsConsulted);
  const parts: string[] = [];
  if (consulted.length > 0) {
    parts.push(`Grounded in ${consulted.join(', ')}`);
  }
  if (typeof context.windowLabel === 'string' && context.windowLabel.trim().length > 0) {
    parts.push(context.windowLabel.trim());
  }
  if (typeof context.todayLocalDate === 'string' && context.todayLocalDate.trim().length > 0) {
    parts.push(context.todayLocalDate.trim());
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
