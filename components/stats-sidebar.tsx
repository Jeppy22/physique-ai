'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Dumbbell, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Gender, LifterState, Phase, TrainingSplit } from '@/lib/types';
import {
  type HeightUnit,
  type WeightUnit,
  heightToCm,
  heightToDisplay,
  weightToDisplay,
  weightToKg,
} from '@/lib/units';

interface StatsSidebarProps {
  lifterState: LifterState;
  onChange: (next: LifterState) => void;
  onReset: () => void;
}

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
    <Input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={raw}
      className={className}
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
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-zinc-400">
        {label}
        {hint && <span className="text-zinc-600"> · {hint}</span>}
      </Label>
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
      className="group rounded-md border border-zinc-800 bg-zinc-900/30 [&[open]_.chev]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between select-none px-3 py-2.5 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="chev h-4 w-4 text-zinc-500 transition-transform" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-zinc-800 p-3">
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? 'default' : 'outline'}
          onClick={() => onSelect(opt.value)}
          className="h-7 px-2.5 text-xs"
        >
          {opt.label}
        </Button>
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
    <div className="flex gap-0.5 rounded-md border border-zinc-800 p-0.5">
      {units.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            value === u
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function SliderField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number | null;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-400">{label}</Label>
        <span className="text-xs tabular-nums text-zinc-300">
          {value ?? '—'} / 10
        </span>
      </div>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value ?? 5]}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v;
          if (typeof n === 'number') onValueChange(n);
        }}
      />
    </div>
  );
}

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
    <div className="flex h-full max-h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-zinc-300" />
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Your Stats
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100"
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
      </header>

      <p className="px-6 pt-3 pb-1 text-xs text-zinc-500">
        Filled in here, used in every message. Stored locally on this device.
      </p>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <Section title="Essentials" defaultOpen>
          <Field label="Gender">
            <SegmentedButtons<Gender>
              value={lifterState.gender}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              onSelect={(g) => update('gender', g)}
            />
          </Field>

          <Field label="Age (years)">
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

          <Field label={`Height (${heightUnit})`}>
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

          <Field label={`Bodyweight (${weightUnit})`}>
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

          <Field label="Phase">
            <SegmentedButtons<Phase>
              value={lifterState.phase}
              options={[
                { value: 'cut', label: 'Cut' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'bulk', label: 'Bulk' },
                { value: 'peak_week', label: 'Peak Week' },
              ]}
              onSelect={(p) => update('phase', p)}
            />
          </Field>
        </Section>

        <Section title="Detail">
          <Field label="Body fat %" hint="optional — improves protein math">
            <NumberInput
              value={lifterState.bodyFatPercent}
              onValueChange={(v) => update('bodyFatPercent', v)}
              min={3}
              max={60}
              step={0.1}
            />
          </Field>

          <Field
            label="Show date"
            hint={
              showDateEnabled
                ? undefined
                : 'available when phase is Cut or Peak Week'
            }
          >
            <Input
              type="date"
              disabled={!showDateEnabled}
              value={lifterState.showDateISO ?? ''}
              onChange={(e) =>
                update('showDateISO', e.target.value === '' ? null : e.target.value)
              }
              className="bg-zinc-900/40"
            />
          </Field>

          <Field label={`Target stage weight (${weightUnit})`} hint="optional">
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
            label={`Recent weekly weight change (${weightUnit}/wk)`}
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

          <Field label="Sessions per week">
            <NumberInput
              value={lifterState.sessionsPerWeek}
              onValueChange={(v) => update('sessionsPerWeek', v)}
              min={0}
              max={14}
              step={1}
            />
          </Field>

          <Field label="Training split">
            <Select
              value={lifterState.trainingSplit ?? undefined}
              onValueChange={(v) =>
                update('trainingSplit', v as TrainingSplit)
              }
            >
              <SelectTrigger className="w-full bg-zinc-900/40">
                <SelectValue placeholder="Select a split" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PPL">Push / Pull / Legs</SelectItem>
                <SelectItem value="upper_lower">Upper / Lower</SelectItem>
                <SelectItem value="bro_split">Bro Split</SelectItem>
                <SelectItem value="full_body">Full Body</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Nutrition + Wellbeing">
          <Field label="Daily calories (kcal)">
            <NumberInput
              value={lifterState.dailyCalories}
              onValueChange={(v) => update('dailyCalories', v)}
              min={0}
              step={50}
            />
          </Field>
          <Field label="Daily protein (g)">
            <NumberInput
              value={lifterState.dailyProteinG}
              onValueChange={(v) => update('dailyProteinG', v)}
              min={0}
              step={5}
            />
          </Field>
          <Field label="Daily carbs (g)">
            <NumberInput
              value={lifterState.dailyCarbsG}
              onValueChange={(v) => update('dailyCarbsG', v)}
              min={0}
              step={5}
            />
          </Field>
          <Field label="Daily fat (g)">
            <NumberInput
              value={lifterState.dailyFatG}
              onValueChange={(v) => update('dailyFatG', v)}
              min={0}
              step={5}
            />
          </Field>

          <SliderField
            label="Energy"
            value={lifterState.energy1to10}
            onValueChange={(v) => update('energy1to10', v)}
          />

          <Field label="Sleep hours">
            <NumberInput
              value={lifterState.sleepHours}
              onValueChange={(v) => update('sleepHours', v)}
              min={0}
              max={14}
              step={0.25}
            />
          </Field>

          <SliderField
            label="Stress level"
            value={lifterState.stressLevel1to10}
            onValueChange={(v) => update('stressLevel1to10', v)}
          />

          {lifterState.gender === 'female' && (
            <Field label="Menstrual cycle phase">
              <Select
                value={lifterState.menstrualCyclePhase ?? undefined}
                onValueChange={(v) =>
                  update(
                    'menstrualCyclePhase',
                    v as LifterState['menstrualCyclePhase'],
                  )
                }
              >
                <SelectTrigger className="w-full bg-zinc-900/40">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follicular">Follicular</SelectItem>
                  <SelectItem value="ovulation">Ovulation</SelectItem>
                  <SelectItem value="luteal">Luteal</SelectItem>
                  <SelectItem value="menstrual">Menstrual</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </Section>
      </div>
    </div>
  );
}

export default StatsSidebar;
