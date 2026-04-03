import {
  businessHoursElapsed,
  JEWEL_THRESHOLD_HOURS,
  MAX_JEWEL_LEVEL,
} from '@sink-board/shared';

export function calculateJewelLevel(createdAt: string, krakenCount: number): number {
  const hoursAlive = businessHoursElapsed(createdAt, new Date());
  const rawLevel = Math.floor(hoursAlive / JEWEL_THRESHOLD_HOURS);
  const level = Math.min(rawLevel, MAX_JEWEL_LEVEL) - krakenCount;
  return Math.max(0, level);
}
