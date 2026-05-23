'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  SendHorizonal,
  Square,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { streamChat } from '@/lib/chat-client';
import type { LifterState } from '@/lib/types';

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
  toolCalls?: ToolCall[];
}

const TOOL_LABELS: Record<string, string> = {
  project_weight_trajectory: 'Projecting weight trajectory',
  assess_macros: 'Assessing macros',
  generate_peak_week: 'Generating peak week protocol',
  flag_warning_signs: 'Checking warning signs',
};

function humanizeTool(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function ToolPill({ call }: { call: ToolCall }) {
  const label = humanizeTool(call.name);
  return (
    <span
      title={call.status === 'error' ? 'Tool execution failed' : label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
        call.status === 'running'
          ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
          : call.status === 'done'
            ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
            : 'border-red-900/60 bg-red-950/40 text-red-300'
      }`}
    >
      {call.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {call.status === 'done' && <Check className="h-3 w-3" />}
      {call.status === 'error' && <X className="h-3 w-3" />}
      <span>
        {label}
        {call.status === 'running' ? '…' : ''}
      </span>
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message.content}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.toolCalls.map((tc) => (
            <ToolPill key={tc.id} call={tc} />
          ))}
        </div>
      )}
      {message.content && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
          {message.content}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  lifterState,
}: {
  lifterState: LifterState | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24; // matches text-sm leading
    const maxHeight = lineHeight * 6 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  const ensureAssistantMessage = useCallback(
    (mutator: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.id === streamingAssistantIdRef.current) {
          return [...prev.slice(0, -1), mutator(last)];
        }
        const fresh: ChatMessage = {
          id: streamingAssistantIdRef.current ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: '',
          toolCalls: [],
        };
        return [...prev, mutator(fresh)];
      });
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    streamingAssistantIdRef.current = assistantId;

    const controller = new AbortController();
    abortRef.current = controller;

    // Pass to the server: drop UI-only error rows; convert to {role, content}
    const transportMessages = updatedMessages
      .filter((m) => m.role !== 'error')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    await streamChat(
      transportMessages,
      lifterState,
      {
        onTextDelta: (text) => {
          ensureAssistantMessage((msg) => ({
            ...msg,
            content: msg.content + text,
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
            },
          ]);
        },
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
          streamingAssistantIdRef.current = null;
        },
      },
      controller.signal,
    );
  }, [input, isStreaming, messages, lifterState, ensureAssistantMessage]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
          PhysiqueAI
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          applied AI for contest prep, grounded in evidence-based bodybuilding research.
        </p>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {messages.length === 0 ? (
            <div className="mt-12 text-center text-sm text-zinc-500">
              Ask anything about your cut, your macros, peak week timing, or warning signs.
              <br />
              I&apos;ll use evidence-based tools to answer.
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-800 p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about macros, weight trajectory, peak week, or warning signs…"
            rows={1}
            className="min-h-[44px] flex-1 resize-none border-zinc-800 bg-zinc-900/40 text-zinc-100 placeholder:text-zinc-500"
          />
          {isStreaming ? (
            <Button
              type="button"
              onClick={handleStop}
              size="icon"
              variant="secondary"
              className="h-11 w-11 shrink-0"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Send"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
