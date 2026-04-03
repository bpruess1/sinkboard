/**
 * Business hours calculator.
 * "Business time" = all hours on weekdays (Mon-Fri), zero on Sat/Sun.
 * All inputs/outputs in UTC.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Returns the start of the UTC day for a given date.
 */
function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Calculate elapsed business milliseconds between two UTC timestamps.
 * Business time accrues 24h/day on Mon-Fri, 0h/day on Sat-Sun.
 *
 * @param from - Start timestamp (ISO string or Date)
 * @param to - End timestamp (ISO string or Date)
 * @returns Elapsed business time in milliseconds
 */
export function businessMsElapsed(from: string | Date, to: string | Date): number {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;

  if (toDate <= fromDate) return 0;

  let elapsed = 0;
  const fromDayStart = startOfUTCDay(fromDate);
  const toDayStart = startOfUTCDay(toDate);

  // Same day case
  if (fromDayStart.getTime() === toDayStart.getTime()) {
    return isWeekday(fromDate) ? toDate.getTime() - fromDate.getTime() : 0;
  }

  // Partial first day
  if (isWeekday(fromDate)) {
    const endOfFromDay = new Date(fromDayStart.getTime() + MS_PER_DAY);
    elapsed += endOfFromDay.getTime() - fromDate.getTime();
  }

  // Full days in between
  let cursor = new Date(fromDayStart.getTime() + MS_PER_DAY);
  while (cursor.getTime() < toDayStart.getTime()) {
    if (isWeekday(cursor)) {
      elapsed += MS_PER_DAY;
    }
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  // Partial last day
  if (isWeekday(toDate)) {
    elapsed += toDate.getTime() - toDayStart.getTime();
  }

  return elapsed;
}

/**
 * Calculate elapsed business hours between two timestamps.
 */
export function businessHoursElapsed(from: string | Date, to: string | Date): number {
  return businessMsElapsed(from, to) / (3600 * 1000);
}

/**
 * Calculate current depth percent for a task.
 *
 * @param savedDepthPercent - The depth when the task was last raised/created
 * @param lastRaisedAt - Timestamp of last raise (ISO string)
 * @param sinkRatePerMs - Depth percent per business millisecond
 * @param now - Current time (defaults to Date.now)
 * @returns Current depth percent, clamped 0-100
 */
export function calculateCurrentDepth(
  savedDepthPercent: number,
  lastRaisedAt: string,
  sinkRatePerMs: number,
  now?: Date | string,
): number {
  const currentTime = now ?? new Date();
  const elapsedMs = businessMsElapsed(lastRaisedAt, currentTime);
  const depth = savedDepthPercent + elapsedMs * sinkRatePerMs;
  return Math.min(100, Math.max(0, depth));
}

/**
 * Calculate raise percent from an AI score.
 * Score 0.0 → 10% raise, Score 1.0 → 90% raise, linear.
 */
export function calculateRaisePercent(aiScore: number): number {
  const clamped = Math.min(1, Math.max(0, aiScore));
  return 10 + clamped * 80;
}
