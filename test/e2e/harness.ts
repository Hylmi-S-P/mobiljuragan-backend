import 'dotenv/config';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mariadb from 'mariadb';

/*
 * Harness E2E.
 *
 * Semua pengujian memakai database terpisah `mobiljuragan_test`, bukan database
 * pengembangan. Alasannya sederhana: harness mengosongkan tabel sebelum setiap
 * run dan menjalankan seed, jadi kalau salah menunjuk database, data kerja tim
 * yang ikut terhapus. Nama database diturunkan dari DATABASE_URL tetapi selalu
 * diganti ke nama uji, sehingga tidak mungkin mengarah ke database dev walau
 * .env berubah.
 */

const DIREKTORI_INI = path.dirname(fileURLToPath(import.meta.url));

/** Akar repo backend; dipakai sebagai cwd perintah prisma dan server. */
export const AKAR_BACKEND = path.resolve(DIREKTORI_INI, '../..');

const NAMA_DATABASE_UJI = 'mobiljuragan_test';
const PORT_UJI = 4100;

/** Alamat dasar API yang dipakai seluruh fixture. */
export const BASE_URL = `http://127.0.0.1:${PORT_UJI}/api/v1`;
/** Akar server; endpoint kesehatan berada di `/health`, bukan di bawah `/api/v1`. */
export const BASE_ORIGIN = `http://127.0.0.1:${PORT_UJI}`;

const URL_KESEHATAN = `${BASE_ORIGIN}/health`;
const FILE_LOG_SERVER = path.join(DIREKTORI_INI, '.server.log');

if (!process.env.DATABASE_URL) {
  // `dotenv/config` membaca .env dari cwd; npm script sudah berjalan di akar
  // backend, tetapi pemanggilan langsung dari folder lain tetap harus bekerja.
  dotenv.config({ path: path.join(AKAR_BACKEND, '.env') });
}

function buatUrlDatabaseUji(): string {
  const asli = process.env.DATABASE_URL;
  if (!asli) {
    throw new Error(
      'DATABASE_URL belum diisi. Salin .env.example menjadi .env sebelum menjalankan harness.',
    );
  }

  const url = new URL(asli);
  url.pathname = `/${NAMA_DATABASE_UJI}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** URL database uji yang dipakai server, migrasi, dan seed. */
export const TEST_DATABASE_URL = buatUrlDatabaseUji();

interface OpsiKoneksi {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

function opsiKoneksi(database?: string): OpsiKoneksi {
  const url = new URL(TEST_DATABASE_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username) || 'root',
    password: decodeURIComponent(url.password),
    database,
  };
}

function jalankanNpx(args: string[], label: string, env: NodeJS.ProcessEnv): void {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const hasil = spawnSync(npx, args, {
    cwd: AKAR_BACKEND,
    env,
    // Di Windows, berkas .cmd hanya bisa dijalankan lewat shell. Argumen di sini
    // konstan (tidak berasal dari input pengguna), jadi tidak ada risiko injeksi.
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (hasil.error) {
    throw new Error(`${label} gagal dijalankan: ${hasil.error.message}`);
  }
  if (hasil.status !== 0) {
    throw new Error(`${label} keluar dengan kode ${hasil.status ?? 'tidak diketahui'}.`);
  }
}

async function siapkanDatabaseUji(): Promise<void> {
  const koneksi = await mariadb.createConnection(opsiKoneksi());
  try {
    await koneksi.query(
      `CREATE DATABASE IF NOT EXISTS \`${NAMA_DATABASE_UJI}\` ` +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
  } finally {
    await koneksi.end();
  }
}

async function jalankanMigrasi(): Promise<void> {
  jalankanNpx(['prisma', 'migrate', 'deploy'], 'Migrasi database uji', {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
  });
}

/*
 * Mengosongkan seluruh tabel sebelum run.
 *
 * Tabel `_prisma_migrations` sengaja tidak ikut dikosongkan. Baris itu adalah
 * catatan migrasi yang sudah diterapkan; kalau dihapus, `migrate deploy` pada
 * run berikutnya akan mencoba membuat ulang tabel yang sudah ada dan gagal.
 */
async function kosongkanTabel(): Promise<void> {
  const koneksi = await mariadb.createConnection(opsiKoneksi(NAMA_DATABASE_UJI));
  try {
    const tabel = await koneksi.query<Array<{ nama: string }>>(
      `SELECT table_name AS nama
         FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'`,
      [NAMA_DATABASE_UJI],
    );

    await koneksi.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const { nama } of tabel) {
        await koneksi.query(`TRUNCATE TABLE \`${nama}\``);
      }
    } finally {
      await koneksi.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`Database uji dikosongkan (${tabel.length} tabel).`);
  } finally {
    await koneksi.end();
  }
}

async function jalankanSeed(): Promise<void> {
  jalankanNpx(['prisma', 'db', 'seed'], 'Seed admin database uji', {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
    SEED_ADMIN_PHONE: '081234567890',
    SEED_ADMIN_PASSWORD: 'Admin123!',
    SEED_ADMIN_NAME: 'Admin Uji',
  });
}

let prosesServer: ChildProcess | null = null;
let fdLogServer: number | null = null;

