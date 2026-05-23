'use client';

import type {
  MuscleGroup,
  MuscleGroupAssessment,
  MuscleRating,
} from '@/lib/types';

const RATING_LABEL: Record<MuscleRating, string> = {
  NEEDS_WORK: 'NEEDS WORK',
  DEVELOPING: 'DEVELOPING',
  SOLID: 'SOLID',
  STRONG: 'STRONG',
  STAGE_READY: 'STAGE-READY',
};

const RATING_COLOR_CLASS: Record<MuscleRating, string> = {
  NEEDS_WORK: 'text-terminal-red',
  DEVELOPING: 'text-terminal-amber-dim',
  SOLID: 'text-terminal-amber',
  STRONG: 'text-terminal-text',
  STAGE_READY: 'text-terminal-green',
};

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'CHEST',
  shoulders: 'SHOULDERS',
  arms: 'ARMS',
  abs: 'ABS',
  lats: 'LATS',
  back_thickness: 'BACK THICKNESS',
  rear_delts: 'REAR DELTS',
  triceps: 'TRICEPS',
  chest_depth: 'CHEST DEPTH',
  shoulder_cap: 'SHOULDER CAP',
  quads: 'QUADS',
  hamstrings: 'HAMSTRINGS',
  glutes: 'GLUTES',
  calves: 'CALVES',
};

function groupLabel(group: string): string {
  return (GROUP_LABEL as Record<string, string | undefined>)[group] ?? group.toUpperCase();
}

interface Props {
  ratings: MuscleGroupAssessment[];
}

export function MuscleRatingsTable({ ratings }: Props) {
  return (
    <div className="mt-4 border-t border-terminal-border pt-3">
      <div
        className="mb-2 text-[11px] font-bold uppercase text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        &gt; MUSCLE_GROUP_RATINGS
      </div>
      <div className="flex flex-col gap-1.5 font-mono text-xs">
        {ratings.map((r) => (
          <div
            key={r.group}
            className="grid items-baseline gap-3 sm:grid-cols-[140px_140px_1fr]"
          >
            <div
              className="text-[10px] uppercase text-terminal-text-dim"
              style={{ letterSpacing: '0.1em' }}
            >
              {groupLabel(r.group)}
            </div>
            <div
              className={`text-[11px] font-bold uppercase ${RATING_COLOR_CLASS[r.rating]}`}
              style={{ letterSpacing: '0.1em' }}
            >
              {RATING_LABEL[r.rating]}
            </div>
            <div className="text-[11px] leading-relaxed text-terminal-text-dim">
              {r.note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MuscleRatingsTable;
