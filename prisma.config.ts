// Prisma 7 configuration (lihat Perubahan dari Prisma 5/6):
//  - Connection URL TIDAK lagi ditulis di `schema.prisma` datasource block.
//    Ditaruh di sini dan dipakai lewat adapter database.
//  - Migrate memakai `@prisma/adapter-pg` untuk koneksi langsung ke PostgreSQL.
//  - `import 'dotenv/config'` agar `.env` (services/api/.env.local dev) terbaca;
//    Prisma 7 tidak meng-auto-load .env sendiri.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // migrate dev / db push memakai koneksi langsung dari URL ini (dari prisma.config →
  // engine pakai direct URL). Query runtime memakai adapter ('migrate.adapter').
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrate: {
    adapter: () =>
      new PrismaPg({
        connectionString: env('DATABASE_URL'),
      }),
  },
});
