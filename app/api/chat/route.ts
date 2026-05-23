import Anthropic from '@anthropic-ai/sdk';
import { TOOL_SCHEMAS } from '@/lib/tools/schemas';
import { executeTool } from '@/lib/tools/dispatcher';
import { buildSystemPrompt } from '@/lib/system-prompt';
import type { LifterState } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TURNS = 5;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  lifterState: LifterState | null;
}

function toContentBlockParams(
  blocks: Anthropic.ContentBlock[],
): Anthropic.ContentBlockParam[] {
  return blocks
    .map((block): Anthropic.ContentBlockParam | null => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return null;
    })
    .filter((b): b is Anthropic.ContentBlockParam => b !== null);
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart `npm run dev`.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        const anthropicMessages: Anthropic.MessageParam[] = body.messages.map(
          (m) => ({ role: m.role, content: m.content }),
        );
        const systemPrompt = buildSystemPrompt(body.lifterState);

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          if (signal.aborted) break;

          const msgStream = client.messages.stream(
            {
              model: MODEL,
              max_tokens: 4096,
              system: systemPrompt,
              messages: anthropicMessages,
              tools: TOOL_SCHEMAS,
            },
            { signal },
          );

          for await (const event of msgStream) {
            if (signal.aborted) break;
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use') {
                send({
                  type: 'tool_call_start',
                  toolName: event.content_block.name,
                  toolUseId: event.content_block.id,
                });
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                send({ type: 'text_delta', text: event.delta.text });
              }
            }
          }

          if (signal.aborted) break;

          const finalMessage = await msgStream.finalMessage();

          anthropicMessages.push({
            role: 'assistant',
            content: toContentBlockParams(finalMessage.content),
          });

          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );

          if (
            finalMessage.stop_reason === 'tool_use' &&
            toolUseBlocks.length > 0
          ) {
            const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              const result = await executeTool(block.name, block.input);
              send({
                type: 'tool_call_end',
                toolUseId: block.id,
                success: !result.error,
              });
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(
                  result.error ? { error: result.error } : result.output,
                ),
                is_error: !!result.error,
              });
            }

            anthropicMessages.push({
              role: 'user',
              content: toolResultBlocks,
            });

            continue;
          }

          break;
        }
      } catch (err) {
        if (!signal.aborted) {
          const message =
            err instanceof Error ? err.message : 'Unknown server error.';
          send({ type: 'error', message });
        }
      } finally {
        send({ type: 'done' });
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
