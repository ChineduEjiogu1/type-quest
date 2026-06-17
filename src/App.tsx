import { useReducer, useEffect } from "react";
import { appReducer } from "./game/reducer";
import { generateWords } from "./game/words";
import type { GameInputAction } from "./game/types";
import { createInitialState, computeAccuracy, computeWpm } from "./game/engine"; 
import { awardXp } from "./game/progression";
import { loadProfile, saveProfile } from "../src/hooks/usePersistentProgress"; 
import "./App.css";

/**
 * App Component
 * Serves as the central controller, visual shell, and side-effect boundary
 * for the typing application. Coordinates browser I/O with the pure game core.
 */
export default function App() {
  /**
   * 1. State Machine Initialization (Lazy Boundary Hydration)
   * React calls this 3rd argument initializer exactly once when the component mounts.
   * This isolates the impure disk read entirely within the UI edge layer, keeping
   * engine.ts 100% pure, deterministic, and free of DOM dependencies.
   */
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    const baseState = createInitialState(); // Fetches pure structural defaults
    const savedProfile = loadProfile();    // Side effect: reads from localStorage

    if (savedProfile) {
      return {
        ...baseState,
        profile: savedProfile, // Hydrates state tree seamlessly with saved data
      };
    }
    return baseState;
  });

  /**
   * 2. Root State Destructuring
   * Pulling 'profile' out at the root level alongside 'phase'. 
   * It remains a global peer to the phase union, making its data accessible
   * across all screens without type-narrowing constraints.
   */
  const { phase, profile } = state;

  /**
   * Game Initialization Trigger
   */
  const handleStart = () => {
    dispatch({
      type: "START_GAME",
      payload: {
        words: generateWords(30),
        duration: 30,
      },
    });
  };

  /**
   * Effect A: The Global Document Window Key Interceptor
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let inputAction: GameInputAction | null = null;

      if (e.key === " ") {
        inputAction = "SPACE_SUBMIT";
      } else if (e.key === "Backspace") {
        inputAction = "BACKSPACE";
      } else if (e.key.length === 1) {
        inputAction = "CHARACTER_INPUT";
      }

      if (!inputAction) return;
      e.preventDefault();

      dispatch({
        type: "KEY_PRESS",
        payload: {
          action: inputAction,
          key: e.key,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          now: Date.now(), // Passes absolute wall-clock anchor into the action payload
        },
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /**
   * Effect B: The Game Clock Heartbeat Mechanism
   */
  useEffect(() => {
    if (phase.status !== "PLAYING") return;

    const intervalId = setInterval(() => {
      dispatch({
        type: "TICK",
        payload: { now: Date.now() }, // Feeds raw timestamps to counter interval drift
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [phase.status]);

  /**
   * Effect C: The Permanent Progression Auto-Save Hook
   * Watches the profile state anchor. The split second a game crosses into 
   * GAME_OVER and updates metrics, this commits the changes to disk storage.
   */
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  return (
    <main className="app-container">
      <section className="app-card fade-in">
        
        {/* ==========================================
            PERSISTENT RPG STATUS HEADER
            Always mounted, always visible across all game phases
            ========================================== */}
        <header className="profile-header">
          <div className="profile-badge">lvl <span>{profile.level}</span></div>
          <div className="profile-stat">xp: <strong>{profile.xp}</strong></div>
          <div className="profile-stat">best wpm: <strong>{profile.bestWpm}</strong></div>
        </header>

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

            {/* Target Display Box */}
            <div className="console-box">
              <div className="console-label">target word</div>
              <div className="target-word">
                {phase.wordStream[phase.metrics.wordIndex]}
              </div>
            </div>

            {/* User Typing Input Display Box */}
            <div className="console-box">
              <div className="console-label">your input</div>
              <div className="input-row">
                {phase.metrics.typed ? (
                  <div className="word-box">
                    {(() => {
                      const targetWord = phase.wordStream[phase.metrics.wordIndex] ?? "";
                      
                      return phase.metrics.typed.split("").map((char, index) => {
                        const expectedChar = targetWord[index];
                        const isCorrect = char === expectedChar;
                        const className = `char-token ${isCorrect ? "correct" : "incorrect"}`;

                        return (
                          <span key={index} className={className}>
                            {char === " " ? "\u00A0" : char}
                          </span>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <span className="subtitle">...</span>
                )}

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
          (() => {
            const elapsedSeconds = phase.metrics.duration - phase.metrics.timeRemaining;
            const finalAccuracy = computeAccuracy(phase.metrics);
            const finalWpm = computeWpm(phase.metrics.correctChars, elapsedSeconds);
            
            // Compute run-specific XP bounty locally using identical pure inputs
            const runXpEarned = awardXp(phase.metrics.correctChars, finalAccuracy);

            return (
              <>
                <h2 className="summary-title">game over</h2>

                <div className="summary-grid">
                  {/* WPM Metric Column */}
                  <div>
                    <div className="summary-metric-label">wpm</div>
                    <div className="summary-metric-value accent">{finalWpm}</div>
                  </div>

                  {/* Accuracy Metric Column */}
                  <div>
                    <div className="summary-metric-label">accuracy</div>
                    <div className="summary-metric-value accent">{finalAccuracy}%</div>
                  </div>

                  {/* Flourish: Run Bounty XP Output */}
                  <div>
                    <div className="summary-metric-label">xp gained</div>
                    <div className="summary-metric-value reward">+{runXpEarned}</div>
                  </div>
                </div>

                <div className="summary-grid sub-metrics">
                  <div>
                    <div className="summary-metric-label">correct characters</div>
                    <div className="summary-metric-value success">{phase.metrics.correctChars}</div>
                  </div>

                  <div>
                    <div className="summary-metric-label">error characters</div>
                    <div className="summary-metric-value error">{phase.metrics.errorChars}</div>
                  </div>
                </div>

                <button onClick={handleStart} className="btn-action">
                  play again
                </button>
              </>
            );
          })()
        )}
      </section>
    </main>
  );
}