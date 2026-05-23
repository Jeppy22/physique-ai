import type { Gender, Phase } from '../types';

export interface AnalyzePhysiqueInput {
  lifterContext: {
    gender: Gender;
    phase: Phase;
    weeksOutFromShow: number | null;
    bodyweightKg: number | null;
    statedBodyFatPercent: number | null;
  };
  posesProvided: Array<'front' | 'side' | 'back' | 'legs'>;
  userQuestion: string;
}

export interface AnalyzePhysiqueOutput {
  assessmentRubric: {
    requiredSections: string[];
    forbiddenClaims: string[];
    voiceGuidance: string;
  };
  citations: string[];
}

export function analyzePhysique(
  input: AnalyzePhysiqueInput,
): AnalyzePhysiqueOutput {
  const isFemale = input.lifterContext.gender === 'female';

  return {
    assessmentRubric: {
      requiredSections: [
        'OVERALL_CONDITIONING — describe the conditioning level visible in the images. Use ranges, not exact numbers. E.g., "appears in the 10-14% body fat range for males, 18-22% for females" — never a single point estimate.',
        'MUSCULAR_DEVELOPMENT — comment on the major muscle groups visible from the provided poses. Identify any noticeable imbalances (e.g., upper body more developed than lower) using specific anatomical language. Acknowledge what is NOT visible from the provided poses (e.g., if no back photo: "cannot assess back development from these images").',
        'LOWER_BODY_DEVELOPMENT — assess quad, hamstring, glute, and calf development if a legs photo is provided. Note muscular separation, sweep, and quad-to-hamstring proportionality. If no legs photo is provided, explicitly state that lower body cannot be assessed from torso-oriented poses and recommend the user upload a legs photo for full assessment.',
        'SYMMETRY — note any visible asymmetries (left/right development, posture-related). Caveat that lighting, camera angle, and pose can produce apparent asymmetries that are not real.',
        'POSING_QUALITY — if the photos show flexed/posed shots, comment on common posing notes (rolled shoulders, tucked pelvis, incomplete lat spread, etc.). If photos are relaxed standing shots, note this and skip posing critique.',
        "STAGE_READINESS_CONTEXT — situate the visible conditioning relative to the lifter's stated weeks out from show. Use phrases like \"consistent with someone at this point in prep\" or \"leaner than typical for this far out\" — never give a definitive stage-readiness verdict in weeks.",
      ],
      forbiddenClaims: [
        'Do NOT estimate exact body fat percentage. Always use a range.',
        'Do NOT make medical observations (gyno, varicose veins, skin conditions, edema, etc.). If something appears potentially medical, say "I am not able to assess medical concerns from images — please consult a physician."',
        'Do NOT give a definitive number of weeks to stage-readiness. The agent can compare visible conditioning to the stated weeks out and comment on whether the trajectory is on-track, behind, or ahead — but no specific countdown.',
        'Do NOT comment on facial features, attractiveness, gender expression, or anything not strictly related to the physique relevant to bodybuilding assessment.',
        `Do NOT compare to specific competitors, athletes, or celebrity physiques${isFemale ? '. This is especially important for female lifters where comparisons can drive disordered behavior.' : '.'}`,
        'Do NOT provide recommendations on PEDs, SARMs, peptides, or any pharmacological intervention.',
      ],
      voiceGuidance:
        'Confident on what is visible. Specific anatomical language for both upper and lower body. Explicit acknowledgment of limits ("from this angle I cannot see X", "without a legs photo I cannot assess lower body development"). One sentence at the end pointing the user to a qualified prep coach for definitive contest prep decisions.',
    },
    citations: [
      'Helms, Aragon, Fitschen 2014 — natural bodybuilding contest prep conditioning standards',
      'Mitchell et al. 2018 — stage-readiness markers in natural bodybuilders',
    ],
  };
}