function catatLog(teks: string): void {
  if (fdLogServer === null) return;
  fs.writeSync(fdLogServer, teks);
}

function bacaEkorLog(jumlahBaris = 40): string {
  if (!fs.existsSync(FILE_LOG_SERVER)) return '(berkas log belum ada)';
  const baris = fs.readFileSync(FILE_LOG_SERVER, 'utf8').trimEnd().split(/\r?\n/);
  return baris.slice(-jumlahBaris).join('\n');
}

function tunggu(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tungguServerSiap(): Promise<void> {
  const batasWaktu = Date.now() + 60_000;
  let upaya = 0;

  while (Date.now() < batasWaktu) {
    upaya += 1;

    if (prosesServer && prosesServer.exitCode !== null) {
      throw new Error(
        `Server uji berhenti sebelum siap (kode ${prosesServer.exitCode}).\n` +
          `--- ekor ${path.relative(AKAR_BACKEND, FILE_LOG_SERVER)} ---\n${bacaEkorLog()}`,
      );
    }

    // Endpoint kesehatan berada di luar prefiks /api/v1. Kalau tidak tersedia,
    // endpoint publik lain yang statusnya di bawah 500 tetap menandakan server
    // sudah menerima koneksi.
    for (const url of [URL_KESEHATAN, `${BASE_URL}/vehicles`]) {
      try {
        const respons = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (respons.status < 500) {
          console.log(`Server uji siap (${url} -> ${respons.status}) setelah ${upaya} percobaan.`);
          return;
        }
      } catch {
        // Belum bisa dihubungi; ulangi sampai batas waktu.
      }
    }

    await tunggu(500);
  }

  throw new Error(
    'Server uji tidak siap dalam 60 detik.\n' +
      `--- ekor ${path.relative(AKAR_BACKEND, FILE_LOG_SERVER)} ---\n${bacaEkorLog()}`,
  );
}

async function spawnServer(): Promise<void> {
  const fd = fs.openSync(FILE_LOG_SERVER, 'a');
  fdLogServer = fd;
  catatLog(`\n=== ${new Date().toISOString()} mulai server uji di port ${PORT_UJI} ===\n`);

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  prosesServer = spawn(npx, ['tsx', 'src/server.ts'], {
    cwd: AKAR_BACKEND,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(PORT_UJI),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      ALLOW_DEV_OTP_BYPASS: 'true',
      LOG_LEVEL: 'warn',
      /*
       * Penjadwal tenggat dokumen dipercepat ke 1 detik. Tanpa ini, kasus uji
       * yang memaksa sebuah pesanan kedaluwarsa harus menunggu 5 menit.
       */
      BOOKING_DEADLINE_INTERVAL_MS: '1000',
    },
    /*
     * stdout/stderr diarahkan ke berkas, bukan pipe. Di lingkungan ini pipe
     * bisa membuat proses anak menggantung karena tidak ada yang membaca
     * keluarannya; berkas juga memudahkan diagnosis setelah run selesai.
     */
    stdio: ['ignore', fd, fd],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
}

/**
 * Menjalankan satu perintah SQL langsung ke database uji.
 *
 * Dipakai hanya untuk menyiapkan keadaan yang tidak bisa dicapai lewat API,
 * misalnya memundurkan tenggat dokumen supaya penjadwal ikut terpicu. Tidak
 * boleh dipakai untuk memeriksa hasil: hasil tetap dibaca lewat API.
 */
export async function sqlUji<T = unknown>(
  perintah: string,
  params: unknown[] = [],
): Promise<T> {
  const koneksi = await mariadb.createConnection(opsiKoneksi(NAMA_DATABASE_UJI));
  try {
    return (await koneksi.query(perintah, params)) as T;
  } finally {
    await koneksi.end();
  }
}

/** Memulai seluruh rangkaian: database, migrasi, bersih-bersih, seed, server. */export async function startHarness(): Promise<void> {
  console.log(`Database uji: ${TEST_DATABASE_URL}`);
  await siapkanDatabaseUji();
  await jalankanMigrasi();
  await kosongkanTabel();
  await jalankanSeed();
  await spawnServer();
  await tungguServerSiap();
}

/** Mematikan server dan menutup berkas log; aman dipanggil lebih dari sekali. */
export async function stopServer(): Promise<void> {
  const proses = prosesServer;
  prosesServer = null;

  if (proses && proses.exitCode === null) {
    if (process.platform === 'win32' && proses.pid) {
      /* Windows tidak meneruskan SIGTERM ke proses cucu lewat shell. taskkill
         dengan /T mematikan seluruh pohon proses, termasuk tsx dan node server,
         supaya port 4100 tidak tertinggal dan run berikutnya tidak bentrok. */
      spawnSync('taskkill', ['/PID', String(proses.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      proses.kill('SIGTERM');
      const batas = Date.now() + 5000;
      while (proses.exitCode === null && Date.now() < batas) {
        await tunggu(100);
      }
      if (proses.exitCode === null) {
        proses.kill('SIGKILL');
      }
    }
  }

  if (fdLogServer !== null) {
    fs.closeSync(fdLogServer);
    fdLogServer = null;
  }
}
