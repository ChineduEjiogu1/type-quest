import { useReducer, useEffect } from "react";
import { appReducer } from "./game/reducer";
import { createInitialState } from "./game/engine";
import { generateWords } from "./game/words";
import type { GameInputAction } from "./game/types";
import "./App.css";

/**
 * App Component
 * Serves as the central controller and presentation shell for the typing application.
 * Manages game lifecycle states, catches global document window inputs, and runs the clock.
 */
export default function App() {
  /**
   * 1. State Machine Initialization
   * Uses `useReducer` to handle complex state transitions rather than scattered `useState` hooks.
   * This guarantees that actions like 'KEY_PRESS' mutate the game parameters in atomic, 
   * predictable ways according to state machine schemas.
   */
  const [state, dispatch] = useReducer(appReducer, createInitialState());

  /**
   * 2. State Distructuring and Type Narrowing
   * Exposes the 'phase' attribute directly. Because our state handles discriminated unions 
   * (e.g., INITIAL, PLAYING, GAME_OVER), pulling this descriptor out enables TypeScript 
   * to automatically narrow down available object definitions within our conditional JSX fields.
   */
  const { phase } = state;

  /**
   * Game Initialization Trigger
   * Dispatches the initial payload data to transition the state status to 'PLAYING'.
   * Generates a structural set of random target strings and caps the duration to a 30s benchmark.
   */
  const handleStart = () => {
    dispatch({
      type: "START_GAME",
      payload: {
        words: generateWords(30), // Pulls an array pool of exactly 30 words
        duration: 30,             // Sets total time remaining baseline
      },
    });
  };

  /**
   * Effect A: The Global Document Window Key Interceptor
   * Intercepts and formats key events directly off the page surface, translating 
   * native keyboard events into strictly-typed game action tokens.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let inputAction: GameInputAction | null = null;

      // Classify and normalize the incoming raw string event
      if (e.key === " ") {
        inputAction = "SPACE_SUBMIT"; // Spaces submit the current active word string
      } else if (e.key === "Backspace") {
        inputAction = "BACKSPACE";    // Deletes the last tracking index character
      } else if (e.key.length === 1) {
        inputAction = "CHARACTER_INPUT"; // Standard alpha-numeric inputs
      }

      // Guard Clause: Instantly dump tracking if the key is a system helper (e.g., Shift, Alt, Escape)
      if (!inputAction) return;

      // Layout Override: Stops Spacebar and Backspace from scrolling down the browser viewport window
      e.preventDefault();

      // Broadcast the key metadata directly into our Reducer logic block
      dispatch({
        type: "KEY_PRESS",
        payload: {
          action: inputAction,
          key: e.key,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          now: Date.now(), // Realtime timestamp checks inside reducer trigger the timer start on index 0
        },
      });
    };

    // Attach listener globally to the layout window element
    window.addEventListener("keydown", handleKeyDown);

    /**
     * Garbage Collection / Lifecycle Cleanup
     * Detaches the window hook whenever the component unmounts or hot-reloads.
     * Crucial to prevent system resource leakage and double-firing listeners.
     */
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Stable dispatch reference allows an empty array, binding the hook precisely once on layout mount

  /**
   * Effect B: The Game Clock Heartbeat Mechanism
   * Drives the internal timing clock cycle whenever the engine state transitions to an active round.
   */
  useEffect(() => {
    // Phase Protection Guard: If the game state is static (INITIAL, GAME_OVER), let the thread sleep
    if (phase.status !== "PLAYING") return;

    // Instantiate a background runtime cycle hitting precisely every 1000ms
    const intervalId = setInterval(() => {
      dispatch({
        type: "TICK",
        payload: { now: Date.now() }, // Supplies exact execution time to contrast against start thresholds
      });
    }, 1000);

    /**
     * Automatic Clock Destruction
     * Removes the interval routine immediately when the status discriminator changes 
     * from 'PLAYING' to 'GAME_OVER' to protect structural timing accuracy.
     */
    return () => {
      clearInterval(intervalId);
    };
  }, [phase.status]); // Re-evaluates and runs cleanup/setup exactly when the state status switches

  return (
    <main className="app-container">
      <section className="app-card fade-in">
        <h1 className="app-title">
          typing <span>engine</span>
        </h1>

        <p className="subtitle">Current Phase Status: {phase.status}</p>

        {/* ==========================================
            VIEW LEVEL 1: Splash Menu/Start Screen 
            ========================================== */}
        {phase.status === "INITIAL" && (
          <button onClick={handleStart} className="btn-action">
            start game
          </button>
        )}

        {/* ==========================================
            VIEW LEVEL 2: Live Gameplay UI 
            ========================================== */}
        {phase.status === "PLAYING" && (
          <>
            {/* Standard Remaining Countdown Output */}
            <div className="timer-display">{phase.metrics.timeRemaining}s</div>

            {/* Target Display Box: Shows what the user is supposed to type */}
            <div className="console-box">
              <div className="console-label">target word</div>
              <div className="target-word">
                {/* Dynamically reads index route pointer from state to fetch current target */}
                {phase.wordStream[phase.metrics.wordIndex]}
              </div>
            </div>

            {/* User Typing Input Display Box */}
            <div className="console-box">
              <div className="console-label">your input</div>
              <div className="input-row">
                {phase.metrics.typed ? (
                  // Turn the raw input string into an array to cycle render individual tokens
                  phase.metrics.typed.split("").map((char, index) => (
                    <span
                      key={`${char}-${index}`}
                      className="char-token correct" // Standard text wrapper styling hook
                    >
                      {/* Unicode space conversion ensures whitespace maps out visually instead of collapsing collapsing */}
                      {char === " " ? "\u00A0" : char}
                    </span>
                  ))
                ) : (
                  // Fallback string placeholder output if user input is empty
                  <span className="subtitle">...</span>
                )}

                {/* Animated styling element representing the typing position marker */}
                <span className="blinking-caret" />
              </div>
            </div>

            {/* Realtime Character Score Trackers */}
            <div className="stats-row">
              <div>
                correct:{" "}
                <span className="highlight">{phase.metrics.correctChars}</span>
              </div>
              <div>
                errors:{" "}
                <span className="alert">{phase.metrics.errorChars}</span>
              </div>
            </div>
          </>
        )}

        {/* ==========================================
            VIEW LEVEL 3: End of Game Scoreboard Summary 
            ========================================== */}
        {phase.status === "GAME_OVER" && (
          <>
            <h2 className="summary-title">game over</h2>

            {/* Layout Grid exposing overall statistics pulled from phase metrics */}
            <div className="summary-grid">
              <div>
                <div className="summary-metric-label">correct characters</div>
                <div className="summary-metric-value success">
                  {phase.metrics.correctChars}
                </div>
              </div>

              <div>
                <div className="summary-metric-label">error characters</div>
                <div className="summary-metric-value error">
                  {phase.metrics.errorChars}
                </div>
              </div>
            </div>

            {/* Resets and fires a new game session using the initial handler logic */}
            <button onClick={handleStart} className="btn-action">
              play again
            </button>
          </>
        )}
      </section>
    </main>
  );
}