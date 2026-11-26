import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables.');
}

const rawUrl = connectionString.replace(/^mysql:\/\//, 'mariadb://');
const parsedUrl = new URL(rawUrl);

/* Batasi pool koneksi agar sesuai batas RAM container 512 MB. Default driver
   `mariadb` adalah connectionLimit=10 dan minimumIdle=10 yang menahan banyak
   koneksi idle permanen. */
if (!parsedUrl.searchParams.has('connectionLimit')) {
  parsedUrl.searchParams.set('connectionLimit', process.env.DB_POOL_LIMIT ?? '6');
}
if (!parsedUrl.searchParams.has('minimumIdle')) {
  parsedUrl.searchParams.set('minimumIdle', process.env.DB_POOL_MIN_IDLE ?? '1');
}
if (!parsedUrl.searchParams.has('idleTimeout')) {
  parsedUrl.searchParams.set('idleTimeout', '300');
}
if (!parsedUrl.searchParams.has('acquireTimeout')) {
  parsedUrl.searchParams.set('acquireTimeout', '10000');
}
if (!parsedUrl.searchParams.has('connectTimeout')) {
  parsedUrl.searchParams.set('connectTimeout', '5000');
}

const adapter = new PrismaMariaDb(parsedUrl.toString());

export const db = new PrismaClient({ adapter });
