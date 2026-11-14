import type { Readable } from 'node:stream';
import { AppError } from './response.js';

/**
 * Adapter penyimpanan objek berbasis S3.
 *
 * Dipakai untuk MinIO (lokal, saat pengembangan) dan Cloudflare R2 (saat
 * produksi). Keduanya bicara protokol S3 yang sama, jadi tidak perlu dua
 * adapter: yang berbeda hanya isi `.env`.
 *
 * Yang sengaja TIDAK dipakai: ACL per objek, object lock, bucket policy, dan
 * multipart upload. Semua akses melewati backend — klien tidak pernah menerima
 * URL S3 langsung — sehingga tidak ada hal yang perlu diatur per objek selain
 * isi dan tipe kontennya.
 */

/** Batas waktu satu operasi, supaya permintaan tidak menggantung selamanya. */
const BATAS_MS = Number(process.env.S3_TIMEOUT_MS ?? 15_000);

type KlienS3 = {
  send: (perintah: unknown) => Promise<unknown>;
};

let klien: KlienS3 | null = null;
let modul: typeof import('@aws-sdk/client-s3') | null = null;

function ambilEnv(nama: string): string {
  const nilai = (process.env[nama] ?? '').trim();
  if (!nilai) {
    throw new AppError(
      'MEDIA_S3_CONFIG_MISSING',
      `MEDIA_DRIVER=s3 memerlukan ${nama} di .env. Lihat .env.example bagian penyimpanan objek.`,
      500,
    );
  }
  return nilai;
}

/**
 * Memuat SDK dan membuat klien sekali saja.
 *
 * `import()` dinamis dipakai supaya `@aws-sdk/client-s3` tidak ikut dimuat saat
 * driver yang aktif `lokal`. Pemakaian memori dan waktu start backend lokal
 * tetap seperti sebelumnya.
 */
async function pastikanKlien(): Promise<{
  klien: KlienS3;
  modul: typeof import('@aws-sdk/client-s3');
  bucket: string;
}> {
  if (klien && modul) {
    return { klien, modul, bucket: ambilEnv('S3_BUCKET') };
  }

  const sdk = await import('@aws-sdk/client-s3');
  const s3 = new sdk.S3Client({
    region: (process.env.S3_REGION ?? 'us-east-1').trim(),
    endpoint: (process.env.S3_ENDPOINT ?? '').trim() || undefined,
    // MinIO dan R2 memerlukan path-style; AWS asli tidak.
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
    credentials: {
      accessKeyId: ambilEnv('S3_ACCESS_KEY'),
      secretAccessKey: ambilEnv('S3_SECRET_KEY'),
    },
    requestHandler: { requestTimeout: BATAS_MS, connectionTimeout: BATAS_MS },
  });

  klien = s3 as unknown as KlienS3;
  modul = sdk;
  return { klien: s3 as unknown as KlienS3, modul: sdk, bucket: ambilEnv('S3_BUCKET') };
}

function galatS3(aksi: string, error: unknown): AppError {
  const nama = error instanceof Error ? error.name : 'UnknownError';
  const pesan = error instanceof Error ? error.message : String(error);

  // Objek tidak ada: 404, bukan 500. Pemanggil perlu membedakannya.
  if (nama === 'NoSuchKey' || nama === 'NotFound' || nama === 'NoSuchBucket') {
    return new AppError('MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.', 404);
  }

  return new AppError(
    'MEDIA_STORAGE_ERROR',
    `Penyimpanan objek gagal saat ${aksi}: ${pesan}`,
    502,
  );
}

/** Menyimpan satu objek. Menimpa objek dengan kunci sama (idempoten). */
export async function simpanS3(
  objectKey: string,
  isi: Buffer,
  contentType = 'image/webp',
): Promise<{ objectKey: string; byte: number }> {
  const { klien: c, modul: m, bucket } = await pastikanKlien();

  try {
    await c.send(
      new m.PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: isi,
        ContentType: contentType,
        // Berkas diberi nama dari hash isi, jadi cache panjang aman.
        CacheControl: 'private, max-age=86400',
      }),
    );
  } catch (error) {
    throw galatS3('menyimpan', error);
  }

  return { objectKey, byte: isi.length };
}

/** Membaca seluruh objek ke memori. Dipakai hanya untuk berkas kecil. */
export async function bacaS3(objectKey: string): Promise<Buffer> {
  const { klien: c, modul: m, bucket } = await pastikanKlien();

  try {
    const hasil = (await c.send(
      new m.GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    )) as { Body?: { transformToByteArray: () => Promise<Uint8Array> } };

    if (!hasil.Body) {
      throw new AppError('MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.', 404);
    }

    return Buffer.from(await hasil.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw galatS3('membaca', error);
  }
}

/** Aliran baca, dipakai saat menyajikan berkas tanpa menyalin ke memori. */
export async function aliranS3(objectKey: string): Promise<Readable> {
  const { klien: c, modul: m, bucket } = await pastikanKlien();

  try {
    const hasil = (await c.send(
      new m.GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    )) as { Body?: Readable };

    if (!hasil.Body) {
      throw new AppError('MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.', 404);
    }

    return hasil.Body;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw galatS3('membaca', error);
  }
}

export async function hapusS3(objectKey: string): Promise<boolean> {
  const { klien: c, modul: m, bucket } = await pastikanKlien();

  try {
    await c.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    return true;
  } catch {
    // Sama seperti driver lokal: gagal menghapus bukan alasan membatalkan
    // operasi pemanggil, cukup dilaporkan lewat nilai balik.
    return false;
  }
}

export async function adaS3(objectKey: string): Promise<boolean> {
  const { klien: c, modul: m, bucket } = await pastikanKlien();

  try {
    await c.send(new m.HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}
