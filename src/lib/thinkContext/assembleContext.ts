import type { ThinkContextSourceValue } from '../../db/schema.ts';
import { getTodayLocalDateForTimeZone, resolveEffectiveTimeZone } from '../timezone.ts';
import { classifyThinkIntent } from './intentClassifier.ts';
import { estimateJsonTokens } from './sanitize.ts';
import { loadLiveContextSlice } from './slices/liveSlice.ts';
import { loadPlanContextSlice } from './slices/planSlice.ts';
import { loadStatsContextSlice } from './slices/statsSlice.ts';
import {
  THINK_CONTEXT_RETRIEVAL_LIMITS,
  type ContextBudgetSummary,
  type ContextDomainKey,
  type ContextTruncationRecord,
  type GroundedEntityCatalogEntry,
  type PreviousTurnContextMeta,
  type ThinkContextAssemblyResult,
  type ThinkWorkspaceContextPacket,
} from './types.ts';

export interface AssembleThinkContextLoaders {
  loadPlan?: typeof loadPlanContextSlice;
  loadLive?: typeof loadLiveContextSlice;
  loadStats?: typeof loadStatsContextSlice;
}

export interface AssembleThinkContextParams {
  userId: number;
  userTimeZone: string | null | undefined;
  userMessage: string;
  contextSource: ThinkContextSourceValue;
  previousTurnMeta?: PreviousTurnContextMeta | null;
  tokenBudget?: number;
  now?: Date;
  loaders?: AssembleThinkContextLoaders;
}

function updateTruncationRecord(
  records: ContextTruncationRecord[],
  domain: string,
  included: number,
  reason: 'cap_limit' | 'token_budget'
) {
  const existing = records.find((r) => r.domain === domain);
  if (!existing) return;
  existing.included = included;
  existing.omitted = Math.max(0, existing.totalAvailable - included);
  existing.truncated = included < existing.totalAvailable;
  if (existing.truncated) {
    existing.reason = reason;
  }
}

function buildEntityCatalogFromPacket(
  packet: ThinkWorkspaceContextPacket
): GroundedEntityCatalogEntry[] {
  const catalog: GroundedEntityCatalogEntry[] = [];

  if (packet.plan?.tasks) {
    for (const t of packet.plan.tasks.openTasks) {
      catalog.push({
        entityType: 'task',
        entityId: t.id,
        label: t.title,
        targetRoute: '/plan/tasks',
      });
    }
    for (const t of packet.plan.tasks.recentlyCompletedTasks) {
      catalog.push({
        entityType: 'task',
        entityId: t.id,
        label: t.title,
        targetRoute: '/plan/tasks',
      });
    }
  }

  if (packet.plan?.calendar) {
    for (const ev of packet.plan.calendar.events) {
      catalog.push({
        entityType: 'calendar_event',
        entityId: ev.id,
        label: ev.title,
        targetRoute: '/plan/calendar',
      });
    }
  }

  if (packet.plan?.projectsGoals) {
    for (const p of packet.plan.projectsGoals.projects) {
      catalog.push({
        entityType: 'project',
        entityId: p.id,
        label: p.name,
        targetRoute: '/plan/projects',
      });
      for (const m of p.incompleteMilestones) {
        catalog.push({
          entityType: 'project_milestone',
          entityId: m.id,
          parentId: p.id,
          label: m.title,
          targetRoute: '/plan/projects',
        });
      }
    }
    for (const g of packet.plan.projectsGoals.goals) {
      catalog.push({
        entityType: 'goal',
        entityId: g.id,
        label: g.title,
        targetRoute: '/plan/goals',
      });
      for (const m of g.incompleteMilestones) {
        catalog.push({
          entityType: 'goal_milestone',
          entityId: m.id,
          parentId: g.id,
          label: m.title,
          targetRoute: '/plan/goals',
        });
      }
    }
  }

  if (packet.live?.habits) {
    for (const h of packet.live.habits.habits) {
      catalog.push({
        entityType: 'habit',
        entityId: h.id,
        label: h.name,
        targetRoute: '/live/habits',
      });
    }
  }

  if (packet.live?.workouts) {
    for (const w of packet.live.workouts.recentSessions) {
      catalog.push({
        entityType: 'workout',
        entityId: w.id,
        label: w.title,
        targetRoute: '/live/fitness',
      });
    }
  }

  if (packet.live?.routines) {
    for (const r of packet.live.routines.routines) {
      catalog.push({
        entityType: 'routine',
        entityId: r.id,
        label: r.name,
        targetRoute: '/live/fitness',
      });
    }
  }

  return catalog;
}

