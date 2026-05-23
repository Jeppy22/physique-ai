'use client';

import { useEffect, useRef, useState } from 'react';
import type { Gender, LifterState, Phase, TrainingSplit } from '@/lib/types';
import {
  type HeightUnit,
  type WeightUnit,
  heightToCm,
  heightToDisplay,
  weightToDisplay,
  weightToKg,
} from '@/lib/units';
import { hasAnyData } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface StatsBarProps {
  lifterState: LifterState;
  onChange: (next: LifterState) => void;
  onReset: () => void;
  initiallyExpanded: boolean;
}

/* ---------- shared styles ---------- */

const inputBase =
  'block w-full border border-terminal-border bg-terminal-bg-elevated text-terminal-text placeholder:text-terminal-text-faint px-2 py-1 text-[13px] focus:border-terminal-amber focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
const inputNum = `${inputBase} text-right tabular-nums`;

/* ---------- primitives ---------- */

interface NumberInputProps {
  value: number | null;
  onValueChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}

function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
  placeholder,
}: NumberInputProps) {
  const [raw, setRaw] = useState<string>(value != null ? String(value) : '');
  const lastExternal = useRef<number | null>(value);

  useEffect(() => {
    if (value === lastExternal.current) return;
    lastExternal.current = value;
    const parsed = raw === '' ? null : parseFloat(raw);
    const parsedNorm = parsed != null && !isNaN(parsed) ? parsed : null;
    if (parsedNorm === value) return;
    setRaw(value != null ? String(value) : '');
  }, [value, raw]);

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={raw}
      className={cn(inputNum, className)}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v.trim() === '') {
          onValueChange(null);
          return;
        }
        const n = parseFloat(v);
        onValueChange(isNaN(n) ? null : n);
      }}
    />
  );
}

