// --------------- Tier Configuration ---------------

export const TIER_VALUES = {
  S: 1,
  M: 2,
  L: 4,
  XL: 8,
} as const;

export type SizeTier = keyof typeof TIER_VALUES;

// --------------- Sink Rate Configuration ---------------

/** Hours of business time for a chest to sink from 0% to 100% depth */
export const TIER_SINK_HOURS = {
  S: 120, // 5 business days
  M: 72,  // 3 business days
  L: 48,  // 2 business days
  XL: 24, // 1 business day
} as const;

/** Sink rate: depth percent gained per business-millisecond */
export const TIER_SINK_RATE_PER_MS = {
  S: 100 / (120 * 3600 * 1000),
  M: 100 / (72 * 3600 * 1000),
  L: 100 / (48 * 3600 * 1000),
  XL: 100 / (24 * 3600 * 1000),
} as const;

// --------------- Jewel System Configuration ---------------

/** Business hours threshold for jewel level progression */
export const JEWEL_THRESHOLD_HOURS = 24;

/** Maximum jewel level attainable */
export const MAX_JEWEL_LEVEL = 5;

// --------------- Depth Calculation ---------------

/**
 * Calculate current depth percentage for a task based on business hours elapsed
 * @param sizeTier - Task size tier (S, M, L, XL)
 * @param businessHoursMs - Business hours elapsed in milliseconds
 * @returns Depth percentage (0-100)
 */
export function calculateCurrentDepth(sizeTier: SizeTier, businessHoursMs: number): number {
  const sinkRate = TIER_SINK_RATE_PER_MS[sizeTier];
  const depth = businessHoursMs * sinkRate;
  return Math.min(100, Math.max(0, depth));
}
