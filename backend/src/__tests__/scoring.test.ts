import { calculateJewelLevel } from '../services/scoring';
import { JEWEL_THRESHOLD_HOURS, MAX_JEWEL_LEVEL } from '@sink-board/shared';

// Mock the businessHoursElapsed function
jest.mock('@sink-board/shared', () => ({
  ...jest.requireActual('@sink-board/shared'),
  businessHoursElapsed: jest.fn(),
}));

import { businessHoursElapsed } from '@sink-board/shared';

const mockBusinessHoursElapsed = businessHoursElapsed as jest.MockedFunction<
  typeof businessHoursElapsed
>;

// --------------- Jewel Level Calculation Tests ---------------

describe('calculateJewelLevel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 0 for new task with no kraken', () => {
    mockBusinessHoursElapsed.mockReturnValue(0);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(level).toBe(0);
  });

  test('calculates level 1 after threshold hours', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(level).toBe(1);
  });

  test('calculates level 2 after double threshold', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS * 2);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(level).toBe(2);
  });

  test('caps at MAX_JEWEL_LEVEL', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS * 999);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(level).toBe(MAX_JEWEL_LEVEL);
  });

  test('subtracts kraken count from level', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS * 3);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 1);
    expect(level).toBe(2); // 3 - 1 = 2
  });

  test('never goes below 0 with multiple krakens', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 5);
    expect(level).toBe(0); // 1 - 5 = -4, capped at 0
  });

  test('handles exact threshold boundaries', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS - 0.1);
    const levelBefore = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(levelBefore).toBe(0);

    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS + 0.1);
    const levelAfter = calculateJewelLevel('2024-01-15T10:00:00Z', 0);
    expect(levelAfter).toBe(1);
  });

  test('handles kraken reducing max level task', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS * 999);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 2);
    expect(level).toBe(MAX_JEWEL_LEVEL - 2);
  });

  test('returns 0 when kraken count exceeds earned level', () => {
    mockBusinessHoursElapsed.mockReturnValue(JEWEL_THRESHOLD_HOURS * 2);
    const level = calculateJewelLevel('2024-01-15T10:00:00Z', 10);
    expect(level).toBe(0);
  });
});
