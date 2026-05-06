/**
 * Shared constants for task management, scoring, and sink mechanics.
 * All constants exported with proper TypeScript types for type-safe imports.
 */

// --------------- Task Size Tier Values ---------------

/**
 * Point values assigned to each task size tier.
 * Used for sprint capacity planning and scoring.
 */
export const TIER_VALUES: Record<string, number> = {
  S: 1,
  M: 2,
  L: 4,
  XL: 8,
};

// --------------- Sink Timing Configuration ---------------

/**
 * Hours of business time for a chest to sink from 0% to 100% depth.
 * Business time = weekdays only (Mon-Fri), calculated in UTC.
 */
export const TIER_SINK_HOURS: Record<string, number> = {
  S: 120, // 5 business days
  M: 72,  // 3 business days
  L: 48,  // 2 business days
  XL: 24, // 1 business day
};

/**
 * Sink rate: depth percent gained per business-millisecond.
 * Calculated as: 100% / (hours * 3600s * 1000ms)
 */
export const TIER_SINK_RATE_PER_MS: Record<string, number> = {
  S: 100 / (120 * 3600 * 1000),
  M: 100 / (72 * 3600 * 1000),
  L: 100 / (48 * 3600 * 1000),
  XL: 100 / (24 * 3600 * 1000),
};

// --------------- Jewel Level Configuration ---------------

/**
 * Minimum rank a kraken must have to be eligible for jewel calculation.
 * Lower rank = higher priority. Set to 5 to exclude low-priority blockers.
 */
export const MIN_KRAKEN_RANK = 5;

/**
 * Business hours required for each jewel level increment.
 * Tasks gain one jewel level per threshold, with kraken penalties applied.
 */
export const JEWEL_THRESHOLD_HOURS = 24;

/**
 * Maximum jewel level a task can achieve.
 * Caps the visual indicator to prevent unbounded growth.
 */
export const MAX_JEWEL_LEVEL = 5;

// --------------- Depth Calculation Constants ---------------

/**
 * Maximum depth percentage (100%).
 * Tasks at this depth are considered "sunken" and highest priority.
 */
export const MAX_DEPTH_PERCENT = 100;

/**
 * Minimum depth percentage (0%).
 * Newly created tasks start at this depth.
 */
export const MIN_DEPTH_PERCENT = 0;

// --------------- Type Exports ---------------

/**
 * Valid task size tiers.
 * Used for validation and type-safe operations.
 */
export type SizeTier = 'S' | 'M' | 'L' | 'XL';

/**
 * Type-safe tier value lookup.
 */
export type TierValue = typeof TIER_VALUES[SizeTier];
