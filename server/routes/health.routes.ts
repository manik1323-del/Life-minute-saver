import { Router, Request, Response } from 'express';
import { readDb } from '../db';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: 'json',
  });
});

router.get('/status', (req: Request, res: Response) => {
  try {
    const db = readDb();
    res.json({
      status: 'healthy',
      totalUsers: db.users.length,
      totalTasks: db.tasks.length,
      totalHabits: db.habits.length,
      totalProjects: db.projects.length,
      systemTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

export default router;
