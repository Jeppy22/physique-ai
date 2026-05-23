'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrambleText } from './scramble-text';
import type { Gender, LifterState, Phase } from '@/lib/types';
import {
  type HeightUnit,
  type WeightUnit,
  heightToCm,
  heightToDisplay,
  weightToDisplay,
  weightToKg,
} from '@/lib/units';
import { cn } from '@/lib/utils';

/* ---------- props ---------- */

interface OnboardingWizardProps {
  initialState: LifterState;
  mode: 'first-visit' | 'edit';
  onComplete: (state: LifterState) => void;
  onCancel?: () => void;
}

/* ---------- shared styles (slightly larger than the bar) ---------- */

const inputBase =
  'block w-full border border-terminal-border bg-terminal-bg-elevated text-terminal-text placeholder:text-terminal-text-faint px-3 py-2 text-[14px] focus:border-terminal-amber focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
const inputNum = `${inputBase} text-right tabular-nums`;

/* ---------- primitives ---------- */

interface NumberInputProps {
  value: number | null;
  onValueChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  large?: boolean;
  className?: string;
  placeholder?: string;
}

function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  large,
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
      className={cn(
        large ? `${inputBase} text-center text-[24px] tabular-nums` : inputNum,
        className,
      )}
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

function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label
      className="text-[10px] font-medium uppercase text-terminal-text-dim"
      style={{ letterSpacing: '0.1em' }}
    >
      {children}
      {hint && (
        <span className="ml-1 normal-case tracking-normal text-terminal-text-faint">
          · {hint}
        </span>
      )}
    </label>
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
            'relative border px-4 py-2 text-[12px] font-medium uppercase transition-colors',
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
            'text-[11px] font-medium uppercase',
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
        className={cn(inputBase, 'cursor-pointer appearance-none pr-8')}
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
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-terminal-amber">
        ▼
      </span>
    </div>
  );
}

/* ---------- validation ---------- */

function canAdvance(step: number, state: LifterState): boolean {
  if (step === 0) {
    return (
      state.ageYears >= 14 &&
      state.ageYears <= 80 &&
      state.heightCm >= 100 &&
      state.heightCm <= 250 &&
      state.bodyweightKg >= 30 &&
      state.bodyweightKg <= 300
    );
  }
  if (step === 1) {
    return state.sessionsPerWeek != null && state.sessionsPerWeek >= 0;
  }
  return true; // step 2 all optional
}

const TITLES = ['WHO ARE YOU', "WHAT'S YOUR GOAL", 'WHAT ARE YOU EATING'];
const SUBHEADS = [
  'BASIC PROFILE_DATA',
  'TRAINING PHASE + TARGET',
  'CURRENT DAILY MACROS',
];

/* ---------- wizard ---------- */

