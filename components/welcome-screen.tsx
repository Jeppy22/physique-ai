'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrambleText } from './scramble-text';
import { TypewriterText } from './typewriter-text';
import { cn } from '@/lib/utils';

interface WelcomeScreenProps {
  onContinue: () => void;
  onBypass?: () => void;
  autoAdvanceAfterMs?: number;
}

interface ToolRow {
  name: string;
  desc: string;
}

const TOOLS: ToolRow[] = [
  {
    name: 'PROJECT_WEIGHT_TRAJECTORY',
    desc: 'weekly weight curves, safe rate flags',
  },
  {
    name: 'ASSESS_MACROS',
    desc: 'protein, fat, calorie ranges by phase',
  },
  {
    name: 'GENERATE_PEAK_WEEK',
    desc: '7-day water/sodium/carb protocol',
  },
  {
    name: 'FLAG_WARNING_SIGNS',
    desc: 'energy, sleep, libido, cycle markers',
  },
];

const VISION: ToolRow[] = [
  {
    name: 'ANALYZE_PHYSIQUE',
    desc: 'optional photo upload, front/side/back/legs, range-based output',
  },
];

const CITATIONS = 'HELMS 2014 · ROSSOW 2013 · MITCHELL 2018 · TREXLER 2014 · MORTON 2018';

// Reveal-step schedule (ms from mount).
//   step 1 — t=0    : header
//   step 2 — t=700  : tagline
//   step 3 — t=1200 : TOOLS header + tool 0
//   step 4 — t=1320 : tool 1
//   step 5 — t=1440 : tool 2
//   step 6 — t=1560 : tool 3
//   step 7 — t=2000 : VISION header + row
//   step 8 — t=2400 : CITATIONS header + line
//   step 9 — t=2750 : INITIALIZE button (300ms fade-in)
//   ready          — t=3050 : auto-advance idle timer starts
const SCHEDULE = [0, 700, 1200, 1320, 1440, 1560, 2000, 2400, 2750];
const READY_AT_MS = 3050;
const ALL_VISIBLE_STEP = 99;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function RowBullet({
  name,
  desc,
  durationMs,
}: ToolRow & { durationMs: number }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <div className="flex w-full items-baseline gap-2 sm:w-[280px] sm:flex-shrink-0">
        <span className="text-terminal-amber">[•]</span>
        <span
          className="text-[12px] font-medium uppercase text-terminal-text"
          style={{ letterSpacing: '0.08em' }}
        >
          <ScrambleText text={name} duration={durationMs} />
        </span>
      </div>
      <div className="flex-1 pl-6 text-[11px] text-terminal-text-dim sm:pl-0">
        {desc}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="mt-6 text-[12px] font-bold uppercase text-terminal-amber"
      style={{ letterSpacing: '0.15em' }}
    >
      &gt; {label}
    </div>
  );
}

