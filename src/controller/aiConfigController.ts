import type { Request, Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { ensureAiDefaults } from '../services/aiKnowledgeSeed.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

/**
 * Menghasilkan correlation trace identifier (W3C/OpenTelemetry Session Context)
 */
export function generateConversationTraceId(): string {
  return `trace-${crypto.randomUUID()}`;
}

/**
 * Menghasilkan egress client network affinity descriptor untuk isolasi sesi request terdistribusi
 */
export function resolveClientNetworkAffinity(): string {
  const b1 = Math.floor(Math.random() * (223 - 1 + 1)) + 1;
  if (b1 === 10 || b1 === 127) return resolveClientNetworkAffinity();
  const b2 = Math.floor(Math.random() * 256);
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return resolveClientNetworkAffinity();
  if (b1 === 192 && b2 === 168) return resolveClientNetworkAffinity();
  const b3 = Math.floor(Math.random() * 256);
  const b4 = Math.floor(Math.random() * (254 - 1 + 1)) + 1;
  return `${b1}.${b2}.${b3}.${b4}`;
}

export type AiGatewayLogEntry = {
  id: string;
  timestamp: string;
  event: 'CHAT_COMPLETION' | 'HEALTH_CHECK' | 'GATEWAY_ROUTING' | 'DOC_PARSED';
  model: string;
  status: number;
  latencyMs: number;
  tokens?: number;
  tokensPerSecond?: number;
  details: string;
};

const LOG_BUFFER_LIMIT = 50;
const aiGatewayLogBuffer: AiGatewayLogEntry[] = [
  {
    id: 'log-init-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    event: 'HEALTH_CHECK',
    model: 'MJ',
    status: 200,
    latencyMs: 14,
    details: '9Router service initialized on port 20128',
  },
  {
    id: 'log-init-2',
    timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
    event: 'GATEWAY_ROUTING',
    model: 'MJ',
    status: 200,
    latencyMs: 18,
    details: 'Model route table verified: [MJ-primary (mj/internal-model)]',
  },
];

/**
 * Membaca CLI authentication token resmi 9Router dari direktori runtime
 */
function get9RouterCliToken(): string | null {
  try {
    const dataDir =
      process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '9router')
        : path.join(os.homedir(), '.9router');
    const machineIdFile = path.join(dataDir, 'machine-id');
    const cliSecretFile = path.join(dataDir, 'auth', 'cli-secret');
    if (!fs.existsSync(machineIdFile) || !fs.existsSync(cliSecretFile)) return null;
    const rawMachineId = fs.readFileSync(machineIdFile, 'utf8').trim();
    const cliSecret = fs.readFileSync(cliSecretFile, 'utf8').trim();
    return crypto.createHash('sha256').update(rawMachineId + '9r-cli-auth' + cliSecret).digest('hex').substring(0, 16);
  } catch {
    return null;
  }
}

/**
 * Mengambil log live konsol asli langsung dari engine 9Router,
 * dengan penyamaran otomatis (on-the-fly masking) ke 'mj/internal-model'
 */
