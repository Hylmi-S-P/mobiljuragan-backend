import { db } from '../../db.js';
import { logger } from '../../logger.js';
import { KnowledgeSourceType } from '../../generated/prisma/client.js';
import { recordGatewayLog } from '../ai/gatewayConfig.js';
import { chunkDocument, chunkFaq, type KnowledgeChunkDraft } from './chunker.js';
import { embedTexts, isEmbeddingsDisabled, resolveEffectiveEmbeddingTarget } from './embeddings.js';
import { invalidateRagCorpusCache } from './retriever.js';

export interface IndexSourceResult {
  chunksWritten: number;
  embeddedCount: number;
  reusedCount: number;
}

export interface FullReindexResult {
  documentsProcessed: number;
  faqsProcessed: number;
  chunksTotal: number;
  embeddedNow: number;
  reused: number;
  failedEmbeddings: number;
  embeddingModel: string;
}

let activeSyncPromise: Promise<FullReindexResult> | null = null;

async function syncSourceChunks(input: {
  sourceType: KnowledgeSourceType;
  documentId?: string;
  faqId?: string;
  isActive: boolean;
  drafts: KnowledgeChunkDraft[];
  forceReembed?: boolean;
}): Promise<IndexSourceResult> {
  const { sourceType, documentId, faqId, isActive, drafts, forceReembed = false } = input;
  const whereOwner = sourceType === 'DOCUMENT' ? { documentId } : { faqId };

  if (drafts.length === 0) {
    await db.knowledgeChunk.deleteMany({ where: whereOwner });
    invalidateRagCorpusCache();
    return { chunksWritten: 0, embeddedCount: 0, reusedCount: 0 };
  }

  const existing = await db.knowledgeChunk.findMany({
    where: whereOwner,
    select: {
      chunkIndex: true,
      contentHash: true,
      embeddingModel: true,
      embeddingDims: true,
      embeddingJson: true,
    },
  });

  const existingByHash = new Map<
    string,
    { embeddingModel: string | null; embeddingDims: number; embeddingJson: string }
  >();
  for (const row of existing) {
    if (row.embeddingJson && row.embeddingDims > 0) {
      existingByHash.set(row.contentHash, {
        embeddingModel: row.embeddingModel,
        embeddingDims: row.embeddingDims,
        embeddingJson: row.embeddingJson,
      });
    }
  }

  const target = await resolveEffectiveEmbeddingTarget();
  const vectors: Array<{ model: string | null; dims: number; json: string | null }> = new Array(
    drafts.length,
  );
  const toEmbedIndices: number[] = [];
  let reusedCount = 0;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const cached = !forceReembed ? existingByHash.get(draft.contentHash) : undefined;
    const modelMatches = cached && cached.embeddingModel === target.model;

    if (cached && modelMatches) {
      vectors[i] = {
        model: cached.embeddingModel,
        dims: cached.embeddingDims,
        json: cached.embeddingJson,
      };
      reusedCount++;
    } else if (!isActive || isEmbeddingsDisabled()) {
      // Tetap pertahankan vektor lama bila nonaktif/disabled agar tidak hilang sia-sia
      if (cached && !forceReembed) {
        vectors[i] = {
          model: cached.embeddingModel,
          dims: cached.embeddingDims,
          json: cached.embeddingJson,
        };
      } else {
        vectors[i] = { model: null, dims: 0, json: null };
      }
    } else {
      vectors[i] = { model: null, dims: 0, json: null };
      toEmbedIndices.push(i);
    }
  }

  let embeddedCount = 0;
  if (toEmbedIndices.length > 0) {
    const batchTexts = toEmbedIndices.map((idx) => drafts[idx].content);
    const batchVectors = await embedTexts(batchTexts, {
      gatewayUrl: target.gatewayUrl,
      apiKey: target.apiKey,
      model: target.model,
    });

    for (let j = 0; j < toEmbedIndices.length; j++) {
      const targetIdx = toEmbedIndices[j];
      const vec = batchVectors[j];
      if (vec && vec.length > 0) {
        vectors[targetIdx] = {
          model: target.model,
          dims: vec.length,
          json: JSON.stringify(vec),
        };
        embeddedCount++;
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: whereOwner });
    await tx.knowledgeChunk.createMany({
      data: drafts.map((draft, idx) => ({
        sourceType,
        documentId: sourceType === 'DOCUMENT' ? documentId : null,
        faqId: sourceType === 'FAQ' ? faqId : null,
        chunkIndex: draft.chunkIndex,
        title: draft.title,
        category: draft.category,
        content: draft.content,
        contentHash: draft.contentHash,
        tokenCount: draft.tokenCount,
        embeddingModel: vectors[idx].model,
        embeddingDims: vectors[idx].dims,
        embeddingJson: vectors[idx].json,
        isActive,
      })),
    });
  });

  invalidateRagCorpusCache();

  return {
    chunksWritten: drafts.length,
    embeddedCount,
    reusedCount,
  };
}

