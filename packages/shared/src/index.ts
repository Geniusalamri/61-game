// Shared types, constants and utilities.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | 'K' | 'Q' | 'J' | '7' | '6' | '5' | '4' | '3';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Points per rank according to the game rules.
export const POINTS: Record<Rank, number> = {
  A: 11,
  K: 4,
  Q: 2,
  J: 3,
  '7': 10,
  '6': 0,
  '5': 0,
  '4': 0,
  '3': 0,
};

// Suits in display order (useful for UI).
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// Ranks in strength order (highest first).
export const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', '7', '6', '5', '4', '3'];