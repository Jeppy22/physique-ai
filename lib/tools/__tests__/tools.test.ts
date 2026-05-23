import { describe, it, expect } from 'vitest';
import {
  projectWeightTrajectory,
  assessMacros,
  generatePeakWeek,
  flagWarningSigns,
  analyzePhysique,
} from '../index';

describe('projectWeightTrajectory', () => {
  it('80kg lifter losing 0.4kg/week reaches 76kg in 10 weeks — on_track, all weeks safe', () => {
    const out = projectWeightTrajectory({
      currentBodyweightKg: 80,
      targetBodyweightKg: 76,
      weeksUntilTarget: 10,
      recentWeeklyChangeKg: -0.4,
      gender: 'male',
    });
    expect(out.verdict).toBe('on_track');
    expect(out.reachesTarget).toBe(true);
    expect(out.projections.every((p) => p.flag === 'safe')).toBe(true);
    expect(out.averageRatePercentPerWeek).toBeCloseTo(0.5, 2);
    expect(out.citations.length).toBeGreaterThan(0);
  });

  it('80kg lifter losing 1.0kg/week (1.25%/wk) flags aggressive — verdict too_aggressive', () => {
    const out = projectWeightTrajectory({
      currentBodyweightKg: 80,
      targetBodyweightKg: 75,
      weeksUntilTarget: 5,
      recentWeeklyChangeKg: -1.0,
      gender: 'male',
    });
    expect(out.verdict).toBe('too_aggressive');
    expect(out.projections.some((p) => p.flag === 'aggressive')).toBe(true);
    expect(out.projections.every((p) => p.flag !== 'unsafe')).toBe(true);
  });

  it('80kg lifter losing 1.5kg/week (1.875%/wk) flags unsafe — verdict too_aggressive', () => {
    const out = projectWeightTrajectory({
      currentBodyweightKg: 80,
      targetBodyweightKg: 72.5,
      weeksUntilTarget: 5,
      recentWeeklyChangeKg: -1.5,
      gender: 'female',
    });
    expect(out.verdict).toBe('too_aggressive');
    expect(out.projections.some((p) => p.flag === 'unsafe')).toBe(true);
  });

  it('80kg target 75kg in 4 weeks at -0.3kg/week → unreachable_safely (required 1.56%/wk)', () => {
    const out = projectWeightTrajectory({
      currentBodyweightKg: 80,
      targetBodyweightKg: 75,
      weeksUntilTarget: 4,
      recentWeeklyChangeKg: -0.3,
      gender: 'male',
    });
    expect(out.verdict).toBe('unreachable_safely');
    expect(out.reachesTarget).toBe(false);
  });

  it('week 0 always reports zero change and safe flag', () => {
    const out = projectWeightTrajectory({
      currentBodyweightKg: 80,
      targetBodyweightKg: 76,
      weeksUntilTarget: 4,
      recentWeeklyChangeKg: -0.5,
      gender: 'male',
    });
    expect(out.projections[0]).toMatchObject({
      weekIndex: 0,
      weeklyChangeKg: 0,
      percentBodyweightChange: 0,
      flag: 'safe',
    });
  });
});

