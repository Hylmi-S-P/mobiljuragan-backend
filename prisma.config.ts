// Prisma 7 configuration (lihat Perubahan dari Prisma 5/6):
//  - Connection URL TIDAK lagi ditulis di `schema.prisma` datasource block.
//    Ditaruh di sini dan dipakai lewat adapter database.
//  - Migrate memakai `@prisma/adapter-pg` untuk koneksi langsung ke PostgreSQL.
//  - `import 'dotenv/config'` agar `.env` (services/api/.env.local dev) terbaca;
//    Prisma 7 tidak meng-auto-load .env sendiri.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // migrate dev / db push memakai koneksi langsung dari URL ini.
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrate: {
    adapter: () =>
      new PrismaMariaDb(env('DATABASE_URL').replace(/^mysql:\/\//, 'mariadb://')),
  },
});
