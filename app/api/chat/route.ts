import Anthropic from '@anthropic-ai/sdk';
import { TOOL_SCHEMAS } from '@/lib/tools/schemas';
import { executeTool } from '@/lib/tools/dispatcher';
import { buildSystemPrompt } from '@/lib/system-prompt';
import type {
  LifterState,
  PhotoMediaType,
  PhysiquePhoto,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TURNS = 5;
const ALLOWED_MEDIA_TYPES: PhotoMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

interface InboundMessage {
  role: 'user' | 'assistant';
  content: string;
  photos?: PhysiquePhoto[];
}

interface ChatRequestBody {
  messages: InboundMessage[];
  lifterState: LifterState | null;
}

function toUserContent(
  message: InboundMessage,
): string | Anthropic.ContentBlockParam[] {
  const photos = message.photos ?? [];
  const validPhotos = photos.filter(
    (p) =>
      typeof p.base64 === 'string' &&
      p.base64.length > 0 &&
      ALLOWED_MEDIA_TYPES.includes(p.mediaType),
  );
  if (validPhotos.length === 0) return message.content;

  const blocks: Anthropic.ContentBlockParam[] = validPhotos.map((p) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: p.mediaType,
      data: p.base64,
    },
  }));
  const posesNote = validPhotos.map((p) => p.pose).join(', ');
  blocks.push({
    type: 'text',
    text: `[PHOTOS ATTACHED: ${posesNote}]\n\n${message.content}`,
  });
  return blocks;
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
          (m) =>
            m.role === 'user'
              ? { role: 'user', content: toUserContent(m) }
              : { role: 'assistant', content: m.content },
        );
        const latest = body.messages[body.messages.length - 1];
        const hasImagesInLatest =
          latest?.role === 'user' && (latest.photos?.length ?? 0) > 0;
        const systemPrompt = buildSystemPrompt(
          body.lifterState,
          hasImagesInLatest,
        );

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
