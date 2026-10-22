import type { Request, Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import {
  processMessageGuardrail,
  GCA_SYSTEM_INSTRUCTION,
} from '../services/aiGuardrailService.js';
import {
  generateConversationTraceId,
  resolveClientNetworkAffinity,
} from './aiConfigController.js';
import * as crypto from 'node:crypto';

/**
 * Controller Chat Pelanggan (Aplikasi Mobile & Web Pelanggan)
 * Menggunakan Tier 2 Semantic Guardrail (MJ-SGIP v1.0)
 */
export async function handleCustomerAiChat(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const rawPrompt = req.body?.message ?? req.body?.prompt;
    const history = req.body?.history;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'Pesan pertanyaan tidak boleh kosong.',
      });
      return;
    }

    const prompt = rawPrompt.trim();
    const userId = req.user?.userId;

    // 1. Eksekusi Lapisan Pelindung & Klasifikasi Intent (Tier 2 Guardrail)
    const guardrail = await processMessageGuardrail(prompt, { userId });

    if (guardrail.shouldBypassRag && guardrail.directResponse) {
      const latencyMs = Date.now() - startTime;
      res.status(200).json({
        status: 'ok',
        data: {
          reply: guardrail.directResponse,
          intent: guardrail.intent,
          confidence: guardrail.confidence,
          reasoning: guardrail.reasoning,
          guardrailSource: guardrail.source,
          bypassedRag: true,
          latencyMs,
        },
      });
      return;
    }

    // 2. Jika RENTAL_FAQ: Susun Konteks Pengetahuan Resmi (RAG)
    const config = await db.aiSetting.findUnique({ where: { id: 'default' } });
    const gatewayUrl = (config?.gatewayUrl || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const activeModel = config?.activeModel || 'MJ';

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

    const fullSystemPrompt = `${systemPromptBase}\n${GCA_SYSTEM_INSTRUCTION}${ragContextText}\nJawab pertanyaan pelanggan secara akurat dan ramah sesuai standar G-C-A.`;

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

    messages.push({ role: 'user', content: prompt });

    // 3. Eksekusi Inferensi LLM melalui 9Router Gateway
    const targetUrl = `${gatewayUrl}/chat/completions`;
    const traceId = generateConversationTraceId();
    const networkAffinity = resolveClientNetworkAffinity();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-ID': traceId,
      'X-Opencode-Session': traceId,
      'X-Opencode-Session-Id': traceId,
      'X-Session-Affinity': traceId,
      'X-Request-ID': `cust-${crypto.randomUUID()}`,
      'X-Forwarded-For': networkAffinity,
      'X-Real-IP': networkAffinity,
    };
    if (config?.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

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

      const responseJson = (await apiRes.json()) as {
        choices?: Array<{ message?: { content: string } }>;
      };

      const replyContent =
        responseJson.choices?.[0]?.message?.content ||
        'Halo! Tim MobilJuragan Merauke siap melayani Anda. Silakan hubungi kami untuk informasi lebih lanjut.';

      res.status(200).json({
        status: 'ok',
        data: {
          reply: replyContent,
          intent: guardrail.intent,
          confidence: guardrail.confidence,
          reasoning: guardrail.reasoning,
          guardrailSource: guardrail.source,
          bypassedRag: false,
          latencyMs,
        },
      });
    } catch (networkError) {
      clearTimeout(timeout);
      logger.warn(
        { error: (networkError as Error).message },
        'Gateway AI tidak merespons pada endpoint customer chat',
      );

      // Graceful fallback response khas rental MobilJuragan
      res.status(200).json({
        status: 'ok',
        data: {
          reply: `Halo Sobat Juragan! Terima kasih telah menghubungi MobilJuragan Merauke.\n\nSaat ini sistem asisten virtual kami sedang melakukan sinkronisasi otomatis. Seluruh layanan rental mobil dalam kota Merauke, rute Sota, dan Boven Digoel tetap beroperasi normal dengan armada prima (Innova Reborn, Fortuner, Avanza, Hilux 4x4).\n\nUntuk informasi ketersediaan unit dan pemesanan cepat, silakan langsung hubungi customer service kami via WhatsApp di +62 812-4800-2910. Tim kami siap melayani Anda!`,
          intent: 'RENTAL_FAQ',
          confidence: 0.5,
          reasoning: 'Fallback graceful offline asisten virtual.',
          guardrailSource: 'rule_fallback',
          bypassedRag: false,
          latencyMs: Date.now() - startTime,
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