/**
 * Memecah & mengindeks ulang satu KnowledgeDocument ke tabel `knowledge_chunks`.
 */
export async function indexKnowledgeDocument(
  documentId: string,
  options?: { forceReembed?: boolean },
): Promise<IndexSourceResult> {
  const doc = await db.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    await db.knowledgeChunk.deleteMany({ where: { documentId } });
    invalidateRagCorpusCache();
    return { chunksWritten: 0, embeddedCount: 0, reusedCount: 0 };
  }

  const drafts = chunkDocument({
    title: doc.title,
    category: doc.category,
    content: doc.content,
  });

  return syncSourceChunks({
    sourceType: 'DOCUMENT',
    documentId: doc.id,
    isActive: doc.isActive,
    drafts,
    forceReembed: options?.forceReembed,
  });
}

/**
 * Mengindeks satu entri FAQ resmi ke tabel `knowledge_chunks`.
 */
export async function indexFaq(
  faqId: string,
  options?: { forceReembed?: boolean },
): Promise<IndexSourceResult> {
  const faq = await db.faq.findUnique({
    where: { id: faqId },
  });

  if (!faq) {
    await db.knowledgeChunk.deleteMany({ where: { faqId } });
    invalidateRagCorpusCache();
    return { chunksWritten: 0, embeddedCount: 0, reusedCount: 0 };
  }

  const drafts = chunkFaq({
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
  });

  return syncSourceChunks({
    sourceType: 'FAQ',
    faqId: faq.id,
    isActive: faq.isActive,
    drafts,
    forceReembed: options?.forceReembed,
  });
}

/**
 * Menyinkronkan seluruh KnowledgeDocument dan FAQ ke `knowledge_chunks`.
 */
export async function syncAllKnowledgeChunks(options?: {
  forceReembed?: boolean;
}): Promise<FullReindexResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  const run = async (): Promise<FullReindexResult> => {
    const t0 = Date.now();
    const forceReembed = Boolean(options?.forceReembed);
    const target = await resolveEffectiveEmbeddingTarget();

    const [docs, faqs] = await Promise.all([
      db.knowledgeDocument.findMany({ orderBy: { createdAt: 'asc' } }),
      db.faq.findMany({ orderBy: { orderIndex: 'asc' } }),
    ]);

    let chunksTotal = 0;
    let embeddedNow = 0;
    let reused = 0;

    for (const doc of docs) {
      const res = await indexKnowledgeDocument(doc.id, { forceReembed });
      chunksTotal += res.chunksWritten;
      embeddedNow += res.embeddedCount;
      reused += res.reusedCount;
    }

    for (const faq of faqs) {
      const res = await indexFaq(faq.id, { forceReembed });
      chunksTotal += res.chunksWritten;
      embeddedNow += res.embeddedCount;
      reused += res.reusedCount;
    }

    const activeMissingEmbeddings = await db.knowledgeChunk.count({
      where: {
        isActive: true,
        OR: [{ embeddingJson: null }, { embeddingDims: 0 }],
      },
    });

    const latencyMs = Date.now() - t0;
    recordGatewayLog({
      event: 'RAG_RETRIEVAL',
      model: target.model,
      status: 200,
      latencyMs,
      details: `RAG reindex complete: ${docs.length} doc, ${faqs.length} FAQ -> ${chunksTotal} chunk (${embeddedNow} embedded, ${reused} reused, ${activeMissingEmbeddings} lexical-only)`,
    });

    logger.info(
      {
        documentsProcessed: docs.length,
        faqsProcessed: faqs.length,
        chunksTotal,
        embeddedNow,
        reused,
        failedEmbeddings: activeMissingEmbeddings,
      },
      'Sinkronisasi indeks RAG selesai',
    );

    invalidateRagCorpusCache();

    return {
      documentsProcessed: docs.length,
      faqsProcessed: faqs.length,
      chunksTotal,
      embeddedNow,
      reused,
      failedEmbeddings: activeMissingEmbeddings,
      embeddingModel: target.model,
    };
  };

  activeSyncPromise = run().finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

/**
 * Memastikan tabel `knowledge_chunks` terisi bila KnowledgeDocument/FAQ sudah ada tetapi belum terindeks.
 */
export async function ensureIndexPopulated(): Promise<boolean> {
  const existingChunks = await db.knowledgeChunk.count();
  if (existingChunks > 0) return false;

  const [docCount, faqCount] = await Promise.all([
    db.knowledgeDocument.count(),
    db.faq.count(),
  ]);

  if (docCount === 0 && faqCount === 0) {
    return false;
  }

  await syncAllKnowledgeChunks({ forceReembed: false });
  return true;
}
