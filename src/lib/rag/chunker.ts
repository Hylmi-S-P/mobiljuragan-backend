import * as crypto from 'node:crypto';

export interface KnowledgeChunkDraft {
  chunkIndex: number;
  title: string;
  category: string;
  content: string;
  contentHash: string;
  tokenCount: number;
}

const DEFAULT_MAX_CHARS = 1100;
const DEFAULT_OVERLAP_CHARS = 180;

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function takeTailOverlap(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return '';
  const slice = text.slice(-overlapChars);
  const firstSpace = slice.search(/\s+/);
  if (firstSpace > 0 && firstSpace < slice.length - 12) {
    return slice.slice(firstSpace).trim();
  }
  return slice.trim();
}

function splitLongBlock(block: string, maxBodyChars: number, overlapChars: number): string[] {
  if (block.length <= maxBodyChars) return [block];

  const sentences = block.split(/(?<=[.!?])\s+/).filter(Boolean);
  const results: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) {
      results.push(current.trim());
    }
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > maxBodyChars) {
      flush();
      let cursor = 0;
      while (cursor < sentence.length) {
        const end = Math.min(sentence.length, cursor + maxBodyChars);
        let cut = end;
        if (end < sentence.length) {
          const lastSpace = sentence.lastIndexOf(' ', end);
          if (lastSpace > cursor + Math.floor(maxBodyChars * 0.5)) {
            cut = lastSpace;
          }
        }
        const piece = sentence.slice(cursor, cut).trim();
        if (piece) results.push(piece);
        if (cut >= sentence.length) break;
        const stepBack = Math.min(overlapChars, Math.floor(maxBodyChars * 0.3));
        cursor = Math.max(cursor + 1, cut - stepBack);
      }
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxBodyChars) {
      current = candidate;
    } else {
      const prev = current;
      flush();
      const overlap = takeTailOverlap(prev, overlapChars);
      current = overlap && overlap.length + 1 + sentence.length <= maxBodyChars
        ? `${overlap} ${sentence}`
        : sentence;
    }
  }

  flush();
  return results;
}

function splitIntoSemanticBlocks(normalized: string): string[] {
  // Pisahkan antar heading Markdown/section maupun paragraf kosong tanpa memecah header dari paragraf pertamanya bila pendek
  const rawSections = normalized.split(/\n(?=#{1,3}\s)/);
  const blocks: string[] = [];

  for (const section of rawSections) {
    const paragraphs = section
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    blocks.push(...paragraphs);
  }

  return blocks;
}

function buildChunksFromBody(input: {
  prefixHeader: string;
  title: string;
  category: string;
  body: string;
  maxChars?: number;
  overlapChars?: number;
}): KnowledgeChunkDraft[] {
  const normalized = normalizeText(input.body);
  if (!normalized) return [];

  const maxChars = Math.max(300, input.maxChars ?? DEFAULT_MAX_CHARS);
  const overlapChars = Math.max(0, Math.min(input.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(maxChars * 0.35)));
  const maxBodyChars = Math.max(200, maxChars - input.prefixHeader.length - 2);

  const rawBlocks = splitIntoSemanticBlocks(normalized);
  const expandedBlocks = rawBlocks.flatMap((block) =>
    splitLongBlock(block, maxBodyChars, overlapChars),
  );

  const bodyChunks: string[] = [];
  let buffer = '';

  for (const block of expandedBlocks) {
    const joined = buffer ? `${buffer}\n\n${block}` : block;
    if (joined.length <= maxBodyChars) {
      buffer = joined;
      continue;
    }

    if (buffer) {
      bodyChunks.push(buffer);
      const overlap = takeTailOverlap(buffer, overlapChars);
      buffer = overlap && overlap.length + 2 + block.length <= maxBodyChars
        ? `${overlap}\n\n${block}`
        : block;
    } else {
      bodyChunks.push(block);
      buffer = '';
    }
  }

  if (buffer.trim()) {
    bodyChunks.push(buffer.trim());
  }

  return bodyChunks.map((bodyText, chunkIndex) => {
    const fullContent = `${input.prefixHeader}\n${bodyText}`;
    return {
      chunkIndex,
      title: input.title.slice(0, 255),
      category: input.category.slice(0, 100),
      content: fullContent,
      contentHash: sha256(fullContent),
      tokenCount: estimateTokenCount(fullContent),
    };
  });
}

/**
 * Memecah dokumen Knowledge Base menjadi chunk semantik ber-overlap.
 */
export function chunkDocument(input: {
  title: string;
  category: string;
  content: string;
  maxChars?: number;
  overlapChars?: number;
}): KnowledgeChunkDraft[] {
  const title = input.title.trim() || 'Dokumen MobilJuragan';
  const category = input.category.trim() || 'umum';
  const prefixHeader = `[Judul: ${title} | Kategori: ${category}]`;

  return buildChunksFromBody({
    prefixHeader,
    title,
    category,
    body: input.content,
    maxChars: input.maxChars,
    overlapChars: input.overlapChars,
  });
}

/**
 * Mengubah entri FAQ menjadi satu atau beberapa chunk siap indeks.
 */
export function chunkFaq(input: {
  question: string;
  answer: string;
  category: string;
  maxChars?: number;
}): KnowledgeChunkDraft[] {
  const question = normalizeText(input.question);
  const answer = normalizeText(input.answer);
  const category = input.category.trim() || 'umum';
  if (!question && !answer) return [];

  const title = (question || 'FAQ MobilJuragan').slice(0, 255);
  const prefixHeader = `[FAQ: ${category}] Pertanyaan: ${question}`;

  return buildChunksFromBody({
    prefixHeader,
    title,
    category,
    body: `Jawaban: ${answer}`,
    maxChars: input.maxChars,
    overlapChars: 120,
  });
}
