import type { Gender } from '../types';

export interface PeakWeekInput {
  showDateISO: string;
  todayISO: string;
  gender: Gender;
  bodyweightKg: number;
  baselineWaterLitersPerDay: number;
  baselineSodiumMgPerDay: number;
  baselineCarbsG: number;
  menstrualCyclePhase?:
    | 'follicular'
    | 'ovulation'
    | 'luteal'
    | 'menstrual'
    | 'irregular'
    | null;
}

export interface PeakWeekDay {
  dayLabel: string; // e.g. "T-6", "T-5", ..., "Show Day"
  dateISO: string;
  waterLiters: number;
  sodiumMg: number;
  carbsG: number;
  notes: string;
}

export interface PeakWeekOutput {
  protocol: PeakWeekDay[];
  generalNotes: string[];
  warnings: string[];
  reasoning: string;
  citations: string[];
}

const CITATIONS = [
  'Mitchell L, Slater G, Hackett D, Johnson N, O\'Connor H. Physiological implications of preparing for a natural male bodybuilding contest. Eur J Sport Sci. 2018;18(5):619-629.',
  'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
  'Rossow LM, Fukuda DH, Fahs CA, Loenneke JP, Stout JR. Natural bodybuilding competition preparation and recovery: a 12-month case study. Int J Sports Physiol Perform. 2013;8(5):582-592.',
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const round0 = (n: number) => Math.round(n);

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function addDays(baseISO: string, days: number): string {
  const d = new Date(`${baseISO.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface DayConfig {
  waterMult: number;
  sodiumMult: number;
  carbMult: number;
  notes: string;
}

function configForT(t: number, isLuteal: boolean): DayConfig {
  // Mitchell 2018 / Helms 2014 standard 7-day peaking protocol.
  // Luteal-phase females extend water-load start to T-7 (extra retention margin).
  const loadCarbsDepleted = 0.55;
  if (t >= 8) {
    return {
      waterMult: 1.0,
      sodiumMult: 1.0,
      carbMult: 1.0,
      notes: 'Pre-peak baseline. Hold normal hydration, sodium, and carbohydrate intake.',
    };
  }
  if (t === 7) {
    if (isLuteal) {
      return {
        waterMult: 1.5,
        sodiumMult: 1.0,
        carbMult: loadCarbsDepleted,
        notes:
          'Luteal-phase early start: begin water load and carbohydrate depletion one day earlier to offset cycle-related retention.',
      };
    }
    return {
      waterMult: 1.0,
      sodiumMult: 1.0,
      carbMult: 1.0,
      notes: 'Final pre-peak baseline day. Hold normal intake; water load begins tomorrow.',
    };
  }
  if (t >= 4 && t <= 6) {
    return {
      waterMult: 1.7,
      sodiumMult: 1.0,
      carbMult: loadCarbsDepleted,
      notes: 'Water-load phase, normal sodium, carbohydrate depletion to deplete muscle glycogen.',
    };
  }
  if (t === 3) {
    return {
      waterMult: 1.0,
      sodiumMult: 0.75,
      carbMult: 1.0,
      notes: 'Water tapers back to baseline, sodium begins to taper, carbohydrate refeed initiated.',
    };
  }
  if (t === 2) {
    return {
      waterMult: 0.7,
      sodiumMult: 0.5,
      carbMult: 1.5,
      notes: 'Water reduced, sodium reduced further, carbohydrate refeed accelerates.',
    };
  }
  if (t === 1) {
    return {
      waterMult: 0.4,
      sodiumMult: 0.3,
      carbMult: 2.5,
      notes: 'Final water cut, sodium minimized, carbohydrate load peaks. Last full meals.',
    };
  }
  // t === 0 (show day)
  return {
    waterMult: 0.3,
    sodiumMult: 0.2,
    carbMult: 1.5,
    notes:
      'Show day: sips of water as needed, minimal sodium until first round, posing fuel carbs to taste.',
  };
}

export function generatePeakWeek(input: PeakWeekInput): PeakWeekOutput {
  const {
    showDateISO,
    todayISO,
    gender,
    baselineWaterLitersPerDay,
    baselineSodiumMgPerDay,
    baselineCarbsG,
    menstrualCyclePhase,
  } = input;

  const daysUntilShow = daysBetween(todayISO, showDateISO);

  const isFemale = gender === 'female';
  const isLuteal = isFemale && menstrualCyclePhase === 'luteal';
  const isMenstrual = isFemale && menstrualCyclePhase === 'menstrual';
  const isIrregular = isFemale && menstrualCyclePhase === 'irregular';

  const generalNotes: string[] = [];
  const warnings: string[] = [];

  generalNotes.push(
    'Consult a qualified prep coach before competition — this is a starting framework, not personalized advice.',
  );
  generalNotes.push(
    'Track subjective fullness, vascularity, and weight each morning. Adjust the final 48 hours based on the mirror, not the plan.',
  );

  if (isLuteal) {
    generalNotes.push(
      'Luteal-phase note: expect elevated water retention. Water load is initiated one day earlier (T-7) when possible to clear excess fluid by show day.',
    );
  }
  if (isIrregular) {
    generalNotes.push(
      'Irregular cycle reported: water retention may be unpredictable. Build in a 48-hour mirror checkpoint before locking final cuts.',
    );
  }

  if (isMenstrual) {
    warnings.push(
      'Menstrual phase coincides with show week. Expect additional water retention and possible mood/energy drops; consider conservative water cut and prioritize sodium taper.',
    );
  }

  const protocol: PeakWeekDay[] = [];

  if (daysUntilShow < 0) {
    warnings.push('Show date is in the past — no protocol generated.');
    return {
      protocol,
      generalNotes,
      warnings,
      reasoning: 'Show date precedes today; cannot generate forward-looking protocol.',
      citations: CITATIONS,
    };
  }

  if (daysUntilShow < 7) {
    warnings.push(
      `Compressed protocol: only ${daysUntilShow} day(s) until the show. Standard protocols assume 7 days. Skip earlier depletion phases and prioritize the final 72-hour refeed and water/sodium taper.`,
    );
    if (daysUntilShow < 4) {
      warnings.push(
        'Very compressed window (<4 days). Drop carbohydrate depletion entirely; focus on the carb load and water/sodium manipulation only.',
      );
    }
  }

  for (let t = daysUntilShow; t >= 0; t--) {
    const cfg = configForT(t, isLuteal);
    const dateISO = addDays(todayISO, daysUntilShow - t);
    protocol.push({
      dayLabel: t === 0 ? 'Show Day' : `T-${t}`,
      dateISO,
      waterLiters: round1(baselineWaterLitersPerDay * cfg.waterMult),
      sodiumMg: round0(baselineSodiumMgPerDay * cfg.sodiumMult),
      carbsG: round0(baselineCarbsG * cfg.carbMult),
      notes: cfg.notes,
    });
  }

  const reasoning =
    `Protocol spans ${protocol.length} day(s) ending on ${showDateISO}. ` +
    'Manipulations follow Mitchell 2018 / Helms 2014: water-load → taper, sodium taper, ' +
    'carbohydrate depletion → load, with female cycle-phase adjustments where applicable.';

  return {
    protocol,
    generalNotes,
    warnings,
    reasoning,
    citations: CITATIONS,
  };
}
