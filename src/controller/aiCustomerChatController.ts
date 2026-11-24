import type { Request, Response } from 'express';
import { logger } from '../logger.js';
import { ticketModel } from '../model/ticketModel.js';
import { NOMOR_WHATSAPP_KANTOR } from '../lib/kontak.js';
import { runAssistantTurn } from '../lib/ai/chatOrchestrator.js';
import { TicketHandler, TicketStatus, UserRole } from '../generated/prisma/client.js';

/**
 * Penjaga sementara di memori agar inisiasi balasan AI pertama pada tiket yang
 * sama tidak dijalankan dua kali secara bersamaan oleh permintaan paralel.
 */
const inFlightInitialAiTickets = new Set<string>();

/**
 * Controller Chat Pelanggan (Aplikasi Mobile & Web Pelanggan).
 * Mempertahankan seluruh pagar keamanan tiket sebelum memanggil AI Orchestrator.
 */
export async function handleCustomerAiChat(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const rawPrompt = req.body?.message ?? req.body?.prompt;
    const history = req.body?.history;
    const rawTicketId = req.body?.ticketId ?? req.body?.ticket_id;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'Pesan pertanyaan tidak boleh kosong.',
      });
      return;
    }

    const rawTrimmed = rawPrompt.trim();
    const ticketId = typeof rawTicketId === 'string' && rawTicketId ? rawTicketId : undefined;
    // Aplikasi mobile lama mengirim konteks sistem "Tiket #TKT-... Keluhan pelanggan: <isi>"
    // saat inisialisasi tiket baru. Ekstrak keluhan aslinya agar wrapper sistem tidak bocor
    // sebagai bubble pesan pelanggan dan tidak memicu balasan AI ganda.
    const wrapperMatch = rawTrimmed.match(
      /^Tiket\s+#[A-Za-z0-9-]+:[\s\S]*?Keluhan pelanggan:\s*([\s\S]+)$/i,
    );
    const isTicketInitWrapper = Boolean(wrapperMatch);
    const prompt = wrapperMatch ? wrapperMatch[1].trim() : rawTrimmed;
    let tiket: Awaited<ReturnType<typeof ticketModel.findById>> = null;

    if (ticketId) {
      tiket = await ticketModel.findById(ticketId);
      if (!tiket) {
        res.status(404).json({
          status: 'error',
          message: `Tiket dengan ID '${ticketId}' tidak ditemukan.`,
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          status: 'error',
          error: {
            code: 'UNAUTHENTICATED',
            message:
              'Untuk melanjutkan percakapan pada tiket, Anda harus masuk terlebih dahulu.',
          },
        });
        return;
      }

      if (req.user.role === UserRole.CUSTOMER && tiket.customerId !== req.user.userId) {
        res.status(403).json({
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'Anda tidak memiliki hak akses untuk tiket ini.',
          },
        });
        return;
      }

      if (tiket.status === TicketStatus.CLOSED) {
        res.status(409).json({
          status: 'error',
          error: {
            code: 'TICKET_CLOSED',
            message:
              'Tiket ini sudah ditutup. Silakan buat tiket baru kalau masih perlu bantuan.',
          },
        });
        return;
      }

      if (tiket.handledBy === TicketHandler.HUMAN) {
        res.status(409).json({
          status: 'error',
          error: {
            code: 'TICKET_HANDED_OVER',
            message:
              'Percakapan ini sudah ditangani staf admin. Asisten AI tidak menjawab lagi di tiket ini.',
          },
        });
        return;
      }
    }

    // Susun riwayat dari DB bila terikat tiket (sumber kebenaran tunggal),
    // atau dari riwayat klien jika percakapan konsultasi umum tanpa tiket.
    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let isPromptAlreadyLastMessage = false;
    let shouldTrackInitialLock = false;

    if (ticketId) {
      const riwayatDb = await ticketModel.listMessages(ticketId);
      if (isTicketInitWrapper) {
        const existingAiMsg = riwayatDb.find((m) => m.isAi);
        if (existingAiMsg) {
          res.status(200).json({
            status: 'ok',
            data: {
              reply: existingAiMsg.body,
              model: 'cached',
              latencyMs: Date.now() - startTime,
              ragMode: 'NONE',
              toolsUsed: [],
              ticketHandedOver: false,
            },
          });
          return;
        }
      }

      const hasExistingAiReply = riwayatDb.some((m) => m.isAi);
      const normalizedPrompt = prompt.trim();
      const extractedComplaint = normalizedPrompt.includes('Keluhan pelanggan:')
        ? normalizedPrompt.split('Keluhan pelanggan:').pop()!.trim()
        : normalizedPrompt;

      if (riwayatDb.length > 0) {
        const lastMsg = riwayatDb[riwayatDb.length - 1];
        if (
          lastMsg?.isCustomer &&
          !lastMsg.isAi &&
          (lastMsg.body.trim() === normalizedPrompt ||
            isTicketInitWrapper ||
            (extractedComplaint.length > 0 && lastMsg.body.trim() === extractedComplaint))
        ) {
          isPromptAlreadyLastMessage = true;
        }

        const isDuplicateOldClientInit =
          hasExistingAiReply &&
          normalizedPrompt.startsWith('Tiket #') &&
          normalizedPrompt.includes('Keluhan pelanggan:') &&
          riwayatDb.some(
            (m) => m.isCustomer && !m.isAi && m.body.trim() === extractedComplaint,
          );

        if (
          isDuplicateOldClientInit ||
          (!hasExistingAiReply &&
            isPromptAlreadyLastMessage &&
            inFlightInitialAiTickets.has(ticketId))
        ) {
          res.status(200).json({
            status: 'ok',
            data: {
              reply: '',
              duplicateSkipped: true,
              latencyMs: Date.now() - startTime,
              ticketId,
            },
          });
          return;
        }

        if (!hasExistingAiReply && isPromptAlreadyLastMessage) {
          shouldTrackInitialLock = true;
          inFlightInitialAiTickets.add(ticketId);
        }

        const contextSlice = isPromptAlreadyLastMessage
          ? riwayatDb.slice(0, -1).slice(-6)
          : riwayatDb.slice(-6);

        for (const m of contextSlice) {
          historyMessages.push({
            role: m.isCustomer ? 'user' : 'assistant',
            content: m.body,
          });
        }
      }

      if (!isPromptAlreadyLastMessage && !isTicketInitWrapper) {
        const senderId = req.user?.userId ?? tiket?.customerId;
        if (senderId) {
          await ticketModel.createMessage({
            ticket: { connect: { id: ticketId } },
            sender: { connect: { id: senderId } },
            body: prompt,
            isCustomer: true,
          });
        }

        if (
          tiket &&
          (tiket.status === TicketStatus.WAITING_CUSTOMER ||
            tiket.status === TicketStatus.RESOLVED)
        ) {
          await ticketModel.updateStatus(ticketId, TicketStatus.IN_PROGRESS);
        }
      }
    } else if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (
          h &&
          (h.role === 'user' || h.role === 'assistant') &&
          typeof h.content === 'string' &&
          h.content.trim()
        ) {
          historyMessages.push({ role: h.role, content: h.content.trim() });
        }
      }
    }

    try {
      const result = await runAssistantTurn({
        userMessage: prompt,
        historyMessages,
        user: req.user ? { userId: req.user.userId, role: req.user.role } : null,
        ticketId: ticketId ?? null,
        bookingId: tiket?.bookingId ?? null,
        isSandbox: false,
      });

      if (ticketId) {
        await ticketModel.createAiMessage(ticketId, result.reply);
      }

      res.status(200).json({
        status: 'ok',
        data: {
          reply: result.reply,
          latencyMs: result.latencyMs,
          ticketId: ticketId ?? null,
          fallback: result.fallbackUsed,
          ragMode: result.rag.mode,
          toolsUsed: result.toolsUsed.map((t) => t.name),
          intentGuard: result.intentGuard,
          ticketHandedOver: result.ticketHandedOver,
        },
      });
    } finally {
      if (shouldTrackInitialLock && ticketId) {
        inFlightInitialAiTickets.delete(ticketId);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Terjadi galat pada endpoint customer AI chat');
    const balasanCadangan = [
      'Halo Sobat Juragan! Layanan asisten virtual kami sedang dalam pemeliharaan singkat.',
      `Untuk pengecekan armada maupun bantuan pesanan cepat, silakan hubungi customer service kami via WhatsApp resmi ${NOMOR_WHATSAPP_KANTOR}.`,
    ].join('\n\n');

    res.status(200).json({
      status: 'ok',
      data: {
        reply: balasanCadangan,
        latencyMs: Date.now() - startTime,
        ticketId: null,
        fallback: true,
      },
    });
  }
}
