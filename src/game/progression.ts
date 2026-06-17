// XP, levels, ranks, unlock rules (level- and skill-gated), and quest checks.

import { computeAccuracy, computeWpm } from "./engine";
import type { GameplayMetrics, Profile } from "./types";

/**
 * Calculates the total experience points awarded for a completed typing run.
 * * Formula: Math.floor(correctChars * (accuracyPercentage / 100))
 * Note: This creates a strict, dual-penalty curve for mistakes. Errors are omitted 
 * from the initial volume pool, and the final total is scaled down again by the fraction.
 * * @param correctChars - The volume metric: total number of successfully typed characters
 * @param accuracyPercentage - The quality metric: the raw percentage value (0 to 100)
 * @returns A stable, non-negative integer representing the XP bounty
 */
export function awardXp(correctChars: number, accuracyPercentage: number): number {
  // 1. Guard against unexpected edge states or negative metrics
  if (correctChars <= 0 || accuracyPercentage <= 0) {
    return 0;
  }

  // 2. Convert the 0-100 percentage metric into a 0.0-1.0 multiplier fraction
  const accuracyMultiplier = accuracyPercentage / 100;

  // 3. Weight the volume against the quality score
  const exactXp = correctChars * accuracyMultiplier;

  // 4. Floor the float down to a clean, consistent whole number integer
  return Math.floor(exactXp);
}
/**
 * Determines a user's current character level based on their lifetime total XP pool.
 * Uses a step-by-step loop approach where each level costs 100 XP more than the last.
 * * Progression Tier Breakdown:
 * - Level 1 to 2 costs: 100 XP
 * - Level 2 to 3 costs: 200 XP
 * - Level 3 to 4 costs: 300 XP (Total cumulative XP needed for Lvl 4: 600 XP)
 * * @param totalXp - The total lifetime accumulated experience points of the player
 * @returns A stable integer representing the maximum level reached (minimum: 1)
 */
export function levelFromXp(totalXp: number): number {
  // Guard Clause: If the user has zero or negative XP, they are safely anchored at Level 1
  if (totalXp <= 0) {
    return 1;
  }

  // 1. Initialize our loop's three moving parts
  let currentLevel = 1;
  let nextLevelCost = 100; // Step-modifier baseline escalation value
  let xpRemaining = totalXp;

  // 2. The Loop Condition: Can we afford the entry ticket to the next level?
  while (xpRemaining >= nextLevelCost) {
    // A. Pay the transaction fee out of our wallet
    xpRemaining -= nextLevelCost;

    // B. Ascend the user up to the next tier
    currentLevel += 1;

    // C. Escalate the price of the upcoming level up by +100 XP
    nextLevelCost += 100;
  }

  // 3. Return the level we are currently standing on when we run out of currency
  return currentLevel;
}

/**
 * Commits a completed game's performance data into the player's lifetime profile record.
 * Composes scoring, accuracy weighting, level calculation, and personal best tracking.
 * * @param currentProfile - The historic profile snapshot before this game round started
 * @param gameMetrics - The raw real-time telemetry from the completed typing test session
 * @returns A pristine, unmutated new Profile object containing updated progression metrics
 */
export function finalizeProfile(currentProfile: Profile, gameMetrics: GameplayMetrics): Profile {
  // 1. Calculate the foundational game run metrics using engine formulas
  const accuracy = computeAccuracy(gameMetrics);
  const elapsedSeconds = gameMetrics.duration - gameMetrics.timeRemaining;
  const currentRunWpm = computeWpm(gameMetrics.correctChars, elapsedSeconds);

  // 2. Compute the XP bounty earned on this specific run
  const xpEarned = awardXp(gameMetrics.correctChars, accuracy);

  // 3. Accumulate total experience pool
  const newXp = currentProfile.xp + xpEarned;

  // 4. Determine if the player reaches a new tier threshold based on total XP pool
  const newLevel = levelFromXp(newXp);

  // 5. Check for a Personal Best WPM record
  const newBestWpm = Math.max(currentProfile.bestWpm, currentRunWpm);

  // 6. Return a brand new Profile object, keeping data immutable
  return {
    xp: newXp,
    level: newLevel,
    bestWpm: newBestWpm
  };
}