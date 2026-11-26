import type { Request, Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { ensureAiDefaults } from '../services/aiKnowledgeSeed.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runAssistantTurn } from '../lib/ai/chatOrchestrator.js';
import { indexKnowledgeDocument, syncAllKnowledgeChunks } from '../lib/rag/indexer.js';
import { invalidateRagCorpusCache } from '../lib/rag/retriever.js';
import {
  clearAiGatewayHttpLogs,
  fetch9RouterRawLogs,
  generateConversationTraceId,
  get9RouterCliToken,
  getAiGatewayHttpLogs,
  invalidateAiSettingCache,
  recordGatewayLog,
  resolve9RouterConfig,
  resolve9RouterOrigin,
  resolveClientNetworkAffinity,
  sanitizeAiConfigForClient,
} from '../lib/ai/gatewayConfig.js';
import type {
  AiGatewayLogEntry,
  AiGatewayLogEvent,
  Resolved9RouterConfig,
} from '../lib/ai/gatewayConfig.js';

export {
  generateConversationTraceId,
  recordGatewayLog,
  resolve9RouterConfig,
  resolveClientNetworkAffinity,
  sanitizeAiConfigForClient,
};
export type { AiGatewayLogEntry, AiGatewayLogEvent, Resolved9RouterConfig };

export async function getAiGatewayLogs(req: Request, res: Response): Promise<void> {
  try {
    const rawConsoleLogs = await fetch9RouterRawLogs();

    res.status(200).json({
      status: 'ok',
      data: {
        httpLogs: getAiGatewayHttpLogs(),
        rawLogs: rawConsoleLogs,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memuat log AI Gateway');
    res.status(500).json({ status: 'error', message: 'Gagal memuat log gateway.' });
  }
}

export async function clearAiGatewayLogs(req: Request, res: Response): Promise<void> {
  try {
    clearAiGatewayHttpLogs();
    const token = get9RouterCliToken();
    if (token) {
      await fetch(`${resolve9RouterOrigin()}/api/translator/console-logs`, {
        method: 'DELETE',
        headers: { 'x-9r-cli-token': token },
      }).catch(() => {});
    }
    res.status(200).json({ status: 'ok', message: 'Log berhasil dibersihkan.' });
  } catch {
    res.status(500).json({ status: 'error', message: 'Gagal membersihkan log.' });
  }
}

export async function getAiConfig(req: Request, res: Response): Promise<void> {
  try {
    await ensureAiDefaults();

    let config = await db.aiSetting.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      const resolved = resolve9RouterConfig(null);
      config = await db.aiSetting.create({
        data: {
          id: 'default',
          gatewayUrl: resolved.gatewayUrl,
          apiKey: '',
          activeModel: resolved.activeModel,
          fallbackModel: resolved.activeModel,
          fallbackGatewayUrl: '',
          fallbackApiKey: '',
          autoFallbackEnabled: true,
          proxyUrl: '',
          healthStatus: 'HEALTHY',
          lastLatencyMs: 0,
          temperature: 0.7,
          maxTokens: 1200,
          enableRag: true,
          systemPrompt: 'Asisten Virtual Resmi MobilJuragan Merauke.',
        },
      });
    }

    const [
      documentCount,
      activeDocumentCount,
      faqCount,
      activeFaqCount,
      chunkCount,
      activeChunkCount,
      embeddedChunkCount,
    ] = await Promise.all([
      db.knowledgeDocument.count(),
      db.knowledgeDocument.count({ where: { isActive: true } }),
      db.faq.count(),
      db.faq.count({ where: { isActive: true } }),
      db.knowledgeChunk.count(),
      db.knowledgeChunk.count({ where: { isActive: true } }),
      db.knowledgeChunk.count({ where: { isActive: true, embeddingDims: { gt: 0 } } }),
    ]);

    res.status(200).json({
      status: 'ok',
      data: {
        config: sanitizeAiConfigForClient(config),
        stats: {
          documentCount,
          activeDocumentCount,
          faqCount,
          activeFaqCount,
          chunkCount,
          activeChunkCount,
          embeddedChunkCount,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memuat konfigurasi AI');
    res.status(500).json({ status: 'error', message: 'Gagal memuat konfigurasi AI.' });
  }
}

export async function updateAiConfig(req: Request, res: Response): Promise<void> {
  try {
    await ensureAiDefaults();
    const {
      gatewayUrl,
      apiKey,
      activeModel,
      fallbackModel,
      fallbackGatewayUrl,
      fallbackApiKey,
      autoFallbackEnabled,
      proxyUrl,
      systemPrompt,
      temperature,
      maxTokens,
      enableRag,
    } = req.body;

    const resolvedDefault = resolve9RouterConfig(null);
    const hasNonEmptyString = (val: unknown): val is string =>
      typeof val === 'string' && val.trim().length > 0;

    if (systemPrompt !== undefined && String(systemPrompt).length > 2000) {
      res.status(400).json({
        status: 'error',
        message: 'System prompt maksimal 2000 karakter.',
      });
      return;
    }

    const updated = await db.aiSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(hasNonEmptyString(gatewayUrl) ? { gatewayUrl: gatewayUrl.trim() } : {}),
        ...(hasNonEmptyString(apiKey) ? { apiKey: apiKey.trim() } : {}),
        ...(hasNonEmptyString(activeModel) ? { activeModel: activeModel.trim() } : {}),
        ...(hasNonEmptyString(fallbackModel) ? { fallbackModel: fallbackModel.trim() } : {}),
        ...(hasNonEmptyString(fallbackGatewayUrl)
          ? { fallbackGatewayUrl: fallbackGatewayUrl.trim() }
          : {}),
        ...(hasNonEmptyString(fallbackApiKey) ? { fallbackApiKey: fallbackApiKey.trim() } : {}),
        ...(autoFallbackEnabled !== undefined
          ? { autoFallbackEnabled: Boolean(autoFallbackEnabled) }
          : {}),
        ...(proxyUrl !== undefined ? { proxyUrl: String(proxyUrl).trim() } : {}),
        ...(systemPrompt !== undefined ? { systemPrompt: String(systemPrompt) } : {}),
        ...(temperature !== undefined && !isNaN(Number(temperature))
          ? { temperature: Number(temperature) }
          : {}),
        ...(maxTokens !== undefined && !isNaN(Number(maxTokens))
          ? { maxTokens: Number(maxTokens) }
          : {}),
        ...(enableRag !== undefined ? { enableRag: Boolean(enableRag) } : {}),
      },
      create: {
        id: 'default',
        gatewayUrl: hasNonEmptyString(gatewayUrl)
          ? gatewayUrl.trim()
          : resolvedDefault.gatewayUrl,
        apiKey: hasNonEmptyString(apiKey) ? apiKey.trim() : '',
        activeModel: hasNonEmptyString(activeModel)
          ? activeModel.trim()
          : resolvedDefault.activeModel,
        fallbackModel: hasNonEmptyString(fallbackModel)
          ? fallbackModel.trim()
          : resolvedDefault.activeModel,
        fallbackGatewayUrl: hasNonEmptyString(fallbackGatewayUrl)
          ? fallbackGatewayUrl.trim()
          : '',
        fallbackApiKey: hasNonEmptyString(fallbackApiKey) ? fallbackApiKey.trim() : '',
        autoFallbackEnabled:
          autoFallbackEnabled !== undefined ? Boolean(autoFallbackEnabled) : true,
        proxyUrl: proxyUrl ? String(proxyUrl).trim() : '',
        healthStatus: 'HEALTHY',
        systemPrompt: systemPrompt ? String(systemPrompt) : 'Asisten MobilJuragan',
        temperature:
          temperature !== undefined && !isNaN(Number(temperature)) ? Number(temperature) : 0.7,
        maxTokens:
          maxTokens !== undefined && !isNaN(Number(maxTokens)) ? Number(maxTokens) : 1200,
        enableRag: enableRag !== undefined ? Boolean(enableRag) : true,
      },
    });

    invalidateAiSettingCache();

    res.status(200).json({
      status: 'ok',
      data: sanitizeAiConfigForClient(updated),
      message: 'Konfigurasi AI Gateway & mitigasi kuota berhasil disimpan.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memperbarui konfigurasi AI');
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui konfigurasi AI.' });
  }
}

/**
 * Health check & kuota status checker live ke gateway aktif
 */
export async function checkAiGatewayHealth(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    await ensureAiDefaults();
    const config = await db.aiSetting.findUnique({ where: { id: 'default' } });
    const { gatewayUrl, apiKey, activeModel } = resolve9RouterConfig(config);

    const targetUrl = `${gatewayUrl}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let status = 'HEALTHY';
    let statusCode = 200;
    let message = 'Gateway dan provider AI dalam kondisi sehat dan siap melayani.';

    try {
      const pingRes = await fetch(targetUrl, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeout);
      statusCode = pingRes.status;

      if (pingRes.status === 429) {
        status = 'RATE_LIMITED';
        message =
          'Upstream provider terkena rate limit (HTTP 429). Auto-fallback circuit breaker siaga.';
      } else if (pingRes.status === 403) {
        status = 'DEGRADED';
        message =
          'Akses ditolak oleh upstream (HTTP 403 FreeTierError / Cloudflare block). Perlu rotasi session/key.';
      } else if (!pingRes.ok) {
        status = 'DEGRADED';
        message = `Gateway merespons dengan status HTTP ${pingRes.status}.`;
      }
    } catch {
      clearTimeout(timeout);
      status = 'OFFLINE';
      statusCode = 0;
      message = `Gateway lokal di ${gatewayUrl} tidak merespons (Offline atau belum dijalankan).`;
    }

    const latencyMs = Date.now() - startTime;

    await db.aiSetting.update({
      where: { id: 'default' },
      data: {
        healthStatus: status,
        lastLatencyMs: latencyMs,
        lastHealthCheckedAt: new Date(),
      },
    });
    invalidateAiSettingCache();

    recordGatewayLog({
      event: 'HEALTH_CHECK',
      model: activeModel,
      status: statusCode,
      latencyMs,
      details: message,
    });

    res.status(200).json({
      status: 'ok',
      data: {
        healthStatus: status,
        statusCode,
        latencyMs,
        message,
        checkedAt: new Date().toISOString(),
        gatewayUrl,
        activeModel,
        fallbackModel: config?.fallbackModel || activeModel,
        autoFallbackEnabled: config?.autoFallbackEnabled ?? true,
        proxyUrl: config?.proxyUrl || '',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memeriksa kesehatan AI Gateway');
    res.status(500).json({ status: 'error', message: 'Gagal memeriksa kesehatan AI Gateway.' });
  }
}

export async function getKnowledgeDocuments(req: Request, res: Response): Promise<void> {
  try {
    await ensureAiDefaults();
    const documents = await db.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        chunks: {
          select: { embeddingDims: true },
        },
      },
    });

    res.status(200).json({
      status: 'ok',
      data: documents.map(({ chunks, ...doc }) => ({
        ...doc,
        chunkCount: chunks.length,
        embeddedChunkCount: chunks.filter((c) => c.embeddingDims > 0).length,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memuat dokumen basis pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal memuat dokumen basis pengetahuan.' });
  }
}

export async function createKnowledgeDocument(req: Request, res: Response): Promise<void> {
  try {
    const { title, category, content, isActive } = req.body;

    if (!title || !content) {
      res.status(400).json({
        status: 'error',
        message: 'Judul dan konten dokumen pengetahuan wajib diisi.',
      });
      return;
    }

    const judul = String(title).trim();
    const isi = String(content).trim();
    const kategori = category ? String(category).trim().toUpperCase() : 'GENERAL';

    if (judul.length > 80) {
      res.status(400).json({ status: 'error', message: 'Judul dokumen maksimal 80 karakter.' });
      return;
    }
    if (kategori.length > 40) {
      res.status(400).json({ status: 'error', message: 'Kategori maksimal 40 karakter.' });
      return;
    }
    if (isi.length > 15000) {
      res.status(400).json({ status: 'error', message: 'Isi dokumen maksimal 15000 karakter.' });
      return;
    }

    const doc = await db.knowledgeDocument.create({
      data: {
        title: judul,
        category: kategori,
        content: isi,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    const indexResult = await indexKnowledgeDocument(doc.id).catch((err) => {
      logger.warn({ err, docId: doc.id }, 'Gagal mengindeks chunk dokumen baru ke RAG');
      return null;
    });

    res.status(201).json({
      status: 'ok',
      data: {
        ...doc,
        chunkCount: indexResult?.chunksWritten ?? 0,
        embeddedChunkCount: (indexResult?.embeddedCount ?? 0) + (indexResult?.reusedCount ?? 0),
      },
      message: 'Dokumen pengetahuan berhasil ditambahkan dan diindeks ke RAG.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal membuat dokumen pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal membuat dokumen pengetahuan.' });
  }
}

export async function updateKnowledgeDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, category, content, isActive } = req.body;

    const existing = await db.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Dokumen pengetahuan tidak ditemukan.' });
      return;
    }

    if (title !== undefined && String(title).trim().length > 80) {
      res.status(400).json({ status: 'error', message: 'Judul dokumen maksimal 80 karakter.' });
      return;
    }
    if (category !== undefined && String(category).trim().length > 40) {
      res.status(400).json({ status: 'error', message: 'Kategori maksimal 40 karakter.' });
      return;
    }
    if (content !== undefined && String(content).trim().length > 15000) {
      res.status(400).json({ status: 'error', message: 'Isi dokumen maksimal 15000 karakter.' });
      return;
    }

    const updated = await db.knowledgeDocument.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(category !== undefined ? { category: String(category).trim().toUpperCase() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    const indexResult = await indexKnowledgeDocument(updated.id).catch((err) => {
      logger.warn({ err, docId: updated.id }, 'Gagal memperbarui indeks chunk dokumen RAG');
      return null;
    });

    res.status(200).json({
      status: 'ok',
      data: {
        ...updated,
        chunkCount: indexResult?.chunksWritten ?? 0,
        embeddedChunkCount: (indexResult?.embeddedCount ?? 0) + (indexResult?.reusedCount ?? 0),
      },
      message: 'Dokumen pengetahuan berhasil diperbarui.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memperbarui dokumen pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui dokumen pengetahuan.' });
  }
}

export async function reindexRagKnowledge(req: Request, res: Response): Promise<void> {
  try {
    const force = Boolean(req.body?.force);
    const result = await syncAllKnowledgeChunks({ forceReembed: force });

    res.status(200).json({
      status: 'ok',
      data: result,
      message: `Indeks RAG disinkronkan: ${result.chunksTotal} potongan dari ${result.documentsProcessed} dokumen dan ${result.faqsProcessed} FAQ.`,
    });
  } catch (error) {
    logger.error({ error }, 'Gagal melakukan reindex indeks RAG');
    res.status(500).json({ status: 'error', message: 'Gagal menyinkronkan indeks RAG.' });
  }
}

export async function deleteKnowledgeDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await db.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Dokumen pengetahuan tidak ditemukan.' });
      return;
    }

    await db.knowledgeDocument.delete({ where: { id } });
    invalidateRagCorpusCache();

    res.status(200).json({
      status: 'ok',
      message: 'Dokumen pengetahuan berhasil dihapus.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal menghapus dokumen pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal menghapus dokumen pengetahuan.' });
  }
}

/**
 * Ekstraksi dokumen untuk basis pengetahuan RAG.
 *
 * Hanya menerima Markdown (.md) dan teks biasa (.txt).
 *
 * Dulu endpoint ini juga memanggil `anydoc` untuk PDF, DOCX, ODT, PPTX, dan
 * XLSX. Ketergantungan itu dicabut karena `anydoc` adalah biner eksternal yang
 * harus dipasang terpisah di server, dan kalau tidak ada, unggahan admin gagal
 * dengan galat 500. Berkas biner juga membuka permukaan serangan yang tidak
 * sebanding dengan manfaatnya untuk basis pengetahuan teks.
 *
 * Untuk dokumen PDF atau Word, admin mengubahnya menjadi Markdown lebih dulu.
 */
export async function parseKnowledgeFile(req: Request, res: Response): Promise<void> {
  try {
    const { filename, contentBase64 } = req.body;

    if (!filename || !contentBase64) {
      res
        .status(400)
        .json({ status: 'error', message: 'Nama file dan konten base64 wajib disertakan.' });
      return;
    }

    const cleanFilename = String(filename).trim();
    const cleanTitle = cleanFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const ext = path.extname(cleanFilename).toLowerCase();

    if (ext !== '.md' && ext !== '.txt') {
      res.status(400).json({
        status: 'error',
        message: `Format berkas ${ext || '(tanpa ekstensi)'} tidak didukung. Basis pengetahuan hanya menerima Markdown (.md) atau teks biasa (.txt).`,
      });
      return;
    }

    const buffer = Buffer.from(contentBase64, 'base64');

    /*
     * Berkas teks besar tidak ada gunanya untuk RAG: isinya akan terpotong saat
     * dipecah menjadi potongan kecil. Batas 2 MB sudah jauh lebih besar daripada
     * artikel pengetahuan yang wajar.
     */
    const BATAS_BYTE = 2 * 1024 * 1024;
    if (buffer.length > BATAS_BYTE) {
      res.status(413).json({
        status: 'error',
        message: `Ukuran berkas melebihi batas ${BATAS_BYTE / 1024 / 1024} MB.`,
      });
      return;
    }

    const text = buffer.toString('utf-8');

    if (text.trim().length === 0) {
      res.status(422).json({
        status: 'error',
        message: 'Berkas tidak memuat teks yang bisa dibaca.',
      });
      return;
    }

    const lineCount = text.split('\n').length;

    recordGatewayLog({
      event: 'DOC_PARSED',
      model: 'fast-text-parser',
      status: 200,
      latencyMs: 5,
      details: `File ${cleanFilename} diekstrak (${lineCount} baris)`,
    });

    res.status(200).json({
      status: 'ok',
      data: {
        title: cleanTitle,
        content: text.trim(),
        format: ext.replace('.', ''),
        lineCount,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memproses file dokumen RAG');
    res.status(500).json({ status: 'error', message: 'Terjadi galat saat memproses dokumen.' });
  }
}


/**
 * Uji coba percakapan interaktif (Test Sandbox) memakai Hybrid RAG + Live Tool Calling Orchestrator.
 */
export async function testChatSandbox(req: Request, res: Response): Promise<void> {
  try {
    const {
      prompt,
      history,
      temperature: reqTemp,
      maxTokens: reqTokens,
      systemPrompt: reqPrompt,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ status: 'error', message: 'Pertanyaan (prompt) tidak boleh kosong.' });
      return;
    }

    if (prompt.trim().length > 500) {
      res.status(400).json({ status: 'error', message: 'Pesan uji coba maksimal 500 karakter.' });
      return;
    }

    if (reqPrompt !== undefined && String(reqPrompt).length > 2000) {
      res.status(400).json({ status: 'error', message: 'System prompt maksimal 2000 karakter.' });
      return;
    }

    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (Array.isArray(history)) {
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

    const result = await runAssistantTurn({
      userMessage: prompt.trim(),
      historyMessages,
      user: req.user ? { userId: req.user.userId, role: req.user.role } : null,
      isSandbox: true,
      configOverride: {
        ...(reqTemp !== undefined && !isNaN(Number(reqTemp))
          ? { temperature: Number(reqTemp) }
          : {}),
        ...(reqTokens !== undefined && !isNaN(Number(reqTokens))
          ? { maxTokens: Number(reqTokens) }
          : {}),
        ...(reqPrompt !== undefined && String(reqPrompt).trim()
          ? { systemPrompt: String(reqPrompt).trim() }
          : {}),
      },
    });

    const tokens = result.tokens ?? null;
    const tokensPerSecond =
      tokens && result.latencyMs > 0
        ? Math.round((tokens / (result.latencyMs / 1000)) * 10) / 10
        : Math.round((tokens || 60) / 1.2);

    const ragDocumentsInjected = result.rag.chunksUsed.filter(
      (c) => c.sourceType === 'DOCUMENT',
    ).length;
    const ragFaqsInjected = result.rag.chunksUsed.filter(
      (c) => c.sourceType === 'FAQ',
    ).length;
    const referencedDocuments = Array.from(
      new Set(result.rag.chunksUsed.map((c) => c.title)),
    );

    res.status(200).json({
      status: 'ok',
      data: {
        reply: result.reply,
        modelUsed: result.model,
        tokens,
        latencyMs: result.latencyMs,
        tokensPerSecond,
        ragDocumentsInjected,
        ragFaqsInjected,
        referencedDocuments,
        ragMode: result.rag.mode,
        ragLatencyMs: result.rag.latencyMs,
        ragChunksUsed: result.rag.chunksUsed,
        toolsUsed: result.toolsUsed,
        intentGuard: result.intentGuard,
        isSimulationFallback: result.fallbackUsed,
        isFallbackTriggered: result.fallbackUsed,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal menjalankan test chat sandbox');
    res.status(500).json({ status: 'error', message: 'Gagal menjalankan pengujian chat.' });
  }
}

/**
 * Kategori dokumen pengetahuan untuk RAG.
 *
 * Sebelumnya daftar kategori dipatri di kode tampilan, sehingga admin tidak bisa
 * menambah kategori baru tanpa mengubah kode. Sekarang daftarnya tersimpan di
 * database dan bisa dikelola dari portal.
 */

export async function getKnowledgeCategories(_req: Request, res: Response): Promise<void> {
  try {
    await ensureAiDefaults();
    const categories = await db.knowledgeCategory.findMany({
      orderBy: [{ orderIndex: 'asc' }, { label: 'asc' }],
    });

    /* Jumlah dokumen per kategori ikut dikirim supaya layar bisa menolak
       penghapusan kategori yang masih dipakai tanpa permintaan tambahan. */
    const jumlah = await db.knowledgeDocument.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const petaJumlah = new Map(jumlah.map((j) => [j.category, j._count._all]));

    res.status(200).json({
      status: 'ok',
      data: categories.map((c) => ({
        ...c,
        jumlahDokumen: petaJumlah.get(c.slug) ?? 0,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memuat kategori pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal memuat kategori pengetahuan.' });
  }
}

export async function createKnowledgeCategory(req: Request, res: Response): Promise<void> {
  try {
    const label = String(req.body?.label ?? '').trim();
    if (!label) {
      res.status(400).json({ status: 'error', message: 'Nama kategori wajib diisi.' });
      return;
    }

    /* Slug dibuat dari nama, lalu dipakai sebagai nilai yang disimpan dokumen.
       Dengan begitu nama tampilan bisa diubah tanpa menyentuh dokumen lama. */
    const slug = label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);

    if (!slug) {
      res.status(400).json({
        status: 'error',
        message: 'Nama kategori harus mengandung huruf atau angka.',
      });
      return;
    }

    const sudahAda = await db.knowledgeCategory.findUnique({ where: { slug } });
    if (sudahAda) {
      res.status(409).json({
        status: 'error',
        message: `Kategori dengan kode ${slug} sudah ada.`,
      });
      return;
    }

    const terakhir = await db.knowledgeCategory.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const kategori = await db.knowledgeCategory.create({
      data: {
        slug,
        label,
        orderIndex: (terakhir?.orderIndex ?? 0) + 10,
      },
    });

    res.status(201).json({
      status: 'ok',
      data: { ...kategori, jumlahDokumen: 0 },
      message: 'Kategori berhasil ditambahkan.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal membuat kategori pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal membuat kategori pengetahuan.' });
  }
}

export async function updateKnowledgeCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const label = String(req.body?.label ?? '').trim();
    const orderIndex = req.body?.orderIndex;

    if (!label && orderIndex === undefined) {
      res.status(400).json({ status: 'error', message: 'Tidak ada perubahan yang dikirim.' });
      return;
    }

    const ada = await db.knowledgeCategory.findUnique({ where: { id } });
    if (!ada) {
      res.status(404).json({ status: 'error', message: 'Kategori tidak ditemukan.' });
      return;
    }

    /* `slug` sengaja tidak ikut diubah. Dokumen menyimpan slug, jadi menggantinya
       akan memutus hubungan dengan semua dokumen yang sudah ada. */
    const kategori = await db.knowledgeCategory.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(orderIndex !== undefined ? { orderIndex: Number(orderIndex) } : {}),
      },
    });

    res.status(200).json({
      status: 'ok',
      data: kategori,
      message: 'Kategori berhasil diperbarui.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memperbarui kategori pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui kategori pengetahuan.' });
  }
}

export async function deleteKnowledgeCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const kategori = await db.knowledgeCategory.findUnique({ where: { id } });
    if (!kategori) {
      res.status(404).json({ status: 'error', message: 'Kategori tidak ditemukan.' });
      return;
    }

    /* Kategori yang masih dipakai dokumen tidak boleh dihapus. Kalau dihapus,
       dokumennya menjadi yatim dan tidak lagi muncul di penyaring mana pun. */
    const dipakai = await db.knowledgeDocument.count({ where: { category: kategori.slug } });
    if (dipakai > 0) {
      res.status(409).json({
        status: 'error',
        message: `Kategori masih dipakai ${dipakai} dokumen. Pindahkan dokumennya dulu.`,
      });
      return;
    }

    await db.knowledgeCategory.delete({ where: { id } });

    res.status(200).json({ status: 'ok', message: 'Kategori berhasil dihapus.' });
  } catch (error) {
    logger.error({ error }, 'Gagal menghapus kategori pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal menghapus kategori pengetahuan.' });
  }
}
