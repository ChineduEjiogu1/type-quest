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
                startTime: metrics.startTime ?? now, // ← the only new line
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

          // Was that the final word? If so, the run is over → GAME_OVER.
          if (nextWordIndex >= wordStream.length) {
            return {
              ...state,
              phase: {
                status: "GAME_OVER",
                wordStream,
                metrics, // snapshot the final stats as-is
              },
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
    // Fired on a timer (several times a second) to drive the countdown.
    case "TICK": {
      // Only count down during an active, already-started game.
      if (state.phase.status !== "PLAYING") return state;
      const { metrics, wordStream } = state.phase;
      if (metrics.startTime === null) return state; // clock hasn't started yet

      // Measure elapsed time from the wall clock rather than by counting ticks.
      // This is immune to interval jitter, dropped ticks, and the throttling
      // browsers apply to background tabs.
      const elapsedSeconds = Math.floor(
        (action.payload.now - metrics.startTime) / 1000,
      );
      // Derive what's left from the FROZEN total, so the value can never
      // accumulate drift no matter how irregularly TICK fires.
      const newTimeRemaining = metrics.duration - elapsedSeconds;

      // Time's up → end the run. A reducer can't dispatch actions, so TICK
      // performs the GAME_OVER transition itself the moment the clock expires.
      if (newTimeRemaining <= 0) {
        return {
          ...state,
          phase: {
            status: "GAME_OVER",
            wordStream,
            metrics: { ...metrics, timeRemaining: 0 }, // clamp the display to 0
          },
        };
      }

      // Still running — just refresh the displayed time.
      return {
        ...state,
        phase: {
          ...state.phase,
          metrics: { ...metrics, timeRemaining: newTimeRemaining },
        },
      };
    }

    // Any action we don't explicitly handle (e.g. END_GAME for now) leaves
    // state untouched, which is the safe default for a reducer.
    default:
      return state;
  }
}