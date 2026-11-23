import type { ThinkContextSourceValue } from '../../db/schema.ts';
import type { StatisticsPeriodPreset } from '../../types/statistics.ts';
import type {
  ContextDomainKey,
  ContextIntentCategory,
  IntentClassificationResult,
  PreviousTurnContextMeta,
} from './types.ts';

type SupportedStatsPreset = Exclude<StatisticsPeriodPreset, 'custom'>;

const ALL_DOMAINS: ContextDomainKey[] = [
  'plan_tasks',
  'plan_calendar',
  'plan_projects_goals',
  'live_habits',
  'live_workouts',
  'live_routines',
  'statistics',
];

const SCHEDULING_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'today_tomorrow', regex: /\b(today|tomorrow|tonight|this morning|this afternoon|this evening)\b/i },
  { label: 'schedule_calendar', regex: /\b(schedule|scheduled|calendar|event|events|meeting|meetings|time block|time-block)\b/i },
  { label: 'conflicts_overload', regex: /\b(conflict|conflicts|overlap|overlaps|overlapping|overload|overloaded|overbooked|packed|bandwidth|capacity|free time|availability)\b/i },
  { label: 'next_week_plan', regex: /\b(next week|this week|rest of the week|prioritiz\w*|triage|what should i do next|plan my day|plan my week)\b/i },
];

const PLAN_WORK_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'tasks_backlog', regex: /\b(task|tasks|to-do|todo|todos|overdue|deadline|deadlines|due date|due soon|backlog|urgent)\b/i },
  { label: 'projects_milestones', regex: /\b(project|projects|milestone|milestones|bottleneck|bottlenecks|deliverable|blocker)\b/i },
  { label: 'goals', regex: /\b(goal|goals|target|targets|objective|objectives)\b/i },
];

const HABITS_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'habits', regex: /\b(habit|habits|streak|streaks|adherence|consistency|consistent)\b/i },
  { label: 'missed_partial', regex: /\b(missed|partial|check-in|check in|weekly quota|times per week|skip|skipped)\b/i },
];

const FITNESS_ROUTINES_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'fitness', regex: /\b(workout|workouts|gym|cardio|strength|mobility|recovery|exercise|training|lift|lifting|run|running|fitness)\b/i },
  { label: 'routines', regex: /\b(routine|routines|morning routine|evening routine|afternoon routine|wind-down|wind down|steps|checklist)\b/i },
];

const BROAD_REVIEW_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'broad_review', regex: /\b(how am i doing|how's my|progress review|weekly review|monthly review|overall|big picture|summary|summarize|where do i stand|across everything|audit my|reflect|reflection)\b/i },
  { label: 'stats_trend', regex: /\b(statistics|stats|analytics|metrics|trends|trend|completion rate|throughput)\b/i },
];

const FOLLOW_UP_PHRASES_REGEX =
  /^(and|also|what about|how about|why|which|which ones|those|these|them|that|it|ok|okay|yes|yeah|sure|please|next|more|elaborate|explain)\b|\b(what about tomorrow|how about next week|break it down|break them down|prioritize those|schedule those|which one|any conflicts|what else)\b/i;

function matchSignals(
  text: string,
  patterns: Array<{ label: string; regex: RegExp }>
): string[] {
  const hits: string[] = [];
  for (const item of patterns) {
    if (item.regex.test(text)) {
      hits.push(item.label);
    }
  }
  return hits;
}

function detectStatsPreset(
  message: string,
  previousPreset?: StatisticsPeriodPreset | null
): SupportedStatsPreset {
  if (/\b(year to date|ytd|this year|so far this year)\b/i.test(message)) {
    return 'ytd';
  }
  if (/\b(90 days|last 90|past 90|three months|3 months|quarter|quarterly)\b/i.test(message)) {
    return '90d';
  }
  if (/\b(this month|current month)\b/i.test(message)) {
    return 'month';
  }
  if (/\b(last 7 days|past 7 days|past week|7 days|7d)\b/i.test(message)) {
    return '7d';
  }
  if (/\b(this week|current week|mon-sun)\b/i.test(message)) {
    return 'week';
  }
  if (/\b(30 days|last 30|past 30|past month|last month|30d)\b/i.test(message)) {
    return '30d';
  }
  if (
    previousPreset &&
    previousPreset !== 'custom' &&
    FOLLOW_UP_PHRASES_REGEX.test(message.trim())
  ) {
    return previousPreset;
  }
  return '30d';
}