export function OnboardingWizard({
  initialState,
  mode,
  onComplete,
  onCancel,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [draft, setDraft] = useState<LifterState>(initialState);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const modalRef = useRef<HTMLDivElement>(null);

  function update<K extends keyof LifterState>(key: K, value: LifterState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Escape closes (EDIT mode only)
  useEffect(() => {
    if (mode === 'first-visit') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, onCancel]);

  // Focus first element on each step + basic tab trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const getFocusables = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
        ),
      );

    const focusables = getFocusables();
    focusables[0]?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    modal.addEventListener('keydown', handler);
    return () => modal.removeEventListener('keydown', handler);
  }, [step]);

  const onBackdropClick = (e: React.MouseEvent) => {
    if (mode === 'first-visit') return;
    if (e.target === e.currentTarget) onCancel?.();
  };

  const canNext = canAdvance(step, draft);
  const showDateFields = draft.phase === 'cut';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-terminal-black/90 sm:items-center sm:p-4"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col bg-terminal-bg-elevated sm:max-h-[90vh] sm:max-w-[600px] sm:border sm:border-terminal-border"
      >
        {/* HEADER */}
        <header className="border-b border-terminal-border p-6">
          <div
            className="text-[14px] font-bold uppercase text-terminal-amber"
            style={{ letterSpacing: '0.15em' }}
          >
            <ScrambleText text={`> ${TITLES[step]}`} duration={400} />
          </div>
          <div
            className="mt-1 text-[11px] uppercase text-terminal-text-dim"
            style={{ letterSpacing: '0.1em' }}
          >
            {SUBHEADS[step]}
          </div>
          <div className="mt-4 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  i <= step ? 'bg-terminal-amber' : 'bg-terminal-border',
                )}
              />
            ))}
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>GENDER</Label>
                <SegmentedButtons<Gender>
                  value={draft.gender}
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                  onSelect={(g) => update('gender', g)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>AGE</Label>
                <div className="flex items-baseline gap-3">
                  <NumberInput
                    value={draft.ageYears}
                    onValueChange={(n) => {
                      if (n != null) update('ageYears', n);
                    }}
                    min={14}
                    max={80}
                    step={1}
                    large
                    className="max-w-[140px]"
                  />
                  <span
                    className="text-[11px] uppercase text-terminal-text-dim"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    YRS
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>HEIGHT</Label>
                <div className="flex items-center gap-3">
                  <NumberInput
                    value={heightToDisplay(draft.heightCm, heightUnit)}
                    onValueChange={(v) => {
                      if (v == null) return;
                      const cm = heightToCm(v, heightUnit);
                      if (cm != null) update('heightCm', cm);
                    }}
                    step={0.1}
                    className="max-w-[200px] flex-1"
                  />
                  <UnitToggle<HeightUnit>
                    value={heightUnit}
                    units={['cm', 'in']}
                    onChange={setHeightUnit}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>BODYWEIGHT</Label>
                <div className="flex items-center gap-3">
                  <NumberInput
                    value={weightToDisplay(draft.bodyweightKg, weightUnit)}
                    onValueChange={(v) => {
                      if (v == null) return;
                      const kg = weightToKg(v, weightUnit);
                      if (kg != null) update('bodyweightKg', kg);
                    }}
                    step={0.1}
                    className="max-w-[200px] flex-1"
                  />
                  <UnitToggle<WeightUnit>
                    value={weightUnit}
                    units={['kg', 'lb']}
                    onChange={setWeightUnit}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>PHASE</Label>
                <SegmentedButtons<Phase>
                  value={draft.phase}
                  options={[
                    { value: 'cut', label: 'Cut' },
                    { value: 'maintenance', label: 'Maintenance' },
                    { value: 'bulk', label: 'Bulk' },
                  ]}
                  onSelect={(p) => update('phase', p)}
                />
              </div>

              {showDateFields && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label hint="if you have one">SHOW DATE</Label>
                    <input
                      type="date"
                      value={draft.showDateISO ?? ''}
                      onChange={(e) =>
                        update(
                          'showDateISO',
                          e.target.value === '' ? null : e.target.value,
                        )
                      }
                      className={inputBase}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label hint="optional">
                      TARGET STAGE WEIGHT ({weightUnit.toUpperCase()})
                    </Label>
                    <div className="flex items-center gap-3">
                      <NumberInput
                        value={weightToDisplay(
                          draft.targetStageWeightKg,
                          weightUnit,
                        )}
                        onValueChange={(v) =>
                          update(
                            'targetStageWeightKg',
                            v != null ? weightToKg(v, weightUnit) : null,
                          )
                        }
                        step={0.1}
                        className="max-w-[200px] flex-1"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>SESSIONS PER WEEK</Label>
                <NumberInput
                  value={draft.sessionsPerWeek}
                  onValueChange={(v) => update('sessionsPerWeek', v)}
                  min={0}
                  max={14}
                  step={1}
                  className="max-w-[140px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label hint="improves protein math when known">BODY FAT %</Label>
                <NumberInput
                  value={draft.bodyFatPercent}
                  onValueChange={(v) => update('bodyFatPercent', v)}
                  min={3}
                  max={60}
                  step={0.1}
                  className="max-w-[140px]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div
                className="text-[11px] uppercase text-terminal-text-dim"
                style={{ letterSpacing: '0.1em' }}
              >
                OPTIONAL — SKIP IF YOU&apos;LL FIGURE THIS OUT LATER
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>CALORIES (KCAL)</Label>
                  <NumberInput
                    value={draft.dailyCalories}
                    onValueChange={(v) => update('dailyCalories', v)}
                    min={0}
                    step={50}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>PROTEIN (G)</Label>
                  <NumberInput
                    value={draft.dailyProteinG}
                    onValueChange={(v) => update('dailyProteinG', v)}
                    min={0}
                    step={5}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>CARBS (G)</Label>
                  <NumberInput
                    value={draft.dailyCarbsG}
                    onValueChange={(v) => update('dailyCarbsG', v)}
                    min={0}
                    step={5}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>FAT (G)</Label>
                  <NumberInput
                    value={draft.dailyFatG}
                    onValueChange={(v) => update('dailyFatG', v)}
                    min={0}
                    step={5}
                  />
                </div>
              </div>

              {draft.gender === 'female' && (
                <div className="flex flex-col gap-1.5">
                  <Label hint="optional">MENSTRUAL CYCLE PHASE</Label>
                  <TerminalSelect<NonNullable<LifterState['menstrualCyclePhase']>>
                    value={draft.menstrualCyclePhase}
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="flex items-center justify-between border-t border-terminal-border p-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
              className="text-[11px] font-bold uppercase text-terminal-text-dim transition-colors hover:text-terminal-text"
              style={{ letterSpacing: '0.15em' }}
            >
              [◂ BACK]
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-5">
            {step === 2 && (
              <button
                type="button"
                onClick={() => onComplete(draft)}
                className="text-[11px] font-bold uppercase text-terminal-text-dim transition-colors hover:text-terminal-text"
                style={{ letterSpacing: '0.15em' }}
              >
                [SKIP]
              </button>
            )}
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                if (step < 2) setStep((s) => (s + 1) as 0 | 1 | 2);
                else onComplete(draft);
              }}
              className={cn(
                'text-[11px] font-bold uppercase transition-colors',
                canNext
                  ? 'text-terminal-amber hover:brightness-125'
                  : 'cursor-not-allowed text-terminal-text-faint',
              )}
              style={{ letterSpacing: '0.15em' }}
            >
              {step === 2 ? '[FINISH ▸]' : '[CONTINUE ▸]'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default OnboardingWizard;
