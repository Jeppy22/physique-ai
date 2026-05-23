'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/chat-panel';
import { StatsBar } from '@/components/stats-bar';
import {
  clearLifterState,
  hasAnyData,
  loadLifterState,
  saveLifterState,
} from '@/lib/storage';
import { DEFAULT_LIFTER_STATE } from '@/lib/types';
import type { LifterState } from '@/lib/types';

function formatUTC(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} UTC`;
}

function genSessionId(): string {
  const seg = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
  return `${seg()}-${seg()}`;
}

function TerminalTopBar({
  hydrated,
  sessionId,
  clock,
}: {
  hydrated: boolean;
  sessionId: string;
  clock: string;
}) {
  return (
    <div className="flex h-8 w-full flex-shrink-0 items-center justify-between border-b border-terminal-border bg-terminal-bg-deep px-4 text-[12px]">
      <span
        className="font-bold text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        PHYSIQUE_AI
      </span>
      <span
        className="hidden text-[11px] text-terminal-text-dim sm:inline"
        style={{ letterSpacing: '0.1em' }}
      >
        SESSION: {hydrated ? sessionId : '----  ----'}
      </span>
      <span
        className="text-[11px] tabular-nums text-terminal-text-dim"
        style={{ letterSpacing: '0.1em' }}
      >
        {hydrated ? clock : '--:--:-- UTC'}
      </span>
    </div>
  );
}

function StatsBarLoadingShell() {
  return (
    <div className="flex w-full flex-shrink-0 items-center gap-x-2 border-b border-terminal-border bg-terminal-bg-deep px-4 py-2">
      <span
        className="text-[11px] font-bold uppercase text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        LIFTER ▸
      </span>
      <span
        className="flex-1 text-[12px] uppercase text-terminal-text-dim"
        style={{ letterSpacing: '0.1em' }}
      >
        LOADING...
      </span>
    </div>
  );
}

export default function Home() {
  const [lifterState, setLifterState] = useState<LifterState>(DEFAULT_LIFTER_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [initiallyExpanded, setInitiallyExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [clock, setClock] = useState<string>('');

  useEffect(() => {
    const loaded = loadLifterState();
    setLifterState(loaded);
    setInitiallyExpanded(!hasAnyData(loaded));
    setSessionId(genSessionId());
    setClock(formatUTC(new Date()));
    setHydrated(true);
    const id = setInterval(() => setClock(formatUTC(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveLifterState(lifterState), 300);
    return () => clearTimeout(t);
  }, [lifterState, hydrated]);

  function handleReset() {
    clearLifterState();
    setLifterState(DEFAULT_LIFTER_STATE);
  }

  return (
    <main className="flex h-screen min-h-screen w-screen flex-col bg-terminal-black text-terminal-text">
      <TerminalTopBar hydrated={hydrated} sessionId={sessionId} clock={clock} />
      {hydrated ? (
        <StatsBar
          lifterState={lifterState}
          onChange={setLifterState}
          onReset={handleReset}
          initiallyExpanded={initiallyExpanded}
        />
      ) : (
        <StatsBarLoadingShell />
      )}
      <section className="flex min-h-0 flex-1 flex-col">
        <ChatPanel lifterState={hydrated ? lifterState : null} />
      </section>
    </main>
  );
}
