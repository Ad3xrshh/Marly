import { Router } from 'express';
import type { Response } from 'express';
import {
  CalendarEventValidationError,
  createUserCalendarEvent,
  deleteUserCalendarEvent,
  getUserCalendarEventById,
  listUserCalendarEvents,
  updateUserCalendarEvent,
} from '../db/calendarEvents.ts';
import type { CalendarEventRecord } from '../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  calendarEventFilterQuerySchema,
  calendarEventIdParamSchema,
  createCalendarEventSchema,
  formatCalendarZodError,
  updateCalendarEventSchema,
} from '../validators/calendarEventValidator.ts';

const router = Router();

router.use(requireAuth);

function serializeCalendarEvent(record: CalendarEventRecord) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    allDay: record.allDay,
    startDate: record.startDate,
    endDate: record.endDate,
    startAt: record.startAt ? record.startAt.toISOString() : null,
    endAt: record.endAt ? record.endAt.toISOString() : null,
    taskId: record.taskId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = calendarEventFilterQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatCalendarZodError(parsedQuery.error));
    return;
  }

  try {
    const records = await listUserCalendarEvents(req.dbUser.id, parsedQuery.data);
    res.json({ events: records.map(serializeCalendarEvent) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load calendar events right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = calendarEventIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatCalendarZodError(parsedId.error));
    return;
  }

  try {
    const record = await getUserCalendarEventById(req.dbUser.id, parsedId.data);
    if (!record) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    res.json({ event: serializeCalendarEvent(record) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load the requested calendar event.';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createCalendarEventSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatCalendarZodError(parsedBody.error));
    return;
  }

  const data = parsedBody.data;
  try {
    const created = await createUserCalendarEvent(req.dbUser.id, {
      title: data.title,
      description: data.description ?? null,
      category: data.category,
      allDay: data.allDay,
      startDate: data.allDay ? (data.startDate ?? null) : null,
      endDate: data.allDay ? (data.endDate ?? data.startDate ?? null) : null,
      startAt: data.allDay ? null : (data.startAt ?? null),
      endAt: data.allDay ? null : (data.endAt ?? null),
    });
    res.status(201).json({ event: serializeCalendarEvent(created) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create calendar event right now.';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = calendarEventIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatCalendarZodError(parsedId.error));
    return;
  }

  const parsedBody = updateCalendarEventSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatCalendarZodError(parsedBody.error));
    return;
  }

  try {
    const updated = await updateUserCalendarEvent(req.dbUser.id, parsedId.data, parsedBody.data);
    if (!updated) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    res.json({ event: serializeCalendarEvent(updated) });
  } catch (error) {
    if (error instanceof CalendarEventValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Unable to update calendar event right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = calendarEventIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatCalendarZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserCalendarEvent(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to delete calendar event right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