function InputGroup({
  label,
  hint,
  minWidth,
  children,
}: {
  label: string;
  hint?: string;
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{ minWidth: `${minWidth}px` }}
    >
      <label
        className="text-[10px] font-medium uppercase text-terminal-text-dim"
        style={{ letterSpacing: '0.1em' }}
      >
        {label}
        {hint && (
          <span className="ml-1 normal-case tracking-normal text-terminal-text-faint">
            · {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function SegmentedButtons<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={cn(
            'relative border px-3 py-1.5 text-[11px] font-medium uppercase transition-colors',
            i > 0 && '-ml-px',
            value === opt.value
              ? 'z-10 border-terminal-amber bg-terminal-amber-bg text-terminal-amber'
              : 'border-terminal-border bg-terminal-black text-terminal-text-dim hover:border-terminal-border-bright hover:text-terminal-text',
          )}
          style={{ letterSpacing: '0.1em' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UnitToggle<U extends string>({
  value,
  units,
  onChange,
}: {
  value: U;
  units: U[];
  onChange: (u: U) => void;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      {units.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={cn(
            'text-[10px] font-medium uppercase',
            value === u
              ? 'text-terminal-amber'
              : 'text-terminal-text-dim hover:text-terminal-text',
          )}
          style={{ letterSpacing: '0.1em' }}
        >
          [{u.toUpperCase()}]
        </button>
      ))}
    </div>
  );
}

function TerminalSelect<T extends string>({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  placeholder: string;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value as T) || null)}
        className={cn(inputBase, 'cursor-pointer appearance-none pr-7')}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-terminal-amber">
        ▼
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 mt-1 text-[11px] font-bold uppercase text-terminal-amber"
      style={{ letterSpacing: '0.15em' }}
    >
      &gt; {children}
    </div>
  );
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

export function StatsBar({
  lifterState,
  onChange,
  onReset,
  initiallyExpanded,
}: StatsBarProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(initiallyExpanded);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');

  function update<K extends keyof LifterState>(key: K, value: LifterState[K]) {
    onChange({ ...lifterState, [key]: value });
  }

  function handleReset() {
    if (typeof window === 'undefined') return;
    const ok = window.confirm("Clear all stats? This can't be undone.");
    if (ok) onReset();
  }

  const populated = hasAnyData(lifterState);
  const summaryParts = populated
    ? buildSummary(lifterState, weightUnit, heightUnit)
    : [];

  const showDateEnabled =
    lifterState.phase === 'cut' || lifterState.phase === 'peak_week';

  return (
    <>
      {/* COLLAPSED BAR — always visible */}
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
            {summaryParts.map((p, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="mx-2 text-terminal-text-faint">·</span>
                )}
                <span className="text-terminal-text">{p}</span>
              </span>
            ))}
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
          onClick={() => setIsExpanded((v) => !v)}
          className={cn(
            'text-[11px] font-bold uppercase transition-colors hover:brightness-125',
            !populated && !isExpanded
              ? 'terminal-pulse text-terminal-amber'
              : 'text-terminal-amber',
          )}
          style={{ letterSpacing: '0.15em' }}
        >
          [EDIT {isExpanded ? '▲' : '▼'}]
        </button>
      </div>

      {/* EXPANDED FORM PANEL */}
      {isExpanded && (
        <div className="w-full flex-shrink-0 border-b border-terminal-border bg-terminal-bg-elevated p-4">
          {/* SECTION 1: ESSENTIALS */}
          <SectionHeader>ESSENTIALS</SectionHeader>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <InputGroup label="GENDER" minWidth={140}>
              <SegmentedButtons<Gender>
                value={lifterState.gender}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                onSelect={(g) => update('gender', g)}
              />
            </InputGroup>
            <InputGroup label="AGE (YR)" minWidth={70}>
              <NumberInput
                value={lifterState.ageYears}
                onValueChange={(n) => {
                  if (n != null) update('ageYears', n);
                }}
                min={14}
                max={80}
                step={1}
              />
            </InputGroup>
            <InputGroup label={`HEIGHT (${heightUnit.toUpperCase()})`} minWidth={140}>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={heightToDisplay(lifterState.heightCm, heightUnit)}
                  onValueChange={(v) => {
                    if (v == null) return;
                    const cm = heightToCm(v, heightUnit);
                    if (cm != null) update('heightCm', cm);
                  }}
                  step={0.1}
                  className="flex-1"
                />
                <UnitToggle<HeightUnit>
                  value={heightUnit}
                  units={['cm', 'in']}
                  onChange={setHeightUnit}
                />
              </div>
            </InputGroup>
            <InputGroup
              label={`BODYWEIGHT (${weightUnit.toUpperCase()})`}
              minWidth={150}
            >
              <div className="flex items-center gap-2">
                <NumberInput
                  value={weightToDisplay(lifterState.bodyweightKg, weightUnit)}
                  onValueChange={(v) => {
                    if (v == null) return;
                    const kg = weightToKg(v, weightUnit);
                    if (kg != null) update('bodyweightKg', kg);
                  }}
                  step={0.1}
                  className="flex-1"
                />
                <UnitToggle<WeightUnit>
                  value={weightUnit}
                  units={['kg', 'lb']}
                  onChange={setWeightUnit}
                />
              </div>
            </InputGroup>
            <InputGroup label="PHASE" minWidth={260}>
              <SegmentedButtons<Phase>
                value={lifterState.phase}
                options={[
                  { value: 'cut', label: 'Cut' },
                  { value: 'maintenance', label: 'Maint' },
                  { value: 'bulk', label: 'Bulk' },
                  { value: 'peak_week', label: 'Peak' },
                ]}
                onSelect={(p) => update('phase', p)}
              />
            </InputGroup>
          </div>

          {/* SECTION 2: DETAIL */}
          <SectionHeader>DETAIL</SectionHeader>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <InputGroup label="BODY FAT %" hint="optional" minWidth={90}>
              <NumberInput
                value={lifterState.bodyFatPercent}
                onValueChange={(v) => update('bodyFatPercent', v)}
                min={3}
                max={60}
                step={0.1}
              />
            </InputGroup>
            <InputGroup
              label="SHOW DATE"
              hint={showDateEnabled ? undefined : 'cut/peak only'}
              minWidth={140}
            >
              <input
                type="date"
                disabled={!showDateEnabled}
                value={lifterState.showDateISO ?? ''}
                onChange={(e) =>
                  update(
                    'showDateISO',
                    e.target.value === '' ? null : e.target.value,
                  )
                }
                className={inputBase}
              />
            </InputGroup>
            <InputGroup
              label={`TARGET STAGE WT (${weightUnit.toUpperCase()})`}
              minWidth={120}
            >
              <NumberInput
                value={weightToDisplay(lifterState.targetStageWeightKg, weightUnit)}
                onValueChange={(v) =>
                  update(
                    'targetStageWeightKg',
                    v != null ? weightToKg(v, weightUnit) : null,
                  )
                }
                step={0.1}
              />
            </InputGroup>
            <InputGroup
              label={`WEEKLY Δ (${weightUnit.toUpperCase()}/WK)`}
              hint="negative = losing"
              minWidth={120}
            >
              <NumberInput
                value={weightToDisplay(
                  lifterState.recentWeeklyWeightChangeKg,
                  weightUnit,
                )}
                onValueChange={(v) =>
                  update(
                    'recentWeeklyWeightChangeKg',
                    v != null ? weightToKg(v, weightUnit) : null,
                  )
                }
                step={0.05}
              />
            </InputGroup>
            <InputGroup label="SESSIONS / WK" minWidth={90}>
              <NumberInput
                value={lifterState.sessionsPerWeek}
                onValueChange={(v) => update('sessionsPerWeek', v)}
                min={0}
                max={14}
                step={1}
              />
            </InputGroup>
            <InputGroup label="TRAINING SPLIT" minWidth={200}>
              <TerminalSelect<TrainingSplit>
                value={lifterState.trainingSplit}
                placeholder="-- select --"
                options={[
                  { value: 'PPL', label: 'Push / Pull / Legs' },
                  { value: 'upper_lower', label: 'Upper / Lower' },
                  { value: 'bro_split', label: 'Bro Split' },
                  { value: 'full_body', label: 'Full Body' },
                  { value: 'other', label: 'Other' },
                ]}
                onChange={(v) => update('trainingSplit', v)}
              />
            </InputGroup>
          </div>

          {/* SECTION 3: NUTRITION_WELLBEING */}
          <SectionHeader>NUTRITION_WELLBEING</SectionHeader>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <InputGroup label="CALORIES (KCAL)" minWidth={100}>
              <NumberInput
                value={lifterState.dailyCalories}
                onValueChange={(v) => update('dailyCalories', v)}
                min={0}
                step={50}
              />
            </InputGroup>
            <InputGroup label="PROTEIN (G)" minWidth={80}>
              <NumberInput
                value={lifterState.dailyProteinG}
                onValueChange={(v) => update('dailyProteinG', v)}
                min={0}
                step={5}
              />
            </InputGroup>
            <InputGroup label="CARBS (G)" minWidth={80}>
              <NumberInput
                value={lifterState.dailyCarbsG}
                onValueChange={(v) => update('dailyCarbsG', v)}
                min={0}
                step={5}
              />
            </InputGroup>
            <InputGroup label="FAT (G)" minWidth={70}>
              <NumberInput
                value={lifterState.dailyFatG}
                onValueChange={(v) => update('dailyFatG', v)}
                min={0}
                step={5}
              />
            </InputGroup>
            <InputGroup label="ENERGY (1-10)" minWidth={80}>
              <NumberInput
                value={lifterState.energy1to10}
                onValueChange={(v) => update('energy1to10', v)}
                min={1}
                max={10}
                step={1}
              />
            </InputGroup>
            <InputGroup label="SLEEP (HRS)" minWidth={80}>
              <NumberInput
                value={lifterState.sleepHours}
                onValueChange={(v) => update('sleepHours', v)}
                min={0}
                max={14}
                step={0.25}
              />
            </InputGroup>
            <InputGroup label="STRESS (1-10)" minWidth={80}>
              <NumberInput
                value={lifterState.stressLevel1to10}
                onValueChange={(v) => update('stressLevel1to10', v)}
                min={1}
                max={10}
                step={1}
              />
            </InputGroup>
            {lifterState.gender === 'female' && (
              <InputGroup label="MENSTRUAL CYCLE" minWidth={200}>
                <TerminalSelect<NonNullable<LifterState['menstrualCyclePhase']>>
                  value={lifterState.menstrualCyclePhase}
                  placeholder="-- select --"
                  options={[
                    { value: 'follicular', label: 'Follicular' },
                    { value: 'ovulation', label: 'Ovulation' },
                    { value: 'luteal', label: 'Luteal' },
                    { value: 'menstrual', label: 'Menstrual' },
                    { value: 'irregular', label: 'Irregular' },
                  ]}
                  onChange={(v) => update('menstrualCyclePhase', v)}
                />
              </InputGroup>
            )}
          </div>

          {/* RESET ROW */}
          <div className="mt-4 flex justify-end border-t border-terminal-border pt-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-medium uppercase text-terminal-text-dim transition-colors hover:text-terminal-amber"
              style={{ letterSpacing: '0.1em' }}
            >
              [RESET]
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default StatsBar;
