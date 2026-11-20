import { and, asc, eq, gte, lte, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  calendarEvents,
  type CalendarEventCategoryValue,
  type CalendarEventRecord,
} from './schema.ts';

export class CalendarEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarEventValidationError';
  }
}

export interface CalendarEventFilterParams {
  fromDate?: string;
  toDate?: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  category?: CalendarEventCategoryValue;
}

export interface CreateCalendarEventParams {
  title: string;
  description?: string | null;
  category?: CalendarEventCategoryValue;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAt: Date | null;
  endAt: Date | null;
}

export interface UpdateCalendarEventParams {
  title?: string;
  description?: string | null;
  category?: CalendarEventCategoryValue;
  allDay?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
}

export async function listUserCalendarEvents(
  userId: number,
  filters?: CalendarEventFilterParams
): Promise<CalendarEventRecord[]> {
  try {
    const conditions = [eq(calendarEvents.userId, userId)];

    if (filters?.category) {
      conditions.push(eq(calendarEvents.category, filters.category));
    }

    const hasDateBounds = Boolean(filters?.fromDate && filters?.toDate);
    const hasTimeBounds = Boolean(filters?.rangeStart && filters?.rangeEnd);

    if (hasDateBounds && hasTimeBounds && filters?.fromDate && filters?.toDate && filters?.rangeStart && filters?.rangeEnd) {
      const rangeCondition = or(
        and(
          eq(calendarEvents.allDay, true),
          lte(calendarEvents.startDate, filters.toDate),
          gte(calendarEvents.endDate, filters.fromDate)
        ),
        and(
          eq(calendarEvents.allDay, false),
          lte(calendarEvents.startAt, filters.rangeEnd),
          gte(calendarEvents.endAt, filters.rangeStart)
        )
      );
      if (rangeCondition) {
        conditions.push(rangeCondition);
      }
    } else if (hasDateBounds && filters?.fromDate && filters?.toDate) {
      const dateCondition = and(
        eq(calendarEvents.allDay, true),
        lte(calendarEvents.startDate, filters.toDate),
        gte(calendarEvents.endDate, filters.fromDate)
      );
      if (dateCondition) {
        conditions.push(dateCondition);
      }
    } else if (hasTimeBounds && filters?.rangeStart && filters?.rangeEnd) {
      const timeCondition = and(
        eq(calendarEvents.allDay, false),
        lte(calendarEvents.startAt, filters.rangeEnd),
        gte(calendarEvents.endAt, filters.rangeStart)
      );
      if (timeCondition) {
        conditions.push(timeCondition);
      }
    }

    return await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startDate), asc(calendarEvents.startAt), asc(calendarEvents.id));
  } catch (error) {
    console.error('Failed to list calendar events:', error);
    throw new Error('Unable to load calendar events right now.', { cause: error });
  }
}

export async function getUserCalendarEventById(
  userId: number,
  eventId: number
): Promise<CalendarEventRecord | null> {
  try {
    const rows = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to fetch calendar event:', error);
    throw new Error('Unable to load the requested calendar event.', { cause: error });
  }
}

export async function createUserCalendarEvent(
  userId: number,
  input: CreateCalendarEventParams
): Promise<CalendarEventRecord> {
  try {
    const rows = await db
      .insert(calendarEvents)
      .values({
        userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? 'Work',
        allDay: input.allDay,
        startDate: input.allDay ? input.startDate : null,
        endDate: input.allDay ? input.endDate : null,
        startAt: input.allDay ? null : input.startAt,
        endAt: input.allDay ? null : input.endAt,
      })
      .returning();

    return rows[0];
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    throw new Error('Unable to create calendar event right now.', { cause: error });
  }
}

export async function updateUserCalendarEvent(
  userId: number,
  eventId: number,
  patch: UpdateCalendarEventParams
): Promise<CalendarEventRecord | null> {
  try {
    const existing = await getUserCalendarEventById(userId, eventId);
    if (!existing) {
      return null;
    }

    const nextAllDay = patch.allDay ?? existing.allDay;
    let nextStartDate: string | null = null;
    let nextEndDate: string | null = null;
    let nextStartAt: Date | null = null;
    let nextEndAt: Date | null = null;

    if (nextAllDay) {
      nextStartDate = patch.startDate !== undefined ? patch.startDate : existing.startDate;
      nextEndDate = patch.endDate !== undefined ? patch.endDate : existing.endDate;

      if (!nextStartDate) {
        throw new CalendarEventValidationError('All-day events require a start date (YYYY-MM-DD)');
      }
      if (!nextEndDate) {
        nextEndDate = nextStartDate;
      }
      if (nextEndDate < nextStartDate) {
        throw new CalendarEventValidationError('End date cannot be earlier than start date');
      }
    } else {
      nextStartAt = patch.startAt !== undefined ? patch.startAt : existing.startAt;
      nextEndAt = patch.endAt !== undefined ? patch.endAt : existing.endAt;

      if (!nextStartAt || !nextEndAt) {
        throw new CalendarEventValidationError('Timed events require both start and end date/time');
      }
      if (nextEndAt.getTime() <= nextStartAt.getTime()) {
        throw new CalendarEventValidationError('End date/time must be after start date/time');
      }
    }

    const rows = await db
      .update(calendarEvents)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        allDay: nextAllDay,
        startDate: nextStartDate,
        endDate: nextEndDate,
        startAt: nextStartAt,
        endAt: nextEndAt,
        updatedAt: new Date(),
      })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof CalendarEventValidationError) {
      throw error;
    }
    console.error('Failed to update calendar event:', error);
    throw new Error('Unable to update calendar event right now.', { cause: error });
  }
}

export async function deleteUserCalendarEvent(
  userId: number,
  eventId: number
): Promise<CalendarEventRecord | null> {
  try {
    const rows = await db
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    throw new Error('Unable to delete calendar event right now.', { cause: error });
  }
}
