import type { Request, Response } from 'express';
import { TicketHandler } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { ticketModel } from '../model/ticketModel.js';

/**
 * Saluran peristiwa tiket untuk klien (SSE).
 *
 * Dipakai pada tahap setelah AI menyerahkan tiket ke admin: balasan admin masuk ke
 * layar pelanggan tanpa perlu menanyakan ulang. Sebelum handover tidak ada admin
 * yang terlibat, jadi tidak ada yang perlu didorong dan klien memakai POST biasa.
 *
 * Pemilihan SSE, bukan WebSocket: pada tahap ini arahnya satu — server memberi tahu
 * klien. Mengirim pesan tetap lewat endpoint POST yang sudah ada. Kalau nanti butuh
 * dua arah sungguhan (indikator mengetik, status online), sambungan ini bisa diganti
 * ke WebSocket tanpa mengubah bentuk peristiwanya.
 */

/** Jeda antar-pemeriksaan perubahan, dan batas umur satu sambungan. */
const INTERVAL_PERIKSA_MS = 2000;
const UMUR_MAKSIMAL_MS = 10 * 60 * 1000;
const INTERVAL_DETAK_MS = 25000;

type Peristiwa =
  | { jenis: 'siap'; ticketId: string }
  | { jenis: 'pesan'; ticketId: string; jumlahPesan: number; versi: string }
  | { jenis: 'status'; ticketId: string; status: string; versi: string }
  | { jenis: 'handover'; ticketId: string; handoverAt: string | null; versi: string };

function tulis(res: Response, peristiwa: Peristiwa): void {
  res.write(`event: ${peristiwa.jenis}\n`);
  res.write(`data: ${JSON.stringify(peristiwa)}\n\n`);
}

/**
 * GET /api/v1/tickets/:id/events
 *
 * Mengirim satu peristiwa setiap kali tiket berubah. Perubahan dikenali dari
 * jumlah pesan dan waktu pembaruan tiket, bukan dengan membandingkan seluruh isi —
 * cukup untuk memberi tahu klien bahwa ada yang baru.
 */
export async function streamTicketEvents(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const actor = req.user!;

  const tiket = await ticketModel.findById(id);
  if (!tiket) {
    res.status(404).json({
      status: 'error',
      error: { code: 'TICKET_NOT_FOUND', message: `Tiket dengan ID '${id}' tidak ditemukan.` },
    });
    return;
  }

  if (tiket.customerId !== actor.userId && actor.role === 'CUSTOMER') {
    res.status(403).json({
      status: 'error',
      error: { code: 'FORBIDDEN', message: 'Anda tidak memiliki hak akses untuk tiket ini.' },
    });
    return;
  }

  /* Header SSE. "X-Accel-Buffering: no" mematikan penyangga pada nginx, karena
     tanpa itu peristiwa bisa tertahan sampai sambungan ditutup. */
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let jumlahPesanTerakhir = tiket.messages.length;
  let statusTerakhir = tiket.status;
  let handoverTerakhir = tiket.handoverAt ? tiket.handoverAt.toISOString() : null;
  let selesai = false;

  tulis(res, { jenis: 'siap', ticketId: id });

  const berhenti = () => {
    if (selesai) return;
    selesai = true;
    clearInterval(pemeriksa);
    clearInterval(detak);
    clearTimeout(batasUmur);
    res.end();
  };

  /* Detak berkala menjaga sambungan tetap hidup melewati proxy yang memutus
     koneksi diam. Bentuknya komentar, jadi tidak memicu peristiwa di klien. */
  const detak = setInterval(() => {
    if (selesai) return;
    res.write(': detak\n\n');
  }, INTERVAL_DETAK_MS);

  const pemeriksa = setInterval(async () => {
    if (selesai) return;

    try {
      const terkini = await db.supportTicket.findUnique({
        where: { id },
        select: {
          status: true,
          handoverAt: true,
          updatedAt: true,
          handledBy: true,
          _count: { select: { messages: true } },
        },
      });

      if (!terkini) {
        berhenti();
        return;
      }

      const versi = terkini.updatedAt.toISOString();

      if (terkini._count.messages !== jumlahPesanTerakhir) {
        jumlahPesanTerakhir = terkini._count.messages;
        tulis(res, {
          jenis: 'pesan',
          ticketId: id,
          jumlahPesan: jumlahPesanTerakhir,
          versi,
        });
      }

      if (terkini.status !== statusTerakhir) {
        statusTerakhir = terkini.status;
        tulis(res, { jenis: 'status', ticketId: id, status: statusTerakhir, versi });
      }

      const handoverSekarang = terkini.handoverAt ? terkini.handoverAt.toISOString() : null;
      if (handoverSekarang !== handoverTerakhir) {
        handoverTerakhir = handoverSekarang;
        tulis(res, { jenis: 'handover', ticketId: id, handoverAt: handoverSekarang, versi });
      }

      // Tiket yang sudah ditutup tidak akan berubah lagi; tidak perlu menahan sambungan.
      if (terkini.status === 'CLOSED') {
        berhenti();
      }
    } catch (error) {
      logger.warn({ error, ticketId: id }, 'Gagal memeriksa perubahan tiket pada saluran SSE');
    }
  }, INTERVAL_PERIKSA_MS);

  const batasUmur = setTimeout(berhenti, UMUR_MAKSIMAL_MS);

  req.on('close', berhenti);
}
