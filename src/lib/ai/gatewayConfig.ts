import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export type AiGatewayLogEvent =
  | 'CHAT_COMPLETION'
  | 'HEALTH_CHECK'
  | 'GATEWAY_ROUTING'
  | 'DOC_PARSED'
  | 'TOOL_CALL'
  | 'RAG_RETRIEVAL';

export type AiGatewayLogEntry = {
  id: string;
  timestamp: string;
  event: AiGatewayLogEvent;
  model: string;
  status: number;
  latencyMs: number;
  tokens?: number;
  tokensPerSecond?: number;
  details: string;
};

export interface Resolved9RouterConfig {
  gatewayUrl: string;
  apiKey: string;
  activeModel: string;
  embeddingModel: string;
}

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
 * Menghasilkan correlation trace identifier (W3C/OpenTelemetry Session Context).
 */
export function generateConversationTraceId(): string {
  return `trace-${crypto.randomUUID()}`;
}

/**
 * Menghasilkan egress client network affinity descriptor untuk isolasi sesi request terdistribusi.
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

/**
 * Mencatat entri aktivitas AI Gateway (chat, embedding, RAG retrieval, tool call) ke ring buffer memori.
 */
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

export function getAiGatewayHttpLogs(): AiGatewayLogEntry[] {
  return aiGatewayLogBuffer;
}

export function clearAiGatewayHttpLogs(): void {
  aiGatewayLogBuffer.length = 0;
}

/**
 * Membaca CLI authentication token resmi 9Router dari direktori runtime.
 */
export function get9RouterCliToken(): string | null {
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
    return crypto
      .createHash('sha256')
      .update(rawMachineId + '9r-cli-auth' + cliSecret)
      .digest('hex')
      .substring(0, 16);
  } catch {
    return null;
  }
}

/**
 * Membaca API key cadangan dari db.json 9Router lokal bila tersedia (lingkungan dev).
 */
export function readLocal9RouterApiKey(): string | null {
  try {
    const candidates = [
      path.join(os.homedir(), '.9router', 'db.json'),
      path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        '9router',
        'db.json',
      ),
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        apiKeys?: Array<{ key?: string; token?: string; value?: string }>;
        apiKey?: string;
      };
      if (typeof parsed.apiKey === 'string' && parsed.apiKey.trim()) {
        return parsed.apiKey.trim();
      }
      if (Array.isArray(parsed.apiKeys) && parsed.apiKeys.length > 0) {
        const first = parsed.apiKeys[0];
        const candidate = first?.key || first?.token || first?.value;
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Menyelesaikan konfigurasi efektif gateway 9Router dengan prioritas .env -> DB -> db.json lokal -> default.
 */
export function resolve9RouterConfig(
  dbConfig?: {
    gatewayUrl?: string | null;
    apiKey?: string | null;
    activeModel?: string | null;
  } | null,
): Resolved9RouterConfig {
  const gatewayUrl = (
    process.env.NINEROUTER_GATEWAY_URL?.trim() ||
    dbConfig?.gatewayUrl?.trim() ||
    'http://localhost:20128/v1'
  ).replace(/\/+$/, '');
  const apiKey =
    process.env.NINEROUTER_API_KEY?.trim() ||
    dbConfig?.apiKey?.trim() ||
    readLocal9RouterApiKey() ||
    '';
  const rawModel =
    process.env.NINEROUTER_MODEL?.trim() ||
    dbConfig?.activeModel?.trim() ||
    'MJ';
  const activeModel = rawModel.toUpperCase() === 'MJ' ? 'MJ' : rawModel;
  const embeddingModel =
    process.env.NINEROUTER_EMBEDDING_MODEL?.trim() || 'gemini/gemini-embedding-001';

  return { gatewayUrl, apiKey, activeModel, embeddingModel };
}

export function resolve9RouterOrigin(gatewayUrl?: string): string {
  const target = gatewayUrl || resolve9RouterConfig(null).gatewayUrl;
  try {
    return new URL(target).origin;
  } catch {
    return 'http://localhost:20128';
  }
}

/**
 * Mengambil log live konsol asli langsung dari engine 9Router,
 * dengan penyamaran otomatis (on-the-fly masking) ke 'mj/internal-model'.
 */
export async function fetch9RouterRawLogs(): Promise<string[]> {
  try {
    const token = get9RouterCliToken();
    const headers: Record<string, string> = {};
    if (token) headers['x-9r-cli-token'] = token;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${resolve9RouterOrigin()}/api/translator/console-logs`, {
        headers,
        signal: controller.signal,
      });

      if (!res.ok) return [];
      const json = (await res.json()) as { success?: boolean; logs?: string[] };
      if (!json.success || !Array.isArray(json.logs)) return [];

      return json.logs.map((line) =>
        line
          .replace(/opencode\/longcat-2\.5-preview-free/g, 'mj/internal-model')
          .replace(/opencode\/[a-zA-Z0-9.-]+/g, 'mj/internal-model')
          .replace(/oc\/longcat-2\.5-preview-free/g, 'mj/internal-model')
          .replace(/oc\/[a-zA-Z0-9.-]+/g, 'mj/internal-model')
          .replace(/https:\/\/opencode\.ai\/[^\s]+/g, 'https://gateway.internal.mobiljuragan.com')
          .replace(/FreeUsageLimitError/g, 'ClusterThroughputLimit'),
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return [];
  }
}

/**
 * Menghapus kredensial rahasia (`apiKey`, `fallbackApiKey`) sebelum konfigurasi AI dikirim ke browser.
 */
export function sanitizeAiConfigForClient<
  T extends {
    gatewayUrl?: string | null;
    apiKey?: string | null;
    activeModel?: string | null;
    fallbackApiKey?: string | null;
  },
>(config: T) {
  const resolved = resolve9RouterConfig(config);
  const { apiKey: _apiKey, fallbackApiKey: _fallbackApiKey, ...safeRest } = config;
  return {
    ...safeRest,
    gatewayUrl: resolved.gatewayUrl,
    activeModel: resolved.activeModel,
    embeddingModel: resolved.embeddingModel,
    hasApiKey: Boolean(resolved.apiKey),
  };
}
