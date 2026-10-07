import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { v1Router } from './routes/v1/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app: Express = express();

// Middleware dasar
app.use(cors());
app.use(express.json());

// Logger request untuk memantau request masuk
app.use((req: Request, _res: Response, next) => {
  logger.info({ method: req.method, path: req.path }, `${req.method} ${req.path}`);
  next();
});

/**
 * Pemeriksaan kesehatan server, bisa diakses tanpa menyentuh database.
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

// Handler galat global, wajib berada paling akhir
app.use(errorHandler);

logger.info('Aplikasi Express siap: CORS, rute /api/v1, dan handler galat terpasang.');
