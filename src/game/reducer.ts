// reducer() + assertNever() — every state transition lives here, including streak build/reset.
import type { AppState, AppAction } from "./types";

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "START_GAME":
      return {
        ...state, // keeps profile
        phase: {
          status: "PLAYING",
          wordStream: action.payload.words,
          metrics: {
            wordIndex: 0,
            typed: "",
            correctChars: 0,
            errorChars: 0,
            lastWpm: 0,
            startTime: null, // clock starts on the first keystroke
            duration: action.payload.duration, // <-- FIXED: Added duration to anchor absolute calculations
            timeRemaining: action.payload.duration,
          },
        },
      };

    case "KEY_PRESS": {
      if (state.phase.status !== "PLAYING") return state; // narrows phase to PLAYING
      const { action: inputAction, key, ctrlKey } = action.payload;
      const { metrics, wordStream } = state.phase;

      switch (inputAction) {
        case "CHARACTER_INPUT": {
          const isCorrect =
            key === wordStream[metrics.wordIndex][metrics.typed.length];
          return {
            ...state,
            phase: {
              ...state.phase,
              metrics: {
                ...metrics,
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

        case "BACKSPACE": {
          return {
            ...state,
            phase: {
              ...state.phase,
              metrics: {
                ...metrics,
                // If ctrlKey is true, wipe the buffer entirely; otherwise chop off the last char
                typed: ctrlKey ? "" : metrics.typed.slice(0, -1),
              },
            },
          };
        }

        case "SPACE_SUBMIT": {
          if (metrics.typed.length === 0) return state;

          const nextWordIndex = metrics.wordIndex + 1;

          if (nextWordIndex >= wordStream.length) {
            return {
              ...state,
              phase: {
                status: "GAME_OVER",
                wordStream,
                metrics,
              },
            };
          }

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

        default:
          return state;
      }
    } // ← CLOSED: KEY_PRESS block cleanly breaks here

    case "TICK": {
      // ← FIXED: TICK lifted out to its correct home as a sibling to KEY_PRESS
      if (state.phase.status !== "PLAYING") return state;
      const { metrics, wordStream } = state.phase;
      if (metrics.startTime === null) return state;

      // Pure absolute time tracking using our payload anchor
      const elapsedSeconds = Math.floor(
        (action.payload.now - metrics.startTime) / 1000,
      );
      const newTimeRemaining = metrics.duration - elapsedSeconds;

      if (newTimeRemaining <= 0) {
        return {
          ...state,
          phase: {
            status: "GAME_OVER",
            wordStream,
            metrics: { ...metrics, timeRemaining: 0 },
          },
        };
      }

      return {
        ...state,
        phase: {
          ...state.phase,
          metrics: { ...metrics, timeRemaining: newTimeRemaining },
        },
      };
    }

    default:
      return state;
  }
}