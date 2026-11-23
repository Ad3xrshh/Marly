import { and, asc, eq, gt, gte, lt, lte, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  calendarEvents,
  goalMilestones,
  goals,
  projectMilestones,
  projects,
  tasks,
  type TaskPriorityValue,
} from '../../../db/schema.ts';
import { computeGoalProgress, computeProjectProgress, type ProjectProgressSummary } from '../../progress.ts';
import {
  addDaysToLocalDate,
  formatTimestampInTimeZoneToLocalDate,
  formatTimestampInTimeZoneToLocalParts,
  getUtcInstantForLocalMidnight,
} from '../../timezone.ts';
import { sanitizeContextText, sanitizeRequiredContextLabel } from '../sanitize.ts';
import {
  THINK_CONTEXT_RETRIEVAL_LIMITS,
  THINK_TEXT_BOUNDS,
  type ContextTruncationRecord,
  type GroundedEntityCatalogEntry,
  type PlanCalendarDailySummary,
  type PlanCalendarEventContextItem,
  type PlanCalendarOverlapItem,
  type PlanContextSlice,
  type PlanGoalContextItem,
  type PlanProjectContextItem,
  type PlanTaskContextItem,
} from '../types.ts';

const PRIORITY_WEIGHT: Record<TaskPriorityValue, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PROJECT_STATUS_RANK: Record<string, number> = {
  active: 0,
  planned: 1,
  on_hold: 2,
};

const GOAL_STATUS_RANK: Record<string, number> = {
  active: 0,
  planned: 1,
  paused: 2,
};

export interface LoadPlanSliceParams {
  userId: number;
  effectiveTimeZone: string;
  todayLocalDate: string;
  includeTasks: boolean;
  includeCalendar: boolean;
  includeProjectsGoals: boolean;
  includeRecentlyCompletedTasks: boolean;
  calendarWindowPastDays: number;
  calendarWindowFutureDays: number;
}

export interface LoadPlanSliceResult {
  slice: PlanContextSlice;
  truncations: ContextTruncationRecord[];
  catalogEntries: GroundedEntityCatalogEntry[];
}

function getTaskDueBucket(dueDate: string | null, todayLocalDate: string, dueSoonCutoff: string): number {
  if (!dueDate) return 3;
  if (dueDate < todayLocalDate) return 0; // overdue
  if (dueDate === todayLocalDate) return 1; // due today
  if (dueDate <= dueSoonCutoff) return 2; // due within 7 days
  return 3;
}

