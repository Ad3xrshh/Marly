import { Router } from 'express';
import type { Response } from 'express';
import type { UserRecord } from '../db/schema.ts';
import { updateUserTimeZone } from '../db/users.ts';
import { getTodayLocalDateForTimeZone } from '../lib/habitSchedule.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { updateTimezoneSchema } from '../validators/habitValidator.ts';
import { formatZodError } from '../validators/taskValidator.ts';

const router = Router();
router.use(requireAuth);

function serializeMe(record: UserRecord) {
  const effectiveTimezone = record.timezone ?? 'UTC';
  return {
    id: record.id,
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    timezone: record.timezone,
    effectiveTimezone,
    timezoneInitialized: Boolean(record.timezone),
    todayLocalDate: getTodayLocalDateForTimeZone(effectiveTimezone),
  };
}

router.get('/', (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user: serializeMe(req.dbUser) });
});

router.patch('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = updateTimezoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(formatZodError(parsed.error));
    return;
  }

  try {
    const updated = await updateUserTimeZone(req.dbUser.id, parsed.data.timezone);
    if (!updated) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    res.json({ user: serializeMe(updated) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update timezone preference.';
    res.status(500).json({ error: message });
  }
});

export default router;