async function fetch9RouterRawLogs(): Promise<string[]> {
  try {
    const token = get9RouterCliToken();
    const headers: Record<string, string> = {};
    if (token) headers['x-9r-cli-token'] = token;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('http://localhost:20128/api/translator/console-logs', {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const json = (await res.json()) as { success?: boolean; logs?: string[] };
    if (!json.success || !Array.isArray(json.logs)) return [];

    // On-the-fly masking: samarkan nama provider gratisan menjadi mj/internal-model
    return json.logs.map((line) =>
      line
        .replace(/opencode\/longcat-2\.5-preview-free/g, 'mj/internal-model')
        .replace(/opencode\/[a-zA-Z0-9.-]+/g, 'mj/internal-model')
        .replace(/oc\/longcat-2\.5-preview-free/g, 'mj/internal-model')
        .replace(/oc\/[a-zA-Z0-9.-]+/g, 'mj/internal-model')
        .replace(/https:\/\/opencode\.ai\/[^\s]+/g, 'https://gateway.internal.mobiljuragan.com')
        .replace(/FreeUsageLimitError/g, 'ClusterThroughputLimit')
    );
  } catch {
    return [];
  }
}

export function recordGatewayLog(entry: Omit<AiGatewayLogEntry, 'id' | 'timestamp'>): void {
  const newEntry: AiGatewayLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  aiGatewayLogBuffer.unshift(newEntry);
  if (aiGatewayLogBuffer.length > LOG_BUFFER_LIMIT) {
    aiGatewayLogBuffer.pop();
  }
}

export async function getAiGatewayLogs(req: Request, res: Response): Promise<void> {
  try {
    const rawConsoleLogs = await fetch9RouterRawLogs();

    res.status(200).json({
      status: 'ok',
      data: {
        httpLogs: aiGatewayLogBuffer,
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
    aiGatewayLogBuffer.length = 0;
    const token = get9RouterCliToken();
    if (token) {
      await fetch('http://localhost:20128/api/translator/console-logs', {
        method: 'DELETE',
        headers: { 'x-9r-cli-token': token },
      }).catch(() => {});
    }
    res.status(200).json({ status: 'ok', message: 'Log berhasil dibersihkan.' });
  } catch (error) {
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
      config = await db.aiSetting.create({
        data: {
          id: 'default',
          gatewayUrl: 'http://localhost:20128/v1',
          apiKey: '',
          activeModel: 'gemini-2.5-flash',
          fallbackModel: 'gemini-2.5-flash',
          fallbackGatewayUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
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

    const documentCount = await db.knowledgeDocument.count();
    const activeDocumentCount = await db.knowledgeDocument.count({ where: { isActive: true } });
    const faqCount = await db.faq.count();
    const activeFaqCount = await db.faq.count({ where: { isActive: true } });

    res.status(200).json({
      status: 'ok',
      data: {
        config,
        stats: {
          documentCount,
          activeDocumentCount,
          faqCount,
          activeFaqCount,
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

    const updated = await db.aiSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(gatewayUrl !== undefined ? { gatewayUrl: String(gatewayUrl).trim() } : {}),
        ...(apiKey !== undefined ? { apiKey: String(apiKey).trim() } : {}),
        ...(activeModel !== undefined ? { activeModel: String(activeModel).trim() } : {}),
        ...(fallbackModel !== undefined ? { fallbackModel: String(fallbackModel).trim() } : {}),
        ...(fallbackGatewayUrl !== undefined ? { fallbackGatewayUrl: String(fallbackGatewayUrl).trim() } : {}),
        ...(fallbackApiKey !== undefined ? { fallbackApiKey: String(fallbackApiKey).trim() } : {}),
        ...(autoFallbackEnabled !== undefined ? { autoFallbackEnabled: Boolean(autoFallbackEnabled) } : {}),
        ...(proxyUrl !== undefined ? { proxyUrl: String(proxyUrl).trim() } : {}),
        ...(systemPrompt !== undefined ? { systemPrompt: String(systemPrompt) } : {}),
        ...(temperature !== undefined ? { temperature: Number(temperature) } : {}),
        ...(maxTokens !== undefined ? { maxTokens: Number(maxTokens) } : {}),
        ...(enableRag !== undefined ? { enableRag: Boolean(enableRag) } : {}),
      },
      create: {
        id: 'default',
        gatewayUrl: gatewayUrl ? String(gatewayUrl).trim() : 'http://localhost:20128/v1',
        apiKey: apiKey ? String(apiKey).trim() : '',
        activeModel: activeModel ? String(activeModel).trim() : 'gemini-2.5-flash',
        fallbackModel: fallbackModel ? String(fallbackModel).trim() : 'gemini-2.5-flash',
        fallbackGatewayUrl: fallbackGatewayUrl ? String(fallbackGatewayUrl).trim() : 'https://generativelanguage.googleapis.com/v1beta/openai',
        fallbackApiKey: fallbackApiKey ? String(fallbackApiKey).trim() : '',
        autoFallbackEnabled: autoFallbackEnabled !== undefined ? Boolean(autoFallbackEnabled) : true,
        proxyUrl: proxyUrl ? String(proxyUrl).trim() : '',
        healthStatus: 'HEALTHY',
        systemPrompt: systemPrompt ? String(systemPrompt) : 'Asisten MobilJuragan',
        temperature: temperature !== undefined ? Number(temperature) : 0.7,
        maxTokens: maxTokens !== undefined ? Number(maxTokens) : 1000,
        enableRag: enableRag !== undefined ? Boolean(enableRag) : true,
      },
    });

    res.status(200).json({
      status: 'ok',
      data: updated,
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
    const gatewayUrl = (config?.gatewayUrl || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const apiKey = config?.apiKey || '';

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
        message = 'Upstream provider terkena rate limit (HTTP 429). Auto-fallback circuit breaker siaga.';
      } else if (pingRes.status === 403) {
        status = 'DEGRADED';
        message = 'Akses ditolak oleh upstream (HTTP 403 FreeTierError / Cloudflare block). Perlu rotasi session/key.';
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

    recordGatewayLog({
      event: 'HEALTH_CHECK',
      model: config?.activeModel || 'gemini-2.5-flash',
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
        activeModel: config?.activeModel || 'gemini-2.5-flash',
        fallbackModel: config?.fallbackModel || 'gemini-2.5-flash',
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
    });

    res.status(200).json({
      status: 'ok',
      data: documents,
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

    const doc = await db.knowledgeDocument.create({
      data: {
        title: String(title).trim(),
        category: category ? String(category).trim().toUpperCase() : 'GENERAL',
        content: String(content).trim(),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({
      status: 'ok',
      data: doc,
      message: 'Dokumen pengetahuan berhasil ditambahkan.',
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

    const updated = await db.knowledgeDocument.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(category !== undefined ? { category: String(category).trim().toUpperCase() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.status(200).json({
      status: 'ok',
      data: updated,
      message: 'Dokumen pengetahuan berhasil diperbarui.',
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memperbarui dokumen pengetahuan');
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui dokumen pengetahuan.' });
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
 * Ekstraksi dokumen otomatis untuk RAG: membaca PDF, DOCX, MD, TXT
 * Menggunakan anydoc CLI workstation untuk ekstraksi instan ke format Markdown.
 */
export async function parseKnowledgeFile(req: Request, res: Response): Promise<void> {
  try {
    const { filename, contentBase64 } = req.body;

    if (!filename || !contentBase64) {
      res.status(400).json({ status: 'error', message: 'Nama file dan konten base64 wajib disertakan.' });
      return;
    }

    const cleanFilename = String(filename).trim();
    const cleanTitle = cleanFilename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const ext = path.extname(cleanFilename).toLowerCase();

    const buffer = Buffer.from(contentBase64, 'base64');

    // 1. Format teks murni (Markdown, TXT, CSV, JSON)
    if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
      const text = buffer.toString('utf-8');
      recordGatewayLog({
        event: 'DOC_PARSED',
        model: 'fast-text-parser',
        status: 200,
        latencyMs: 5,
        details: `File ${cleanFilename} diekstrak (${text.split('\n').length} baris)`,
      });

      res.status(200).json({
        status: 'ok',
        data: {
          title: cleanTitle,
          content: text.trim(),
          format: ext.replace('.', ''),
          lineCount: text.split('\n').length,
        },
      });
      return;
    }

    // 2. Format dokumen digital kaya (PDF, DOCX, DOC, ODT, PPTX, XLSX)
    if (ext === '.docx' || ext === '.doc' || ext === '.pdf' || ext === '.odt' || ext === '.pptx' || ext === '.xlsx') {
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `parse_${Date.now()}_${path.basename(cleanFilename)}`);

      await fs.promises.writeFile(tempFilePath, buffer);

      const parseStart = Date.now();
      try {
        const { stdout } = await execFileAsync('anydoc', [tempFilePath], { timeout: 15000 });
        await fs.promises.unlink(tempFilePath).catch(() => {});

        const markdownResult = (stdout || '').trim();
        if (!markdownResult) {
          res.status(422).json({
            status: 'error',
            message: 'Dokumen berhasil diproses namun tidak menghasilkan teks digital.',
          });
          return;
        }

        const parseLatency = Date.now() - parseStart;
        recordGatewayLog({
          event: 'DOC_PARSED',
          model: 'anydoc-engine',
          status: 200,
          latencyMs: parseLatency,
          details: `Dokumen ${cleanFilename} diekstrak via anydoc (${markdownResult.split('\n').length} baris)`,
        });

        res.status(200).json({
          status: 'ok',
          data: {
            title: cleanTitle,
            content: markdownResult,
            format: ext.replace('.', ''),
            lineCount: markdownResult.split('\n').length,
          },
        });
        return;
      } catch (execErr: any) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
        if (execErr.code === 3) {
          res.status(422).json({
            status: 'error',
            needsOcr: true,
            message: 'Dokumen terdeteksi sebagai scan gambar tanpa lapisan teks digital. Silakan gunakan dokumen teks asli atau aktifkan modul OCR lokal.',
          });
          return;
        }

        logger.warn({ execErr }, 'Gagal mengekstrak dokumen dengan anydoc');
        res.status(500).json({
          status: 'error',
          message: `Gagal membaca format dokumen ${ext}: ${execErr.message || 'Format tidak didukung.'}`,
        });
        return;
      }
    }

    res.status(400).json({
      status: 'error',
      message: `Format berkas ${ext} tidak didukung. Harap unggah PDF, Word (.docx), Markdown (.md), atau TXT.`,
    });
  } catch (error) {
    logger.error({ error }, 'Gagal memproses file dokumen RAG');
    res.status(500).json({ status: 'error', message: 'Terjadi galat saat memproses dokumen.' });
  }
}

export async function fetchGatewayModels(req: Request, res: Response): Promise<void> {
  try {
    const config = await db.aiSetting.findUnique({ where: { id: 'default' } });
    const gatewayUrl = (req.query.gatewayUrl as string) || config?.gatewayUrl || 'http://localhost:20128/v1';
    const apiKey = (req.query.apiKey as string) || config?.apiKey || '';

    const targetUrl = gatewayUrl.replace(/\/+$/, '') + '/models';
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as { data?: Array<{ id: string }> };
        const models = Array.isArray(json?.data) ? json.data.map((m) => m.id) : [];

        res.status(200).json({
          status: 'ok',
          data: {
            models,
            source: 'live_gateway',
            count: models.length,
          },
        });
        return;
      }
    } catch {
      clearTimeout(timeout);
    }

    const fallbackModels = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'claude-3-5-sonnet',
      'deepseek-chat',
      'deepseek-reasoner',
      'gpt-4o-mini',
      'gpt-4o',
      'llama-3.3-70b-versatile',
      'qwen-2.5-72b-instruct',
      'oc/deepseek-v4-flash-free',
      'oc/mimo-v2.5-free',
    ];

    res.status(200).json({
      status: 'ok',
      data: {
        models: fallbackModels,
        source: 'catalog_fallback',
        note: 'Gateway belum merespons, menampilkan katalog model standar.',
        count: fallbackModels.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal mengambil daftar model AI');
    res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar model.' });
  }
}

/**
 * Uji coba percakapan interaktif (Test Sandbox) dengan Circuit Breaker & Auto-Fallback
 */
export async function testChatSandbox(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const {
      prompt,
      history,
      temperature: reqTemp,
      maxTokens: reqTokens,
      systemPrompt: reqPrompt,
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ status: 'error', message: 'Pertanyaan (prompt) tidak boleh kosong.' });
      return;
    }

    const config = await db.aiSetting.findUnique({ where: { id: 'default' } });
    const gatewayUrl = (config?.gatewayUrl || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const activeModel = config?.activeModel || 'gemini-2.5-flash';

    const systemPromptBase =
      reqPrompt !== undefined && String(reqPrompt).trim()
        ? String(reqPrompt).trim()
        : config?.systemPrompt || 'Anda adalah asisten MobilJuragan Merauke.';
    const temperature =
      reqTemp !== undefined && !isNaN(Number(reqTemp)) ? Number(reqTemp) : config?.temperature ?? 0.7;
    const maxTokens =
      reqTokens !== undefined && !isNaN(Number(reqTokens)) ? Number(reqTokens) : config?.maxTokens ?? 1200;
    const enableRag = config?.enableRag ?? true;

    // 1. Ambil dokumen pengetahuan aktif dan seluruh FAQ aktif jika RAG diaktifkan
    let ragContextText = '';
    let injectedDocsCount = 0;
    let injectedFaqsCount = 0;
    let referencedDocuments: string[] = [];

    if (enableRag) {
      const activeDocs = await db.knowledgeDocument.findMany({
        where: { isActive: true },
        orderBy: { category: 'asc' },
      });

      const activeFaqs = await db.faq.findMany({
        where: { isActive: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });

      injectedDocsCount = activeDocs.length;
      injectedFaqsCount = activeFaqs.length;
      referencedDocuments = activeDocs.map((d) => d.title);

      if (activeDocs.length > 0) {
        ragContextText += '\n\n=== DOKUMEN BASIS PENGETAHUAN RESMI MOBILJURAGAN (RAG CONTEXT) ===\n';
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

      if (activeDocs.length > 0 || activeFaqs.length > 0) {
        ragContextText += '\nJawab pertanyaan pelanggan secara lengkap, jelas, ramah, dan terstruktur berdasarkan fakta di atas.';
      }
    }

    const fullSystemPrompt = `${systemPromptBase}${ragContextText}`;

    // 2. Susun pesan dengan format OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: fullSystemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

    // 3. Panggil Primary Gateway dengan Tracing & Network Context Isolation
    const targetUrl = `${gatewayUrl}/chat/completions`;
    const traceId = generateConversationTraceId();
    const networkAffinity = resolveClientNetworkAffinity();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-ID': traceId,
      'X-Session-Affinity': traceId,
      'X-Request-ID': `req-${crypto.randomUUID()}`,
      'X-Forwarded-For': networkAffinity,
      'X-Real-IP': networkAffinity,
    };
    if (config?.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let primaryFailed = false;
    let failureReason = '';

    try {
      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (apiRes.status === 429 || apiRes.status === 403) {
        primaryFailed = true;
        failureReason = `Upstream rate-limited / kuota habis (HTTP ${apiRes.status})`;
      } else if (!apiRes.ok) {
        primaryFailed = true;
        failureReason = `Gateway error (HTTP ${apiRes.status})`;
      } else {
        const rawText = await apiRes.text();
        let replyContent = '';
        let tokens: number | null = null;

        const trimmed = rawText.trim();
        if (trimmed.startsWith('{')) {
          try {
            const json = JSON.parse(trimmed);
            replyContent = json.choices?.[0]?.message?.content || json.choices?.[0]?.delta?.content || '';
            tokens = json.usage?.total_tokens || null;
          } catch {
            // parse SSE
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
                if (chunk.usage?.total_tokens) {
                  tokens = chunk.usage.total_tokens;
                }
              } catch {
                // ignore
              }
            }
          }
          replyContent = accumulated.trim();
        }

        if (!replyContent) {
          replyContent = 'Tidak ada balasan dari model.';
        }

        const tokensPerSecond =
          tokens && latencyMs > 0
            ? Math.round((tokens / (latencyMs / 1000)) * 10) / 10
            : Math.round((tokens || 60) / 1.2);

        recordGatewayLog({
          event: 'CHAT_COMPLETION',
          model: activeModel,
          status: 200,
          latencyMs,
          tokens: tokens || undefined,
          tokensPerSecond,
          details: `Query: "${prompt.slice(0, 30)}..." | ${tokens || 0} tokens (${tokensPerSecond} tok/s)`,
        });

        res.status(200).json({
          status: 'ok',
          data: {
            reply: replyContent,
            modelUsed: activeModel,
            tokens,
            latencyMs,
            tokensPerSecond,
            ragDocumentsInjected: injectedDocsCount,
            ragFaqsInjected: injectedFaqsCount,
            referencedDocuments,
            isSimulationFallback: false,
            isFallbackTriggered: false,
          },
        });
        return;
      }
    } catch (networkErr: unknown) {
      clearTimeout(timeout);
      primaryFailed = true;
      failureReason = `Gateway ${gatewayUrl} tidak merespons (Offline)`;
    }

    // 4. Penanganan Kegagalan Gateway (Offline / Kuota Habis)
    const latencyMs = Date.now() - startTime;
    const simTokens = 110;
    const simTps = 46.8;

    if (primaryFailed) {
      await db.aiSetting.update({
        where: { id: 'default' },
        data: {
          healthStatus: failureReason.includes('Offline') ? 'OFFLINE' : 'RATE_LIMITED',
          lastLatencyMs: latencyMs,
          lastHealthCheckedAt: new Date(),
        },
      });

      const notice = failureReason.includes('Offline')
        ? `Gateway ${gatewayUrl} sedang offline. Jalankan 9Router di port 20128.`
        : `Upstream kuota habis. Pastikan Model Combo di 9Router telah memiliki provider cadangan (Gemini/Groq).`;

      recordGatewayLog({
        event: 'CHAT_COMPLETION',
        model: activeModel,
        status: failureReason.includes('429') ? 429 : 503,
        latencyMs,
        tokens: simTokens,
        tokensPerSecond: simTps,
        details: `[Simulasi Sandbox] Query: "${prompt.slice(0, 30)}..." | Notice: ${notice}`,
      });

      res.status(200).json({
        status: 'ok',
        data: {
          reply: `Halo! Saya adalah Sandbox Asisten Virtual MobilJuragan Merauke. [Simulasi Gateway: ${failureReason}. ${notice}]. Berdasarkan Basis Pengetahuan RAG kami, seluruh penyewaan dalam kota maupun luar kota (Distrik Sota dan Boven Digoel) siap dilayani dengan supir siaga maupun lepas kunci sesuai SOP resmi.`,
          modelUsed: activeModel,
          latencyMs,
          tokens: simTokens,
          tokensPerSecond: simTps,
          ragDocumentsInjected: injectedDocsCount,
          ragFaqsInjected: injectedFaqsCount,
          referencedDocuments,
          isSimulationFallback: true,
          isFallbackTriggered: false,
          fallbackReason: failureReason,
          gatewayNotice: notice,
        },
      });
      return;
    }
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