import { db } from '../../db.js';
import { logger } from '../../logger.js';
import { recordGatewayLog, resolve9RouterConfig } from '../ai/gatewayConfig.js';

export interface EmbeddingRequestOptions {
  gatewayUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface QueryEmbeddingResult {
  vector: number[];
  model: string;
  cached: boolean;
}

const EMBEDDING_BATCH_SIZE = 16;
const DEFAULT_EMBEDDING_TIMEOUT_MS = 8000;
const QUERY_CACHE_MAX_SIZE = 100;
const QUERY_CACHE_TTL_MS = 15 * 60 * 1000;

type QueryCacheEntry = {
  vector: number[];
  model: string;
  createdAt: number;
};

const queryEmbeddingCache = new Map<string, QueryCacheEntry>();

export function isEmbeddingsDisabled(): boolean {
  return process.env.RAG_EMBEDDINGS_DISABLED?.trim().toLowerCase() === 'true';
}

export function clearQueryEmbeddingCache(): void {
  queryEmbeddingCache.clear();
}

export async function resolveEffectiveEmbeddingTarget(options?: EmbeddingRequestOptions): Promise<{
  gatewayUrl: string;
  apiKey: string;
  model: string;
}> {
  let dbConfig: { gatewayUrl: string; apiKey: string | null; activeModel: string } | null = null;
  if (!options?.gatewayUrl || !options?.apiKey) {
    dbConfig = await db.aiSetting
      .findUnique({
        where: { id: 'default' },
        select: { gatewayUrl: true, apiKey: true, activeModel: true },
      })
      .catch(() => null);
  }

  const resolved = resolve9RouterConfig(dbConfig);
  return {
    gatewayUrl: (options?.gatewayUrl || resolved.gatewayUrl).replace(/\/+$/, ''),
    apiKey: options?.apiKey ?? resolved.apiKey,
    model: options?.model?.trim() || resolved.embeddingModel,
  };
}

/**
 * Menghasilkan vektor embedding untuk sekumpulan teks melalui 9Router `/v1/embeddings`.
 * Bersifat fail-soft: jika gateway mati atau `RAG_EMBEDDINGS_DISABLED=true`, mengembalikan `null`
 * pada slot terkait tanpa melempar error agar jalur BM25 lexical fallback tetap berjalan.
 */
export async function embedTexts(
  texts: string[],
  options?: EmbeddingRequestOptions,
): Promise<Array<number[] | null>> {
  if (texts.length === 0) return [];
  if (isEmbeddingsDisabled()) {
    return texts.map(() => null);
  }

  const target = await resolveEffectiveEmbeddingTarget(options);
  const results: Array<number[] | null> = new Array(texts.length).fill(null);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS;

  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (target.apiKey) {
        headers['Authorization'] = `Bearer ${target.apiKey}`;
      }

      const res = await fetch(`${target.gatewayUrl}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: target.model,
          input: batch.length === 1 ? batch[0] : batch,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn(
          { status: res.status, model: target.model, latencyMs, errText: errText.slice(0, 200) },
          'Embedding gateway gagal merespons; beralih ke fallback lexical',
        );
        recordGatewayLog({
          event: 'RAG_RETRIEVAL',
          model: target.model,
          status: res.status,
          latencyMs,
          details: `Embedding failed (${res.status}) for ${batch.length} text(s), using BM25 fallback`,
        });
        continue;
      }

      const payload = (await res.json()) as {
        data?: Array<{ index?: number; embedding?: unknown }>;
        usage?: { total_tokens?: number };
      };

      const rows = Array.isArray(payload.data) ? payload.data : [];
      for (let idx = 0; idx < rows.length; idx++) {
        const item = rows[idx];
        const targetIndex = typeof item?.index === 'number' ? item.index : idx;
        const vec = item?.embedding;
        if (
          targetIndex >= 0 &&
          targetIndex < batch.length &&
          Array.isArray(vec) &&
          vec.length > 0 &&
          typeof vec[0] === 'number'
        ) {
          results[start + targetIndex] = vec as number[];
        }
      }

      recordGatewayLog({
        event: 'RAG_RETRIEVAL',
        model: target.model,
        status: 200,
        latencyMs,
        tokens: payload.usage?.total_tokens,
        details: `Embedded ${batch.length} chunk(s) (${results[start]?.length ?? 0} dims)`,
      });
    } catch (error) {
      const latencyMs = Date.now() - t0;
      const reason = error instanceof Error ? error.message : 'Unknown error';
      logger.warn({ reason, model: target.model, latencyMs }, 'Gagal menghubungi endpoint embedding');
      recordGatewayLog({
        event: 'RAG_RETRIEVAL',
        model: target.model,
        status: 503,
        latencyMs,
        details: `Embedding network error (${reason}), using BM25 fallback`,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}

/**
 * Mengambil vektor embedding untuk kueri pengguna dengan cache LRU/FIFO terbatas.
 */
export async function embedQuery(
  query: string,
  options?: EmbeddingRequestOptions,
): Promise<QueryEmbeddingResult | null> {
  const normalized = query.trim();
  if (!normalized || isEmbeddingsDisabled()) return null;

  const target = await resolveEffectiveEmbeddingTarget(options);
  const cacheKey = `${target.model}::${normalized.toLowerCase()}`;
  const cached = queryEmbeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < QUERY_CACHE_TTL_MS) {
    return {
      vector: cached.vector,
      model: cached.model,
      cached: true,
    };
  }

  const [vector] = await embedTexts([normalized], {
    ...options,
    gatewayUrl: target.gatewayUrl,
    apiKey: target.apiKey,
    model: target.model,
  });

  if (!vector) return null;

  if (queryEmbeddingCache.size >= QUERY_CACHE_MAX_SIZE) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (oldestKey !== undefined) {
      queryEmbeddingCache.delete(oldestKey);
    }
  }

  queryEmbeddingCache.set(cacheKey, {
    vector,
    model: target.model,
    createdAt: Date.now(),
  });

  return {
    vector,
    model: target.model,
    cached: false,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return dot / denom;
}
