// ==========================================
// 1. Persistent User Profile
// ==========================================
export interface Profile {
  level: number;
  xp: number;
  bestWpm: number;
}

// ==========================================
// 2. Simplified Input Types
// ==========================================
// Collapsed the exhaustive character list. The reducer only cares about 
// characters that append to the string, or standard typing control keys.
export type GameInputAction = "CHARACTER_INPUT" | "BACKSPACE" | "SPACE_SUBMIT";

export interface KeyPressPayload {
  key: string;               // Raw DOM KeyboardEvent.key string
  action: GameInputAction;
  shiftKey: boolean;
  ctrlKey: boolean;          // Useful for Ctrl+Backspace (delete whole word)
}

// ==========================================
// 3. Transient Gameplay Metrics (Per-Session Only)
// ==========================================
export interface GameplayMetrics {
  wordIndex: number;         // Track current position in the array
  typed: string;             // Current word's progress string
  correctChars: number;
  errorChars: number;
  lastWpm: number;
  startTime: number | null;  // For precise elapsed time calculation
  duration: number; // the original total, set once, never changed
  timeRemaining: number;     // For countdown visualization
}

// ==========================================
// 4. Decoupled Phase Union (State Machine)
// ==========================================
export type GamePhase = 
  | { status: "INITIAL" }
  | { status: "PLAYING"; wordStream: string[]; metrics: GameplayMetrics }
  | { status: "GAME_OVER"; wordStream: string[]; metrics: GameplayMetrics };

// ==========================================
// 5. Root Application State
// ==========================================
export interface AppState {
  profile: Profile;          // Survives phase transitions, ready for LocalStorage
  phase: GamePhase;          // Isolated transient gameplay state
}

// ==========================================
// 6. Reducer Actions
// ==========================================
export type AppAction =
  | { type: "START_GAME"; payload: { words: string[]; duration: number } }
  | { type: "KEY_PRESS"; payload: KeyPressPayload }
  | { type: "TICK"; payload: { now: number } }
  | { type: "END_GAME" };