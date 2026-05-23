export type Gender = 'male' | 'female';
export type Phase = 'cut' | 'maintenance' | 'bulk' | 'peak_week';
export type TrainingSplit = 'PPL' | 'upper_lower' | 'bro_split' | 'full_body' | 'other';

export type PhysiquePose = 'front' | 'side' | 'back' | 'legs';
export type PhotoMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export interface PhysiquePhoto {
  pose: PhysiquePose;
  dataUrl: string;         // base64 data URL for preview rendering
  base64: string;          // raw base64 (no data: prefix) for Anthropic API
  mediaType: PhotoMediaType;
  sizeBytes: number;
}

export interface LifterState {
  // Demographics
  gender: Gender;
  ageYears: number;
  heightCm: number;

  // Current physique
  bodyweightKg: number;
  bodyFatPercent: number | null; // optional, null if unknown

  // Goal context
  phase: Phase;
  showDateISO: string | null; // ISO date string, null if no show booked
  targetStageWeightKg: number | null;

  // Recent trajectory
  recentWeeklyWeightChangeKg: number | null; // negative = losing

  // Nutrition
  dailyCalories: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;

  // Training
  trainingSplit: TrainingSplit | null;
  sessionsPerWeek: number | null;

  // Wellbeing flags (1-10 scales, null if not reported)
  energy1to10: number | null;
  sleepHours: number | null;
  stressLevel1to10: number | null;

  // Female-specific (null if male or not provided)
  menstrualCyclePhase: 'follicular' | 'ovulation' | 'luteal' | 'menstrual' | 'irregular' | null;
}

export const DEFAULT_LIFTER_STATE: LifterState = {
  gender: 'male',
  ageYears: 30,
  heightCm: 175,
  bodyweightKg: 80,
  bodyFatPercent: null,
  phase: 'cut',
  showDateISO: null,
  targetStageWeightKg: null,
  recentWeeklyWeightChangeKg: null,
  dailyCalories: null,
  dailyProteinG: null,
  dailyCarbsG: null,
  dailyFatG: null,
  trainingSplit: null,
  sessionsPerWeek: null,
  energy1to10: null,
  sleepHours: null,
  stressLevel1to10: null,
  menstrualCyclePhase: null,
};
