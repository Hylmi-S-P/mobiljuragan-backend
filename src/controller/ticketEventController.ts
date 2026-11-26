import type { Request, Response } from 'express';
import { subscribeTicketEvents, type TicketEvent } from '../lib/ticketEvents.js';
import { ticketModel } from '../model/ticketModel.js';

/**
 * Saluran peristiwa tiket untuk klien (Server-Sent Events / SSE) berbasis
 * EventEmitter (`ticketEvents.ts`).
 *
 * Setiap perubahan pesan, status, atau handover pada tiket langsung didorong ke
 * klien yang sedang membuka aliran `/api/v1/tickets/:id/events` tanpa polling
 * database berulang.
 */

const UMUR_MAKSIMAL_MS = 10 * 60 * 1000;
const INTERVAL_DETAK_MS = 25_000;
const MAKS_SSE_PER_PENGGUNA = 5;

const activeSseClosers = new Set<() => void>();
const activeSseByUser = new Map<string, Set<() => void>>();

/** Menutup seluruh koneksi SSE aktif dengan rapi saat proses server dimatikan. */
export function tutupSemuaAliranSse(): void {
  for (const tutup of Array.from(activeSseClosers)) {
    tutup();
  }
}

type PeristiwaSse = { jenis: 'siap'; ticketId: string } | TicketEvent;

function tulis(res: Response, peristiwa: PeristiwaSse): void {
  if (res.destroyed || res.writableEnded) return;
  res.write(`event: ${peristiwa.jenis}\n`);
  res.write(`data: ${JSON.stringify(peristiwa)}\n\n`);
}

/**
 * GET /api/v1/tickets/:id/events
 */
export async function streamTicketEvents(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const actor = req.user!;

  const tiket = await ticketModel.findAuthMetaById(id);
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

  if (
    actor.role === 'ADMIN' &&
    tiket.assignedAdminId &&
    tiket.assignedAdminId !== actor.userId
  ) {
    res.status(403).json({
      status: 'error',
      error: { code: 'FORBIDDEN', message: 'Tiket ini sedang ditangani oleh admin lain.' },
    });
    return;
  }

  let userSet = activeSseByUser.get(actor.userId);
  if (userSet && userSet.size >= MAKS_SSE_PER_PENGGUNA) {
    const palingLama = userSet.values().next().value;
    if (palingLama) palingLama();
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let selesai = false;

  tulis(res, { jenis: 'siap', ticketId: id });

  let batalLangganan: () => void = () => {};

  const berhenti = () => {
    if (selesai) return;
    selesai = true;
    activeSseClosers.delete(berhenti);
    const setPengguna = activeSseByUser.get(actor.userId);
    if (setPengguna) {
      setPengguna.delete(berhenti);
      if (setPengguna.size === 0) {
        activeSseByUser.delete(actor.userId);
      }
    }
    batalLangganan();
    clearInterval(detak);
    clearTimeout(batasUmur);
    if (!res.writableEnded) {
      res.end();
    }
  };

  activeSseClosers.add(berhenti);
  if (!userSet) {
    userSet = new Set();
    activeSseByUser.set(actor.userId, userSet);
  }
  userSet.add(berhenti);

  batalLangganan = subscribeTicketEvents(id, (peristiwa: TicketEvent) => {
    if (selesai || res.destroyed || res.writableEnded) return;
    tulis(res, peristiwa);

    if (
      peristiwa.jenis === 'status' &&
      (peristiwa.status === 'CLOSED' || peristiwa.status === 'RESOLVED')
    ) {
      berhenti();
    }
  });

  const detak = setInterval(() => {
    if (selesai || res.destroyed || res.writableEnded) return;
    res.write(': detak\n\n');
  }, INTERVAL_DETAK_MS);
  detak.unref?.();

  const batasUmur = setTimeout(berhenti, UMUR_MAKSIMAL_MS);
  batasUmur.unref?.();

  req.on('close', berhenti);
  res.on('close', berhenti);
  res.on('error', berhenti);
}
