import type { Gender } from '../types';

export interface WarningSignsInput {
  gender: Gender;
  weeksIntoCut: number;
  energy1to10: number;
  sleepHours: number;
  stressLevel1to10: number;
  trainingPerformance1to10: number; // subjective
  hungerLevel1to10: number;
  libido1to10: number | null;
  moodLow: boolean;
  menstrualCycleStatus?: 'regular' | 'irregular' | 'absent_3_plus_months' | null; // female only
  recentWeeklyWeightChangeKg: number;
  bodyweightKg: number;
}

export interface WarningSignsOutput {
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  flags: {
    flag: string;
    explanation: string;
    severity: 'mild' | 'moderate' | 'severe';
  }[];
  recommendation:
    | 'continue_as_planned'
    | 'monitor_closely'
    | 'deload_or_diet_break'
    | 'pull_back_significantly'
    | 'seek_medical_attention';
  reasoning: string;
  citations: string[];
}

const CITATIONS = [
  'Rossow LM, Fukuda DH, Fahs CA, Loenneke JP, Stout JR. Natural bodybuilding competition preparation and recovery: a 12-month case study. Int J Sports Physiol Perform. 2013;8(5):582-592.',
  'Trexler ET, Smith-Ryan AE, Norton LE. Metabolic adaptation to weight loss: implications for the athlete. J Int Soc Sports Nutr. 2014;11(1):7.',
  'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
];

