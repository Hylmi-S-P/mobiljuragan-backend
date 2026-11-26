import { logger } from '../../logger.js';
import {
  generateConversationTraceId,
  recordGatewayLog,
} from './gatewayConfig.js';

export interface OpenAiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ChatCompletionMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface GatewayCompletionResult {
  ok: boolean;
  status: number;
  content: string;
  toolCalls: OpenAiToolCall[];
  finishReason: string | null;
  totalTokens?: number;
  latencyMs: number;
  rawError?: string;
}

type StreamChunkDeltaToolCall = {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type GatewayChunkPayload = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: StreamChunkDeltaToolCall[];
    };
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

/**
 * Membersihkan tag penalaran internal `<think>...</think>` agar tidak bocor ke jawaban pelanggan.
 */
export function stripReasoningTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Mengurai payload balasan 9Router/OpenAI baik berformat SSE (`data: ...`) maupun JSON utuh,
 * termasuk menggabungkan fragmen `delta.tool_calls` yang dikirim terpotong-potong.
 */
export function parseGatewayResponseBody(rawText: string, contentType: string): {
  content: string;
  toolCalls: OpenAiToolCall[];
  finishReason: string | null;
  totalTokens?: number;
} {
  const isSse = contentType.includes('text/event-stream') || rawText.trimStart().startsWith('data:');

  if (!isSse) {
    try {
      const parsed = JSON.parse(rawText) as GatewayChunkPayload;
      const choice = parsed.choices?.[0];
      const msgContent = choice?.message?.content ?? choice?.delta?.content ?? '';
      const rawCalls = choice?.message?.tool_calls ?? [];
      const toolCalls: OpenAiToolCall[] = rawCalls.map((tc, idx) => ({
        id: tc.id || `call_${idx + 1}`,
        type: 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '{}',
        },
      }));

      return {
        content: stripReasoningTags(msgContent || ''),
        toolCalls: toolCalls.filter((t) => Boolean(t.function.name)),
        finishReason: choice?.finish_reason ?? null,
        totalTokens: parsed.usage?.total_tokens,
      };
    } catch {
      return { content: '', toolCalls: [], finishReason: null };
    }
  }

  let content = '';
  let finishReason: string | null = null;
  let totalTokens: number | undefined;
  const toolAccumulator = new Map<number, OpenAiToolCall>();

  const lines = rawText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const jsonPart = line.slice(5).trim();
    if (!jsonPart || jsonPart === '[DONE]') continue;

    try {
      const chunk = JSON.parse(jsonPart) as GatewayChunkPayload;
      if (chunk.usage?.total_tokens) {
        totalTokens = chunk.usage.total_tokens;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      if (choice.delta?.content) {
        content += choice.delta.content;
      } else if (choice.message?.content) {
        content += choice.message.content;
      }

      const deltaToolCalls = choice.delta?.tool_calls;
      if (Array.isArray(deltaToolCalls)) {
        for (let i = 0; i < deltaToolCalls.length; i++) {
          const delta = deltaToolCalls[i];
          const index = typeof delta.index === 'number' ? delta.index : i;
          const existing = toolAccumulator.get(index) ?? {
            id: delta.id || `call_${index + 1}`,
            type: 'function' as const,
            function: { name: '', arguments: '' },
          };

          if (delta.id) existing.id = delta.id;
          if (delta.function?.name) existing.function.name += delta.function.name;
          if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
          toolAccumulator.set(index, existing);
        }
      }

      if (Array.isArray(choice.message?.tool_calls)) {
        choice.message.tool_calls.forEach((tc, idx) => {
          toolAccumulator.set(idx, {
            id: tc.id || `call_${idx + 1}`,
            type: 'function',
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '{}',
            },
          });
        });
      }
    } catch {
      // Abaikan chunk parsial atau komentar SSE
    }
  }

  const toolCalls = Array.from(toolAccumulator.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, tc]) => tc)
    .filter((tc) => Boolean(tc.function.name));

  return {
    content: stripReasoningTags(content),
    toolCalls,
    finishReason,
    totalTokens,
  };
}

/**
 * Mengirim satu putaran chat completion ke 9Router (OpenAI compatible).
 */
export async function callGatewayCompletion(input: {
  gatewayUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  maxTokens: number;
  tools?: OpenAiToolDefinition[];
  toolChoice?: 'auto' | 'none';
  timeoutMs?: number;
  traceId?: string;
  signal?: AbortSignal;
}): Promise<GatewayCompletionResult> {
  const t0 = Date.now();
  const controller = new AbortController();
  const handleParentAbort = () => controller.abort();
  if (input.signal) {
    if (input.signal.aborted) {
      controller.abort();
    } else {
      input.signal.addEventListener('abort', handleParentAbort, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 25000);
  const traceId = input.traceId ?? generateConversationTraceId();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Correlation-Id': traceId,
    };
    if (input.apiKey) {
      headers['Authorization'] = `Bearer ${input.apiKey}`;
    }

    const bodyPayload: Record<string, unknown> = {
      model: input.model,
      stream: false,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
    };
    if (input.tools && input.tools.length > 0) {
      bodyPayload.tools = input.tools;
      bodyPayload.tool_choice = input.toolChoice ?? 'auto';
    }

    const res = await fetch(`${input.gatewayUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - t0;
    const rawText = await res.text();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      recordGatewayLog({
        event: 'CHAT_COMPLETION',
        model: input.model,
        status: res.status,
        latencyMs,
        details: `Upstream rejected completion (${res.status}): ${rawText.slice(0, 120)}`,
      });
      return {
        ok: false,
        status: res.status,
        content: '',
        toolCalls: [],
        finishReason: null,
        latencyMs,
        rawError: rawText.slice(0, 300),
      };
    }

    const parsed = parseGatewayResponseBody(rawText, contentType);
    const estTokens = parsed.totalTokens ?? Math.max(10, Math.floor(parsed.content.length / 4));
    const tps = latencyMs > 0 ? Number(((estTokens / latencyMs) * 1000).toFixed(1)) : 0;

    recordGatewayLog({
      event: 'CHAT_COMPLETION',
      model: input.model,
      status: res.status,
      latencyMs,
      tokens: estTokens,
      tokensPerSecond: tps,
      details:
        parsed.toolCalls.length > 0
          ? `Requested ${parsed.toolCalls.length} tool(s): ${parsed.toolCalls.map((t) => t.function.name).join(', ')}`
          : `OK (${parsed.content.length} chars, finish=${parsed.finishReason ?? 'stop'})`,
    });

    return {
      ok: true,
      status: res.status,
      content: parsed.content,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      totalTokens: estTokens,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const msg = error instanceof Error ? error.message : 'Network error';
    logger.warn({ msg, model: input.model, latencyMs }, 'Gagal menghubungi AI Gateway 9Router');
    recordGatewayLog({
      event: 'CHAT_COMPLETION',
      model: input.model,
      status: 503,
      latencyMs,
      details: `Gateway network failure: ${msg}`,
    });

    return {
      ok: false,
      status: 503,
      content: '',
      toolCalls: [],
      finishReason: null,
      latencyMs,
      rawError: msg,
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', handleParentAbort);
  }
}
