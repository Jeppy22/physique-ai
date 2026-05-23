import type { Gender } from '../types';

export interface WeightTrajectoryInput {
  currentBodyweightKg: number;
  targetBodyweightKg: number;
  weeksUntilTarget: number;
  recentWeeklyChangeKg: number; // negative = losing
  gender: Gender;
}

export interface WeeklyProjection {
  weekIndex: number; // 0 = current week
  projectedBodyweightKg: number;
  weeklyChangeKg: number;
  percentBodyweightChange: number;
  flag: 'safe' | 'aggressive' | 'unsafe';
}

export interface WeightTrajectoryOutput {
  projections: WeeklyProjection[];
  reachesTarget: boolean;
  weeksToTarget: number | null; // null if unreachable at current rate
  averageRatePercentPerWeek: number;
  verdict: 'on_track' | 'too_aggressive' | 'too_slow' | 'unreachable_safely';
  reasoning: string;
  citations: string[];
}

const CITATIONS = [
  'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
  'Mitchell L, Slater G, Hackett D, Johnson N, O\'Connor H. Physiological implications of preparing for a natural male bodybuilding contest. Eur J Sport Sci. 2018;18(5):619-629.',
  'Trexler ET, Smith-Ryan AE, Norton LE. Metabolic adaptation to weight loss: implications for the athlete. J Int Soc Sports Nutr. 2014;11(1):7.',
  'Rossow LM, Fukuda DH, Fahs CA, Loenneke JP, Stout JR. Natural bodybuilding competition preparation and recovery: a 12-month case study. Int J Sports Physiol Perform. 2013;8(5):582-592.',
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function flagForPercent(pct: number): 'safe' | 'aggressive' | 'unsafe' {
  // Helms 2014 / Mitchell 2018: 0.5–1.0%/week is the safe loss range. Above 1.0%
  // accelerates lean mass loss; above ~1.5% is consistently associated with
  // performance decline and hormonal disruption.
  if (pct > 1.5) return 'unsafe';
  if (pct > 1.0) return 'aggressive';
  return 'safe';
}

export function projectWeightTrajectory(
  input: WeightTrajectoryInput,
): WeightTrajectoryOutput {
  const {
    currentBodyweightKg,
    targetBodyweightKg,
    weeksUntilTarget,
    recentWeeklyChangeKg,
    gender,
  } = input;

  const weightDeltaToTarget = targetBodyweightKg - currentBodyweightKg;
  const cutting = weightDeltaToTarget < -0.05;
  const bulking = weightDeltaToTarget > 0.05;
  const directionMatch =
    (cutting && recentWeeklyChangeKg < 0) ||
    (bulking && recentWeeklyChangeKg > 0) ||
    (!cutting && !bulking);

  const projections: WeeklyProjection[] = [];
  let bw = currentBodyweightKg;
  for (let i = 0; i <= weeksUntilTarget; i++) {
    if (i === 0) {
      projections.push({
        weekIndex: 0,
        projectedBodyweightKg: round1(currentBodyweightKg),
        weeklyChangeKg: 0,
        percentBodyweightChange: 0,
        flag: 'safe',
      });
      continue;
    }
    const prevBw = bw;
    bw = prevBw + recentWeeklyChangeKg;
    const pct = prevBw > 0 ? Math.abs(recentWeeklyChangeKg / prevBw) * 100 : 0;
    projections.push({
      weekIndex: i,
      projectedBodyweightKg: round1(bw),
      weeklyChangeKg: round2(recentWeeklyChangeKg),
      percentBodyweightChange: round2(pct),
      flag: flagForPercent(pct),
    });
  }

  const finalProjectedBw =
    currentBodyweightKg + weeksUntilTarget * recentWeeklyChangeKg;

  let reachesTarget = false;
  if (cutting) reachesTarget = finalProjectedBw <= targetBodyweightKg + 0.1;
  else if (bulking) reachesTarget = finalProjectedBw >= targetBodyweightKg - 0.1;
  else reachesTarget = true;

  let weeksToTarget: number | null = null;
  if (directionMatch && Math.abs(recentWeeklyChangeKg) > 0.001 && (cutting || bulking)) {
    weeksToTarget = Math.ceil(
      Math.abs(weightDeltaToTarget / recentWeeklyChangeKg),
    );
  }

  const currentPercentRate =
    currentBodyweightKg > 0
      ? Math.abs(recentWeeklyChangeKg / currentBodyweightKg) * 100
      : 0;
  const requiredWeeklyChange =
    weeksUntilTarget > 0 ? weightDeltaToTarget / weeksUntilTarget : 0;
  const requiredPercentRate =
    currentBodyweightKg > 0
      ? Math.abs(requiredWeeklyChange / currentBodyweightKg) * 100
      : 0;

  let verdict: WeightTrajectoryOutput['verdict'];
  let reasoning: string;

  const femaleNote =
    gender === 'female'
      ? ' Female lifters are particularly sensitive to aggressive deficits — Rossow 2013 documented marked hormonal disruption at sustained high rates.'
      : '';

  if (!directionMatch && (cutting || bulking)) {
    verdict = 'unreachable_safely';
    reasoning =
      'Current trajectory is moving away from the target. Reverse direction before assessing rate.';
  } else if (currentPercentRate > 1.0) {
    verdict = 'too_aggressive';
    reasoning =
      `Current rate of ${currentPercentRate.toFixed(2)}%/week exceeds the 0.5–1.0%/week safe ceiling. ` +
      `Sustained loss above 1.0% accelerates lean mass loss and metabolic adaptation (Helms 2014, Mitchell 2018, Trexler 2014).` +
      femaleNote;
  } else if (reachesTarget) {
    verdict = 'on_track';
    reasoning =
      `Current rate of ${currentPercentRate.toFixed(2)}%/week sits inside the 0.5–1.0% safe range and reaches the target in the projected window (Helms 2014).`;
  } else if (requiredPercentRate > 1.0) {
    verdict = 'unreachable_safely';
    reasoning =
      `Reaching target in ${weeksUntilTarget} weeks would require ${requiredPercentRate.toFixed(2)}%/week, above the 1.0%/week safe ceiling. ` +
      `Extend the timeline or revise the target weight.` +
      femaleNote;
  } else {
    verdict = 'too_slow';
    reasoning =
      `Current rate of ${currentPercentRate.toFixed(2)}%/week is safe but will not reach target in ${weeksUntilTarget} weeks. ` +
      `Required rate is ${requiredPercentRate.toFixed(2)}%/week — still within the safe band, modest increase warranted.`;
  }

  return {
    projections,
    reachesTarget,
    weeksToTarget,
    averageRatePercentPerWeek: round2(currentPercentRate),
    verdict,
    reasoning,
    citations: CITATIONS,
  };
}
