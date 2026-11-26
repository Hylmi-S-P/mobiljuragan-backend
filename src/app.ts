import crypto from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import { db } from './db.js';
import { logger } from './logger.js';
import { v1Router } from './routes/v1/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app: Express = express();

/*
 * Menyembunyikan jejak Express dari header respons. Bukan pengaman sungguhan,
 * hanya mengurangi informasi yang dibagikan ke publik tanpa perlu.
 */
app.disable('x-powered-by');

// Header keamanan ringan untuk seluruh respons API
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const REQUEST_ID_REGEX = /^[A-Za-z0-9._-]{1,64}$/;

// Korelasi request-id dan pencatatan durasi selesai permintaan
app.use((req: Request, res: Response, next) => {
  const incomingId = req.header('x-request-id');
  const requestId =
    incomingId && REQUEST_ID_REGEX.test(incomingId) ? incomingId : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2));
    const logPayload = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    };

    if (req.path === '/health' && res.statusCode < 400) {
      logger.debug(logPayload, `${req.method} ${req.path} ${res.statusCode}`);
      return;
    }

    const slowThresholdMs = Number(process.env.SLOW_REQUEST_MS ?? 1000);
    if (res.statusCode >= 500 || durationMs >= slowThresholdMs) {
      logger.warn(logPayload, `${req.method} ${req.path} ${res.statusCode}`);
      return;
    }

    logger.info(logPayload, `${req.method} ${req.path} ${res.statusCode}`);
  });

  next();
});

/*
 * Daftar asal yang boleh memanggil API dari peramban.
 *
 * Di production daftar ini WAJIB diisi. Kalau kosong, seluruh origin diizinkan
 * dan itu berbahaya begitu dashboard dan API punya hostname berbeda. Di
 * pengembangan daftar kosong tetap diizinkan supaya tidak menghambat kerja.
 */
const daftarOrigin = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (daftarOrigin.length === 0 && process.env.NODE_ENV === 'production') {
  throw new Error(
    'CORS_ORIGINS wajib diisi saat NODE_ENV=production, misalnya https://mj.tapakvia.com. ' +
      'Tanpa itu setiap situs boleh memanggil API ini dari peramban.',
  );
}

// Middleware dasar
app.use(cors(daftarOrigin.length > 0 ? { origin: daftarOrigin } : {}));
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers.accept?.includes('text/event-stream')) return false;
      const contentType = String(res.getHeader('Content-Type') ?? '');
      if (
        contentType.includes('text/event-stream') ||
        contentType.includes('image/webp') ||
        contentType.includes('application/pdf')
      ) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

/*
 * Di balik Cloudflare Tunnel, alamat asli pengunjung ada di X-Forwarded-For.
 * Tanpa pengaturan ini `req.ip` berisi alamat tunnel untuk semua orang, sehingga
 * pembatas laju menjadi satu kuota bersama dan kolom ip di audit log tidak berarti.
 */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== 'false') {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

/* Batasi parser JSON standar ke 256 KB agar permintaan normal tidak mengalokasikan
   buffer V8 besar. Batas 10 MB hanya diizinkan pada rute legacy Base64 demi
   kompatibilitas APK 1.0.2+3 yang masih aktif di lapangan. */
const jsonStandar = express.json({ limit: '256kb' });
const jsonBesarLegacy = express.json({ limit: '10mb' });
const RUTE_JSON_BESAR = [
  /^\/api\/v1\/payments\/[^/]+\/proof$/,
  /^\/api\/v1\/bookings\/[^/]+\/documents$/,
  /^\/api\/v1\/admin\/vehicles(\/[^/]+)?$/,
  /^\/api\/v1\/admin\/drivers(\/[^/]+)?$/,
  /^\/api\/v1\/admin\/ai\/documents\/parse-file$/,
];
app.use((req, res, next) => {
  if (RUTE_JSON_BESAR.some((pola) => pola.test(req.path))) {
    jsonBesarLegacy(req, res, next);
    return;
  }
  jsonStandar(req, res, next);
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

/**
 * Pemeriksaan kesiapan server beserta koneksi database (timeout 2000ms).
 */
app.get('/health/ready', async (_req: Request, res: Response) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const dbCheck = Promise.resolve(db.$queryRaw`SELECT 1`);
    dbCheck.catch(() => undefined);

    await Promise.race([
      dbCheck,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Database readiness timeout')), 2000);
      }),
    ]);

    res.status(200).json({
      status: 'ready',
      db: 'ok',
      uptimeSec: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      db: 'error',
    });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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
