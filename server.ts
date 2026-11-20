import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import calendarEventsRouter from './src/routes/calendarEvents.ts';
import goalsRouter from './src/routes/goals.ts';
import habitsRouter, { habitLogsRouter } from './src/routes/habits.ts';
import meRouter from './src/routes/me.ts';
import projectsRouter from './src/routes/projects.ts';
import tasksRouter from './src/routes/tasks.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));

  // Malformed JSON payload guard for API requests
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err && req.path.startsWith('/api')) {
      res.status(400).json({ error: 'Invalid JSON request body' });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'marly-api' });
  });

  app.use('/api/me', meRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/calendar-events', calendarEventsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/habits', habitsRouter);
  app.use('/api/habit-logs', habitLogsRouter);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Marly server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Marly server:', error);
  process.exit(1);
});