export async function loadPlanContextSlice(
  params: LoadPlanSliceParams
): Promise<LoadPlanSliceResult> {
  const {
    userId,
    effectiveTimeZone,
    todayLocalDate,
    includeTasks,
    includeCalendar,
    includeProjectsGoals,
    includeRecentlyCompletedTasks,
    calendarWindowPastDays,
    calendarWindowFutureDays,
  } = params;

  const slice: PlanContextSlice = {};
  const truncations: ContextTruncationRecord[] = [];
  const catalogEntries: GroundedEntityCatalogEntry[] = [];

  const needTasksQuery = includeTasks || includeProjectsGoals;
  const needProjectsFull = includeProjectsGoals;
  const needGoalsFull = includeProjectsGoals;

  const windowFrom = addDaysToLocalDate(todayLocalDate, -calendarWindowPastDays);
  const windowTo = addDaysToLocalDate(todayLocalDate, calendarWindowFutureDays);
  const rangeStart = new Date(getUtcInstantForLocalMidnight(windowFrom, effectiveTimeZone));
  const rangeEnd = new Date(
    getUtcInstantForLocalMidnight(addDaysToLocalDate(windowTo, 1), effectiveTimeZone)
  );

  const [
    taskRows,
    projectRows,
    goalRows,
    projectMilestoneRows,
    goalMilestoneRows,
    calendarRows,
  ] = await Promise.all([
    needTasksQuery
      ? db.select().from(tasks).where(eq(tasks.userId, userId))
      : Promise.resolve([]),
    needProjectsFull
      ? db.select().from(projects).where(eq(projects.userId, userId))
      : includeTasks
        ? db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(eq(projects.userId, userId))
        : Promise.resolve([]),
    needGoalsFull
      ? db.select().from(goals).where(eq(goals.userId, userId))
      : includeTasks
        ? db
            .select({ id: goals.id, title: goals.title })
            .from(goals)
            .where(eq(goals.userId, userId))
        : Promise.resolve([]),
    needProjectsFull
      ? db
          .select()
          .from(projectMilestones)
          .where(eq(projectMilestones.userId, userId))
          .orderBy(asc(projectMilestones.sortOrder), asc(projectMilestones.id))
      : Promise.resolve([]),
    needGoalsFull
      ? db
          .select()
          .from(goalMilestones)
          .where(eq(goalMilestones.userId, userId))
          .orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.id))
      : Promise.resolve([]),
    includeCalendar
      ? db
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.userId, userId),
              or(
                and(
                  eq(calendarEvents.allDay, true),
                  lte(calendarEvents.startDate, windowTo),
                  gte(calendarEvents.endDate, windowFrom)
                ),
                and(
                  eq(calendarEvents.allDay, false),
                  lt(calendarEvents.startAt, rangeEnd),
                  gt(calendarEvents.endAt, rangeStart)
                )
              )
            )
          )
          .orderBy(
            asc(calendarEvents.startDate),
            asc(calendarEvents.startAt),
            asc(calendarEvents.id)
          )
      : Promise.resolve([]),
  ]);

  const projectNameMap = new Map<number, string>();
  for (const p of projectRows) {
    projectNameMap.set(
      p.id,
      sanitizeRequiredContextLabel(p.name, THINK_TEXT_BOUNDS.TITLE_MAX)
    );
  }

  const goalTitleMap = new Map<number, string>();
  for (const g of goalRows) {
    goalTitleMap.set(
      g.id,
      sanitizeRequiredContextLabel(g.title, THINK_TEXT_BOUNDS.TITLE_MAX)
    );
  }

  // --------------------------------------------------------------------------
  // 1. Tasks
  // --------------------------------------------------------------------------
  if (includeTasks) {
    const dueSoonCutoff = addDaysToLocalDate(todayLocalDate, 7);
    const recentCompletedCutoff = addDaysToLocalDate(
      todayLocalDate,
      -(THINK_CONTEXT_RETRIEVAL_LIMITS.RECENT_COMPLETED_TASKS_DAYS - 1)
    );

    const openTaskRows = taskRows.filter((t) => t.status !== 'completed');
    let todoCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueSoon7dCount = 0;
    let noDueDateCount = 0;
    let urgentOrHighOpenCount = 0;

    for (const t of openTaskRows) {
      if (t.status === 'in_progress') inProgressCount += 1;
      else todoCount += 1;

      if (t.priority === 'urgent' || t.priority === 'high') {
        urgentOrHighOpenCount += 1;
      }

      if (!t.dueDate) {
        noDueDateCount += 1;
      } else if (t.dueDate < todayLocalDate) {
        overdueCount += 1;
      } else if (t.dueDate === todayLocalDate) {
        dueTodayCount += 1;
      } else if (t.dueDate <= dueSoonCutoff) {
        dueSoon7dCount += 1;
      }
    }

    const rankedOpen = [...openTaskRows].sort((a, b) => {
      const bucketA = getTaskDueBucket(a.dueDate, todayLocalDate, dueSoonCutoff);
      const bucketB = getTaskDueBucket(b.dueDate, todayLocalDate, dueSoonCutoff);
      if (bucketA !== bucketB) return bucketA - bucketB;

      const prioDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (prioDiff !== 0) return prioDiff;

      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;

      const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (updatedDiff !== 0) return updatedDiff;
      return b.id - a.id;
    });

    const cappedOpen = rankedOpen.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.OPEN_TASKS_MAX);

    const openTasks: PlanTaskContextItem[] = cappedOpen.map((t) => {
      const title = sanitizeRequiredContextLabel(t.title, THINK_TEXT_BOUNDS.TITLE_MAX);
      const desc = sanitizeContextText(t.description, THINK_TEXT_BOUNDS.DESCRIPTION_MAX).text;
      const isOverdue = Boolean(t.dueDate && t.dueDate < todayLocalDate);

      catalogEntries.push({
        entityType: 'task',
        entityId: t.id,
        label: title,
        targetRoute: '/plan/tasks',
      });

      return {
        id: t.id,
        title,
        description: desc,
        status: t.status,
        priority: t.priority,
        category: t.category,
        dueDate: t.dueDate,
        isOverdue,
        projectId: t.projectId,
        projectName: t.projectId ? (projectNameMap.get(t.projectId) ?? null) : null,
        goalId: t.goalId,
        goalTitle: t.goalId ? (goalTitleMap.get(t.goalId) ?? null) : null,
        completedAtLocalDate: null,
      };
    });

    const recentCompletedRows = taskRows
      .filter((t) => t.status === 'completed' && t.completedAt !== null)
      .map((t) => ({
        row: t,
        completedAtLocalDate: formatTimestampInTimeZoneToLocalDate(
          t.completedAt!,
          effectiveTimeZone
        ),
      }))
      .filter(
        (item) =>
          item.completedAtLocalDate >= recentCompletedCutoff &&
          item.completedAtLocalDate <= todayLocalDate
      )
      .sort((a, b) => {
        const timeDiff = b.row.completedAt!.getTime() - a.row.completedAt!.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.row.id - a.row.id;
      });

    const cappedRecentCompleted = includeRecentlyCompletedTasks
      ? recentCompletedRows.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.RECENT_COMPLETED_TASKS_MAX)
      : [];

    const recentlyCompletedTasks: PlanTaskContextItem[] = cappedRecentCompleted.map(
      ({ row: t, completedAtLocalDate }) => {
        const title = sanitizeRequiredContextLabel(t.title, THINK_TEXT_BOUNDS.TITLE_MAX);
        catalogEntries.push({
          entityType: 'task',
          entityId: t.id,
          label: title,
          targetRoute: '/plan/tasks',
        });
        return {
          id: t.id,
          title,
          description: null,
          status: t.status,
          priority: t.priority,
          category: t.category,
          dueDate: t.dueDate,
          isOverdue: false,
          projectId: t.projectId,
          projectName: t.projectId ? (projectNameMap.get(t.projectId) ?? null) : null,
          goalId: t.goalId,
          goalTitle: t.goalId ? (goalTitleMap.get(t.goalId) ?? null) : null,
          completedAtLocalDate,
        };
      }
    );

    slice.tasks = {
      summary: {
        totalOpen: openTaskRows.length,
        todoCount,
        inProgressCount,
        overdueCount,
        dueTodayCount,
        dueSoon7dCount,
        noDueDateCount,
        urgentOrHighOpenCount,
        recentlyCompletedWindowDays: THINK_CONTEXT_RETRIEVAL_LIMITS.RECENT_COMPLETED_TASKS_DAYS,
        recentlyCompletedTotal: recentCompletedRows.length,
      },
      openTasks,
      recentlyCompletedTasks,
    };

    truncations.push({
      domain: 'plan.tasks.open',
      truncated: openTasks.length < openTaskRows.length,
      totalAvailable: openTaskRows.length,
      included: openTasks.length,
      omitted: Math.max(0, openTaskRows.length - openTasks.length),
      reason: openTasks.length < openTaskRows.length ? 'cap_limit' : 'within_limits',
    });

    if (includeRecentlyCompletedTasks) {
      truncations.push({
        domain: 'plan.tasks.recentlyCompleted',
        truncated: recentlyCompletedTasks.length < recentCompletedRows.length,
        totalAvailable: recentCompletedRows.length,
        included: recentlyCompletedTasks.length,
        omitted: Math.max(0, recentCompletedRows.length - recentlyCompletedTasks.length),
        reason:
          recentlyCompletedTasks.length < recentCompletedRows.length
            ? 'cap_limit'
            : 'within_limits',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Calendar
  // --------------------------------------------------------------------------
  if (includeCalendar) {
    const allDayInWindow = calendarRows.filter(
      (ev) => ev.allDay && ev.startDate && ev.endDate && ev.startDate <= windowTo && ev.endDate >= windowFrom
    );
    const timedInWindow = calendarRows.filter(
      (ev) =>
        !ev.allDay &&
        ev.startAt &&
        ev.endAt &&
        ev.startAt.getTime() < rangeEnd.getTime() &&
        ev.endAt.getTime() > rangeStart.getTime()
    );

    const windowEvents = [...allDayInWindow, ...timedInWindow];

    // Daily scheduled-hour summaries & overlap detection using authoritative local-midnight instants
    const dailySummaries: PlanCalendarDailySummary[] = [];
    const overlaps: PlanCalendarOverlapItem[] = [];
    let totalTimedMs = 0;

    let dayCursor = windowFrom;
    while (dayCursor <= windowTo) {
      const dayStartMs = getUtcInstantForLocalMidnight(dayCursor, effectiveTimeZone);
      const dayEndMs = getUtcInstantForLocalMidnight(
        addDaysToLocalDate(dayCursor, 1),
        effectiveTimeZone
      );

      let dayAllDayCount = 0;
      for (const ev of allDayInWindow) {
        if (ev.startDate && ev.endDate && ev.startDate <= dayCursor && ev.endDate >= dayCursor) {
          dayAllDayCount += 1;
        }
      }

      const dayTimedIntervals: Array<{
        id: number;
        title: string;
        startMs: number;
        endMs: number;
      }> = [];

      let dayTimedMs = 0;
      for (const ev of timedInWindow) {
        const sMs = ev.startAt!.getTime();
        const eMs = ev.endAt!.getTime();
        if (sMs < dayEndMs && eMs > dayStartMs) {
          const clampedStart = Math.max(sMs, dayStartMs);
          const clampedEnd = Math.min(eMs, dayEndMs);
          if (clampedEnd > clampedStart) {
            dayTimedMs += clampedEnd - clampedStart;
            dayTimedIntervals.push({
              id: ev.id,
              title: sanitizeRequiredContextLabel(ev.title, THINK_TEXT_BOUNDS.TITLE_MAX),
              startMs: clampedStart,
              endMs: clampedEnd,
            });
          }
        }
      }

      dayTimedIntervals.sort((a, b) => a.startMs - b.startMs || a.id - b.id);

      let dayHasOverlaps = false;
      for (let i = 0; i < dayTimedIntervals.length; i += 1) {
        for (let j = i + 1; j < dayTimedIntervals.length; j += 1) {
          const a = dayTimedIntervals[i];
          const b = dayTimedIntervals[j];
          if (b.startMs >= a.endMs) break;
          const overlapMs = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
          if (overlapMs > 0) {
            dayHasOverlaps = true;
            if (overlaps.length < THINK_CONTEXT_RETRIEVAL_LIMITS.CALENDAR_OVERLAPS_MAX) {
              overlaps.push({
                localDate: dayCursor,
                eventAId: a.id,
                eventATitle: a.title,
                eventBId: b.id,
                eventBTitle: b.title,
                overlapMinutes: Math.max(1, Math.round(overlapMs / 60000)),
              });
            }
          }
        }
      }

      totalTimedMs += dayTimedMs;

      if (dayAllDayCount > 0 || dayTimedIntervals.length > 0) {
        const scheduledMinutes = Math.round(dayTimedMs / 60000);
        dailySummaries.push({
          localDate: dayCursor,
          timedEventsCount: dayTimedIntervals.length,
          allDayEventsCount: dayAllDayCount,
          scheduledMinutes,
          scheduledHours: Math.round((scheduledMinutes / 60) * 10) / 10,
          hasOverlaps: dayHasOverlaps,
        });
      }

      dayCursor = addDaysToLocalDate(dayCursor, 1);
    }

    const mappedEvents: Array<{
      sortDate: string;
      sortTime: string;
      isPast: boolean;
      item: PlanCalendarEventContextItem;
    }> = windowEvents.map((ev) => {
      const title = sanitizeRequiredContextLabel(ev.title, THINK_TEXT_BOUNDS.TITLE_MAX);
      const description = sanitizeContextText(
        ev.description,
        THINK_TEXT_BOUNDS.DESCRIPTION_MAX
      ).text;

      if (ev.allDay) {
        const startDate = ev.startDate!;
        const endDate = ev.endDate ?? startDate;
        const isPast = endDate < todayLocalDate;
        return {
          sortDate: startDate,
          sortTime: '00:00',
          isPast,
          item: {
            id: ev.id,
            title,
            description,
            category: ev.category,
            allDay: true,
            startDate,
            endDate,
            localStartDate: startDate,
            localStartTime: null,
            localEndDate: endDate,
            localEndTime: null,
            durationMinutes: null,
            taskId: ev.taskId,
          },
        };
      }

      const startParts = formatTimestampInTimeZoneToLocalParts(ev.startAt!, effectiveTimeZone);
      const endParts = formatTimestampInTimeZoneToLocalParts(ev.endAt!, effectiveTimeZone);
      const durationMinutes = Math.max(
        1,
        Math.round((ev.endAt!.getTime() - ev.startAt!.getTime()) / 60000)
      );
      const isPast = endParts.localDate < todayLocalDate;

      return {
        sortDate: startParts.localDate,
        sortTime: startParts.localTime,
        isPast,
        item: {
          id: ev.id,
          title,
          description,
          category: ev.category,
          allDay: false,
          startDate: null,
          endDate: null,
          localStartDate: startParts.localDate,
          localStartTime: startParts.localTime,
          localEndDate: endParts.localDate,
          localEndTime: endParts.localTime,
          durationMinutes,
          taskId: ev.taskId,
        },
      };
    });

    // Prioritize today & upcoming events chronologically before past-window events
    mappedEvents.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      if (!a.isPast) {
        const dCmp = a.sortDate.localeCompare(b.sortDate);
        if (dCmp !== 0) return dCmp;
        const tCmp = a.sortTime.localeCompare(b.sortTime);
        if (tCmp !== 0) return tCmp;
        return a.item.id - b.item.id;
      }
      const dCmpDesc = b.sortDate.localeCompare(a.sortDate);
      if (dCmpDesc !== 0) return dCmpDesc;
      return b.sortTime.localeCompare(a.sortTime);
    });

    const cappedEvents = mappedEvents
      .slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.CALENDAR_EVENTS_MAX)
      .map((entry) => {
        catalogEntries.push({
          entityType: 'calendar_event',
          entityId: entry.item.id,
          label: entry.item.title,
          targetRoute: '/plan/calendar',
        });
        return entry.item;
      });

    slice.calendar = {
      windowFrom,
      windowTo,
      summary: {
        totalEventsInWindow: windowEvents.length,
        allDayEventsCount: allDayInWindow.length,
        timedEventsCount: timedInWindow.length,
        totalScheduledHours: Math.round((totalTimedMs / 3600000) * 10) / 10,
        overlapsCount: overlaps.length,
      },
      dailySummaries,
      overlaps,
      events: cappedEvents,
    };

    truncations.push({
      domain: 'plan.calendar.events',
      truncated: cappedEvents.length < windowEvents.length,
      totalAvailable: windowEvents.length,
      included: cappedEvents.length,
      omitted: Math.max(0, windowEvents.length - cappedEvents.length),
      reason: cappedEvents.length < windowEvents.length ? 'cap_limit' : 'within_limits',
    });
  }

  // --------------------------------------------------------------------------
  // 3. Projects & Goals
  // --------------------------------------------------------------------------
  if (includeProjectsGoals) {
    const fullProjects = projectRows as Array<typeof projects.$inferSelect>;
    const fullGoals = goalRows as Array<typeof goals.$inferSelect>;

    const milestonesByProject = new Map<number, typeof projectMilestoneRows>();
    for (const m of projectMilestoneRows) {
      const list = milestonesByProject.get(m.projectId) ?? [];
      list.push(m);
      milestonesByProject.set(m.projectId, list);
    }

    const milestonesByGoal = new Map<number, typeof goalMilestoneRows>();
    for (const m of goalMilestoneRows) {
      const list = milestonesByGoal.get(m.goalId) ?? [];
      list.push(m);
      milestonesByGoal.set(m.goalId, list);
    }

    const tasksByProject = new Map<number, typeof taskRows>();
    const tasksByGoal = new Map<number, typeof taskRows>();
    for (const t of taskRows) {
      if (t.projectId !== null) {
        const list = tasksByProject.get(t.projectId) ?? [];
        list.push(t);
        tasksByProject.set(t.projectId, list);
      }
      if (t.goalId !== null) {
        const list = tasksByGoal.get(t.goalId) ?? [];
        list.push(t);
        tasksByGoal.set(t.goalId, list);
      }
    }

    const projectsByGoal = new Map<number, typeof fullProjects>();
    const projectProgressMap = new Map<number, ProjectProgressSummary>();
    for (const p of fullProjects) {
      if (p.goalId !== null) {
        const list = projectsByGoal.get(p.goalId) ?? [];
        list.push(p);
        projectsByGoal.set(p.goalId, list);
      }
      const pMilestones = milestonesByProject.get(p.id) ?? [];
      const pTasks = tasksByProject.get(p.id) ?? [];
      projectProgressMap.set(
        p.id,
        computeProjectProgress({
          status: p.status,
          milestones: pMilestones,
          tasks: pTasks,
        })
      );
    }

    const relevantProjects = fullProjects
      .filter((p) => p.status === 'active' || p.status === 'planned' || p.status === 'on_hold')
      .sort((a, b) => {
        const rankDiff =
          (PROJECT_STATUS_RANK[a.status] ?? 9) - (PROJECT_STATUS_RANK[b.status] ?? 9);
        if (rankDiff !== 0) return rankDiff;
        if (a.targetDate && b.targetDate && a.targetDate !== b.targetDate) {
          return a.targetDate.localeCompare(b.targetDate);
        }
        if (a.targetDate && !b.targetDate) return -1;
        if (!a.targetDate && b.targetDate) return 1;
        const prioDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (prioDiff !== 0) return prioDiff;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

    const cappedProjects = relevantProjects.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.PROJECTS_MAX);

    const projectItems: PlanProjectContextItem[] = cappedProjects.map((p) => {
      const pMilestones = milestonesByProject.get(p.id) ?? [];
      const pTasks = tasksByProject.get(p.id) ?? [];
      const progress = projectProgressMap.get(p.id)!;
      const incompleteMilestonesAll = pMilestones.filter((m) => !m.completed);
      const boundedMilestones = incompleteMilestonesAll.slice(
        0,
        THINK_CONTEXT_RETRIEVAL_LIMITS.PROJECT_MILESTONES_PER_PROJECT_MAX
      );

      const name = sanitizeRequiredContextLabel(p.name, THINK_TEXT_BOUNDS.TITLE_MAX);

      catalogEntries.push({
        entityType: 'project',
        entityId: p.id,
        label: name,
        targetRoute: '/plan/projects',
      });

      for (const m of boundedMilestones) {
        catalogEntries.push({
          entityType: 'project_milestone',
          entityId: m.id,
          parentId: p.id,
          label: sanitizeRequiredContextLabel(m.title, THINK_TEXT_BOUNDS.MILESTONE_TITLE_MAX),
          targetRoute: '/plan/projects',
        });
      }

      return {
        id: p.id,
        name,
        description: sanitizeContextText(p.description, THINK_TEXT_BOUNDS.DESCRIPTION_MAX).text,
        status: p.status,
        priority: p.priority,
        category: p.category,
        startDate: p.startDate,
        targetDate: p.targetDate,
        goalId: p.goalId,
        goalTitle: p.goalId ? (goalTitleMap.get(p.goalId) ?? null) : null,
        progressPercent: progress.progressPercent,
        completedUnits: progress.completedUnits,
        totalUnits: progress.totalUnits,
        openTasksCount: pTasks.filter((t) => t.status !== 'completed').length,
        completedTasksCount: pTasks.filter((t) => t.status === 'completed').length,
        incompleteMilestonesCount: incompleteMilestonesAll.length,
        totalMilestonesCount: pMilestones.length,
        incompleteMilestones: boundedMilestones.map((m) => ({
          id: m.id,
          title: sanitizeRequiredContextLabel(m.title, THINK_TEXT_BOUNDS.MILESTONE_TITLE_MAX),
          dueOrTargetDate: m.dueDate,
          sortOrder: m.sortOrder,
        })),
        milestonesTruncatedCount: Math.max(
          0,
          incompleteMilestonesAll.length - boundedMilestones.length
        ),
      };
    });

    const relevantGoals = fullGoals
      .filter((g) => g.status === 'active' || g.status === 'planned' || g.status === 'paused')
      .sort((a, b) => {
        const rankDiff = (GOAL_STATUS_RANK[a.status] ?? 9) - (GOAL_STATUS_RANK[b.status] ?? 9);
        if (rankDiff !== 0) return rankDiff;
        if (a.targetDate && b.targetDate && a.targetDate !== b.targetDate) {
          return a.targetDate.localeCompare(b.targetDate);
        }
        if (a.targetDate && !b.targetDate) return -1;
        if (!a.targetDate && b.targetDate) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

    const cappedGoals = relevantGoals.slice(0, THINK_CONTEXT_RETRIEVAL_LIMITS.GOALS_MAX);

    const goalItems: PlanGoalContextItem[] = cappedGoals.map((g) => {
      const gMilestones = milestonesByGoal.get(g.id) ?? [];
      const linkedProjects = projectsByGoal.get(g.id) ?? [];
      const gTasks = tasksByGoal.get(g.id) ?? [];

      const progress = computeGoalProgress({
        goalId: g.id,
        status: g.status,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        milestones: gMilestones,
        linkedProjects: linkedProjects.map((p) => ({
          id: p.id,
          status: p.status,
          progress: projectProgressMap.get(p.id)!,
        })),
        goalTasks: gTasks,
      });

      const incompleteMilestonesAll = gMilestones.filter((m) => !m.completed);
      const boundedMilestones = incompleteMilestonesAll.slice(
        0,
        THINK_CONTEXT_RETRIEVAL_LIMITS.GOAL_MILESTONES_PER_GOAL_MAX
      );
      const title = sanitizeRequiredContextLabel(g.title, THINK_TEXT_BOUNDS.TITLE_MAX);

      catalogEntries.push({
        entityType: 'goal',
        entityId: g.id,
        label: title,
        targetRoute: '/plan/goals',
      });

      for (const m of boundedMilestones) {
        catalogEntries.push({
          entityType: 'goal_milestone',
          entityId: m.id,
          parentId: g.id,
          label: sanitizeRequiredContextLabel(m.title, THINK_TEXT_BOUNDS.MILESTONE_TITLE_MAX),
          targetRoute: '/plan/goals',
        });
      }

      return {
        id: g.id,
        title,
        description: sanitizeContextText(g.description, THINK_TEXT_BOUNDS.DESCRIPTION_MAX).text,
        status: g.status,
        category: g.category,
        targetDate: g.targetDate,
        progressPercent: progress.progressPercent,
        mode: progress.mode,
        targetMetricLabel: sanitizeContextText(g.targetMetricLabel, 80).text,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        unit: sanitizeContextText(g.unit, 40).text,
        linkedProjectsCount: linkedProjects.length,
        openTasksCount: gTasks.filter((t) => t.status !== 'completed').length,
        completedTasksCount: gTasks.filter((t) => t.status === 'completed').length,
        incompleteMilestonesCount: incompleteMilestonesAll.length,
        totalMilestonesCount: gMilestones.length,
        incompleteMilestones: boundedMilestones.map((m) => ({
          id: m.id,
          title: sanitizeRequiredContextLabel(m.title, THINK_TEXT_BOUNDS.MILESTONE_TITLE_MAX),
          dueOrTargetDate: m.targetDate,
          sortOrder: m.sortOrder,
        })),
        milestonesTruncatedCount: Math.max(
          0,
          incompleteMilestonesAll.length - boundedMilestones.length
        ),
      };
    });

    slice.projectsGoals = {
      summary: {
        relevantProjectsTotal: relevantProjects.length,
        activeProjectsCount: relevantProjects.filter((p) => p.status === 'active').length,
        plannedProjectsCount: relevantProjects.filter((p) => p.status === 'planned').length,
        onHoldProjectsCount: relevantProjects.filter((p) => p.status === 'on_hold').length,
        relevantGoalsTotal: relevantGoals.length,
        activeGoalsCount: relevantGoals.filter((g) => g.status === 'active').length,
        plannedGoalsCount: relevantGoals.filter((g) => g.status === 'planned').length,
        pausedGoalsCount: relevantGoals.filter((g) => g.status === 'paused').length,
      },
      projects: projectItems,
      goals: goalItems,
    };

    truncations.push({
      domain: 'plan.projects',
      truncated: projectItems.length < relevantProjects.length,
      totalAvailable: relevantProjects.length,
      included: projectItems.length,
      omitted: Math.max(0, relevantProjects.length - projectItems.length),
      reason: projectItems.length < relevantProjects.length ? 'cap_limit' : 'within_limits',
    });

    truncations.push({
      domain: 'plan.goals',
      truncated: goalItems.length < relevantGoals.length,
      totalAvailable: relevantGoals.length,
      included: goalItems.length,
      omitted: Math.max(0, relevantGoals.length - goalItems.length),
      reason: goalItems.length < relevantGoals.length ? 'cap_limit' : 'within_limits',
    });
  }

  return {
    slice,
    truncations,
    catalogEntries,
  };
}
