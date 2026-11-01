import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { v1Router } from './routes/v1/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app: Express = express();

/*
 * Menyembunyikan jejak Express dari header respons. Bukan pengaman sungguhan,
 * hanya mengurangi informasi yang dibagikan ke publik tanpa perlu.
 */
app.disable('x-powered-by');

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

/*
 * Di balik Cloudflare Tunnel, alamat asli pengunjung ada di X-Forwarded-For.
 * Tanpa pengaturan ini `req.ip` berisi alamat tunnel untuk semua orang, sehingga
 * pembatas laju menjadi satu kuota bersama dan kolom ip di audit log tidak berarti.
 */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== 'false') {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

/* Batas 10 MB karena foto armada dikirim sebagai data URL base64: berkas 5 MB
   menjadi sekitar 6,7 MB teks. Batas bawaan 100 KB membuat foto sah ditolak
   sebelum validasi sempat berjalan. */
app.use(express.json({ limit: '10mb' }));

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