describe('assessMacros', () => {
  it('80kg male, 12% BF, cutting, 4 sessions, 2000 cal / 180g protein — protein in_range, calorie appropriate', () => {
    const out = assessMacros({
      bodyweightKg: 80,
      bodyFatPercent: 12,
      ageYears: 30,
      heightCm: 175,
      phase: 'cut',
      gender: 'male',
      sessionsPerWeek: 4,
      currentCalories: 2000,
      currentProteinG: 180,
      currentCarbsG: 185,
      currentFatG: 60,
    });
    expect(out.proteinVerdict).toBe('in_range');
    expect(out.calorieVerdict).toBe('appropriate');
    expect(out.estimatedTDEE).toBeGreaterThan(2500);
    expect(out.estimatedTDEE).toBeLessThan(2700);
    expect(out.citations.length).toBeGreaterThan(0);
  });

  it('60kg female, 18% BF, cutting, 5 sessions, 1200 cal / 90g protein — protein too_low, calorie too_aggressive_deficit', () => {
    const out = assessMacros({
      bodyweightKg: 60,
      bodyFatPercent: 18,
      ageYears: 30,
      heightCm: 165,
      phase: 'cut',
      gender: 'female',
      sessionsPerWeek: 5,
      currentCalories: 1200,
      currentProteinG: 90,
      currentCarbsG: 135,
      currentFatG: 50,
    });
    expect(out.proteinVerdict).toBe('too_low');
    expect(out.calorieVerdict).toBe('too_aggressive_deficit');
  });

  it('80kg male, bulk phase, 4 sessions, 2500 cal / 160g protein — protein in_range, calorie too_lenient (sub-surplus)', () => {
    const out = assessMacros({
      bodyweightKg: 80,
      bodyFatPercent: 15,
      ageYears: 30,
      heightCm: 175,
      phase: 'bulk',
      gender: 'male',
      sessionsPerWeek: 4,
      currentCalories: 2500,
      currentProteinG: 160,
      currentCarbsG: 320,
      currentFatG: 70,
    });
    expect(out.proteinVerdict).toBe('in_range');
    // 2500 is below TDEE*1.05 (≈2754) but above TDEE*0.95 — surplus phase wants more food
    expect(out.calorieVerdict).toBe('too_lenient');
  });

  it('65kg female cutting with 30g fat — fat too_low_for_hormones', () => {
    const out = assessMacros({
      bodyweightKg: 65,
      bodyFatPercent: 22,
      ageYears: 30,
      heightCm: 165,
      phase: 'cut',
      gender: 'female',
      sessionsPerWeek: 4,
      currentCalories: 1500,
      currentProteinG: 120,
      currentCarbsG: 150,
      currentFatG: 30,
    });
    expect(out.fatVerdict).toBe('too_low_for_hormones');
  });

  it('uses LBM-based protein when bodyFatPercent is known (cut phase)', () => {
    const withBF = assessMacros({
      bodyweightKg: 80,
      bodyFatPercent: 10,
      ageYears: 30,
      heightCm: 175,
      phase: 'cut',
      gender: 'male',
      sessionsPerWeek: 4,
      currentCalories: 2200,
      currentProteinG: 180,
      currentCarbsG: 200,
      currentFatG: 70,
    });
    // LBM = 72 → range 165.6–223.2
    expect(withBF.recommendedProteinG.min).toBe(166);
    expect(withBF.recommendedProteinG.max).toBe(223);
  });
});

