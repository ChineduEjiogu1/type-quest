// Loads/saves the durable profile (level, xp, bests, result history) via localStorage.
import type { Profile } from "../game/types";

const STORAGE_KEY = "typequest-profile";

export function saveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function loadProfile(): Profile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}