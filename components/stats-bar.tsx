'use client';

import { useEffect, useRef, useState } from 'react';
import type { LifterState, Phase } from '@/lib/types';
import {
  type HeightUnit,
  type WeightUnit,
  heightToDisplay,
  weightToDisplay,
} from '@/lib/units';
import { hasAnyData } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { ScrambleText } from './scramble-text';

interface StatsBarProps {
  lifterState: LifterState;
  onEdit: () => void;
}

/* ---------- summary string ---------- */

const PHASE_LABEL: Record<Phase, string> = {
  cut: 'CUT',
  maintenance: 'MAINTENANCE',
  bulk: 'BULK',
  peak_week: 'PEAK WEEK',
};

function buildSummary(
  state: LifterState,
  weightUnit: WeightUnit,
  heightUnit: HeightUnit,
): string[] {
  const parts: string[] = [];

  const genderLetter = state.gender === 'male' ? 'M' : 'F';
  parts.push(`${Math.round(state.ageYears)}${genderLetter}`);

  const hd = heightToDisplay(state.heightCm, heightUnit);
  if (hd != null) {
    const hStr = heightUnit === 'cm' ? Math.round(hd).toString() : hd.toFixed(0);
    parts.push(`${hStr}${heightUnit}`);
  }

  const wd = weightToDisplay(state.bodyweightKg, weightUnit);
  if (wd != null) parts.push(`${wd.toFixed(1)}${weightUnit}`);

  if (state.bodyFatPercent != null) {
    parts.push(`${state.bodyFatPercent.toFixed(1)}% BF`);
  }

  parts.push(PHASE_LABEL[state.phase]);

  if (state.dailyCalories != null) {
    parts.push(`${Math.round(state.dailyCalories)}cal`);
  }

  const macroParts: string[] = [];
  if (state.dailyProteinG != null) macroParts.push(`${Math.round(state.dailyProteinG)}P`);
  if (state.dailyCarbsG != null) macroParts.push(`${Math.round(state.dailyCarbsG)}C`);
  if (state.dailyFatG != null) macroParts.push(`${Math.round(state.dailyFatG)}F`);
  if (macroParts.length > 0) parts.push(macroParts.join('/'));

  if (state.sessionsPerWeek != null) {
    parts.push(`${state.sessionsPerWeek}×/wk`);
  }

  if (
    (state.phase === 'cut' || state.phase === 'peak_week') &&
    state.showDateISO
  ) {
    const today = new Date();
    const todayUTC = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const showUTC = Date.parse(state.showDateISO);
    if (!isNaN(showUTC)) {
      const days = Math.round((showUTC - todayUTC) / (1000 * 60 * 60 * 24));
      parts.push(days >= 0 ? `T-${days}` : `T+${Math.abs(days)}`);
    }
  }

  return parts;
}

/* ---------- main ---------- */

export function StatsBar({ lifterState, onEdit }: StatsBarProps) {
  const [weightUnit] = useState<WeightUnit>('kg');
  const [heightUnit] = useState<HeightUnit>('cm');

  const populated = hasAnyData(lifterState);
  const summaryParts = populated
    ? buildSummary(lifterState, weightUnit, heightUnit)
    : [];

  // Diff-based chip animation: track which indices changed since the last render.
  const prevPartsRef = useRef<string[]>([]);
  const mountedRef = useRef(false);
  const [animatingDelays, setAnimatingDelays] = useState<Map<number, number>>(
    () => new Map(),
  );
  const partsKey = summaryParts.join('|');

  useEffect(() => {
    if (!mountedRef.current) {
      // First render — never animate, just capture the baseline.
      mountedRef.current = true;
      prevPartsRef.current = summaryParts;
      return;
    }

    const prev = prevPartsRef.current;
    const changedIndices: number[] = [];
    for (let i = 0; i < summaryParts.length; i++) {
      if (prev[i] !== summaryParts[i]) changedIndices.push(i);
    }
    prevPartsRef.current = summaryParts;

    if (changedIndices.length === 0) return;

    const delays = new Map<number, number>();
    changedIndices.forEach((idx, order) => {
      delays.set(idx, order * 80);
    });
    setAnimatingDelays(delays);

    // Clear after the longest scramble + its delay completes.
    const longestDelay = (changedIndices.length - 1) * 80;
    const clearMs = longestDelay + 240; // 200 ms duration + small buffer
    const t = setTimeout(() => setAnimatingDelays(new Map()), clearMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partsKey]);

  return (
    <div
      className={cn(
        'flex w-full flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-terminal-border bg-terminal-bg-deep px-4 py-2',
      )}
    >
      <span
        className="text-[11px] font-bold uppercase text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        LIFTER ▸
      </span>
      {populated ? (
        <span
          className="flex-1 text-[12px] text-terminal-text-dim"
          style={{ letterSpacing: '0.02em' }}
        >
          {summaryParts.map((part, i) => {
            const animDelay = animatingDelays.get(i);
            return (
              <span key={i}>
                {i > 0 && (
                  <span className="mx-2 text-terminal-text-faint">·</span>
                )}
                <span className="text-terminal-text">
                  {animDelay != null ? (
                    <ScrambleText
                      text={part}
                      duration={200}
                      delay={animDelay}
                    />
                  ) : (
                    part
                  )}
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <span
          className="flex-1 text-[12px] uppercase text-terminal-text-dim"
          style={{ letterSpacing: '0.1em' }}
        >
          NO DATA · CLICK EDIT TO SET STATS
        </span>
      )}
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'text-[11px] font-bold uppercase transition-colors hover:brightness-125',
          !populated
            ? 'terminal-pulse text-terminal-amber'
            : 'text-terminal-amber',
        )}
        style={{ letterSpacing: '0.15em' }}
      >
        [EDIT ▸]
      </button>
    </div>
  );
}

export default StatsBar;
