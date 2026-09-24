import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { v1Router } from './routes/v1/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app: Express = express();

// Middleware dasar
app.use(cors());
app.use(express.json());

/**
 * Health/liveness check — tidak membutuhkan DB agar bisa dipakai di monitoring & staging.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'mobiljuragan-api',
    version: process.env.APP_VERSION ?? 'dev',
    time: new Date().toISOString(),
  });
});

// REST API v1
app.use('/api/v1', v1Router);

// Catch-all 404 untuk rute yang belum terdaftar
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} tidak ditemukan.`,
      details: {},
    },
  });
});

// Global Error Handler
app.use(errorHandler);

logger.info('Express app configured with CORS, /api/v1 routes, and error handler.');