export function flagWarningSigns(input: WarningSignsInput): WarningSignsOutput {
  const {
    gender,
    weeksIntoCut,
    energy1to10,
    sleepHours,
    stressLevel1to10,
    trainingPerformance1to10,
    hungerLevel1to10,
    libido1to10,
    moodLow,
    menstrualCycleStatus,
    recentWeeklyWeightChangeKg,
    bodyweightKg,
  } = input;

  const flags: WarningSignsOutput['flags'] = [];

  // Severe — amenorrhea (Rossow 2013): functional hypothalamic amenorrhea is a
  // recognized risk of aggressive female contest prep.
  if (gender === 'female' && menstrualCycleStatus === 'absent_3_plus_months') {
    flags.push({
      flag: 'Amenorrhea (3+ months)',
      explanation:
        'Absent menstrual cycle for 3+ months suggests functional hypothalamic amenorrhea — a documented consequence of low energy availability and aggressive contest prep. Medical evaluation indicated.',
      severity: 'severe',
    });
  }

  // Severe — male libido zero (sex hormone suppression)
  if (gender === 'male' && libido1to10 != null && libido1to10 === 0) {
    flags.push({
      flag: 'Libido absent',
      explanation:
        'Reported libido of 0 in a male lifter suggests significant suppression of sex hormones — a recognized consequence of prolonged energy deficit (Rossow 2013).',
      severity: 'severe',
    });
  }

  // Severe — sustained excessive weight loss
  const weeklyLossPct =
    bodyweightKg > 0
      ? Math.abs(recentWeeklyWeightChangeKg / bodyweightKg) * 100
      : 0;
  const losing = recentWeeklyWeightChangeKg < 0;
  if (losing && weeklyLossPct > 1.5 && weeksIntoCut >= 3) {
    flags.push({
      flag: 'Excessive sustained weight loss',
      explanation:
        `Weight loss of ${weeklyLossPct.toFixed(2)}%/week sustained ${weeksIntoCut} weeks exceeds the 1.5%/week ceiling. Sustained losses at this rate accelerate lean mass loss and metabolic adaptation (Helms 2014, Trexler 2014).`,
      severity: 'severe',
    });
  } else if (losing && weeklyLossPct > 1.5) {
    flags.push({
      flag: 'Aggressive weight loss rate',
      explanation: `Current rate of ${weeklyLossPct.toFixed(2)}%/week is above the 1.5% ceiling, but cut is only ${weeksIntoCut} weeks in — monitor closely; treat as severe if sustained 3+ weeks.`,
      severity: 'moderate',
    });
  }

  // Severe — chronic sleep deprivation
  if (sleepHours < 5) {
    flags.push({
      flag: 'Severe sleep deprivation',
      explanation:
        'Sleep below 5 hours significantly impairs recovery, hormonal regulation, and insulin sensitivity. If sustained 7+ days, this is a stop-and-reassess signal.',
      severity: 'severe',
    });
  } else if (sleepHours < 6) {
    flags.push({
      flag: 'Mild sleep deficit',
      explanation: 'Sleep of 5–6 hours is below optimal; monitor recovery markers.',
      severity: 'mild',
    });
  }

  // Moderate — energy + training performance both low (metabolic adaptation signal)
  if (energy1to10 <= 3 && trainingPerformance1to10 <= 4) {
    flags.push({
      flag: 'Energy and performance collapse',
      explanation:
        'Energy ≤3 combined with training performance ≤4 is the classic profile of metabolic adaptation (Trexler 2014). A diet break or refeed is typically warranted.',
      severity: 'moderate',
    });
  } else if (energy1to10 >= 4 && energy1to10 <= 5) {
    flags.push({
      flag: 'Reduced energy',
      explanation: 'Energy of 4–5/10 — mild deficit symptom, monitor for further decline.',
      severity: 'mild',
    });
  }

  // Moderate — hunger
  if (hungerLevel1to10 >= 8) {
    flags.push({
      flag: 'Extreme hunger',
      explanation:
        'Sustained hunger ≥8/10 raises adherence risk and signals ghrelin/leptin disruption — a diet break may restore appetite signaling (Trexler 2014).',
      severity: 'moderate',
    });
  } else if (hungerLevel1to10 >= 6) {
    flags.push({
      flag: 'Elevated hunger',
      explanation: 'Hunger of 6–7/10 is uncomfortable but tolerable; monitor.',
      severity: 'mild',
    });
  }

  // Moderate — persistent low mood
  if (moodLow) {
    flags.push({
      flag: 'Persistent low mood',
      explanation:
        'Sustained low mood is a recognized consequence of prolonged caloric restriction. If it persists more than 1–2 weeks, consider a diet break and screen for clinical concerns.',
      severity: 'moderate',
    });
  }

  // Moderate — irregular cycle (female)
  if (gender === 'female' && menstrualCycleStatus === 'irregular') {
    flags.push({
      flag: 'Irregular menstrual cycle',
      explanation:
        'Cycle irregularity during prep can precede amenorrhea (Rossow 2013). Pull back deficit and monitor; consider clinical evaluation if it progresses.',
      severity: 'moderate',
    });
  }

  // Moderate — high stress
  if (stressLevel1to10 >= 8) {
    flags.push({
      flag: 'High life stress',
      explanation:
        'Self-reported stress ≥8/10 compounds the physiological stress of contest prep and accelerates adaptation (Trexler 2014).',
      severity: 'moderate',
    });
  }

  // Severity aggregation
  let severity: WarningSignsOutput['severity'] = 'none';
  if (flags.some((f) => f.severity === 'severe')) severity = 'severe';
  else if (flags.some((f) => f.severity === 'moderate')) severity = 'moderate';
  else if (flags.some((f) => f.severity === 'mild')) severity = 'mild';

  // Recommendation
  let recommendation: WarningSignsOutput['recommendation'];
  const hasAmenorrhea = flags.some((f) => f.flag === 'Amenorrhea (3+ months)');
  const hasLibidoZero = flags.some((f) => f.flag === 'Libido absent');
  const hasSevereSleep = flags.some(
    (f) => f.flag === 'Severe sleep deprivation',
  );
  const hasExcessiveLoss = flags.some(
    (f) => f.flag === 'Excessive sustained weight loss',
  );
  const moderateCount = flags.filter((f) => f.severity === 'moderate').length;
  const mildCount = flags.filter((f) => f.severity === 'mild').length;

  if (hasAmenorrhea || hasLibidoZero || hasSevereSleep) {
    recommendation = 'seek_medical_attention';
  } else if (hasExcessiveLoss) {
    recommendation = 'pull_back_significantly';
  } else if (moderateCount >= 2) {
    recommendation = 'deload_or_diet_break';
  } else if (moderateCount === 1) {
    recommendation = 'monitor_closely';
  } else if (mildCount >= 2) {
    recommendation = 'monitor_closely';
  } else {
    recommendation = 'continue_as_planned';
  }

  const reasoning =
    flags.length === 0
      ? 'No warning flags detected. Wellness markers are within expected ranges; continue current plan with normal monitoring.'
      : `Detected ${flags.length} flag(s) (${flags.filter((f) => f.severity === 'severe').length} severe, ${moderateCount} moderate, ${mildCount} mild). ` +
        `Recommendation reflects the highest-severity flags and the count of moderate findings (Rossow 2013, Trexler 2014, Helms 2014).`;

  return {
    severity,
    flags,
    recommendation,
    reasoning,
    citations: CITATIONS,
  };
}
