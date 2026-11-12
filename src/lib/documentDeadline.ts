import { DocumentDeadlineState } from '../generated/prisma/client.js';

/**
 * Tenggat unggah dokumen persyaratan sewa.
 *
 * Aturan yang disepakati:
 * - Pelanggan punya 2 jam sejak pesanan dibuat untuk mengunggah berkas pertama.
 * - Jam berhenti selama berkas menunggu diperiksa admin. Pelanggan tidak boleh
 *   dihukum karena admin belum sempat membuka berkasnya.
 * - Setiap penolakan memberi jendela baru 12 jam untuk memperbaiki berkas.
 * - Apa pun yang terjadi, tenggat tidak pernah melewati 12 jam sebelum sewa mulai,
 *   supaya admin masih punya waktu memeriksa sebelum armada diserahkan.
 *
 * Semua perhitungan memakai jam kalender, bukan jam kerja: pesanan yang masuk
 * pukul 23.00 tetap punya 2 jam, bukan menunggu kantor buka.
 */

const SATU_JAM_MS = 60 * 60 * 1000;

/** Jendela unggah pertama sejak pesanan dibuat. */
export const JAM_UPLOAD_PERTAMA = 2;

/** Jendela perbaikan setelah admin menolak berkas. */
export const JAM_SETELAH_DITOLAK = 12;

/** Jarak paling akhir sebuah tenggat boleh jatuh sebelum sewa dimulai. */
export const JAM_SEBELUM_MULAI_SEWA = 12;

/** Batas paling akhir yang tidak boleh dilewati tenggat mana pun. */
export function batasKerasTenggat(startDateTime: Date): Date {
  return new Date(startDateTime.getTime() - JAM_SEBELUM_MULAI_SEWA * SATU_JAM_MS);
}

function pilihLebihAwal(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** Tenggat saat pesanan baru dibuat. */
export function tenggatAwal(createdAt: Date, startDateTime: Date): Date {
  const alami = new Date(createdAt.getTime() + JAM_UPLOAD_PERTAMA * SATU_JAM_MS);
  return pilihLebihAwal(alami, batasKerasTenggat(startDateTime));
}

/** Tenggat baru setelah admin menolak berkas. */
export function tenggatSetelahDitolak(sekarang: Date, startDateTime: Date): Date {
  const alami = new Date(sekarang.getTime() + JAM_SETELAH_DITOLAK * SATU_JAM_MS);
  return pilihLebihAwal(alami, batasKerasTenggat(startDateTime));
}

export type DeadlineView = {
  state: DocumentDeadlineState;
  /** ISO string, null saat tidak ada tenggat. */
  deadlineAt: string | null;
  /** Alasan jam berhenti; null saat jam berjalan atau tidak ada tenggat. */
  pausedReason: string | null;
  /** Sisa waktu dalam milidetik; null saat dijeda atau tidak ada tenggat. */
  remainingMs: number | null;
};

/**
 * Bentuk tenggat yang dikirim ke klien.
 *
 * Klien tidak boleh menebak sendiri apakah jamnya sedang berjalan: kalau hanya
 * menerima stempel waktu, aplikasi akan terus menghitung mundur selama berkas
 * diperiksa admin dan menampilkan "waktu habis" padahal pesanannya aman.
 */
export function deskripsikanTenggat(input: {
  state: DocumentDeadlineState;
  deadlineAt: Date | null;
  now?: Date;
}): DeadlineView {
  const { state, deadlineAt } = input;
  const now = input.now ?? new Date();

  if (state === DocumentDeadlineState.NONE || !deadlineAt) {
    return { state: DocumentDeadlineState.NONE, deadlineAt: null, pausedReason: null, remainingMs: null };
  }

  if (state === DocumentDeadlineState.PAUSED) {
    return {
      state: DocumentDeadlineState.PAUSED,
      deadlineAt: deadlineAt.toISOString(),
      pausedReason: 'Menunggu pemeriksaan admin',
      remainingMs: null,
    };
  }

  return {
    state: DocumentDeadlineState.RUNNING,
    deadlineAt: deadlineAt.toISOString(),
    pausedReason: null,
    remainingMs: Math.max(0, deadlineAt.getTime() - now.getTime()),
  };
}
