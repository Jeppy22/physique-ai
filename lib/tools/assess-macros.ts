import type { Gender, Phase } from '../types';

export interface AssessMacrosInput {
  bodyweightKg: number;
  bodyFatPercent: number | null; // if known, use lean body mass for protein calc
  ageYears: number;
  heightCm: number;
  phase: Phase;
  gender: Gender;
  sessionsPerWeek: number;
  currentCalories: number;
  currentProteinG: number;
  currentCarbsG: number;
  currentFatG: number;
}

export interface MacroRecommendation {
  recommendedProteinG: { min: number; max: number };
  recommendedFatG: { min: number; max: number };
  recommendedCarbsG: { min: number; max: number };
  estimatedTDEE: number;
  recommendedCalories: { min: number; max: number };
  proteinVerdict: 'too_low' | 'in_range' | 'higher_than_needed';
  calorieVerdict:
    | 'too_aggressive_deficit'
    | 'appropriate'
    | 'too_lenient'
    | 'surplus';
  fatVerdict: 'too_low_for_hormones' | 'in_range' | 'higher_than_needed';
  reasoning: string;
  citations: string[];
}

const CITATIONS = [
  'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
  'Helms ER, Zinn C, Rowlands DS, Brown SR. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127-138.',
  'Rossow LM, Fukuda DH, Fahs CA, Loenneke JP, Stout JR. Natural bodybuilding competition preparation and recovery: a 12-month case study. Int J Sports Physiol Perform. 2013;8(5):582-592.',
  'Trexler ET, Smith-Ryan AE, Norton LE. Metabolic adaptation to weight loss: implications for the athlete. J Int Soc Sports Nutr. 2014;11(1):7.',
  'Mifflin MD, St Jeor ST, Hill LA, Daugherty BJ, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
];

const round0 = (n: number) => Math.round(n);

function getActivityMultiplier(sessionsPerWeek: number): number {
  if (sessionsPerWeek <= 2) return 1.3;
  if (sessionsPerWeek <= 4) return 1.5;
  if (sessionsPerWeek === 5) return 1.7;
  return 1.9;
}

function getBMR(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === 'male' ? base + 5 : base - 161;
}

