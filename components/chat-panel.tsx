'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '@/lib/chat-client';
import type { LifterState, PhysiquePhoto } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PhotoUploadPanel } from '@/components/photo-upload-panel';

type ToolStatus = 'running' | 'done' | 'error';

interface ToolCall {
  id: string;
  name: string;
  status: ToolStatus;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  pendingBuffer?: string;       // assistant only: chars waiting to be drained
  isApiStreaming?: boolean;     // assistant only: true while API is still streaming
  toolCalls?: ToolCall[];
  photos?: PhysiquePhoto[];     // user only: attached images for vision turn
  createdAt: number;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} UTC`;
}

const STATUS_LABEL: Record<ToolStatus, string> = {
  running: 'RUNNING',
  done: 'DONE',
  error: 'ERROR',
};

function ToolStatusRow({ call }: { call: ToolCall }) {
  const colorCls =
    call.status === 'running'
      ? 'text-terminal-amber'
      : call.status === 'done'
        ? 'text-terminal-green'
        : 'text-terminal-red';
  return (
    <div className="flex items-baseline gap-2 py-0.5 text-[11px]">
      <span className="text-terminal-text-dim">
        [TOOL]{' '}
        <span className="text-terminal-text">{call.name}</span>
      </span>
      <span
        className="flex-1 self-center border-b border-dotted border-terminal-text-faint"
        aria-hidden="true"
      />
      <span className={cn('inline-flex items-center gap-1', colorCls)}>
        {call.status === 'running' && (
          <span className="terminal-blink">▮</span>
        )}
        {STATUS_LABEL[call.status]}
      </span>
    </div>
  );
}

function MessageBlock({
  message,
  showStreamingCursor,
}: {
  message: ChatMessage;
  showStreamingCursor: boolean;
}) {
  if (message.role === 'error') {
    return (
      <div className="border-t border-terminal-border pt-3">
        <div
          className="mb-1 text-[10px] font-bold text-terminal-red"
          style={{ letterSpacing: '0.1em' }}
        >
          [ERROR] {fmtTime(message.createdAt)}
        </div>
        <div className="text-[13px] text-terminal-text-dim">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const prefix = isUser ? 'USER' : 'AGENT';

  return (
    <div className="border-t border-terminal-border pt-3">
      <div
        className="mb-1.5 text-[10px] font-bold text-terminal-amber"
        style={{ letterSpacing: '0.1em' }}
      >
        {prefix} &gt; {fmtTime(message.createdAt)}
      </div>

      {isUser && message.photos && message.photos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {message.photos.map((p) => (
            <div key={p.pose} className="border border-terminal-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={p.pose}
                className="h-16 w-16 object-cover"
              />
              <div
                className="py-0.5 text-center text-[9px] uppercase text-terminal-text-dim"
                style={{ letterSpacing: '0.1em' }}
              >
                {p.pose}
              </div>
            </div>
          ))}
        </div>
      )}

      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mb-2 flex flex-col gap-0">
          {message.toolCalls.map((tc) => (
            <ToolStatusRow key={tc.id} call={tc} />
          ))}
        </div>
      )}

      {message.content ? (
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-terminal-text">
          {message.content}
          {showStreamingCursor && (
            <span className="terminal-blink ml-1 text-terminal-amber">●</span>
          )}
        </div>
      ) : (
        showStreamingCursor && (
          <div className="text-[13px] leading-relaxed text-terminal-text">
            <span className="terminal-blink text-terminal-amber">●</span>
          </div>
        )
      )}
    </div>
  );
}

export function ChatPanel({
  lifterState,
  disabled = false,
}: {
  lifterState: LifterState | null;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PhysiquePhoto[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);

  /* ---------- typewriter drain loop ---------- */
  useEffect(() => {
    let rafId: number | null = null;
    let lastTime = performance.now();
    let accumulator = 0;

    function tick(now: number) {
      const elapsed = now - lastTime;
      lastTime = now;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          !last ||
          last.role !== 'assistant' ||
          !last.pendingBuffer ||
          last.pendingBuffer.length === 0
        ) {
          accumulator = 0;
          return prev;
        }

        const bufferLen = last.pendingBuffer.length;
        let rate: number;
        if (!last.isApiStreaming) rate = 600;
        else if (bufferLen > 500) rate = 400;
        else if (bufferLen > 200) rate = 150;
        else rate = 70;

        accumulator += (elapsed * rate) / 1000;
        const charsToAdd = Math.floor(accumulator);
        if (charsToAdd <= 0) return prev;
        accumulator -= charsToAdd;

        const take = Math.min(charsToAdd, bufferLen);
        const newContent = last.content + last.pendingBuffer.slice(0, take);
        const newBuffer = last.pendingBuffer.slice(take);

        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          content: newContent,
          pendingBuffer: newBuffer,
        };
        return updated;
      });

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  /* ---------- effects ---------- */
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 6 + 8;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  /* ---------- helpers ---------- */
  const ensureAssistantMessage = useCallback(
    (mutator: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === 'assistant' &&
          last.id === streamingAssistantIdRef.current
        ) {
          return [...prev.slice(0, -1), mutator(last)];
        }
        const fresh: ChatMessage = {
          id:
            streamingAssistantIdRef.current ??
            `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: '',
          pendingBuffer: '',
          isApiStreaming: true,
          toolCalls: [],
          createdAt: Date.now(),
        };
        return [...prev, mutator(fresh)];
      });
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const photosForTurn = pendingPhotos.length > 0 ? pendingPhotos : undefined;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      photos: photosForTurn,
      createdAt: Date.now(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setPendingPhotos([]);
    setShowPhotoUpload(false);
    setIsStreaming(true);

    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    streamingAssistantIdRef.current = assistantId;

    const controller = new AbortController();
    abortRef.current = controller;

    const transportMessages = updatedMessages
      .filter((m) => m.role !== 'error')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        photos: m.role === 'user' ? m.photos : undefined,
      }));

    await streamChat(
      transportMessages,
      lifterState,
      {
        onTextDelta: (text) => {
          ensureAssistantMessage((msg) => ({
            ...msg,
            pendingBuffer: (msg.pendingBuffer ?? '') + text,
            isApiStreaming: true,
          }));
        },
        onToolCallStart: (toolName, toolUseId) => {
          ensureAssistantMessage((msg) => ({
            ...msg,
            toolCalls: [
              ...(msg.toolCalls ?? []),
              { id: toolUseId, name: toolName, status: 'running' },
            ],
          }));
        },
        onToolCallEnd: (toolUseId, success) => {
          ensureAssistantMessage((msg) => ({
            ...msg,
            toolCalls: (msg.toolCalls ?? []).map((tc) =>
              tc.id === toolUseId
                ? { ...tc, status: success ? 'done' : 'error' }
                : tc,
            ),
          }));
        },
        onError: (message) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'error',
              content: message,
              createdAt: Date.now(),
            },
          ]);
        },
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
          // Mark API stream done. The typewriter loop will drain the
          // remaining buffer at the fast (600 c/s) rate.
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, isApiStreaming: false },
            ];
          });
          streamingAssistantIdRef.current = null;
        },
      },
      controller.signal,
    );
  }, [input, isStreaming, messages, lifterState, ensureAssistantMessage, pendingPhotos]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    // Immediately drop the pending buffer so the typewriter doesn't keep
    // typing out aborted text.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, pendingBuffer: '', isApiStreaming: false },
      ];
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const cursorVisible =
    lastMessage?.role === 'assistant' &&
    lastMessage.id === streamingAssistantIdRef.current
      ? true
      : lastMessage?.role === 'assistant' &&
          ((lastMessage.pendingBuffer && lastMessage.pendingBuffer.length > 0) ||
            lastMessage.isApiStreaming === true);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-terminal-black">
      <header className="border-b border-terminal-border px-4 py-3">
        <div
          className="text-[12px] font-bold text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
        >
          &gt; TERMINAL // EVIDENCE_BASED_AGENT
        </div>
        <div
          className={cn(
            'mt-1 text-[10px] uppercase',
            isStreaming
              ? 'text-terminal-amber'
              : 'text-terminal-text-dim',
          )}
          style={{ letterSpacing: '0.15em' }}
        >
          {isStreaming ? (
            <>
              PROCESSING<span className="terminal-blink">...</span>
            </>
          ) : (
            'READY. AWAITING INPUT.'
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-0 px-6 py-6">
          {messages.length === 0 ? (
            <pre
              className="m-0 whitespace-pre font-mono text-[13px] leading-[1.6] text-terminal-text-dim"
              style={{ letterSpacing: '0.02em' }}
            >
              <span className="text-terminal-amber-dim">{'>'}</span>{' '}
              {disabled ? 'SYSTEM_INIT IN PROGRESS' : 'NO_MESSAGES'}
              {'\n'}
              <span className="text-terminal-amber-dim">{'>'}</span>
              {'\n'}
              <span className="text-terminal-amber-dim">{'>'}</span> AWAITING USER INPUT...
              {'\n'}
              <span className="text-terminal-amber-dim">{'>'}</span>
              {'\n'}
              <span className="text-terminal-amber-dim">{'>'}</span> TIP: FILL STATS PANEL FOR FULL CONTEXT
            </pre>
          ) : (
            messages.map((m, i) => (
              <MessageBlock
                key={m.id}
                message={m}
                showStreamingCursor={
                  i === messages.length - 1 && Boolean(cursorVisible)
                }
              />
            ))
          )}
          <div ref={scrollEndRef} />
        </div>
      </div>

      {showPhotoUpload && (
        <div className="border-t border-terminal-border bg-terminal-bg-elevated px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <PhotoUploadPanel
              photos={pendingPhotos}
              onChange={setPendingPhotos}
              onClose={() => setShowPhotoUpload(false)}
            />
          </div>
        </div>
      )}

      <div className="border-t border-terminal-border bg-terminal-bg-elevated px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          {!showPhotoUpload && pendingPhotos.length === 0 && (
            <button
              type="button"
              onClick={() => setShowPhotoUpload(true)}
              disabled={disabled}
              className={cn(
                'text-[11px] font-bold uppercase transition-colors',
                disabled
                  ? 'cursor-not-allowed text-terminal-text-faint'
                  : 'text-terminal-amber hover:brightness-125',
              )}
              style={{ letterSpacing: '0.15em' }}
              aria-label="Attach physique photos"
            >
              [+ PHOTOS]
            </button>
          )}
          {pendingPhotos.length > 0 && !showPhotoUpload && (
            <button
              type="button"
              onClick={() => setShowPhotoUpload(true)}
              className="text-[11px] font-bold uppercase text-terminal-amber transition-colors hover:brightness-125"
              style={{ letterSpacing: '0.15em' }}
            >
              [{pendingPhotos.length} PHOTO{pendingPhotos.length > 1 ? 'S' : ''} ATTACHED ▸]
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? '> SYSTEM INITIALIZING...' : '> ENTER QUERY...'
            }
            rows={1}
            disabled={disabled}
            className={cn(
              'min-h-[24px] flex-1 resize-none border-none bg-transparent text-[13px] focus:outline-none',
              disabled
                ? 'cursor-not-allowed text-terminal-text-faint placeholder:text-terminal-text-faint'
                : 'text-terminal-text placeholder:text-terminal-text-faint',
            )}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="text-[11px] font-bold uppercase text-terminal-red transition-colors hover:brightness-125"
              style={{ letterSpacing: '0.15em' }}
            >
              [STOP]
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              className={cn(
                'text-[11px] font-bold uppercase transition-colors',
                !disabled && input.trim()
                  ? 'text-terminal-amber hover:brightness-125'
                  : 'cursor-not-allowed text-terminal-text-faint',
              )}
              style={{ letterSpacing: '0.15em' }}
            >
              [SEND]
            </button>
          )}
          <span
            className="text-[10px] text-terminal-text-faint"
            style={{ letterSpacing: '0.1em' }}
          >
            ^ENTER
          </span>
        </div>
      </div>
    </section>
  );
}