function enforceTokenBudget(
  packet: ThinkWorkspaceContextPacket,
  tokenBudget: number
): ContextBudgetSummary {
  const trimmedDomains = new Set<string>();
  let estimatedTokens = estimateJsonTokens(packet);

  if (estimatedTokens <= tokenBudget) {
    return {
      tokenBudget,
      estimatedTokens,
      withinBudget: true,
      estimator: 'utf8_byte_and_lexical_json_conservative_v1',
      trimmedDomains: [],
    };
  }

  const trimArrayStep = <T>(
    arr: T[] | undefined,
    domain: string,
    nextLength: number
  ): boolean => {
    if (!arr || arr.length <= nextLength) return false;
    arr.splice(nextLength);
    updateTruncationRecord(packet.truncation, domain, arr.length, 'token_budget');
    trimmedDomains.add(domain);
    estimatedTokens = estimateJsonTokens(packet);
    return true;
  };

  // Pass 1: Trim secondary verbose recent completed tasks to 4 (preserve at least 2 initially)
  if (packet.plan?.tasks?.recentlyCompletedTasks.length) {
    trimArrayStep(packet.plan.tasks.recentlyCompletedTasks, 'plan.tasks.recentlyCompleted', 4);
  }
  if (estimatedTokens > tokenBudget && packet.plan?.tasks?.recentlyCompletedTasks.length) {
    trimArrayStep(packet.plan.tasks.recentlyCompletedTasks, 'plan.tasks.recentlyCompleted', 2);
  }

  // Pass 2: Trim routine snapshots & step patterns before shrinking core items
  if (estimatedTokens > tokenBudget && packet.live?.routines) {
    for (const r of packet.live.routines.routines) {
      if (r.recentSnapshots.length > 3) {
        r.recentSnapshots = r.recentSnapshots.slice(0, 3);
      }
      if (r.stepPatterns.length > 4) {
        r.stepPatterns = r.stepPatterns.slice(0, 4);
      }
    }
    estimatedTokens = estimateJsonTokens(packet);
  }

  // Pass 3: Strip optional descriptions/notes before removing core entities
  if (estimatedTokens > tokenBudget) {
    if (packet.plan?.tasks) {
      for (const t of packet.plan.tasks.openTasks) t.description = null;
    }
    if (packet.plan?.calendar) {
      for (const ev of packet.plan.calendar.events) ev.description = null;
    }
    if (packet.plan?.projectsGoals) {
      for (const p of packet.plan.projectsGoals.projects) p.description = null;
      for (const g of packet.plan.projectsGoals.goals) g.description = null;
    }
    if (packet.live?.habits) {
      for (const h of packet.live.habits.habits) h.description = null;
    }
    if (packet.live?.workouts) {
      for (const w of packet.live.workouts.recentSessions) w.notes = null;
    }
    if (packet.live?.routines) {
      for (const r of packet.live.routines.routines) r.description = null;
    }
    estimatedTokens = estimateJsonTokens(packet);
  }

  // Pass 4: Progressively reduce domain item counts down to minimum floors while preserving top-ranked entities
  const trimSchedule: Array<() => boolean> = [
    () => trimArrayStep(packet.plan?.tasks?.recentlyCompletedTasks, 'plan.tasks.recentlyCompleted', 0),
    () => trimArrayStep(packet.live?.workouts?.recentSessions, 'live.workouts', 10),
    () => trimArrayStep(packet.live?.routines?.routines, 'live.routines', 8),
    () => trimArrayStep(packet.plan?.calendar?.events, 'plan.calendar.events', 18),
    () => trimArrayStep(packet.live?.habits?.habits, 'live.habits', 12),
    () => trimArrayStep(packet.plan?.projectsGoals?.projects, 'plan.projects', 8),
    () => trimArrayStep(packet.plan?.projectsGoals?.goals, 'plan.goals', 8),
    () => trimArrayStep(packet.plan?.tasks?.openTasks, 'plan.tasks.open', 18),

    () => trimArrayStep(packet.live?.workouts?.recentSessions, 'live.workouts', 5),
    () => trimArrayStep(packet.live?.routines?.routines, 'live.routines', 5),
    () => trimArrayStep(packet.plan?.calendar?.events, 'plan.calendar.events', 10),
    () => trimArrayStep(packet.live?.habits?.habits, 'live.habits', 8),
    () => trimArrayStep(packet.plan?.projectsGoals?.projects, 'plan.projects', 5),
    () => trimArrayStep(packet.plan?.projectsGoals?.goals, 'plan.goals', 5),
    () => trimArrayStep(packet.plan?.tasks?.openTasks, 'plan.tasks.open', 10),

    () => trimArrayStep(packet.live?.workouts?.recentSessions, 'live.workouts', 3),
    () => trimArrayStep(packet.live?.routines?.routines, 'live.routines', 3),
    () => trimArrayStep(packet.plan?.calendar?.events, 'plan.calendar.events', 6),
    () => trimArrayStep(packet.live?.habits?.habits, 'live.habits', 5),
    () => trimArrayStep(packet.plan?.projectsGoals?.projects, 'plan.projects', 3),
    () => trimArrayStep(packet.plan?.projectsGoals?.goals, 'plan.goals', 3),
    () => trimArrayStep(packet.plan?.tasks?.openTasks, 'plan.tasks.open', 6),
  ];

  for (const applyTrim of trimSchedule) {
    if (estimatedTokens <= tokenBudget) break;
    applyTrim();
  }

  // Pass 5a: Trim nested arrays (milestones, routine steps, calendar overlaps/dailySummaries)
  if (estimatedTokens > tokenBudget) {
    if (packet.plan?.projectsGoals) {
      for (const p of packet.plan.projectsGoals.projects) {
        if (p.incompleteMilestones.length > 2) {
          p.milestonesTruncatedCount += p.incompleteMilestones.length - 2;
          p.incompleteMilestones = p.incompleteMilestones.slice(0, 2);
        }
      }
      for (const g of packet.plan.projectsGoals.goals) {
        if (g.incompleteMilestones.length > 2) {
          g.milestonesTruncatedCount += g.incompleteMilestones.length - 2;
          g.incompleteMilestones = g.incompleteMilestones.slice(0, 2);
        }
      }
    }
    if (packet.live?.routines) {
      for (const r of packet.live.routines.routines) {
        if (r.steps.length > 5) {
          r.steps = r.steps.slice(0, 5);
          r.stepsTruncated = true;
        }
        if (r.recentSnapshots.length > 1) {
          r.recentSnapshots = r.recentSnapshots.slice(0, 1);
        }
        if (r.stepPatterns.length > 2) {
          r.stepPatterns = r.stepPatterns.slice(0, 2);
        }
      }
    }
    if (packet.plan?.calendar) {
      if (packet.plan.calendar.overlaps.length > 4) {
        packet.plan.calendar.overlaps = packet.plan.calendar.overlaps.slice(0, 4);
      }
      if (packet.plan.calendar.dailySummaries.length > 7) {
        packet.plan.calendar.dailySummaries = packet.plan.calendar.dailySummaries.slice(0, 7);
      }
    }
    estimatedTokens = estimateJsonTokens(packet);
  }

  // Pass 5b: Tighter entity list caps when all 7 domains are loaded concurrently
  const tightTrimSchedule: Array<() => boolean> = [
    () => trimArrayStep(packet.live?.workouts?.recentSessions, 'live.workouts', 2),
    () => trimArrayStep(packet.live?.routines?.routines, 'live.routines', 2),
    () => trimArrayStep(packet.plan?.calendar?.events, 'plan.calendar.events', 4),
    () => trimArrayStep(packet.live?.habits?.habits, 'live.habits', 3),
    () => trimArrayStep(packet.plan?.projectsGoals?.projects, 'plan.projects', 2),
    () => trimArrayStep(packet.plan?.projectsGoals?.goals, 'plan.goals', 2),
    () => trimArrayStep(packet.plan?.tasks?.openTasks, 'plan.tasks.open', 4),
  ];

  for (const applyTrim of tightTrimSchedule) {
    if (estimatedTokens <= tokenBudget) break;
    applyTrim();
  }

  // Pass 5c: Extreme fallback if still above budget — prune nested step/milestone lists & optional stats breakdowns
  if (estimatedTokens > tokenBudget) {
    if (packet.live?.routines) {
      for (const r of packet.live.routines.routines) {
        if (r.steps.length > 0) {
          r.steps = [];
          r.stepsTruncated = r.stepsCount > 0;
        }
        r.recentSnapshots = [];
        r.stepPatterns = [];
      }
    }
    if (packet.plan?.projectsGoals) {
      for (const p of packet.plan.projectsGoals.projects) {
        p.milestonesTruncatedCount += p.incompleteMilestones.length;
        p.incompleteMilestones = [];
      }
      for (const g of packet.plan.projectsGoals.goals) {
        g.milestonesTruncatedCount += g.incompleteMilestones.length;
        g.incompleteMilestones = [];
      }
    }
    if (packet.statistics) {
      packet.statistics.planSummary.priorityBreakdown = [];
      packet.statistics.planSummary.categoryBreakdown = [];
      packet.statistics.liveSummary.fitness.activityMix = [];
      packet.statistics.liveSummary.topDailyStreaks =
        packet.statistics.liveSummary.topDailyStreaks.slice(0, 3);
      trimmedDomains.add('statistics.breakdowns');
    }
    estimatedTokens = estimateJsonTokens(packet);
  }

  return {
    tokenBudget,
    estimatedTokens,
    withinBudget: estimatedTokens <= tokenBudget,
    estimator: 'utf8_byte_and_lexical_json_conservative_v1',
    trimmedDomains: Array.from(trimmedDomains),
  };
}

