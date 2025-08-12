// Shared types, constants and utilities.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '7' | 'K' | 'Q' | 'J' | '6' | '5' | '4' | '3';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Points per rank according to the game rules.
export const POINTS: Record<Rank, number> = {
  A: 11,
  '7': 10,
  K: 4,
  J: 3,
  Q: 2,
  '6': 0,
  '5': 0,
  '4': 0,
  '3': 0,
};

// Suits in display order (useful for UI).
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// Ranks in strength order (highest first).
// New ranking order according to updated rules: 7 outranks K, Q, J
export const RANK_ORDER: Rank[] = [
  'A',
  '7',
  'K',
  'Q',
  'J',
  '6',
  '5',
  '4',
  '3',
];