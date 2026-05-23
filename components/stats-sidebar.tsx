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
import { cn } from '@/lib/utils';

interface StatsSidebarProps {
  lifterState: LifterState;
  onChange: (next: LifterState) => void;
  onReset: () => void;
}

/* ---------- shared styles ---------- */

const inputBase =
  'block w-full border border-terminal-border bg-terminal-bg-elevated text-terminal-text placeholder:text-terminal-text-faint px-2 py-1 text-[13px] focus:border-terminal-amber focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
const inputNum = `${inputBase} text-right tabular-nums`;
const labelCls =
  'text-[10px] font-medium uppercase text-terminal-text-dim';

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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className={labelCls}
        style={{ letterSpacing: '0.1em' }}
      >
        {label}
        {hint && (
          <span className="ml-1 text-terminal-text-faint normal-case tracking-normal">
            · {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border border-terminal-border bg-terminal-black"
    >
      <summary
        className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase text-terminal-text-dim hover:text-terminal-text group-open:text-terminal-amber [&::-webkit-details-marker]:hidden"
        style={{ letterSpacing: '0.15em' }}
      >
        <span className="inline-block w-3 group-open:hidden">{'>'}</span>
        <span className="hidden w-3 group-open:inline">▼</span>
        <span>{title}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-terminal-border p-3">
        {children}
      </div>
    </details>
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

/* ---------- sidebar ---------- */

export function StatsSidebar({
  lifterState,
  onChange,
  onReset,
}: StatsSidebarProps) {
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

  const showDateEnabled =
    lifterState.phase === 'cut' || lifterState.phase === 'peak_week';

  return (
    <div className="flex h-full max-h-full flex-col bg-terminal-black">
      <header className="flex items-center justify-between gap-2 border-b border-terminal-border px-4 py-3">
        <span
          className="text-[12px] font-bold text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
        >
          STATS // LIFTER_PROFILE
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] font-medium uppercase text-terminal-text-dim transition-colors hover:text-terminal-amber"
          style={{ letterSpacing: '0.1em' }}
        >
          [RESET]
        </button>
      </header>

      <p
        className="px-4 pt-2 pb-3 text-[10px] uppercase text-terminal-text-faint"
        style={{ letterSpacing: '0.1em' }}
      >
        Filled here, used in every message. Stored locally.
      </p>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
        <Section title="ESSENTIALS" defaultOpen>
          <Field label="GENDER">
            <SegmentedButtons<Gender>
              value={lifterState.gender}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              onSelect={(g) => update('gender', g)}
            />
          </Field>

          <Field label="AGE (YEARS)">
            <NumberInput
              value={lifterState.ageYears}
              onValueChange={(n) => {
                if (n != null) update('ageYears', n);
              }}
              min={14}
              max={80}
              step={1}
            />
          </Field>

          <Field label={`HEIGHT (${heightUnit.toUpperCase()})`}>
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
          </Field>

          <Field label={`BODYWEIGHT (${weightUnit.toUpperCase()})`}>
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
          </Field>

          <Field label="PHASE">
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
          </Field>
        </Section>

        <Section title="DETAIL">
          <Field label="BODY FAT %" hint="optional — improves protein math">
            <NumberInput
              value={lifterState.bodyFatPercent}
              onValueChange={(v) => update('bodyFatPercent', v)}
              min={3}
              max={60}
              step={0.1}
            />
          </Field>

          <Field
            label="SHOW DATE"
            hint={
              showDateEnabled ? undefined : 'enabled when phase is Cut or Peak'
            }
          >
            <input
              type="date"
              disabled={!showDateEnabled}
              value={lifterState.showDateISO ?? ''}
              onChange={(e) =>
                update('showDateISO', e.target.value === '' ? null : e.target.value)
              }
              className={inputBase}
            />
          </Field>

          <Field
            label={`TARGET STAGE WEIGHT (${weightUnit.toUpperCase()})`}
            hint="optional"
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
          </Field>

          <Field
            label={`WEEKLY WT CHANGE (${weightUnit.toUpperCase()}/WK)`}
            hint="negative = losing"
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
          </Field>

          <Field label="SESSIONS / WEEK">
            <NumberInput
              value={lifterState.sessionsPerWeek}
              onValueChange={(v) => update('sessionsPerWeek', v)}
              min={0}
              max={14}
              step={1}
            />
          </Field>

          <Field label="TRAINING SPLIT">
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
          </Field>
        </Section>

        <Section title="NUTRITION_WELLBEING">
          <Field label="DAILY CALORIES (KCAL)">
            <NumberInput
              value={lifterState.dailyCalories}
              onValueChange={(v) => update('dailyCalories', v)}
              min={0}
              step={50}
            />
          </Field>
          <Field label="DAILY PROTEIN (G)">
            <NumberInput
              value={lifterState.dailyProteinG}
              onValueChange={(v) => update('dailyProteinG', v)}
              min={0}
              step={5}
            />
          </Field>
          <Field label="DAILY CARBS (G)">
            <NumberInput
              value={lifterState.dailyCarbsG}
              onValueChange={(v) => update('dailyCarbsG', v)}
              min={0}
              step={5}
            />
          </Field>
          <Field label="DAILY FAT (G)">
            <NumberInput
              value={lifterState.dailyFatG}
              onValueChange={(v) => update('dailyFatG', v)}
              min={0}
              step={5}
            />
          </Field>
          <Field label="ENERGY (1-10)">
            <NumberInput
              value={lifterState.energy1to10}
              onValueChange={(v) => update('energy1to10', v)}
              min={1}
              max={10}
              step={1}
            />
          </Field>
          <Field label="SLEEP HOURS">
            <NumberInput
              value={lifterState.sleepHours}
              onValueChange={(v) => update('sleepHours', v)}
              min={0}
              max={14}
              step={0.25}
            />
          </Field>
          <Field label="STRESS LEVEL (1-10)">
            <NumberInput
              value={lifterState.stressLevel1to10}
              onValueChange={(v) => update('stressLevel1to10', v)}
              min={1}
              max={10}
              step={1}
            />
          </Field>

          {lifterState.gender === 'female' && (
            <Field label="MENSTRUAL CYCLE PHASE">
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
            </Field>
          )}
        </Section>
      </div>
    </div>
  );
}

export default StatsSidebar;
