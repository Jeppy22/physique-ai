import type { LifterState } from './types';
import { DEFAULT_LIFTER_STATE } from './types';

const STORAGE_KEY = 'physique-ai-lifter-state';

export function loadLifterState(): LifterState {
  if (typeof window === 'undefined') return DEFAULT_LIFTER_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIFTER_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LIFTER_STATE, ...parsed };
  } catch {
    return DEFAULT_LIFTER_STATE;
  }
}

export function saveLifterState(state: LifterState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled — fail silently
  }
}

export function clearLifterState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasAnyData(state: LifterState): boolean {
  const keys = Object.keys(DEFAULT_LIFTER_STATE) as (keyof LifterState)[];
  for (const k of keys) {
    if (state[k] !== DEFAULT_LIFTER_STATE[k]) return true;
  }
  return false;
}
