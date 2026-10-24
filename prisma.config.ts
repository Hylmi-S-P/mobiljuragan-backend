// Prisma 7 configuration (lihat Perubahan dari Prisma 5/6):
//  - Connection URL TIDAK lagi ditulis di `schema.prisma` datasource block.
//    Ditaruh di sini dan dipakai lewat adapter database.
//  - Database proyek ini MariaDB / MySQL, bukan PostgreSQL. Adapter yang dipakai
//    `@prisma/adapter-mariadb`; komentar lama yang menyebut `@prisma/adapter-pg`
//    adalah sisa sebelum pindah provider.
//  - `import 'dotenv/config'` agar `.env` terbaca; Prisma 7 tidak meng-auto-load
//    .env sendiri.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Database bayangan untuk `prisma migrate`.
 *
 * Migrate membutuhkan database kosong terpisah untuk memutar ulang seluruh riwayat
 * migrasi dan membandingkannya dengan skema. Tanpa ini, perintah yang membaca
 * direktori migrasi gagal dengan galat "must set datasource.shadowDatabaseUrl".
 *
 * Dibuat terpisah dari database utama supaya data asli tidak pernah tersentuh.
 * Kalau database ini belum ada, buat sekali dengan:
 *   CREATE DATABASE `mobiljuragan_shadow`;
 */
function shadowUrl(): string {
  const utama = env('DATABASE_URL');
  const url = new URL(utama);
  url.pathname = '/mobiljuragan_shadow';
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // migrate dev / db push memakai koneksi langsung dari URL ini.
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: shadowUrl(),
  },
  migrate: {
    adapter: () => new PrismaMariaDb(env('DATABASE_URL').replace(/^mysql:\/\//, 'mariadb://')),
  },
});
