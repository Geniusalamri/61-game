import { RANK_ORDER, POINTS, Suit, Rank, Card } from '@61-game/shared';

/**
 * Simple linear congruential generator for deterministic pseudo‑random numbers.
 * Given a numeric seed, returns a function that generates values in [0, 1).
 *
 * @param seed Any finite numeric seed.
 */
export function createRng(seed: number): () => number {
  // constants for 32‑bit LCG (Numerical Recipes)
  let state = seed >>> 0;
  const a = 1664525;
  const c = 1013904223;
  const m = 0x100000000;
  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

/** Convert arbitrary string seeds into numeric seeds using a simple hash. */
export function stringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Returns a freshly shuffled 36‑card deck given a seeded RNG.
 */
export function createShuffledDeck(rng: () => number): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks: Rank[] = ['A', 'K', 'Q', 'J', '7', '6', '5', '4', '3'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  // Fisher‑Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Determine which team a player belongs to (0 = Team A, 1 = Team B). */
export function teamOfPlayer(player: number): 0 | 1 {
  return (player % 2) as 0 | 1;
}

/**
 * Compute a comparison weight for a card given the trump and led suits.
 * Higher weights are stronger.
 */
export function cardWeight(card: Card, trump: Suit, led: Suit | null): number {
  // higher rank should yield a larger weight.  Compute a rank strength where A=8 (highest), 3=0 (lowest)
  const idx = RANK_ORDER.indexOf(card.rank as Rank);
  const rankStrength = (RANK_ORDER.length - 1) - idx;
  if (card.suit === trump) return 200 + rankStrength;
  if (led && card.suit === led) return 100 + rankStrength;
  return rankStrength;
}

export interface TrickPlay {
  player: number;
  card: Card;
}

export interface TrickResult {
  /** Index of the winning player, or null if tie */
  winner: number | null;
  /** Total points contained in this trick */
  points: number;
  /** Whether the trick ended in a tie */
  tie: boolean;
}

/**
 * Resolve a single trick given the plays, trump suit and led suit.
 * Returns the winning player index, total points and tie flag.
 */
export function resolveTrick(
  plays: TrickPlay[],
  trump: Suit,
): TrickResult {
  if (plays.length === 0) throw new Error('No plays to resolve');
  const led = plays[0].card.suit;
  const weights = plays.map((p) => cardWeight(p.card, trump, led));
  const maxWeight = Math.max(...weights);
  const indices = weights
    .map((w, i) => (w === maxWeight ? i : -1))
    .filter((i) => i >= 0);
  const points = plays.reduce((acc, p) => acc + POINTS[p.card.rank], 0);
  if (indices.length > 1) {
    // tie
    return { winner: null, points, tie: true };
  }
  return { winner: plays[indices[0]].player, points, tie: false };
}

/**
 * Seat/lead controller.  Given the current lead and the winning player, determine
 * the next leader according to the rule: lead only changes when the winning team changes.
 */
export function nextLead(currentLead: number, winner: number | null): number {
  if (winner === null) {
    // tie: keep current lead
    return currentLead;
  }
  const currentTeam = teamOfPlayer(currentLead);
  const winnerTeam = teamOfPlayer(winner);
  return winnerTeam === currentTeam ? currentLead : winner;
}

/**
 * Punishment queue controller.  Maintains a sequence of punishment cards.
 * When called, it appends the next punishment card to the queue and
 * resets when the 2 card is submitted.
 */
export class PunishmentQueue {
  // New punishment sequence: two 10s, two 9s, two 8s, two 2s
  private static sequence = ['10', '10', '9', '9', '8', '8', '2', '2'];
  public queue: string[] = [];
  private index = 0;

  submit(): void {
    const card = PunishmentQueue.sequence[this.index];
    this.queue.push(card);
    if (card === '2') {
      // On submitting a 2, return all previously submitted cards and reset index
      this.queue = [];
    }
    this.index = (this.index + 1) % PunishmentQueue.sequence.length;
  }
}

/**
 * Game state for a simplified two‑trick demo.  This is not a full match implementation
 * but provides the minimal data needed for demonstration and testing.
 */
export interface DemoState {
  seed: string;
  deck: Card[];
  trump: Suit;
  leadPlayer: number;
  hands: Card[][];
  scores: [number, number];
  tiePoints: number;
  punishment: PunishmentQueue;
  log: { player: number; card: Card; action: string }[];
}

/**
 * Initialise a demo match with a given seed.  Deals 3 cards per player and
 * determines the trump suit from the top of the remaining deck.
 */
export function initDemoMatch(seed: string): DemoState {
  const rng = createRng(stringToSeed(seed));
  const deck = createShuffledDeck(rng);
  // Deal 3 cards to each of 6 players
  const hands: Card[][] = Array.from({ length: 6 }, () => []);
  for (let i = 0; i < 3; i++) {
    for (let p = 0; p < 6; p++) {
      hands[p].push(deck.shift()!);
    }
  }
  // Determine trump from the top of the draw pile (remaining deck)
  const trumpCard = deck[0];
  const trump = trumpCard.suit;
  return {
    seed,
    deck,
    trump,
    leadPlayer: 0,
    hands,
    scores: [0, 0],
    tiePoints: 0,
    punishment: new PunishmentQueue(),
    log: [],
  };
}

/**
 * Play a single trick in the demo state.  Accepts an ordered list of plays
 * matching the order in which players act.  Updates scores, lead and log.
 */
export function playDemoTrick(state: DemoState, plays: TrickPlay[]): void {
  const { trump } = state;
  // Record plays in log and remove cards from hands
  plays.forEach(({ player, card }) => {
    const idx = state.hands[player].findIndex(
      (c) => c.rank === card.rank && c.suit === card.suit,
    );
    if (idx === -1) throw new Error('Player does not have that card');
    state.hands[player].splice(idx, 1);
    state.log.push({ player, card, action: 'play' });
  });
  // Resolve trick
  const result = resolveTrick(plays, trump);
  if (result.tie) {
    state.tiePoints += result.points;
    // lead stays the same
  } else if (result.winner !== null) {
    const team = teamOfPlayer(result.winner);
    state.scores[team] += result.points + state.tiePoints;
    state.tiePoints = 0;
    // update lead
    state.leadPlayer = nextLead(state.leadPlayer, result.winner);
    // handle punishment if there was a tie
    if (result.points > 0 && state.tiePoints > 0) {
      state.punishment.submit();
    }
  }
}

/**
 * Generate a human‑readable log for the demo state.  Includes seed, moves and scores.
 */
export function generateHumanLog(state: DemoState): string {
  let out = `Seed: ${state.seed}\nTrump: ${state.trump}\n`;
  state.log.forEach((entry, idx) => {
    out += `Move ${idx + 1}: Player ${entry.player + 1} played ${entry.card.rank}${suitSymbol(entry.card.suit)}\n`;
  });
  out += `Scores – Team A: ${state.scores[0]}, Team B: ${state.scores[1]}\n`;
  return out;
}

function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
    default:
      return '';
  }
}