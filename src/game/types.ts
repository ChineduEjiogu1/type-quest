/**
 * types.ts — the shape of the whole game.
 *
 * The core design split: durable data the player keeps across games (Profile)
 * is kept separate from the throwaway state of a single run (a phase plus its
 * metrics). AppState glues the two together. Everything the reducer does is
 * built around the discriminated unions defined here.
 */

// ──────────────────────────────────────────────────────────────────────────
// 1. Persistent User Profile
// ──────────────────────────────────────────────────────────────────────────
// Long-lived data that OUTLIVES any single game — this is what you persist to
// localStorage. Deliberately kept out of the per-game metrics so it survives
// every phase transition and is available even on the start screen.
export interface Profile {
  level: number;
  xp: number;
  bestWpm: number; // best across all runs (contrast with metrics.lastWpm, which is per-run)
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Input
// ──────────────────────────────────────────────────────────────────────────
// The reducer only distinguishes three kinds of keypress: a printable
// character to append, and the two control keys that edit the buffer.
// Modifiers stay as booleans rather than becoming actions of their own.
export type GameInputAction = "CHARACTER_INPUT" | "BACKSPACE" | "SPACE_SUBMIT";

export interface KeyPressPayload {
  key: string; // raw DOM KeyboardEvent.key — kept as a plain string on purpose; narrowing
  //              the full character set into a union would only fight the DOM boundary
  action: GameInputAction; // which of the three kinds above this keypress is
  shiftKey: boolean;
  ctrlKey: boolean; // e.g. Ctrl+Backspace wipes the whole word
  // TODO: add `now: number` here so the first CHARACTER_INPUT can stamp
  now: number;
  // metrics.startTime. Without it, startTime stays null and the clock never starts.
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Transient Gameplay Metrics  (one run only — reset every game)
// ──────────────────────────────────────────────────────────────────────────
export interface GameplayMetrics {
  wordIndex: number; // index of the current word within the stream
  typed: string; // what's been typed of the current word so far
  correctChars: number; // accuracy tally, counted per keystroke as you type
  errorChars: number;
  lastWpm: number; // this run's WPM (Profile.bestWpm is the all-time best)
  startTime: number | null; // null until the first keystroke stamps it; the fixed
  //                           anchor that all elapsed-time math is measured from
  duration: number; // the run's total seconds — FROZEN: set once, never changed
  timeRemaining: number; // LIVE countdown — re-derived each TICK as (duration − elapsed)
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Phase  (the state machine)
// ──────────────────────────────────────────────────────────────────────────
// A discriminated union keyed on `status`. Because wordStream/metrics live
// only on the PLAYING and GAME_OVER variants, TypeScript won't let you touch
// them in INITIAL — the type makes "no game running yet" unrepresentable to
// the rest of the code, which is why the reducer's status guards double as
// type-narrows.
export type GamePhase =
  | { status: "INITIAL" } // menu / pre-game; nothing to play with yet
  | { status: "PLAYING"; wordStream: string[]; metrics: GameplayMetrics } // a run in progress
  | { status: "GAME_OVER"; wordStream: string[]; metrics: GameplayMetrics }; // finished; metrics is the final snapshot

// ──────────────────────────────────────────────────────────────────────────
// 5. Root Application State
// ──────────────────────────────────────────────────────────────────────────
// The split that keeps everything else clean: `profile` is durable and crosses
// every transition untouched; `phase` is the disposable state of whatever is
// happening right now.
export interface AppState {
  profile: Profile;
  phase: GamePhase;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Reducer Actions
// ──────────────────────────────────────────────────────────────────────────
// Every event the reducer knows how to handle. Each variant carries exactly
// the payload its case needs — and nothing it doesn't.
export type AppAction =
  | { type: "START_GAME"; payload: { words: string[]; duration: number } } // seed a fresh run
  | { type: "KEY_PRESS"; payload: KeyPressPayload } // a key pressed during play
  | { type: "TICK"; payload: { now: number } } // timer tick → drives the countdown
  | { type: "END_GAME" }; // manual end — no case yet; currently falls through to default