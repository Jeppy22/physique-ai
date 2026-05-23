'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/chat-panel';
import { StatsBar } from '@/components/stats-bar';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { TypewriterText } from '@/components/typewriter-text';
import { BootSequence, type BootLine } from '@/components/boot-sequence';
import {
  hasAnyData,
  loadLifterState,
  saveLifterState,
} from '@/lib/storage';
import { DEFAULT_LIFTER_STATE } from '@/lib/types';
import type { LifterState } from '@/lib/types';

const HEADER_TYPED_FLAG = 'physique-ai-header-typed';

// Note: numbers reflect current tool/citation counts. Update if
// lib/tools/schemas.ts or system prompt citations change.
const BOOT_LINES: BootLine[] = [
  { text: 'LIFTER_PROFILE LOADED', status: 'OK' },
  { text: 'SYSTEM_PROMPT COMPILED', status: 'OK' },
  { text: 'TOOLS REGISTERED: 4', status: 'OK' },
  { text: 'CITATIONS INDEXED: 5', status: 'OK' },
  { text: 'AGENT READY', status: 'CONNECTED' },
];

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
  typeHeader,
}: {
  hydrated: boolean;
  sessionId: string;
  clock: string;
  typeHeader: boolean;
}) {
  return (
    <div className="flex h-8 w-full flex-shrink-0 items-center justify-between border-b border-terminal-border bg-terminal-bg-deep px-4 text-[12px]">
      <span
        className="font-bold text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        {hydrated ? (
          <TypewriterText
            text="PHYSIQUE_AI"
            animate={typeHeader}
            charDelayMs={50}
          />
        ) : (
          'PHYSIQUE_AI'
        )}
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
  const [typeHeader, setTypeHeader] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [bootSequenceVisible, setBootSequenceVisible] = useState(false);
  const [shouldDelayStatsBarAnimation, setShouldDelayStatsBarAnimation] =
    useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [clock, setClock] = useState<string>('');

  useEffect(() => {
    const loaded = loadLifterState();
    setLifterState(loaded);
    setSessionId(genSessionId());
    setClock(formatUTC(new Date()));

    // Once-per-session header typewriter.
    try {
      const already = window.sessionStorage.getItem(HEADER_TYPED_FLAG);
      if (!already) {
        setTypeHeader(true);
        window.sessionStorage.setItem(HEADER_TYPED_FLAG, '1');
      }
    } catch {
      // sessionStorage unavailable — don't animate
    }

    setHydrated(true);
    const id = setInterval(() => setClock(formatUTC(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveLifterState(lifterState), 300);
    return () => clearTimeout(t);
  }, [lifterState, hydrated]);

  const populated = hasAnyData(lifterState);
  const showWizard = hydrated && (!populated || isEditingStats);
  const wizardMode: 'first-visit' | 'edit' = populated ? 'edit' : 'first-visit';

  return (
    <main className="flex h-screen min-h-screen w-screen flex-col bg-terminal-black text-terminal-text">
      <TerminalTopBar
        hydrated={hydrated}
        sessionId={sessionId}
        clock={clock}
        typeHeader={typeHeader}
      />
      {hydrated ? (
        <StatsBar
          lifterState={lifterState}
          onEdit={() => setIsEditingStats(true)}
          freezeAnimations={shouldDelayStatsBarAnimation}
        />
      ) : (
        <StatsBarLoadingShell />
      )}
      <section className="flex min-h-0 flex-1 flex-col">
        <ChatPanel
          lifterState={hydrated ? lifterState : null}
          disabled={bootSequenceVisible}
        />
      </section>

      {showWizard && (
        <OnboardingWizard
          initialState={lifterState}
          mode={wizardMode}
          onComplete={(next, isFirstVisit) => {
            setLifterState(next);
            setIsEditingStats(false);
            if (isFirstVisit) {
              setShouldDelayStatsBarAnimation(true);
              setBootSequenceVisible(true);
            }
          }}
          onCancel={
            wizardMode === 'edit'
              ? () => setIsEditingStats(false)
              : undefined
          }
        />
      )}

      {bootSequenceVisible && (
        <BootSequence
          lines={BOOT_LINES}
          onComplete={() => {
            setBootSequenceVisible(false);
            setShouldDelayStatsBarAnimation(false);
          }}
        />
      )}
    </main>
  );
}
