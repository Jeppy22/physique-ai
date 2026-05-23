import type { LifterState } from './types';

export interface ChatStreamCallbacks {
  onTextDelta: (text: string) => void;
  onToolCallStart: (toolName: string, toolUseId: string) => void;
  onToolCallEnd: (toolUseId: string, success: boolean) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

interface SSEEvent {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_end' | 'error' | 'done';
  text?: string;
  toolName?: string;
  toolUseId?: string;
  success?: boolean;
  message?: string;
}

function dispatch(event: SSEEvent, cb: ChatStreamCallbacks) {
  switch (event.type) {
    case 'text_delta':
      if (typeof event.text === 'string') cb.onTextDelta(event.text);
      break;
    case 'tool_call_start':
      if (event.toolName && event.toolUseId)
        cb.onToolCallStart(event.toolName, event.toolUseId);
      break;
    case 'tool_call_end':
      if (event.toolUseId)
        cb.onToolCallEnd(event.toolUseId, !!event.success);
      break;
    case 'error':
      cb.onError(event.message ?? 'Unknown error.');
      break;
    case 'done':
      cb.onDone();
      break;
  }
}

export async function streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  lifterState: LifterState | null,
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, lifterState }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) {
      callbacks.onDone();
      return;
    }
    callbacks.onError(err instanceof Error ? err.message : 'Network error.');
    callbacks.onDone();
    return;
  }

  if (!response.ok || !response.body) {
    let message = `Server error ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore
    }
    callbacks.onError(message);
    callbacks.onDone();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneFired = false;

  const fireDone = () => {
    if (!doneFired) {
      doneFired = true;
      callbacks.onDone();
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = rawEvent.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as SSEEvent;
            dispatch(parsed, {
              ...callbacks,
              onDone: fireDone,
            });
          } catch {
            // ignore malformed event
          }
        }
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      callbacks.onError(err instanceof Error ? err.message : 'Stream read failed.');
    }
  } finally {
    fireDone();
  }
}