export function WelcomeScreen({
  onContinue,
  onBypass,
  autoAdvanceAfterMs = 10000,
}: WelcomeScreenProps) {
  const [step, setStep] = useState(0);
  const [readyForInput, setReadyForInput] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const continuedRef = useRef(false);

  const handleContinue = useCallback(() => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onContinue();
  }, [onContinue]);

  const handleBypass = useCallback(() => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onBypass?.();
  }, [onBypass]);

  // Staged reveal (or skip entirely under reduced motion).
  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReducedMotion(reduced);

    if (reduced) {
      setStep(ALL_VISIBLE_STEP);
      setReadyForInput(true);
      return;
    }

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    SCHEDULE.forEach((delay, idx) => {
      timeouts.push(setTimeout(() => setStep((s) => Math.max(s, idx + 1)), delay));
    });
    timeouts.push(setTimeout(() => setReadyForInput(true), READY_AT_MS));

    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Idle auto-advance + Enter key + interaction reset.
  useEffect(() => {
    if (!readyForInput) return;

    // Reduced motion: respect the user's attention — no auto-advance,
    // but Enter still works for accessibility.
    if (reducedMotion) {
      const keydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleContinue();
      };
      document.addEventListener('keydown', keydown);
      return () => document.removeEventListener('keydown', keydown);
    }

    let timerId: ReturnType<typeof setTimeout> = setTimeout(
      handleContinue,
      autoAdvanceAfterMs,
    );

    const reset = () => {
      clearTimeout(timerId);
      timerId = setTimeout(handleContinue, autoAdvanceAfterMs);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleContinue();
        return;
      }
      reset();
    };

    document.addEventListener('mousemove', reset);
    document.addEventListener('scroll', reset, true);
    document.addEventListener('touchstart', reset);
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousemove', reset);
      document.removeEventListener('scroll', reset, true);
      document.removeEventListener('touchstart', reset);
      document.removeEventListener('keydown', onKey);
    };
  }, [readyForInput, reducedMotion, handleContinue, autoAdvanceAfterMs]);

  const headerVisible = step >= 1;
  const taglineVisible = step >= 2;
  const toolsHeaderVisible = step >= 3;
  const toolVisible = (i: number) => step >= 3 + i;
  const visionVisible = step >= 7;
  const citationsVisible = step >= 8;
  const buttonVisible = step >= 9;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to PhysiqueAI"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-terminal-black px-6 py-10"
    >
      <div className="flex w-full max-w-[720px] flex-col">
        {/* HEADER */}
        <div
          className="flex items-baseline gap-2 text-[18px] font-bold uppercase text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
        >
          <span>&gt;</span>
          <span>
            {headerVisible ? (
              <TypewriterText
                text="PHYSIQUE_AI"
                animate={!reducedMotion}
                charDelayMs={50}
              />
            ) : (
              <span className="invisible">PHYSIQUE_AI</span>
            )}
          </span>
        </div>

        {/* TAGLINE */}
        <div
          className={cn(
            'mt-3 text-[13px] text-terminal-text transition-opacity duration-100',
            taglineVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {taglineVisible ? (
            <ScrambleText
              text="EVIDENCE-BASED CONTEST PREP, GROUNDED IN RESEARCH"
              duration={400}
            />
          ) : (
            <span className="invisible">
              EVIDENCE-BASED CONTEST PREP, GROUNDED IN RESEARCH
            </span>
          )}
        </div>

        {/* TOOLS */}
        {toolsHeaderVisible && <SectionHeader label="TOOLS" />}
        {toolsHeaderVisible && (
          <div className="mt-3 flex flex-col gap-2">
            {TOOLS.map((t, i) =>
              toolVisible(i) ? (
                <RowBullet key={t.name} {...t} durationMs={250} />
              ) : null,
            )}
          </div>
        )}

        {/* VISION */}
        {visionVisible && <SectionHeader label="VISION" />}
        {visionVisible && (
          <div className="mt-3 flex flex-col gap-2">
            {VISION.map((t) => (
              <RowBullet key={t.name} {...t} durationMs={250} />
            ))}
          </div>
        )}

        {/* CITATIONS */}
        {citationsVisible && <SectionHeader label="CITATIONS" />}
        {citationsVisible && (
          <div
            className="mt-3 text-[10px] uppercase text-terminal-text-dim"
            style={{ letterSpacing: '0.1em' }}
          >
            <ScrambleText text={CITATIONS} duration={300} />
          </div>
        )}

        {/* INITIALIZE */}
        <div className="mt-8 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!buttonVisible}
            className={cn(
              'text-[14px] font-bold uppercase transition-all',
              buttonVisible
                ? 'text-terminal-amber opacity-100 hover:text-terminal-text'
                : 'pointer-events-none text-terminal-amber opacity-0',
            )}
            style={{ letterSpacing: '0.15em', transitionDuration: '300ms' }}
          >
            [ INITIALIZE ▸ ]
          </button>

          {onBypass && (
            <button
              type="button"
              onClick={handleBypass}
              disabled={!buttonVisible}
              className={cn(
                'text-[11px] uppercase transition-opacity',
                buttonVisible
                  ? 'text-terminal-text-dim opacity-100 hover:text-terminal-amber'
                  : 'pointer-events-none opacity-0',
              )}
              style={{ letterSpacing: '0.1em', transitionDuration: '300ms' }}
            >
              BYPASS ▸ ENTER CHAT WITHOUT ONBOARDING
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
