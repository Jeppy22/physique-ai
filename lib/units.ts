export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'in';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

export function weightToDisplay(
  kg: number | null,
  unit: WeightUnit,
): number | null {
  if (kg == null) return null;
  return unit === 'kg' ? round(kg, 1) : round(kg / KG_PER_LB, 1);
}

export function weightToKg(
  value: number | null,
  unit: WeightUnit,
): number | null {
  if (value == null) return null;
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function heightToDisplay(
  cm: number | null,
  unit: HeightUnit,
): number | null {
  if (cm == null) return null;
  return unit === 'cm' ? round(cm, 1) : round(cm / CM_PER_IN, 1);
}

export function heightToCm(
  value: number | null,
  unit: HeightUnit,
): number | null {
  if (value == null) return null;
  return unit === 'cm' ? value : value * CM_PER_IN;
}
