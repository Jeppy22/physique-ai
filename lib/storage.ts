import type { LifterState } from './types';
import { DEFAULT_LIFTER_STATE } from './types';

const STORAGE_KEY = 'physique-ai-lifter-state';
const WELCOME_SEEN_KEY = 'physique-ai-welcome-seen';
const ONBOARDING_SKIPPED_KEY = 'physique-ai-onboarding-skipped';

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

export function hasSeenWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, 'true');
  } catch {
    // ignore
  }
}

export function hasSkippedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDING_SKIPPED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingSkipped(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_SKIPPED_KEY, 'true');
  } catch {
    // ignore
  }
}
