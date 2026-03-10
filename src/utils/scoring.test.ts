import { describe, it, expect } from 'vitest';
import { getSetWinner, isSetComplete, isMatchComplete, shouldSwitchSides, getPointsTarget, DEFAULT_CONFIG } from './scoring';
import type { MatchConfig, Score } from '@/types/match';

const config5: MatchConfig = DEFAULT_CONFIG; // best of 5, 25 pts, 15 deciding

const config3: MatchConfig = {
  ...DEFAULT_CONFIG,
  bestOf: 3,
};

describe('getSetWinner', () => {
  it('returns null when nobody has reached target', () => {
    expect(getSetWinner({ home: 20, away: 18 }, 0, config5)).toBe(null);
  });

  it('returns home when home reaches 25 with 2+ lead', () => {
    expect(getSetWinner({ home: 25, away: 20 }, 0, config5)).toBe('home');
  });

  it('returns null at 25-24 (not win by 2)', () => {
    expect(getSetWinner({ home: 25, away: 24 }, 0, config5)).toBe(null);
  });

  it('returns home at 26-24 (win by 2)', () => {
    expect(getSetWinner({ home: 26, away: 24 }, 0, config5)).toBe('home');
  });

  it('returns away at 30-28 in deuce', () => {
    expect(getSetWinner({ home: 28, away: 30 }, 0, config5)).toBe('away');
  });

  it('uses 15 points for deciding set (5th set in best-of-5)', () => {
    expect(getSetWinner({ home: 15, away: 10 }, 4, config5)).toBe('home');
    expect(getSetWinner({ home: 14, away: 10 }, 4, config5)).toBe(null);
  });

  it('uses 15 points for deciding set (3rd set in best-of-3)', () => {
    expect(getSetWinner({ home: 10, away: 15 }, 2, config3)).toBe('away');
  });

  it('enforces win by 2 in deciding set', () => {
    expect(getSetWinner({ home: 15, away: 14 }, 4, config5)).toBe(null);
    expect(getSetWinner({ home: 16, away: 14 }, 4, config5)).toBe('home');
  });
});

describe('isSetComplete', () => {
  it('returns true when there is a winner', () => {
    expect(isSetComplete({ home: 25, away: 20 }, 0, config5)).toBe(true);
  });

  it('returns false when no winner', () => {
    expect(isSetComplete({ home: 24, away: 20 }, 0, config5)).toBe(false);
  });
});

describe('isMatchComplete', () => {
  it('returns true when a team wins 3 sets in best-of-5', () => {
    expect(isMatchComplete({ home: 3, away: 1 }, config5)).toBe(true);
    expect(isMatchComplete({ home: 2, away: 3 }, config5)).toBe(true);
  });

  it('returns false with 2-2 in best-of-5', () => {
    expect(isMatchComplete({ home: 2, away: 2 }, config5)).toBe(false);
  });

  it('returns true when a team wins 2 sets in best-of-3', () => {
    expect(isMatchComplete({ home: 2, away: 0 }, config3)).toBe(true);
  });
});

describe('getPointsTarget', () => {
  it('returns 25 for regular sets', () => {
    expect(getPointsTarget(0, config5)).toBe(25);
    expect(getPointsTarget(3, config5)).toBe(25);
  });

  it('returns 15 for deciding set', () => {
    expect(getPointsTarget(4, config5)).toBe(15);
    expect(getPointsTarget(2, config3)).toBe(15);
  });
});

describe('shouldSwitchSides', () => {
  it('returns false for non-deciding sets', () => {
    expect(shouldSwitchSides({ home: 4, away: 4 }, 0, config5)).toBe(false);
  });

  it('returns true at switch point in deciding set (8 pts)', () => {
    expect(shouldSwitchSides({ home: 5, away: 3 }, 4, config5)).toBe(true);
    expect(shouldSwitchSides({ home: 4, away: 4 }, 4, config5)).toBe(true);
  });

  it('returns false at other points in deciding set', () => {
    expect(shouldSwitchSides({ home: 5, away: 4 }, 4, config5)).toBe(false);
  });
});