describe('generatePeakWeek', () => {
  it('show in exactly 7 days → full protocol, no compressed warning', () => {
    const out = generatePeakWeek({
      showDateISO: '2026-06-07',
      todayISO: '2026-05-31',
      gender: 'male',
      bodyweightKg: 80,
      baselineWaterLitersPerDay: 4,
      baselineSodiumMgPerDay: 3000,
      baselineCarbsG: 300,
    });
    expect(out.protocol.length).toBeGreaterThanOrEqual(7);
    expect(out.protocol[out.protocol.length - 1].dayLabel).toBe('Show Day');
    expect(out.warnings.some((w) => w.toLowerCase().includes('compressed'))).toBe(false);
  });

  it('show in 4 days → compressed protocol warning present', () => {
    const out = generatePeakWeek({
      showDateISO: '2026-06-04',
      todayISO: '2026-05-31',
      gender: 'male',
      bodyweightKg: 80,
      baselineWaterLitersPerDay: 4,
      baselineSodiumMgPerDay: 3000,
      baselineCarbsG: 300,
    });
    expect(out.warnings.some((w) => w.toLowerCase().includes('compressed'))).toBe(true);
    expect(out.protocol[out.protocol.length - 1].dayLabel).toBe('Show Day');
  });

  it('female luteal phase, show in 7 days → earlier water load note in generalNotes', () => {
    const out = generatePeakWeek({
      showDateISO: '2026-06-07',
      todayISO: '2026-05-31',
      gender: 'female',
      bodyweightKg: 60,
      baselineWaterLitersPerDay: 3,
      baselineSodiumMgPerDay: 2500,
      baselineCarbsG: 250,
      menstrualCyclePhase: 'luteal',
    });
    expect(
      out.generalNotes.some((n) => n.toLowerCase().includes('luteal')),
    ).toBe(true);
    // T-7 entry should show elevated water (1.5x) thanks to luteal early start
    const tMinus7 = out.protocol.find((d) => d.dayLabel === 'T-7');
    expect(tMinus7).toBeDefined();
    expect(tMinus7!.waterLiters).toBeGreaterThan(3); // baseline was 3
  });

  it('always includes a "consult a qualified prep coach" note in generalNotes', () => {
    const out = generatePeakWeek({
      showDateISO: '2026-06-07',
      todayISO: '2026-05-31',
      gender: 'male',
      bodyweightKg: 80,
      baselineWaterLitersPerDay: 4,
      baselineSodiumMgPerDay: 3000,
      baselineCarbsG: 300,
    });
    expect(
      out.generalNotes.some((n) => n.toLowerCase().includes('qualified prep coach')),
    ).toBe(true);
  });

  it('day labels count down from T-N to Show Day; dateISO advances', () => {
    const out = generatePeakWeek({
      showDateISO: '2026-06-06',
      todayISO: '2026-05-31',
      gender: 'male',
      bodyweightKg: 80,
      baselineWaterLitersPerDay: 4,
      baselineSodiumMgPerDay: 3000,
      baselineCarbsG: 300,
    });
    expect(out.protocol[0].dayLabel).toBe('T-6');
    expect(out.protocol[0].dateISO).toBe('2026-05-31');
    expect(out.protocol[out.protocol.length - 1].dayLabel).toBe('Show Day');
    expect(out.protocol[out.protocol.length - 1].dateISO).toBe('2026-06-06');
  });
});

describe('flagWarningSigns', () => {
  it('all metrics healthy → severity none, continue_as_planned', () => {
    const out = flagWarningSigns({
      gender: 'female',
      weeksIntoCut: 4,
      energy1to10: 8,
      sleepHours: 8,
      stressLevel1to10: 3,
      trainingPerformance1to10: 8,
      hungerLevel1to10: 4,
      libido1to10: 7,
      moodLow: false,
      menstrualCycleStatus: 'regular',
      recentWeeklyWeightChangeKg: -0.4,
      bodyweightKg: 65,
    });
    expect(out.severity).toBe('none');
    expect(out.recommendation).toBe('continue_as_planned');
    expect(out.flags.length).toBe(0);
  });

  it('female with absent cycle 3+ months → severe + seek_medical_attention', () => {
    const out = flagWarningSigns({
      gender: 'female',
      weeksIntoCut: 8,
      energy1to10: 6,
      sleepHours: 7,
      stressLevel1to10: 5,
      trainingPerformance1to10: 6,
      hungerLevel1to10: 5,
      libido1to10: 4,
      moodLow: false,
      menstrualCycleStatus: 'absent_3_plus_months',
      recentWeeklyWeightChangeKg: -0.4,
      bodyweightKg: 60,
    });
    expect(out.severity).toBe('severe');
    expect(out.recommendation).toBe('seek_medical_attention');
    expect(out.flags.some((f) => f.flag.toLowerCase().includes('amenorrhea'))).toBe(true);
  });

  it('male energy 3, training 3, hunger 9, sleep 5 → at least moderate, deload_or_diet_break', () => {
    const out = flagWarningSigns({
      gender: 'male',
      weeksIntoCut: 6,
      energy1to10: 3,
      sleepHours: 5,
      stressLevel1to10: 5,
      trainingPerformance1to10: 3,
      hungerLevel1to10: 9,
      libido1to10: 4,
      moodLow: false,
      recentWeeklyWeightChangeKg: -0.6,
      bodyweightKg: 80,
    });
    expect(['moderate', 'severe']).toContain(out.severity);
    expect(out.recommendation).toBe('deload_or_diet_break');
  });

  it('weight loss 1.8%/week sustained 3+ weeks → severe weight loss flag, pull_back_significantly', () => {
    const out = flagWarningSigns({
      gender: 'male',
      weeksIntoCut: 5,
      energy1to10: 6,
      sleepHours: 7,
      stressLevel1to10: 5,
      trainingPerformance1to10: 6,
      hungerLevel1to10: 5,
      libido1to10: 4,
      moodLow: false,
      recentWeeklyWeightChangeKg: -1.44, // 1.8% of 80
      bodyweightKg: 80,
    });
    expect(out.severity).toBe('severe');
    expect(
      out.flags.some((f) => f.flag.toLowerCase().includes('weight loss')),
    ).toBe(true);
    expect(out.recommendation).toBe('pull_back_significantly');
  });
});

