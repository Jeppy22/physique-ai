'use client';

import { useEffect, useState } from 'react';
import { ScrambleText } from './scramble-text';
import { cn } from '@/lib/utils';

// Note: numbers in BOOT_LINES (TOOLS REGISTERED, CITATIONS INDEXED) reflect
// current tool/citation counts. Update if lib/tools/schemas.ts or system
// prompt citations change.
export interface BootLine {
  text: string;
  status: string; // RHS indicator, e.g. 'OK', 'CONNECTED'
}

interface BootSequenceProps {
  lines: BootLine[];
  staggerMs?: number;
  lineDurationMs?: number;
  holdMs?: number;
  fadeMs?: number;
  onComplete: () => void;
}

type Phase = 'running' | 'holding' | 'fading' | 'done';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function BootSequence({
  lines,
  staggerMs = 120,
  lineDurationMs = 250,
  holdMs = 400,
  fadeMs = 200,
  onComplete,
}: BootSequenceProps) {
  const [revealed, setRevealed] = useState(0);
  const [settled, setSettled] = useState(0);
  const [phase, setPhase] = useState<Phase>('running');

  useEffect(() => {
    // Honor reduced-motion: skip the show entirely.
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    lines.forEach((_, i) => {
      timeouts.push(
        setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), i * staggerMs),
      );
      timeouts.push(
        setTimeout(
          () => setSettled((n) => Math.max(n, i + 1)),
          i * staggerMs + lineDurationMs,
        ),
      );
    });

    const lastSettleAt = (lines.length - 1) * staggerMs + lineDurationMs;
    timeouts.push(setTimeout(() => setPhase('holding'), lastSettleAt));
    timeouts.push(setTimeout(() => setPhase('fading'), lastSettleAt + holdMs));
    timeouts.push(
      setTimeout(() => {
        setPhase('done');
        onComplete();
      }, lastSettleAt + holdMs + fadeMs),
    );

    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center bg-terminal-black px-6 transition-opacity',
        phase === 'fading' ? 'opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${fadeMs}ms` }}
      aria-hidden="true"
    >
      <div className="flex w-full max-w-[640px] flex-col gap-3">
        <div
          className="text-[14px] font-bold uppercase text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
        >
          &gt; SYSTEM_INIT
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-[13px]">
          {lines.map((line, i) => {
            const visible = i < revealed;
            const isSettled = i < settled;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-baseline gap-2 transition-opacity duration-[50ms]',
                  visible ? 'opacity-100' : 'opacity-0',
                )}
              >
                <span className="text-terminal-amber">&gt;</span>
                <span className="text-terminal-text">
                  {visible ? (
                    <ScrambleText text={line.text} duration={lineDurationMs} />
                  ) : (
                    line.text
                  )}
                </span>
                <span
                  className="flex-1 self-center border-b border-dotted border-terminal-border-bright"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'font-bold transition-opacity duration-100',
                    isSettled
                      ? 'text-terminal-green opacity-100'
                      : 'text-transparent opacity-0',
                  )}
                  style={{ letterSpacing: '0.1em' }}
                >
                  {line.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BootSequence;
