/**
 * engine.ts — pure, derived-value helpers used by the reducer and the UI.
 *
 * Nothing here transitions state or touches React; each function takes plain
 * values and returns a number or an object. That purity is exactly what makes
 * them trivial to unit-test in isolation.
 */
import type { AppState } from "./types";

/**
 * The starting state for `useReducer(appReducer, createInitialState())`:
 * a fresh INITIAL phase plus a default profile. These are the defaults — when
 * there's saved progress, the persistence layer hydrates over the top of them.
 */
export const createInitialState = (): AppState => ({
  phase: { status: "INITIAL" },
  profile: { level: 1, xp: 0, bestWpm: 0 },
});

type ComputeAccuracyInput = {
  correctChars: number; // right keystrokes, tallied per character as you type
  errorChars: number; // wrong keystrokes, same per-character tally
};

/**
 * Accuracy as a whole-number percentage.
 *
 * "Total" is the characters the player actually typed (correct + error), NOT
 * the length of the target text — dividing by the whole paragraph would measure
 * how much they *completed*, not how *accurate* they were.
 */
export function computeAccuracy({ correctChars, errorChars }: ComputeAccuracyInput): number {
  const total = correctChars + errorChars;

  // Nothing typed yet → no mistakes yet → show a full 100.
  if (total === 0) {
    return 100;
  }

  // floor (not round) so a displayed 100% means a genuinely flawless run:
  // a single mistake can never round back up to 100.
  return Math.floor((correctChars / total) * 100);
}

/**
 * Net words-per-minute.
 *
 * Built from CORRECT characters only, so mistakes drag the number down (this is
 * "net" WPM; counting every keystroke would be "raw"). Uses the standard
 * convention that 5 characters = 1 word.
 */
export function computeWpm(correctChars: number, timeInSeconds: number): number {
  // Guard against divide-by-zero / nonsense before the clock has run.
  if (timeInSeconds <= 0) {
    return 0;
  }

  const totalWords = correctChars / 5; // 5 chars = 1 "word", by convention
  const timeInMinutes = timeInSeconds / 60;

  return Math.round(totalWords / timeInMinutes); // whole-number WPM for display
}