import express, { Express } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import healthRoutes from './routes/health.routes.js';
import aiRoutes from './routes/ai.routes.js';
import authRoutes from './routes/auth.routes.js';
import tasksRoutes from './routes/tasks.routes.js';

export function createExpressApp(): Express {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allowed for dev / Vite inline scripts
      crossOriginEmbedderPolicy: false,
    })
  );

  // Cross-Origin Resource Sharing (CORS) for external frontend / mobile hosting
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Performance Compression
  app.use(compression());

  // JSON Body Parser with 10MB limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${req.path}`);
    next();
  });

  // Global JWT & Auth context middleware
  app.use(authMiddleware);

  // Mount System Health, Auth, Tasks, and AI Model Host Endpoints
  app.use('/api', healthRoutes);
  app.use('/api', aiRoutes);
  app.use('/api', authRoutes);
  app.use('/api', tasksRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createExpressApp;