export async function assembleThinkContext(
  params: AssembleThinkContextParams
): Promise<ThinkContextAssemblyResult> {
  const retrievedAt = (params.now ?? new Date()).toISOString();
  const { effectiveTimeZone, timezoneInitialized } = resolveEffectiveTimeZone(
    params.userTimeZone
  );
  const todayLocalDate = getTodayLocalDateForTimeZone(effectiveTimeZone, params.now);

  const classification = classifyThinkIntent({
    userMessage: params.userMessage,
    contextSource: params.contextSource,
    previousTurnMeta: params.previousTurnMeta,
  });

  const selectedSet = new Set<ContextDomainKey>(classification.selectedDomains);
  const includePlanTasks = selectedSet.has('plan_tasks');
  const includePlanCalendar = selectedSet.has('plan_calendar');
  const includePlanProjectsGoals = selectedSet.has('plan_projects_goals');
  const includePlanAny = includePlanTasks || includePlanCalendar || includePlanProjectsGoals;

  const includeLiveHabits = selectedSet.has('live_habits');
  const includeLiveWorkouts = selectedSet.has('live_workouts');
  const includeLiveRoutines = selectedSet.has('live_routines');
  const includeLiveAny = includeLiveHabits || includeLiveWorkouts || includeLiveRoutines;

  const includeStats = selectedSet.has('statistics');

  const planLoader = params.loaders?.loadPlan ?? loadPlanContextSlice;
  const liveLoader = params.loaders?.loadLive ?? loadLiveContextSlice;
  const statsLoader = params.loaders?.loadStats ?? loadStatsContextSlice;

  const [planSettled, liveSettled, statsSettled] = await Promise.allSettled([
    includePlanAny
      ? planLoader({
          userId: params.userId,
          effectiveTimeZone,
          todayLocalDate,
          includeTasks: includePlanTasks,
          includeCalendar: includePlanCalendar,
          includeProjectsGoals: includePlanProjectsGoals,
          includeRecentlyCompletedTasks: classification.includeRecentlyCompletedTasks,
          calendarWindowPastDays: classification.calendarWindowPastDays,
          calendarWindowFutureDays: classification.calendarWindowFutureDays,
        })
      : Promise.resolve(null),
    includeLiveAny
      ? liveLoader({
          userId: params.userId,
          effectiveTimeZone,
          todayLocalDate,
          includeHabits: includeLiveHabits,
          includeWorkouts: includeLiveWorkouts,
          includeRoutines: includeLiveRoutines,
        })
      : Promise.resolve(null),
    includeStats
      ? statsLoader({
          userId: params.userId,
          userTimeZone: effectiveTimeZone,
          preset: classification.statsPreset,
        })
      : Promise.resolve(null),
  ]);

  const degradedDomains: ContextDomainKey[] = [];
  let attemptedSlices = 0;
  let succeededSlices = 0;

  let planResult = null;
  if (includePlanAny) {
    attemptedSlices += 1;
    if (planSettled.status === 'fulfilled') {
      planResult = planSettled.value;
      succeededSlices += 1;
    } else {
      console.error('THINK PLAN context slice failed:', planSettled.reason);
      if (includePlanTasks) degradedDomains.push('plan_tasks');
      if (includePlanCalendar) degradedDomains.push('plan_calendar');
      if (includePlanProjectsGoals) degradedDomains.push('plan_projects_goals');
    }
  }

  let liveResult = null;
  if (includeLiveAny) {
    attemptedSlices += 1;
    if (liveSettled.status === 'fulfilled') {
      liveResult = liveSettled.value;
      succeededSlices += 1;
    } else {
      console.error('THINK LIVE context slice failed:', liveSettled.reason);
      if (includeLiveHabits) degradedDomains.push('live_habits');
      if (includeLiveWorkouts) degradedDomains.push('live_workouts');
      if (includeLiveRoutines) degradedDomains.push('live_routines');
    }
  }

  let statsResult = null;
  if (includeStats) {
    attemptedSlices += 1;
    if (statsSettled.status === 'fulfilled') {
      statsResult = statsSettled.value;
      succeededSlices += 1;
    } else {
      console.error('THINK STATISTICS context slice failed:', statsSettled.reason);
      degradedDomains.push('statistics');
    }
  }

  if (attemptedSlices > 0 && succeededSlices === 0) {
    throw new Error('Unable to retrieve THINK workspace context right now.');
  }

  const degradedSet = new Set<ContextDomainKey>(degradedDomains);
  const domainsConsulted = classification.selectedDomains.filter((d) => !degradedSet.has(d));
  const degraded = degradedDomains.length > 0;

  const truncations: ContextTruncationRecord[] = [
    ...(planResult?.truncations ?? []),
    ...(liveResult?.truncations ?? []),
  ];

  const packet: ThinkWorkspaceContextPacket = {
    anchor: {
      todayLocalDate,
      effectiveTimeZone,
      timezoneInitialized,
      contextSource: params.contextSource,
    },
    intent: {
      category: classification.intentCategory,
      selectedDomains: classification.selectedDomains,
      isFollowUp: classification.isFollowUp,
      usedFollowUpHint: classification.usedFollowUpHint,
    },
    ...(planResult ? { plan: planResult.slice } : {}),
    ...(liveResult ? { live: liveResult.slice } : {}),
    ...(statsResult ? { statistics: statsResult } : {}),
    truncation: truncations,
    ...(degraded ? { degraded: { isDegraded: true, degradedDomains } } : {}),
  };

  const tokenBudget = Math.max(
    THINK_CONTEXT_RETRIEVAL_LIMITS.MIN_TOKEN_BUDGET,
    params.tokenBudget ?? THINK_CONTEXT_RETRIEVAL_LIMITS.DEFAULT_TOKEN_BUDGET
  );
  const budget = enforceTokenBudget(packet, tokenBudget);
  const entityCatalog = buildEntityCatalogFromPacket(packet);

  return {
    packet,
    classification,
    budget,
    entityCatalog,
    degraded,
    degradedDomains,
    domainsConsulted,
    retrievedAt,
  };
}
