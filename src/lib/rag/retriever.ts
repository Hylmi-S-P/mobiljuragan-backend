import { db } from '../../db.js';
import { KnowledgeSourceType } from '../../generated/prisma/client.js';
import { recordGatewayLog } from '../ai/gatewayConfig.js';
import {
  cosineSimilarity,
  embedQuery,
  isEmbeddingsDisabled,
  type EmbeddingRequestOptions,
} from './embeddings.js';
import { ensureIndexPopulated } from './indexer.js';

export type RagRetrievalMode = 'HYBRID_VECTOR' | 'LEXICAL_FALLBACK' | 'NONE';

export interface RetrievedChunk {
  id: string;
  sourceType: KnowledgeSourceType;
  documentId: string | null;
  faqId: string | null;
  chunkIndex: number;
  title: string;
  category: string;
  content: string;
  score: number;
  cosineScore: number;
  bm25Score: number;
}

export interface RagRetrievalResult {
  mode: RagRetrievalMode;
  chunks: RetrievedChunk[];
  formattedContext: string;
  latencyMs: number;
  queryEmbeddingUsed: boolean;
  totalActiveChunks: number;
  embeddingModel?: string;
}

const INDONESIAN_STOPWORDS = new Set([
  'yang',
  'dan',
  'di',
  'ke',
  'dari',
  'untuk',
  'dengan',
  'pada',
  'adalah',
  'ini',
  'itu',
  'atau',
  'juga',
  'ya',
  'nih',
  'sih',
  'kok',
  'dong',
  'kah',
  'nya',
  'saya',
  'aku',
  'kami',
  'kita',
  'kamu',
  'anda',
  'apa',
  'apakah',
  'bagaimana',
  'gimana',
  'mohon',
  'tolong',
  'halo',
  'hai',
  'kak',
  'min',
  'admin',
  'ada',
  'bisa',
  'boleh',
]);

const VECTOR_PARSE_CACHE_MAX = 2000;
const parsedVectorCache = new Map<string, number[]>();
const RAG_CORPUS_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedChunkRow {
  id: string;
  sourceType: KnowledgeSourceType;
  documentId: string | null;
  faqId: string | null;
  chunkIndex: number;
  title: string;
  category: string;
  content: string;
  contentHash: string;
  embeddingModel: string | null;
  embeddingDims: number;
  embeddingJson: string | null;
}

interface CachedRagCorpus {
  chunks: CachedChunkRow[];
  docsTokens: string[][];
  termFreqMaps: Array<Map<string, number>>;
  avgDocLength: number;
  includeEmbeddings: boolean;
  expiresAt: number;
}

let indexPopulatedOnce = false;
let ragCorpusCache: CachedRagCorpus | null = null;

/** Mengosongkan cache korpus RAG & token BM25 saat dokumen atau FAQ diperbarui. */
export function invalidateRagCorpusCache(): void {
  ragCorpusCache = null;
  indexPopulatedOnce = false;
}

function tokenize(text: string): string[] {
  const rawTokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && !INDONESIAN_STOPWORDS.has(token));
  return rawTokens;
}

function getParsedVector(cacheKey: string, jsonStr: string | null): number[] | null {
  if (!jsonStr) return null;
  const cached = parsedVectorCache.get(cacheKey);
  if (cached) return cached;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0] !== 'number') {
      return null;
    }
    if (parsedVectorCache.size >= VECTOR_PARSE_CACHE_MAX) {
      const oldest = parsedVectorCache.keys().next().value;
      if (oldest !== undefined) parsedVectorCache.delete(oldest);
    }
    parsedVectorCache.set(cacheKey, parsed as number[]);
    return parsed as number[];
  } catch {
    return null;
  }
}

function computeBm25Scores(
  queryTokens: string[],
  corpus: Pick<CachedRagCorpus, 'docsTokens' | 'termFreqMaps' | 'avgDocLength'>,
): number[] {
  const { docsTokens, termFreqMaps, avgDocLength } = corpus;
  const docCount = docsTokens.length;
  if (docCount === 0 || queryTokens.length === 0) {
    return new Array(docCount).fill(0);
  }

  const uniqueQueryTerms = Array.from(new Set(queryTokens));
  const k1 = 1.5;
  const b = 0.75;
  const scores = new Array(docCount).fill(0);

  for (const term of uniqueQueryTerms) {
    let df = 0;
    for (const freqMap of termFreqMaps) {
      if ((freqMap.get(term) ?? 0) > 0) df++;
    }
    if (df === 0) continue;

    const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
    for (let i = 0; i < docCount; i++) {
      const tf = termFreqMaps[i].get(term) ?? 0;
      if (tf === 0) continue;
      const docLen = Math.max(docsTokens[i].length, 1);
      const denom = tf + k1 * (1 - b + b * (docLen / Math.max(avgDocLength, 1)));
      scores[i] += idf * ((tf * (k1 + 1)) / denom);
    }
  }

  return scores;
}

