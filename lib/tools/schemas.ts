import type { Anthropic } from '@anthropic-ai/sdk';

export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'project_weight_trajectory',
    description:
      'Project a lifter\'s bodyweight week-by-week from their current rate of loss/gain, and flag whether the trajectory is safe, aggressive, or unreachable in the timeframe. Use when the user asks about weight loss pace, whether they will hit a target weight by a date, or whether their current rate is sustainable. Ask the user for their current bodyweight, target stage/goal weight, weeks until the target/show, and recent weekly weight change if you do not already have them.',
    input_schema: {
      type: 'object',
      properties: {
        currentBodyweightKg: {
          type: 'number',
          minimum: 30,
          maximum: 300,
          description: 'Current bodyweight in kilograms.',
        },
        targetBodyweightKg: {
          type: 'number',
          minimum: 30,
          maximum: 300,
          description: 'Goal/target bodyweight in kilograms (e.g. expected stage weight).',
        },
        weeksUntilTarget: {
          type: 'integer',
          minimum: 1,
          maximum: 104,
          description: 'Number of full weeks between today and the target date.',
        },
        recentWeeklyChangeKg: {
          type: 'number',
          minimum: -5,
          maximum: 5,
          description:
            'Recent average weekly bodyweight change in kg. NEGATIVE for losing weight, POSITIVE for gaining.',
        },
        gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex of the lifter.',
        },
      },
      required: [
        'currentBodyweightKg',
        'targetBodyweightKg',
        'weeksUntilTarget',
        'recentWeeklyChangeKg',
        'gender',
      ],
    },
  },
  {
    name: 'assess_macros',
    description:
      'Assess whether a lifter\'s current calorie and macronutrient intake is appropriate for their phase (cut/maintenance/bulk/peak_week). Returns recommended ranges, verdicts on current intake (too_low/in_range/etc.), and an estimated TDEE. Use whenever the user asks about their macros, calories, protein intake, deficit/surplus size, or whether they should eat more or less. Ask for any missing inputs (bodyweight, height, age, sessions per week, current calories/protein/carbs/fat) before calling.',
    input_schema: {
      type: 'object',
      properties: {
        bodyweightKg: {
          type: 'number',
          minimum: 30,
          maximum: 300,
          description: 'Current bodyweight in kilograms.',
        },
        bodyFatPercent: {
          type: ['number', 'null'],
          minimum: 3,
          maximum: 60,
          description:
            'Body-fat percentage if known (used to switch protein target to grams-per-kg-LBM). Pass null if unknown.',
        },
        ageYears: {
          type: 'integer',
          minimum: 15,
          maximum: 90,
          description: 'Age in years (used for Mifflin-St Jeor BMR).',
        },
        heightCm: {
          type: 'number',
          minimum: 130,
          maximum: 220,
          description: 'Height in centimeters (used for Mifflin-St Jeor BMR).',
        },
        phase: {
          type: 'string',
          enum: ['cut', 'maintenance', 'bulk', 'peak_week'],
          description: 'Current training/nutrition phase.',
        },
        gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex of the lifter.',
        },
        sessionsPerWeek: {
          type: 'integer',
          minimum: 0,
          maximum: 14,
          description: 'Number of resistance training sessions per week (drives activity multiplier).',
        },
        currentCalories: {
          type: 'number',
          minimum: 500,
          maximum: 8000,
          description: 'Lifter\'s current daily calorie intake (kcal).',
        },
        currentProteinG: {
          type: 'number',
          minimum: 0,
          maximum: 500,
          description: 'Lifter\'s current daily protein intake in grams.',
        },
        currentCarbsG: {
          type: 'number',
          minimum: 0,
          maximum: 1500,
          description: 'Lifter\'s current daily carbohydrate intake in grams.',
        },
        currentFatG: {
          type: 'number',
          minimum: 0,
          maximum: 400,
          description: 'Lifter\'s current daily fat intake in grams.',
        },
      },
      required: [
        'bodyweightKg',
        'ageYears',
        'heightCm',
        'phase',
        'gender',
        'sessionsPerWeek',
        'currentCalories',
        'currentProteinG',
        'currentCarbsG',
        'currentFatG',
      ],
    },
  },
  {
    name: 'generate_peak_week',
    description:
      'Generate a day-by-day peak-week protocol (water, sodium, carbohydrate manipulation) leading into a bodybuilding show. Use when the user asks about peak week, water loading, carb loading, sodium taper, or how to time things before a show. Requires the show date, today\'s date, and the lifter\'s baseline water/sodium/carb intake. For female lifters, also collect current menstrual cycle phase if known.',
    input_schema: {
      type: 'object',
      properties: {
        showDateISO: {
          type: 'string',
          description: 'Show/competition date as an ISO date string (YYYY-MM-DD).',
        },
        todayISO: {
          type: 'string',
          description: 'Today\'s date as an ISO date string (YYYY-MM-DD).',
        },
        gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex of the lifter.',
        },
        bodyweightKg: {
          type: 'number',
          minimum: 30,
          maximum: 300,
          description: 'Current bodyweight in kilograms.',
        },
        baselineWaterLitersPerDay: {
          type: 'number',
          minimum: 0.5,
          maximum: 10,
          description: 'Lifter\'s normal daily water intake in liters (baseline for the protocol multipliers).',
        },
        baselineSodiumMgPerDay: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          description: 'Lifter\'s normal daily sodium intake in milligrams.',
        },
        baselineCarbsG: {
          type: 'number',
          minimum: 50,
          maximum: 1500,
          description: 'Lifter\'s normal daily carbohydrate intake in grams.',
        },
        menstrualCyclePhase: {
          type: ['string', 'null'],
          enum: ['follicular', 'ovulation', 'luteal', 'menstrual', 'irregular', null],
          description:
            'Current menstrual cycle phase for female lifters. Use null for males or if unknown. Luteal phase shifts water-load start earlier.',
        },
      },
      required: [
        'showDateISO',
        'todayISO',
        'gender',
        'bodyweightKg',
        'baselineWaterLitersPerDay',
        'baselineSodiumMgPerDay',
        'baselineCarbsG',
      ],
    },
  },
  {
    name: 'flag_warning_signs',
    description:
      'Assess wellness markers (energy, sleep, stress, training performance, hunger, libido, mood, menstrual status, weight loss rate) and flag warning signs of overreach, metabolic adaptation, or hormonal disruption during a cut. Returns severity (none/mild/moderate/severe) and a recommendation (continue / monitor / deload / pull back / seek medical attention). Use when the user reports symptoms of fatigue, poor sleep, low mood, lost period, low libido, or aggressive weight loss — or when you proactively want to check in on a lifter deep into a cut.',
    input_schema: {
      type: 'object',
      properties: {
        gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex of the lifter.',
        },
        weeksIntoCut: {
          type: 'integer',
          minimum: 0,
          maximum: 52,
          description: 'How many weeks the lifter has been in the current cut.',
        },
        energy1to10: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Subjective daily energy on a 1-10 scale (10 = excellent).',
        },
        sleepHours: {
          type: 'number',
          minimum: 0,
          maximum: 14,
          description: 'Average hours of sleep per night recently.',
        },
        stressLevel1to10: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Subjective life stress on a 1-10 scale (10 = severe).',
        },
        trainingPerformance1to10: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Subjective training performance vs. baseline on a 1-10 scale.',
        },
        hungerLevel1to10: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Subjective hunger on a 1-10 scale (10 = ravenous).',
        },
        libido1to10: {
          type: ['integer', 'null'],
          minimum: 0,
          maximum: 10,
          description:
            'Libido on a 0-10 scale (0 = absent). Pass null if not reported. Sustained 0 in males is a severe flag.',
        },
        moodLow: {
          type: 'boolean',
          description: 'True if the lifter is reporting persistently low mood.',
        },
        menstrualCycleStatus: {
          type: ['string', 'null'],
          enum: ['regular', 'irregular', 'absent_3_plus_months', null],
          description:
            'Menstrual cycle status for female lifters. "absent_3_plus_months" is a severe flag (functional hypothalamic amenorrhea). Null for males or if not reported.',
        },
        recentWeeklyWeightChangeKg: {
          type: 'number',
          minimum: -5,
          maximum: 5,
          description: 'Recent average weekly bodyweight change in kg (negative for losing).',
        },
        bodyweightKg: {
          type: 'number',
          minimum: 30,
          maximum: 300,
          description: 'Current bodyweight in kilograms.',
        },
      },
      required: [
        'gender',
        'weeksIntoCut',
        'energy1to10',
        'sleepHours',
        'stressLevel1to10',
        'trainingPerformance1to10',
        'hungerLevel1to10',
        'moodLow',
        'recentWeeklyWeightChangeKg',
        'bodyweightKg',
      ],
    },
  },
];
