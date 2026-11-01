import { app } from './app.js';
import { mulaiPenjadwalTiket } from './lib/autoCloseTickets.js';
import { startTicketCleanupJob } from './jobs/ticketCleanupJob.js';

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

const server = app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`mobiljuragan-api listening on http://${host}:${port}`);

  /* Penutupan otomatis tiket dijalankan di proses yang sama dengan API. */
  mulaiPenjadwalTiket();
  startTicketCleanupJob();
});

/*
 * Saat PM2 atau systemd mengirim SIGTERM, tutup sambungan lebih dulu supaya
 * permintaan yang sedang berjalan tidak terputus di tengah jalan.
 */
function berhenti(sinyal: string): void {
  // eslint-disable-next-line no-console
  console.log(`Menerima ${sinyal}, menutup server...`);
  server.close(() => process.exit(0));
  const paksa = setTimeout(() => process.exit(1), 10_000);
  paksa.unref();
}

process.on('SIGTERM', () => berhenti('SIGTERM'));
process.on('SIGINT', () => berhenti('SIGINT'));
