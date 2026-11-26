import { app } from './app.js';
import { db } from './db.js';
import { mulaiPenjadwalTiket } from './lib/autoCloseTickets.js';
import { startBookingLifecycleJob } from './jobs/bookingLifecycleJob.js';
import { documentTemplateService } from './lib/documentTemplateService.js';
import { ensureAiDefaults } from './services/aiKnowledgeSeed.js';
import { tutupSemuaAliranSse } from './controller/ticketEventController.js';
import { logger } from './logger.js';

const port = Number(process.env.PORT ?? 4000);

/*
 * Default host sengaja berbeda antara pengembangan dan produksi.
 *
 * Di production backend hanya boleh dijangkau lewat reverse proxy di mesin yang
 * sama, jadi cukup loopback. Di pengembangan tetap semua interface supaya
 * emulator Android dan HP di jaringan lokal bisa menyambung.
 */
const production = process.env.NODE_ENV === 'production';
const host = process.env.HOST ?? (production ? '127.0.0.1' : '0.0.0.0');

let penjadwalTiket: { stop: () => void } | null = null;
let lifecycleJob: { stop: () => void } | null = null;
let sedangBerhenti = false;

const server = app.listen(port, host, () => {
  logger.info({ host, port }, `mobiljuragan-api listening on http://${host}:${port}`);

  /* Penjadwal tunggal penutupan otomatis tiket manual 24 jam. */
  penjadwalTiket = mulaiPenjadwalTiket();

  /* Tenggat unggah dokumen: pesanan yang ditinggalkan dibatalkan otomatis. */
  lifecycleJob = startBookingLifecycleJob(
    Number(process.env.BOOKING_DEADLINE_INTERVAL_MS ?? 5 * 60 * 1000),
  );

  /*
   * Template dokumen bawaan disiapkan setelah server menyala, bukan sebelumnya,
   * supaya kegagalan database tidak menghalangi proses start. Kalau gagal,
   * cukup dicatat: server tetap jalan dan template bisa disemai ulang.
   */
  documentTemplateService.pastikanTemplateBawaan().catch((error: unknown) => {
    logger.error({ error }, 'Gagal menyiapkan template dokumen bawaan');
  });

  ensureAiDefaults().catch((error: unknown) => {
    logger.error({ error }, 'Gagal menyiapkan basis pengetahuan RAG');
  });
});

/*
 * Saat Kiri/Docker mengirim SIGTERM, hentikan penjadwal latar, tutup stream SSE
 * yang masih terbuka, dan putus pool MariaDB secara bersih agar deploy ulang
 * tidak perlu menunggu timeout paksa 10 detik.
 */
function berhenti(sinyal: string, kodeKeluar = 0): void {
  if (sedangBerhenti) return;
  sedangBerhenti = true;

  logger.info({ sinyal, kodeKeluar }, 'Menutup server secara teratur...');
  penjadwalTiket?.stop();
  lifecycleJob?.stop();
  tutupSemuaAliranSse();
  server.closeIdleConnections?.();

  const paksa = setTimeout(() => process.exit(1), 5_000);
  paksa.unref();

  server.close(() => {
    void db
      .$disconnect()
      .catch(() => {})
      .finally(() => process.exit(kodeKeluar));
  });
  server.closeAllConnections?.();
}

process.on('SIGTERM', () => berhenti('SIGTERM', 0));
process.on('SIGINT', () => berhenti('SIGINT', 0));

process.on('unhandledRejection', (alasan: unknown) => {
  logger.error(
    { alasan },
    'Promise ditolak tanpa penanganan. Permintaan terkait gagal, proses dilanjutkan.',
  );
});

process.on('uncaughtException', (galat: Error) => {
  logger.error(
    { galat },
    'Galat tidak tertangkap pada proses API.',
  );
  if (production) {
    berhenti('uncaughtException', 1);
  }
});