describe('analyzePhysique', () => {
  it('male input with all three poses → rubric contains all five required sections', () => {
    const out = analyzePhysique({
      lifterContext: {
        gender: 'male',
        phase: 'cut',
        weeksOutFromShow: 12,
        bodyweightKg: 80,
        statedBodyFatPercent: 12,
      },
      posesProvided: ['front', 'side', 'back'],
      userQuestion: 'How am I looking for my cut?',
    });
    const sections = out.assessmentRubric.requiredSections.join('\n');
    expect(sections).toContain('OVERALL_CONDITIONING');
    expect(sections).toContain('MUSCULAR_DEVELOPMENT');
    expect(sections).toContain('SYMMETRY');
    expect(sections).toContain('POSING_QUALITY');
    expect(sections).toContain('STAGE_READINESS_CONTEXT');
    expect(out.assessmentRubric.requiredSections.length).toBe(5);
    expect(out.citations.length).toBeGreaterThan(0);
  });

  it('single-pose input still produces a structurally valid rubric', () => {
    const out = analyzePhysique({
      lifterContext: {
        gender: 'male',
        phase: 'maintenance',
        weeksOutFromShow: null,
        bodyweightKg: null,
        statedBodyFatPercent: null,
      },
      posesProvided: ['front'],
      userQuestion: 'Quick check on my front double bi.',
    });
    expect(out.assessmentRubric.requiredSections.length).toBe(5);
    expect(out.assessmentRubric.forbiddenClaims.length).toBeGreaterThan(0);
    expect(out.assessmentRubric.voiceGuidance).toMatch(/qualified prep coach/i);
  });

  it('female input includes the female-specific comparison warning in forbiddenClaims', () => {
    const out = analyzePhysique({
      lifterContext: {
        gender: 'female',
        phase: 'cut',
        weeksOutFromShow: 16,
        bodyweightKg: 60,
        statedBodyFatPercent: 20,
      },
      posesProvided: ['front', 'side'],
      userQuestion: 'How does my conditioning compare?',
    });
    const comparisonClaim = out.assessmentRubric.forbiddenClaims.find((c) =>
      c.toLowerCase().includes('competitors'),
    );
    expect(comparisonClaim).toBeDefined();
    expect(comparisonClaim!.toLowerCase()).toContain('female');
    expect(comparisonClaim!.toLowerCase()).toContain('disordered');
  });

  it('male input omits the female-specific clause from the comparison forbidden claim', () => {
    const out = analyzePhysique({
      lifterContext: {
        gender: 'male',
        phase: 'cut',
        weeksOutFromShow: 8,
        bodyweightKg: 78,
        statedBodyFatPercent: 11,
      },
      posesProvided: ['front', 'side', 'back'],
      userQuestion: 'Where am I at?',
    });
    const comparisonClaim = out.assessmentRubric.forbiddenClaims.find((c) =>
      c.toLowerCase().includes('competitors'),
    );
    expect(comparisonClaim).toBeDefined();
    expect(comparisonClaim!.toLowerCase()).not.toContain('disordered');
  });
});
