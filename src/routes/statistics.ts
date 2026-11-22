import { Router } from 'express';
import type { Response } from 'express';
import { getUserStatisticsOverview } from '../db/statistics.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { statisticsQuerySchema } from '../validators/statisticsValidator.ts';
import { formatZodError } from '../validators/taskValidator.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedQuery = statisticsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json(formatZodError(parsedQuery.error));
    return;
  }

  try {
    const overview = await getUserStatisticsOverview({
      userId: req.dbUser.id,
      userTimeZone: req.dbUser.timezone,
      query: parsedQuery.data,
    });
    res.json(overview);
  } catch (error) {
    console.error('Failed to compute user statistics:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to compute statistics right now.';
    res.status(500).json({ error: message });
  }
});

export default router;
