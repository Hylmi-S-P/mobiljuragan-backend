import type { Request, Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { ticketModel } from '../model/ticketModel.js';
import { TicketHandler } from '../generated/prisma/client.js';
import {
  generateConversationTraceId,
  resolveClientNetworkAffinity,
} from './aiConfigController.js';
import * as crypto from 'node:crypto';

/**
 * Controller Chat Pelanggan (Aplikasi Mobile & Web Pelanggan)
 */
export async function handleCustomerAiChat(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const rawPrompt = req.body?.message ?? req.body?.prompt;
    const history = req.body?.history;
    /* Opsional. Kalau klien mengirim id tiket, percakapan ikut disimpan ke tiket
       itu sehingga admin bisa membacanya setelah mengambil alih. Tanpa id tiket,
       perilaku lama dipertahankan: hanya menjawab, tidak menyimpan. */
    const rawTicketId = req.body?.ticketId ?? req.body?.ticket_id;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'Pesan pertanyaan tidak boleh kosong.',
      });
      return;
    }

    const prompt = rawPrompt.trim();

    /* Tiket diperiksa lebih dulu. Kalau tiket sudah dipegang staf, asisten AI
       harus berhenti menjawab supaya tidak ada dua pihak yang membalas hal yang
       sama di satu ruangan. */
    const ticketId = typeof rawTicketId === 'string' && rawTicketId ? rawTicketId : undefined;
    if (ticketId) {
      const tiket = await ticketModel.findById(ticketId);
      if (!tiket) {
        res.status(404).json({
          status: 'error',
          message: `Tiket dengan ID '${ticketId}' tidak ditemukan.`,
        });
        return;
      }
      if (tiket.handledBy === TicketHandler.HUMAN) {
        /* Bentuk galat disamakan dengan handler galat aplikasi (`error.code`),
           supaya klien cukup membaca satu bentuk untuk semua kegagalan. */
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

    // 1. Susun Konteks Pengetahuan Resmi (RAG)
    const config = await db.aiSetting.findUnique({ where: { id: 'default' } });
    const gatewayUrl = (config?.gatewayUrl || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const activeModel = config?.activeModel || 'gemini-2.5-flash';

    const systemPromptBase =
      config?.systemPrompt ||
      'Anda adalah Asisten Virtual Resmi MobilJuragan (CV. Mobil Juragan Express Transport, Merauke).';

    let ragContextText = '';
    const activeDocs = await db.knowledgeDocument.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });

    const activeFaqs = await db.faq.findMany({
      where: { isActive: true },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    if (activeDocs.length > 0) {
      ragContextText += '\n\n=== DOKUMEN BASIS PENGETAHUAN RESMI MOBILJURAGAN (RAG) ===\n';
      for (const doc of activeDocs) {
        ragContextText += `\n[DOKUMEN: ${doc.title} | KATEGORI: ${doc.category}]\n${doc.content}\n`;
      }
      ragContextText += '\n=== AKHIR DOKUMEN BASIS PENGETAHUAN ===\n';
    }

    if (activeFaqs.length > 0) {
      ragContextText += '\n\n=== BASIS PENGETAHUAN FAQ RESMI MOBILJURAGAN ===\n';
      for (const faq of activeFaqs) {
        ragContextText += `\n[KATEGORI: ${faq.category}]\nTANYA: ${faq.question}\nJAWAB: ${faq.answer}\n`;
      }
      ragContextText += '\n=== AKHIR BASIS PENGETAHUAN FAQ ===\n';
    }

    const fullSystemPrompt = `${systemPromptBase}${ragContextText}\nJawab pertanyaan pelanggan secara ramah, akurat, dan sopan sesuai standar MobilJuragan Merauke.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: fullSystemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h.role && h.content) {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }

    /* Kalau tiketnya diketahui, riwayat diambil dari database dan dipakai
       menggantikan riwayat kiriman klien. Dua alasan: klien bisa mengirim riwayat
       palsu, dan riwayat di database adalah satu-satunya yang juga dibaca admin.
       Dengan begitu yang dijawab AI sama dengan yang dilihat admin. */
    if (ticketId) {
      const riwayatDb = await ticketModel.listMessages(ticketId);
      if (riwayatDb.length > 0) {
        messages.length = 1; // sisakan system prompt saja
        for (const m of riwayatDb.slice(-6)) {
          messages.push({
            role: m.isCustomer ? 'user' : 'assistant',
            content: m.body,
          });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

    /* Pesan pelanggan disimpan SEBELUM inferensi dijalankan. Kalau gateway gagal
       atau waktu habis, pertanyaan pelanggan tetap tercatat sehingga admin bisa
       melihat apa yang ditanyakan. Balasan AI menyusul setelah berhasil. */
    if (ticketId) {
      await ticketModel.createMessage({
        ticket: { connect: { id: ticketId } },
        sender: { connect: { id: req.user!.userId } },
        body: prompt,
        isCustomer: true,
      });
    }

    // 2. Eksekusi Inferensi LLM melalui 9Router Gateway
    const targetUrl = `${gatewayUrl}/chat/completions`;
    const traceId = generateConversationTraceId();
    const networkAffinity = resolveClientNetworkAffinity();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-ID': traceId,
      'X-Session-Affinity': traceId,
      'X-Request-ID': `cust-${crypto.randomUUID()}`,
      'X-Forwarded-For': networkAffinity,
      'X-Real-IP': networkAffinity,
    };
    if (config?.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.maxTokens ?? 1200,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (!apiRes.ok) {
        throw new Error(`Upstream gateway mengembalikan status HTTP ${apiRes.status}`);
      }

      const rawText = await apiRes.text();
      let replyContent = '';

      const trimmed = rawText.trim();
      if (trimmed.startsWith('{')) {
        try {
          const json = JSON.parse(trimmed);
          replyContent = json.choices?.[0]?.message?.content || json.choices?.[0]?.delta?.content || '';
        } catch {
          // parse sebagai SSE
        }
      }

      if (!replyContent) {
        let accumulated = '';
        for (const line of trimmed.split('\n')) {
          const l = line.trim();
          if (l.startsWith('data: ')) {
            const dataStr = l.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const chunk = JSON.parse(dataStr);
              accumulated += chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
            } catch {
              // ignore
            }
          }
        }
        replyContent = accumulated.trim();
      }

      if (!replyContent) {
        replyContent = 'Halo! Tim MobilJuragan Merauke siap melayani Anda. Silakan hubungi kami untuk informasi lebih lanjut.';
      }

      /* Balasan AI disimpan setelah isinya pasti, supaya yang tersimpan adalah
         teks yang benar-benar dikirim ke pelanggan. */
      if (ticketId) {
        await ticketModel.createAiMessage(ticketId, replyContent);
      }

      res.status(200).json({
        status: 'ok',
        data: {
          reply: replyContent,
          latencyMs,
          ticketId: ticketId ?? null,
        },
      });
    } catch (networkError) {
      clearTimeout(timeout);
      logger.warn(
        { error: (networkError as Error).message },
        'Gateway AI tidak merespons pada endpoint customer chat',
      );

      // Graceful fallback response khas rental MobilJuragan
      const balasanCadangan = `Halo Sobat Juragan! Terima kasih telah menghubungi MobilJuragan Merauke.\n\nSaat ini sistem asisten virtual kami sedang melakukan sinkronisasi otomatis. Seluruh layanan rental mobil dalam kota Merauke, rute Sota, dan Boven Digoel tetap beroperasi normal dengan armada prima (Innova Reborn, Fortuner, Avanza, Hilux 4x4).\n\nUntuk informasi ketersediaan unit dan pemesanan cepat, silakan langsung hubungi customer service kami via WhatsApp di +62 812-4800-2910. Tim kami siap melayani Anda!`;

      /* Balasan cadangan pun disimpan. Kalau tidak, riwayat di tiket akan terlihat
         seperti pelanggan bicara sendiri tanpa pernah dijawab. */
      if (ticketId) {
        try {
          await ticketModel.createAiMessage(ticketId, balasanCadangan);
        } catch (simpanError) {
          logger.error({ error: simpanError }, 'Gagal menyimpan balasan cadangan AI');
        }
      }

      res.status(200).json({
        status: 'ok',
        data: {
          reply: balasanCadangan,
          latencyMs: Date.now() - startTime,
          ticketId: ticketId ?? null,
          fallback: true,
        },
      });
    }
  } catch (error) {
    logger.error({ error }, 'Galat fatal pada handleCustomerAiChat');
    res.status(500).json({
      status: 'error',
      message: 'Gagal memproses percakapan asisten AI.',
    });
  }
}
