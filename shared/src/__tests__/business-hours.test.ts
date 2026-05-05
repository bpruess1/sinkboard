import { businessHoursElapsed } from '../business-hours';

// --------------- Business Hours Calculation Tests ---------------

describe('businessHoursElapsed', () => {
  test('returns 0 for same timestamp', () => {
    const now = new Date('2024-01-15T10:00:00Z'); // Monday
    expect(businessHoursElapsed(now.toISOString(), now)).toBe(0);
  });

  test('calculates hours within same weekday', () => {
    const start = new Date('2024-01-15T09:00:00Z'); // Monday 9am
    const end = new Date('2024-01-15T17:00:00Z'); // Monday 5pm
    expect(businessHoursElapsed(start.toISOString(), end)).toBe(8);
  });

  test('excludes weekend days', () => {
    const friday = new Date('2024-01-12T09:00:00Z'); // Friday 9am
    const monday = new Date('2024-01-15T17:00:00Z'); // Monday 5pm
    // Friday: 15 hours (9am-midnight)
    // Saturday/Sunday: 0 hours
    // Monday: 17 hours (midnight-5pm)
    expect(businessHoursElapsed(friday.toISOString(), monday)).toBe(32);
  });

  test('calculates multiple weekdays correctly', () => {
    const monday = new Date('2024-01-15T09:00:00Z'); // Monday 9am
    const wednesday = new Date('2024-01-17T17:00:00Z'); // Wednesday 5pm
    // Monday: 15 hours (9am-midnight)
    // Tuesday: 24 hours (full day)
    // Wednesday: 17 hours (midnight-5pm)
    expect(businessHoursElapsed(monday.toISOString(), wednesday)).toBe(56);
  });

  test('returns 0 for weekend-only period', () => {
    const saturday = new Date('2024-01-13T09:00:00Z'); // Saturday
    const sunday = new Date('2024-01-14T17:00:00Z'); // Sunday
    expect(businessHoursElapsed(saturday.toISOString(), sunday)).toBe(0);
  });

  test('handles single full weekday', () => {
    const start = new Date('2024-01-15T00:00:00Z'); // Monday midnight
    const end = new Date('2024-01-16T00:00:00Z'); // Tuesday midnight
    expect(businessHoursElapsed(start.toISOString(), end)).toBe(24);
  });

  test('handles partial weekend overlap', () => {
    const thursday = new Date('2024-01-11T18:00:00Z'); // Thursday 6pm
    const saturday = new Date('2024-01-13T10:00:00Z'); // Saturday 10am
    // Thursday: 6 hours (6pm-midnight)
    // Friday: 24 hours
    // Saturday: 0 hours
    expect(businessHoursElapsed(thursday.toISOString(), saturday)).toBe(30);
  });

  test('handles month boundaries', () => {
    const endOfMonth = new Date('2024-01-31T20:00:00Z'); // Wednesday
    const startOfMonth = new Date('2024-02-01T08:00:00Z'); // Thursday
    // Jan 31: 4 hours (8pm-midnight)
    // Feb 1: 8 hours (midnight-8am)
    expect(businessHoursElapsed(endOfMonth.toISOString(), startOfMonth)).toBe(12);
  });

  test('handles year boundaries', () => {
    const endOfYear = new Date('2023-12-29T16:00:00Z'); // Friday
    const startOfYear = new Date('2024-01-02T10:00:00Z'); // Tuesday
    // Dec 29 (Fri): 8 hours (4pm-midnight)
    // Dec 30-31 (Sat-Sun): 0 hours
    // Jan 1 (Mon): 24 hours
    // Jan 2 (Tue): 10 hours (midnight-10am)
    expect(businessHoursElapsed(endOfYear.toISOString(), startOfYear)).toBe(42);
  });
});
