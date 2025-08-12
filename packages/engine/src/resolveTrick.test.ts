import { describe, it, expect } from 'vitest';
import { resolveTrick, nextLead, teamOfPlayer } from './index';

// Helper to construct a card
const c = (rank: any, suit: any) => ({ rank, suit });

describe('resolveTrick', () => {
  it('picks the highest card of the led suit when no trumps', () => {
    const plays = [
      { player: 0, card: c('6', 'hearts') },
      { player: 1, card: c('5', 'hearts') },
      { player: 2, card: c('A', 'hearts') },
      { player: 3, card: c('3', 'hearts') },
      { player: 4, card: c('K', 'hearts') },
      { player: 5, card: c('7', 'hearts') },
    ];
    const res = resolveTrick(plays, 'spades');
    expect(res.winner).toBe(2);
    expect(res.tie).toBe(false);
  });

  it('picks the highest trump if any trumps are played', () => {
    const plays = [
      { player: 0, card: c('6', 'clubs') },
      { player: 1, card: c('5', 'clubs') },
      { player: 2, card: c('A', 'clubs') },
      { player: 3, card: c('4', 'spades') },
      { player: 4, card: c('K', 'clubs') },
      { player: 5, card: c('7', 'clubs') },
    ];
    const res = resolveTrick(plays, 'spades');
    // Only one trump (4♠) so winner is player3
    expect(res.winner).toBe(3);
    expect(res.tie).toBe(false);
  });

  it('detects a tie when two highest cards collide', () => {
    const plays = [
      { player: 0, card: c('A', 'hearts') },
      { player: 1, card: c('A', 'hearts') },
      { player: 2, card: c('K', 'hearts') },
      { player: 3, card: c('J', 'hearts') },
      { player: 4, card: c('7', 'hearts') },
      { player: 5, card: c('6', 'hearts') },
    ];
    const res = resolveTrick(plays, 'clubs');
    expect(res.tie).toBe(true);
    expect(res.winner).toBe(null);
  });

  it('ranks 7 above K, Q and J according to updated rules', () => {
    const plays = [
      { player: 0, card: c('J', 'diamonds') },
      { player: 1, card: c('K', 'diamonds') },
      { player: 2, card: c('7', 'diamonds') },
      { player: 3, card: c('5', 'diamonds') },
      { player: 4, card: c('Q', 'diamonds') },
      { player: 5, card: c('6', 'diamonds') },
    ];
    const res = resolveTrick(plays, 'hearts');
    // No trumps; led suit is diamonds. 7♦ should win because 7 outranks K/Q/J
    expect(res.winner).toBe(2);
  });
});

describe('nextLead', () => {
  it('maintains lead within the same team', () => {
    const currentLead = 0; // team 0
    const winner = 2; // same team (players 0,2,4 belong to team 0)
    expect(nextLead(currentLead, winner)).toBe(currentLead);
  });
  it('changes lead when opposing team wins', () => {
    const currentLead = 0; // team 0
    const winner = 1; // team 1
    expect(nextLead(currentLead, winner)).toBe(winner);
  });
  it('keeps lead on tie', () => {
    const currentLead = 3;
    const winner = null;
    expect(nextLead(currentLead, winner)).toBe(currentLead);
  });
});