export function assessMacros(input: AssessMacrosInput): MacroRecommendation {
  const {
    bodyweightKg,
    bodyFatPercent,
    ageYears,
    heightCm,
    phase,
    gender,
    sessionsPerWeek,
    currentCalories,
    currentProteinG,
    currentFatG,
  } = input;

  const bmr = getBMR(gender, bodyweightKg, heightCm, ageYears);
  const tdee = bmr * getActivityMultiplier(sessionsPerWeek);
  const estimatedTDEE = round0(tdee);

  // Protein
  let proteinMin: number;
  let proteinMax: number;
  const lbmKnown = bodyFatPercent != null;
  const lbm = lbmKnown ? bodyweightKg * (1 - (bodyFatPercent as number) / 100) : null;

  if (phase === 'cut' || phase === 'peak_week') {
    if (lbm != null) {
      // Helms 2014: 2.3–3.1 g/kg LBM during caloric restriction in lean trained athletes
      proteinMin = 2.3 * lbm;
      proteinMax = 3.1 * lbm;
    } else {
      proteinMin = 1.8 * bodyweightKg;
      proteinMax = 2.4 * bodyweightKg;
    }
  } else if (phase === 'maintenance') {
    proteinMin = 1.6 * bodyweightKg;
    proteinMax = 2.2 * bodyweightKg;
  } else {
    // bulk
    proteinMin = 1.6 * bodyweightKg;
    proteinMax = 2.0 * bodyweightKg;
  }

  // Fat
  // Helms 2014, Rossow 2013: minimum ~0.5–0.6 g/kg to preserve hormonal function;
  // women under ~20% BF in aggressive deficits should stay closer to 0.8 g/kg.
  const aggressiveCut =
    phase === 'cut' && currentCalories > 0 && currentCalories < tdee * 0.8;
  const femaleLeanAggressive =
    gender === 'female' &&
    aggressiveCut &&
    (bodyFatPercent != null ? bodyFatPercent < 20 : true);
  const fatMinPerKg = femaleLeanAggressive ? 0.8 : gender === 'female' ? 0.6 : 0.5;
  const fatMaxPerKg = 1.2;
  const fatMin = fatMinPerKg * bodyweightKg;
  const fatMax = fatMaxPerKg * bodyweightKg;

  // Calories
  let calMin: number;
  let calMax: number;
  if (phase === 'cut') {
    // 15–25% deficit (Helms 2014, Trexler 2014: deeper deficits accelerate adaptation)
    calMin = tdee * 0.75;
    calMax = tdee * 0.85;
  } else if (phase === 'maintenance' || phase === 'peak_week') {
    calMin = tdee * 0.95;
    calMax = tdee * 1.05;
  } else {
    // bulk: 5–15% surplus
    calMin = tdee * 1.05;
    calMax = tdee * 1.15;
  }

  // Carbs: fill the remainder of the calorie envelope after protein + fat targets.
  // min carbs assume protein/fat are at the high end; max carbs assume both at the low end.
  const carbMin = Math.max(
    0,
    (calMin - proteinMax * 4 - fatMax * 9) / 4,
  );
  const carbMax = Math.max(
    carbMin,
    (calMax - proteinMin * 4 - fatMin * 9) / 4,
  );

  // Verdicts
  let proteinVerdict: MacroRecommendation['proteinVerdict'];
  if (currentProteinG < proteinMin) proteinVerdict = 'too_low';
  else if (currentProteinG > proteinMax) proteinVerdict = 'higher_than_needed';
  else proteinVerdict = 'in_range';

  let fatVerdict: MacroRecommendation['fatVerdict'];
  if (currentFatG < fatMin) fatVerdict = 'too_low_for_hormones';
  else if (currentFatG > fatMax) fatVerdict = 'higher_than_needed';
  else fatVerdict = 'in_range';

  let calorieVerdict: MacroRecommendation['calorieVerdict'];
  if (phase === 'cut') {
    if (currentCalories < calMin) calorieVerdict = 'too_aggressive_deficit';
    else if (currentCalories <= calMax) calorieVerdict = 'appropriate';
    else if (currentCalories < tdee * 0.98) calorieVerdict = 'too_lenient';
    else calorieVerdict = 'surplus';
  } else if (phase === 'bulk') {
    if (currentCalories < tdee * 0.95) calorieVerdict = 'too_aggressive_deficit';
    else if (currentCalories < calMin) calorieVerdict = 'too_lenient';
    else if (currentCalories <= calMax) calorieVerdict = 'appropriate';
    else calorieVerdict = 'surplus';
  } else {
    // maintenance or peak_week
    if (currentCalories < calMin) calorieVerdict = 'too_aggressive_deficit';
    else if (currentCalories <= calMax) calorieVerdict = 'appropriate';
    else if (currentCalories < tdee * 1.15) calorieVerdict = 'too_lenient';
    else calorieVerdict = 'surplus';
  }

  const reasoning =
    `Estimated TDEE ${round0(tdee)} kcal (Mifflin-St Jeor BMR ${round0(bmr)} × activity ${getActivityMultiplier(sessionsPerWeek)}). ` +
    `Protein target ${round0(proteinMin)}–${round0(proteinMax)} g ` +
    `(${lbmKnown ? `${phase === 'cut' || phase === 'peak_week' ? '2.3–3.1 g/kg LBM, Helms 2014' : 'g/kg bw'}` : 'g/kg bodyweight'}). ` +
    `Fat floor ${round0(fatMin)} g protects sex-hormone production (Rossow 2013).`;

  return {
    recommendedProteinG: { min: round0(proteinMin), max: round0(proteinMax) },
    recommendedFatG: { min: round0(fatMin), max: round0(fatMax) },
    recommendedCarbsG: { min: round0(carbMin), max: round0(carbMax) },
    estimatedTDEE,
    recommendedCalories: { min: round0(calMin), max: round0(calMax) },
    proteinVerdict,
    calorieVerdict,
    fatVerdict,
    reasoning,
    citations: CITATIONS,
  };
}