async function loadRagCorpus(): Promise<CachedRagCorpus> {
  if (!indexPopulatedOnce) {
    await ensureIndexPopulated().catch(() => false);
    indexPopulatedOnce = true;
  }

  const includeEmbeddings = !isEmbeddingsDisabled();
  const sekarang = Date.now();
  if (
    ragCorpusCache &&
    sekarang < ragCorpusCache.expiresAt &&
    ragCorpusCache.includeEmbeddings === includeEmbeddings
  ) {
    return ragCorpusCache;
  }

  const rawChunks = await db.knowledgeChunk.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sourceType: true,
      documentId: true,
      faqId: true,
      chunkIndex: true,
      title: true,
      category: true,
      content: true,
      contentHash: true,
      embeddingModel: true,
      embeddingDims: true,
      embeddingJson: includeEmbeddings,
    },
  });

  const chunks: CachedChunkRow[] = rawChunks.map((row) => ({
    ...row,
    embeddingJson: 'embeddingJson' in row ? (row.embeddingJson ?? null) : null,
  }));

  const docsTokens = chunks.map((chunk) => tokenize(chunk.content));
  const termFreqMaps = docsTokens.map((tokens) => {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    return freq;
  });
  const avgDocLength =
    docsTokens.reduce((acc, tokens) => acc + tokens.length, 0) / Math.max(chunks.length, 1);

  ragCorpusCache = {
    chunks,
    docsTokens,
    termFreqMaps,
    avgDocLength,
    includeEmbeddings,
    expiresAt: Date.now() + RAG_CORPUS_CACHE_TTL_MS,
  };
  return ragCorpusCache;
}

/**
 * Mengambil potongan Knowledge Base + FAQ paling relevan menggunakan Hybrid RAG (Cosine + BM25).
 * Secara otomatis jatuh ke `LEXICAL_FALLBACK` (BM25) jika embedding gateway mati atau belum tersedia.
 */
export async function retrieveRelevantKnowledge(
  query: string,
  options?: EmbeddingRequestOptions & {
    topK?: number;
    minScore?: number;
    maxContextChars?: number;
  },
): Promise<RagRetrievalResult> {
  const t0 = Date.now();
  const corpus = await loadRagCorpus();
  const activeChunks = corpus.chunks;

  if (activeChunks.length === 0) {
    return {
      mode: 'NONE',
      chunks: [],
      formattedContext: '',
      latencyMs: Date.now() - t0,
      queryEmbeddingUsed: false,
      totalActiveChunks: 0,
    };
  }

  const topK = options?.topK ?? 5;
  const maxContextChars = options?.maxContextChars ?? 4500;
  const queryTokens = tokenize(query);
  const rawBm25Scores = computeBm25Scores(queryTokens, corpus);
  const maxBm25 = rawBm25Scores.reduce((max, s) => (s > max ? s : max), 0);

  const queryVecResult = await embedQuery(query, {
    gatewayUrl: options?.gatewayUrl,
    apiKey: options?.apiKey,
    model: options?.model,
    timeoutMs: options?.timeoutMs ?? 5000,
  });

  const cosineScores = new Array(activeChunks.length).fill(0);
  let vectorHitCount = 0;

  if (queryVecResult && queryVecResult.vector.length > 0) {
    for (let i = 0; i < activeChunks.length; i++) {
      const chunk = activeChunks[i];
      if (!chunk.embeddingJson || chunk.embeddingDims !== queryVecResult.vector.length) continue;
      const cacheKey = `${chunk.id}:${chunk.contentHash}:${chunk.embeddingModel ?? ''}`;
      const chunkVec = getParsedVector(cacheKey, chunk.embeddingJson);
      if (!chunkVec || chunkVec.length !== queryVecResult.vector.length) continue;
      const sim = cosineSimilarity(queryVecResult.vector, chunkVec);
      cosineScores[i] = Math.max(0, Math.min(1, sim));
      vectorHitCount++;
    }
  }

  const useHybridVector = Boolean(queryVecResult && vectorHitCount > 0);
  const mode: RagRetrievalMode = useHybridVector ? 'HYBRID_VECTOR' : 'LEXICAL_FALLBACK';
  const minScore = options?.minScore ?? (useHybridVector ? 0.25 : 0.15);

  const ranked: RetrievedChunk[] = [];
  for (let i = 0; i < activeChunks.length; i++) {
    const bm25Norm = maxBm25 > 0 ? rawBm25Scores[i] / maxBm25 : 0;
    const cosine = cosineScores[i];
    const score = useHybridVector ? 0.65 * cosine + 0.35 * bm25Norm : bm25Norm;

    if (!useHybridVector && rawBm25Scores[i] <= 0) continue;
    if (score < minScore) continue;

    const c = activeChunks[i];
    ranked.push({
      id: c.id,
      sourceType: c.sourceType,
      documentId: c.documentId,
      faqId: c.faqId,
      chunkIndex: c.chunkIndex,
      title: c.title,
      category: c.category,
      content: c.content,
      score,
      cosineScore: cosine,
      bm25Score: bm25Norm,
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  const selected: RetrievedChunk[] = [];
  let charBudget = 0;
  for (const candidate of ranked) {
    if (selected.length >= topK) break;
    const blockOverhead = 90;
    if (
      selected.length > 0 &&
      charBudget + candidate.content.length + blockOverhead > maxContextChars
    ) {
      continue;
    }
    selected.push(candidate);
    charBudget += candidate.content.length + blockOverhead;
  }

  const formattedContext = selected
    .map((chunk, idx) => {
      const pct = Math.round(chunk.score * 100);
      return `[Sumber #${idx + 1} | ${chunk.sourceType} | ${chunk.title} | relevansi ${pct}%]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  const latencyMs = Date.now() - t0;
  recordGatewayLog({
    event: 'RAG_RETRIEVAL',
    model: queryVecResult?.model ?? 'bm25-lexical',
    status: 200,
    latencyMs,
    details: `RAG ${mode}: ${selected.length}/${activeChunks.length} chunk dipilih (vektor=${vectorHitCount}, queryCached=${Boolean(queryVecResult?.cached)})`,
  });

  return {
    mode,
    chunks: selected,
    formattedContext,
    latencyMs,
    queryEmbeddingUsed: useHybridVector,
    totalActiveChunks: activeChunks.length,
    embeddingModel: queryVecResult?.model,
  };
}
