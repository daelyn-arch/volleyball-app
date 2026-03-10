import { describe, it, expect } from 'vitest';
import { rotateLineup, getServer, isBackRow, isFrontRow, findPlayerPosition, applySubstitution } from './rotation';
import type { Lineup } from '@/types/match';

const testLineup: Lineup = {
  1: 7,  // I - server
  2: 12, // II
  3: 3,  // III
  4: 9,  // IV
  5: 1,  // V
  6: 15, // VI
};

describe('rotateLineup', () => {
  it('rotates all players one position', () => {
    const rotated = rotateLineup(testLineup);
    // Player at pos 2 moves to pos 1
    expect(rotated[1]).toBe(12);
    // Player at pos 3 moves to pos 2
    expect(rotated[2]).toBe(3);
    // Player at pos 1 (7) wraps to pos 6
    expect(rotated[6]).toBe(7);
  });

  it('full rotation (6 times) returns to original', () => {
    let lineup = { ...testLineup };
    for (let i = 0; i < 6; i++) {
      lineup = rotateLineup(lineup);
    }
    expect(lineup).toEqual(testLineup);
  });
});

describe('getServer', () => {
  it('returns player at position I', () => {
    expect(getServer(testLineup)).toBe(7);
  });
});

describe('isBackRow / isFrontRow', () => {
  it('identifies back row positions (I, V, VI)', () => {
    expect(isBackRow(1)).toBe(true);
    expect(isBackRow(5)).toBe(true);
    expect(isBackRow(6)).toBe(true);
    expect(isBackRow(2)).toBe(false);
    expect(isBackRow(3)).toBe(false);
    expect(isBackRow(4)).toBe(false);
  });

  it('identifies front row positions (II, III, IV)', () => {
    expect(isFrontRow(2)).toBe(true);
    expect(isFrontRow(3)).toBe(true);
    expect(isFrontRow(4)).toBe(true);
    expect(isFrontRow(1)).toBe(false);
  });
});

describe('findPlayerPosition', () => {
  it('finds player in lineup', () => {
    expect(findPlayerPosition(testLineup, 7)).toBe(1);
    expect(findPlayerPosition(testLineup, 12)).toBe(2);
    expect(findPlayerPosition(testLineup, 99)).toBe(null);
  });
});

describe('applySubstitution', () => {
  it('replaces the correct player', () => {
    const newLineup = applySubstitution(testLineup, 7, 22);
    expect(newLineup[1]).toBe(22); // 7 was at pos 1, now 22
    expect(newLineup[2]).toBe(12); // unchanged
  });
});
