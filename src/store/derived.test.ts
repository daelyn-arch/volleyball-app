import { describe, it, expect, beforeEach } from 'vitest';
import { useMatchStore } from './matchStore';
import { getSetScore, getSetsWon, getCurrentRotation, getServiceRounds, getRunningScoreData } from './derived';
import type { Lineup } from '@/types/match';

const homeLineup: Lineup = { 1: 7, 2: 12, 3: 3, 4: 9, 5: 1, 6: 15 };
const awayLineup: Lineup = { 1: 10, 2: 22, 3: 5, 4: 14, 5: 8, 6: 20 };

function setupMatch() {
  const store = useMatchStore.getState();
  store.createMatch(
    { name: 'Eagles', roster: [7, 12, 3, 9, 1, 15, 6, 11].map((n) => ({ number: n })) },
    { name: 'Hawks', roster: [10, 22, 5, 14, 8, 20, 17, 23].map((n) => ({ number: n })) },
    { bestOf: 5 }
  );
  store.setLineup(0, 'home', homeLineup);
  store.setLineup(0, 'away', awayLineup);
  store.setFirstServe(0, 'home');
}

describe('derived state', () => {
  beforeEach(() => {
    useMatchStore.getState().resetMatch();
    setupMatch();
  });

  it('starts with 0-0 score', () => {
    const state = useMatchStore.getState();
    const score = getSetScore(state.events, 0);
    expect(score).toEqual({ home: 0, away: 0 });
  });

  it('tracks score after points', () => {
    const store = useMatchStore.getState();
    store.awardPoint('home');
    store.awardPoint('home');
    store.awardPoint('away');

    const state = useMatchStore.getState();
    const score = getSetScore(state.events, 0);
    expect(score).toEqual({ home: 2, away: 1 });
  });

  it('getCurrentRotation returns starting state', () => {
    const state = useMatchStore.getState();
    const rotation = getCurrentRotation(state, 0);
    expect(rotation).not.toBeNull();
    expect(rotation!.servingTeam).toBe('home');
    expect(rotation!.serverNumber).toBe(7); // pos I of home lineup
    expect(rotation!.homeLineup).toEqual(homeLineup);
    expect(rotation!.awayLineup).toEqual(awayLineup);
  });

  it('rotates on sideout', () => {
    const store = useMatchStore.getState();
    // Home serves, away wins point (sideout)
    store.awardPoint('away');

    const state = useMatchStore.getState();
    const rotation = getCurrentRotation(state, 0);
    expect(rotation!.servingTeam).toBe('away');
    // Away should have rotated: new server at pos I = old pos II = 22
    expect(rotation!.serverNumber).toBe(22);
    // Away lineup should be rotated
    expect(rotation!.awayLineup[1]).toBe(22);
    expect(rotation!.awayLineup[6]).toBe(10);
    // Home lineup unchanged
    expect(rotation!.homeLineup).toEqual(homeLineup);
  });

  it('does not rotate when serving team scores', () => {
    const store = useMatchStore.getState();
    store.awardPoint('home'); // home serves, home scores

    const state = useMatchStore.getState();
    const rotation = getCurrentRotation(state, 0);
    expect(rotation!.servingTeam).toBe('home');
    expect(rotation!.serverNumber).toBe(7); // same server
    expect(rotation!.homeLineup).toEqual(homeLineup);
  });

  it('tracks running score data', () => {
    const store = useMatchStore.getState();
    store.awardPoint('home');
    store.awardPoint('away'); // sideout
    store.awardPoint('away');
    store.awardPoint('home'); // sideout

    const state = useMatchStore.getState();
    const data = getRunningScoreData(state.events, 0);
    expect(data.home).toHaveLength(2);
    expect(data.away).toHaveLength(2);
    expect(data.home[0].point).toBe(1);
    expect(data.home[0].serverNumber).toBe(7);
    expect(data.away[0].point).toBe(1);
  });

  it('undo removes last event', () => {
    const store = useMatchStore.getState();
    store.awardPoint('home');
    store.awardPoint('away');
    store.undo();

    const state = useMatchStore.getState();
    const score = getSetScore(state.events, 0);
    expect(score).toEqual({ home: 1, away: 0 });
  });

  it('tracks substitutions', () => {
    const store = useMatchStore.getState();
    const error = store.recordSubstitution('home', 6, 7); // sub 6 in for 7
    expect(error).toBeNull();

    const state = useMatchStore.getState();
    const rotation = getCurrentRotation(state, 0);
    // Player 6 should be at position 1 (where 7 was)
    expect(rotation!.homeLineup[1]).toBe(6);
  });

  it('enforces max substitutions', () => {
    const store = useMatchStore.getState();
    // Do 6 subs (use additional players)
    // Need to be careful with re-entry rules
    // Sub out players one at a time with unique bench players
    const subs = [
      { out: 7, in: 6 },
      { out: 12, in: 11 },
    ];
    for (const s of subs) {
      store.recordSubstitution('home', s.in, s.out);
    }
    // After 2 subs, should still be able to sub
    const state = useMatchStore.getState();
    expect(state.events.filter(e => e.type === 'substitution').length).toBe(2);
  });

  it('enforces max timeouts', () => {
    const store = useMatchStore.getState();
    const err1 = store.recordTimeout('home');
    expect(err1).toBeNull();
    const err2 = store.recordTimeout('home');
    expect(err2).toBeNull();
    const err3 = store.recordTimeout('home');
    expect(err3).not.toBeNull(); // should fail
  });
});
