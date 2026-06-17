/**
 * appReducer — the single source of truth for every game state transition.
 *
 * Pure function: given the current AppState and an action, it returns the
 * NEXT AppState. It never mutates its inputs and never reaches outside them
 * (timestamps always arrive via an action's payload, never Date.now()), which
 * keeps it deterministic and easy to test.
 *
 * Structure: the OUTER switch handles the action type. KEY_PRESS owns a
 * second, INNER switch over the kind of key that was pressed.
 */
import type { AppState, AppAction } from "./types";
import { finalizeProfile } from "./progression";

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ── START_GAME ───────────────────────────────────────────────────────
    // Begin a fresh run: enter the PLAYING phase with zeroed-out metrics.
    case "START_GAME":
      return {
        ...state, // carry the durable profile (level / xp / bestWpm) across the transition
        phase: {
          status: "PLAYING",
          wordStream: action.payload.words, // the words to type, in order
          metrics: {
            wordIndex: 0, // which word in the stream we're on
            typed: "", // characters typed for the current word so far
            correctChars: 0, // running accuracy counters, tallied per keystroke
            errorChars: 0,
            lastWpm: 0,
            startTime: null, // null = clock not started; stamped on the first keystroke
            duration: action.payload.duration, // FROZEN total — the fixed anchor for the countdown
            timeRemaining: action.payload.duration, // LIVE value — recomputed on every TICK
          },
        },
      };

    // ── KEY_PRESS ────────────────────────────────────────────────────────
    // A key was pressed. Only meaningful while a game is in progress.
    case "KEY_PRESS": {
      // Guard: ignore keypresses outside PLAYING. This check also narrows
      // `state.phase` to the PLAYING variant, so `metrics`/`wordStream` below
      // are safely accessible.
      if (state.phase.status !== "PLAYING") return state;

      const { action: inputAction, key, ctrlKey, now } = action.payload;
      const { metrics, wordStream } = state.phase;

      // Inner switch: what kind of key was it?
      switch (inputAction) {
        // A printable character — append it and score it on the spot.
        case "CHARACTER_INPUT": {
          const isCorrect =
            key === wordStream[metrics.wordIndex][metrics.typed.length];
          return {
            ...state,
            phase: {
              ...state.phase,
              metrics: {
                ...metrics,
                startTime: metrics.startTime ?? now, // Set the clock base if it is the first stroke
                typed: metrics.typed + key,
                correctChars: isCorrect
                  ? metrics.correctChars + 1
                  : metrics.correctChars,
                errorChars: !isCorrect
                  ? metrics.errorChars + 1
                  : metrics.errorChars,
              },
            },
          };
        }

        // Backspace — Ctrl wipes the whole word, otherwise drop the last char.
        case "BACKSPACE": {
          return {
            ...state,
            phase: {
              ...state.phase,
              metrics: {
                ...metrics,
                typed: ctrlKey ? "" : metrics.typed.slice(0, -1),
              },
            },
          };
        }

        // Space — commit the current word and advance to the next.
        case "SPACE_SUBMIT": {
          // Ignore a stray space when nothing's typed yet (no empty words).
          if (metrics.typed.length === 0) return state;

          const nextWordIndex = metrics.wordIndex + 1;

          // =======================================================
          // TRANSITION 2: Word Stream Exhaustion -> GAME_OVER
          // =======================================================
          if (nextWordIndex >= wordStream.length) {
            // 1. Capture the final metrics pool at text completion
            const finalMetrics = {
              ...metrics,
              wordIndex: nextWordIndex,
              typed: "", // Clear buffer for clean ending presentation layout
            };

            // 2. Return atomic state containing the structural high-score calculations
            return {
              ...state,
              phase: {
                status: "GAME_OVER",
                wordStream,
                metrics: finalMetrics,
              },
              profile: finalizeProfile(state.profile, finalMetrics),
            };
          }

          // Otherwise step to the next word and clear the typed buffer.
          return {
            ...state,
            phase: {
              ...state.phase,
              metrics: {
                ...metrics,
                wordIndex: nextWordIndex,
                typed: "",
              },
            },
          };
        }

        // Any other input kind: change nothing.
        default:
          return state;
      }
    }

    // ── TICK ─────────────────────────────────────────────────────────────
    // System clock pulse: counts down remaining game loop duration.
    // =======================================================
    // TRANSITION 1: System Countdown Timeout -> GAME_OVER
    // =======================================================
    // ── TICK ─────────────────────────────────────────────────────────────
    // System clock pulse: derives remaining time from true wall-clock elapsed time.
    case "TICK": {
      if (state.phase.status !== "PLAYING") return state;

      const { metrics, wordStream } = state.phase;

      // Idle State Guard: If the user hasn't typed their first stroke yet,
      // the countdown loop remains completely frozen at maximum duration.
      if (metrics.startTime === null) return state;

      // True Wall-Clock Derivation: Protects against setInterval drift and background tab throttling
      const elapsedSeconds = Math.floor(
        (action.payload.now - metrics.startTime) / 1000,
      );
      const newTimeRemaining = Math.max(0, metrics.duration - elapsedSeconds);

      // =======================================================
      // TRANSITION 1: System Countdown Timeout -> GAME_OVER
      // =======================================================
      if (newTimeRemaining <= 0) {
        // 1. Build the exact final snapshot of game metrics (Clamping live time to 0)
        const finalMetrics = {
          ...metrics,
          timeRemaining: 0,
        };

        // 2. Transition atomic state with an updated profile field override
        return {
          ...state,
          phase: {
            status: "GAME_OVER",
            wordStream,
            metrics: finalMetrics,
          },
          // The finalizeProfile call overrides the old profile stored in state.profile single-shot
          profile: finalizeProfile(state.profile, finalMetrics),
        };
      }

      // Regular countdown update: Push the freshly derived wall-clock time into state
      return {
        ...state,
        phase: {
          ...state.phase,
          metrics: {
            ...metrics,
            timeRemaining: newTimeRemaining,
          },
        },
      };
    }

    // Any action we don't explicitly handle leaves state untouched,
    // which is the safe default for a deterministic reducer.
    default:
      return state;
  }
}