function detectCalendarWindow(message: string): { pastDays: number; futureDays: number } {
  if (/\b(this month|next month|next 30 days|30 days)\b/i.test(message)) {
    return { pastDays: 3, futureDays: 30 };
  }
  if (/\b(next two weeks|next 2 weeks|two weeks)\b/i.test(message)) {
    return { pastDays: 2, futureDays: 14 };
  }
  if (/\b(last week|past week|yesterday|recent)\b/i.test(message)) {
    return { pastDays: 7, futureDays: 7 };
  }
  return { pastDays: 1, futureDays: 13 };
}

function dedupeDomains(domains: ContextDomainKey[]): ContextDomainKey[] {
  const set = new Set<ContextDomainKey>(domains);
  return ALL_DOMAINS.filter((d) => set.has(d));
}

export function classifyThinkIntent(params: {
  userMessage: string;
  contextSource: ThinkContextSourceValue;
  previousTurnMeta?: PreviousTurnContextMeta | null;
}): IntentClassificationResult {
  const trimmed = params.userMessage.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const schedSignals = matchSignals(trimmed, SCHEDULING_PATTERNS);
  const planSignals = matchSignals(trimmed, PLAN_WORK_PATTERNS);
  const habitSignals = matchSignals(trimmed, HABITS_PATTERNS);
  const fitnessSignals = matchSignals(trimmed, FITNESS_ROUTINES_PATTERNS);
  const broadSignals = matchSignals(trimmed, BROAD_REVIEW_PATTERNS);

  const allSignals = [
    ...schedSignals,
    ...planSignals,
    ...habitSignals,
    ...fitnessSignals,
    ...broadSignals,
  ];

  const statsPreset = detectStatsPreset(trimmed, params.previousTurnMeta?.statsPreset);
  const calendarWindow = detectCalendarWindow(trimmed);
  const includeRecentlyCompletedTasks =
    /\b(completed|done|finished|accomplished|throughput|progress|review|summary|recent|how am i doing)\b/i.test(
      trimmed
    ) || broadSignals.length > 0;

  const hasPreviousHint = Boolean(
    params.previousTurnMeta?.selectedDomains &&
      params.previousTurnMeta.selectedDomains.length > 0
  );

  const looksReferential =
    hasPreviousHint &&
    (FOLLOW_UP_PHRASES_REGEX.test(trimmed) ||
      (wordCount <= 7 && allSignals.length === 0) ||
      (wordCount <= 5 && schedSignals.length <= 1 && planSignals.length === 0 && habitSignals.length === 0 && fitnessSignals.length === 0));

  if (looksReferential && params.previousTurnMeta?.selectedDomains) {
    const combinedDomains: ContextDomainKey[] = [...params.previousTurnMeta.selectedDomains];
    if (schedSignals.length > 0) {
      combinedDomains.push('plan_calendar', 'plan_tasks', 'live_routines');
    }
    if (planSignals.length > 0) {
      combinedDomains.push('plan_tasks', 'plan_projects_goals');
    }
    if (habitSignals.length > 0) {
      combinedDomains.push('live_habits', 'statistics');
    }
    if (fitnessSignals.length > 0) {
      combinedDomains.push('live_workouts', 'live_routines');
    }
    if (broadSignals.length > 0) {
      combinedDomains.push('statistics');
    }

    return {
      intentCategory: 'follow_up_continuity',
      selectedDomains: dedupeDomains(combinedDomains),
      isFollowUp: true,
      usedFollowUpHint: true,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: includeRecentlyCompletedTasks || combinedDomains.includes('plan_tasks'),
      matchedSignals: allSignals.length > 0 ? allSignals : ['follow_up_referential'],
    };
  }

  // Broad review explicitly requested or multiple pillars spanned at once
  const pillarCount =
    (planSignals.length > 0 ? 1 : 0) +
    (habitSignals.length > 0 ? 1 : 0) +
    (fitnessSignals.length > 0 ? 1 : 0);

  if (broadSignals.length > 0 && pillarCount !== 1) {
    return {
      intentCategory: 'broad_review',
      selectedDomains: [...ALL_DOMAINS],
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: true,
      matchedSignals: allSignals,
    };
  }

  if (pillarCount >= 2 && schedSignals.length === 0) {
    const domains: ContextDomainKey[] = ['statistics'];
    if (planSignals.length > 0) domains.push('plan_tasks', 'plan_projects_goals');
    if (habitSignals.length > 0) domains.push('live_habits');
    if (fitnessSignals.length > 0) domains.push('live_workouts', 'live_routines');
    return {
      intentCategory: 'broad_review',
      selectedDomains: dedupeDomains(domains),
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: true,
      matchedSignals: allSignals,
    };
  }

  // Fitness & routines (include calendar if scheduling/time words are present)
  if (fitnessSignals.length > 0 && planSignals.length === 0 && habitSignals.length === 0) {
    const domains: ContextDomainKey[] = ['live_workouts', 'live_routines'];
    if (
      schedSignals.length > 0 ||
      /\b(when|time|calendar|week|today|tomorrow|busy|fit|schedule)\b/i.test(trimmed)
    ) {
      domains.push('plan_calendar');
    }
    if (broadSignals.length > 0 || /\b(summary|progress|month|last 30|trends)\b/i.test(trimmed)) {
      domains.push('statistics');
    }
    return {
      intentCategory: 'fitness_routines',
      selectedDomains: dedupeDomains(domains),
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: false,
      matchedSignals: allSignals,
    };
  }

  // Habits & consistency
  if (habitSignals.length > 0 && planSignals.length === 0) {
    const domains: ContextDomainKey[] = ['live_habits', 'statistics'];
    if (fitnessSignals.length > 0) domains.push('live_routines');
    if (schedSignals.length > 0) domains.push('plan_calendar');
    return {
      intentCategory: 'habits_consistency',
      selectedDomains: dedupeDomains(domains),
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: false,
      matchedSignals: allSignals,
    };
  }

  // Tasks, projects & goals
  if (planSignals.length > 0 && schedSignals.length === 0) {
    const domains: ContextDomainKey[] = ['plan_tasks', 'plan_projects_goals', 'statistics'];
    if (/\b(calendar|when|time|week|schedule)\b/i.test(trimmed)) {
      domains.push('plan_calendar');
    }
    return {
      intentCategory: 'tasks_projects_goals',
      selectedDomains: dedupeDomains(domains),
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: true,
      matchedSignals: allSignals,
    };
  }

  // Scheduling & workload
  if (schedSignals.length > 0) {
    const domains: ContextDomainKey[] = [
      'plan_tasks',
      'plan_calendar',
      'live_habits',
      'live_routines',
    ];
    if (planSignals.length > 0) domains.push('plan_projects_goals');
    if (fitnessSignals.length > 0) domains.push('live_workouts');
    if (broadSignals.length > 0) domains.push('statistics');
    return {
      intentCategory: 'scheduling_workload',
      selectedDomains: dedupeDomains(domains),
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks,
      matchedSignals: allSignals,
    };
  }

  // Fallback by conversation contextSource when message lacks explicit keywords
  if (params.contextSource === 'plan') {
    return {
      intentCategory: 'tasks_projects_goals',
      selectedDomains: ['plan_tasks', 'plan_calendar', 'plan_projects_goals', 'statistics'],
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: true,
      matchedSignals: ['context_source:plan'],
    };
  }

  if (params.contextSource === 'live') {
    return {
      intentCategory: 'habits_consistency',
      selectedDomains: ['live_habits', 'live_workouts', 'live_routines', 'statistics'],
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: false,
      matchedSignals: ['context_source:live'],
    };
  }

  if (params.contextSource === 'home') {
    return {
      intentCategory: 'scheduling_workload',
      selectedDomains: [
        'plan_tasks',
        'plan_calendar',
        'plan_projects_goals',
        'live_habits',
        'live_routines',
      ],
      isFollowUp: false,
      usedFollowUpHint: false,
      statsPreset,
      calendarWindowPastDays: calendarWindow.pastDays,
      calendarWindowFutureDays: calendarWindow.futureDays,
      includeRecentlyCompletedTasks: false,
      matchedSignals: ['context_source:home'],
    };
  }

  // 'general' or 'statistics' default to balanced cross-pillar review
  return {
    intentCategory: 'broad_review',
    selectedDomains: [...ALL_DOMAINS],
    isFollowUp: false,
    usedFollowUpHint: false,
    statsPreset,
    calendarWindowPastDays: calendarWindow.pastDays,
    calendarWindowFutureDays: calendarWindow.futureDays,
    includeRecentlyCompletedTasks: true,
    matchedSignals: [`context_source:${params.contextSource}`],
  };
}
