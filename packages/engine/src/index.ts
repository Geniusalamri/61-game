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
 * Full match state for a complete 61 hand.  Extends the demo state to
 * support continuous drawing from the deck and full 6‑trick play.  This
 * structure is internal to the engine; consumers can inspect scores and
 * logs after playHand() completes.
 */
export interface MatchState {
  /** Seed used to initialise the RNG */
  seed: string;
  /** Remaining draw pile */
  deck: Card[];
  /** Trump suit (called the ruler) */
  trump: Suit;
  /** Index (0–5) of the player who will lead the next trick */
  leadPlayer: number;
  /** 6 player hands, each containing 0–3 cards */
  hands: Card[][];
  /** Team scores for this hand */
  scores: [number, number];
  /** Accumulated points from tied tricks */
  tiePoints: number;
  /** Queue of punishment submissions (currently unused but carried through) */
  punishment: PunishmentQueue;
  /** Log of each play in order */
  log: { player: number; card: Card; action: string }[];

  /** The card that determines the trump suit, revealed at the start of the hand. */
  trumpCard: Card;

  /**
   * Current trick in progress.  Plays accumulate here until six cards have
   * been played, at which point the trick is resolved and cleared.  Each
   * entry records the player index and the card they played.
   */
  currentTrick?: TrickPlay[];
}

/**
 * Initialise a full 61 match.  Deals 3 cards to each of 6 players and
 * determines the trump suit from the top of the draw pile.  The initial
 * lead is seat 0.
 */
export function initMatch(seed: string): MatchState {
  const rng = createRng(stringToSeed(seed));
  const deck = createShuffledDeck(rng);
  const hands: Card[][] = Array.from({ length: 6 }, () => []);
  for (let i = 0; i < 3; i++) {
    for (let p = 0; p < 6; p++) {
      hands[p].push(deck.shift()!);
    }
  }
  // Determine trump from the top of the remaining draw pile
  const trumpCard = deck[0];
  const trump = trumpCard.suit;
  // Move the trump card to the bottom of the draw pile so it is drawn last
  deck.shift();
  deck.push(trumpCard);
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
    trumpCard,
  };
}

/**
 * Helper to draw cards after a trick.  The winner draws first, then the
 * remaining players clockwise until everyone has three cards or the deck
 * is empty.  Modifies state in place.
 */
function drawAfterTrick(state: MatchState, winner: number): void {
  // Determine the order in which players draw: winner first, then clockwise
  for (let offset = 0; offset < 6; offset++) {
    const player = (winner + offset) % 6;
    while (state.hands[player].length < 3 && state.deck.length > 0) {
      const card = state.deck.shift()!;
      state.hands[player].push(card);
    }
  }
}

/**
 * Play an entire hand until all cards are exhausted.  This function is
 * primarily intended for simulations and internal testing; user interfaces
 * should call lower‑level routines to handle interactive play.
 *
 * It uses a trivial strategy for play: each player simply plays the
 * first card in their hand when it is their turn.  Following suit is
 * not enforced by the updated rules, so any card may be played.
 *
 * Returns the final match state after all cards have been played.
 */
export function playHand(state: MatchState): MatchState {
  // Continue until all hands are empty
  let cardsRemaining = state.hands.reduce((acc, h) => acc + h.length, 0);
  while (cardsRemaining > 0) {
    // Determine play order for this trick starting from leadPlayer
    const plays: TrickPlay[] = [];
    for (let i = 0; i < 6; i++) {
      const player = (state.leadPlayer + i) % 6;
      const hand = state.hands[player];
      if (hand.length === 0) {
        continue; // no card to play (should not happen in a proper hand)
      }
      // Simple strategy: play the first card in the hand
      const card = hand.shift()!;
      plays.push({ player, card });
      state.log.push({ player, card, action: 'play' });
    }
    // Resolve the trick
    const result = resolveTrick(plays, state.trump);
    // Collect points
    if (result.tie) {
      state.tiePoints += result.points;
      // lead remains the same
    } else if (result.winner !== null) {
      const team = teamOfPlayer(result.winner);
      state.scores[team] += result.points + state.tiePoints;
      state.tiePoints = 0;
      // update lead; lead only changes when the winning team changes
      state.leadPlayer = nextLead(state.leadPlayer, result.winner);
      // Draw cards for next trick if deck has cards
      if (state.deck.length > 0) {
        drawAfterTrick(state, result.winner);
      }
    }
    cardsRemaining = state.hands.reduce((acc, h) => acc + h.length, 0);
  }
  return state;
}

/**
 * Return the list of legal moves for a given player.  Under the updated
 * rules, following suit is optional, so the only constraint is that
 * players must have at least one card.  If it is not the player's turn
 * (based on lead and plays so far), an empty array is returned.
 */
export function legalMoves(state: MatchState, player: number): Card[] {
  // Determine whose turn it is in the current trick
  const trick = state.currentTrick ?? [];
  const turnPlayer = (state.leadPlayer + trick.length) % 6;
  if (player !== turnPlayer) return [];
  return [...state.hands[player]];
}

/**
 * Play a card in the interactive match.  Validates that it is the
 * player's turn and that the card exists in their hand.  Appends the
 * play to the current trick.  When six cards have been played, it
 * resolves the trick, updates scores, handles ties and drawing, and
 * sets up the next trick.  Mutates state in place.
 */
export function playCard(state: MatchState, player: number, card: Card): void {
  // Ensure it's the player's turn
  const trick = state.currentTrick ?? [];
  const turnPlayer = (state.leadPlayer + trick.length) % 6;
  if (player !== turnPlayer) {
    throw new Error(`It's not player ${player}'s turn`);
  }
  // Find and remove the card from the player's hand
  const hand = state.hands[player];
  const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
  if (idx === -1) {
    throw new Error('Player does not have that card');
  }
  hand.splice(idx, 1);
  // Append to current trick
  if (!state.currentTrick) state.currentTrick = [];
  state.currentTrick.push({ player, card });
  // Add to log
  state.log.push({ player, card, action: 'play' });
  // If six cards played or everyone is out of cards (end of hand), resolve trick
  const trickComplete = state.currentTrick.length === 6;
  if (trickComplete) {
    const plays = state.currentTrick;
    state.currentTrick = [];
    const result = resolveTrick(plays, state.trump);
    if (result.tie) {
      // Accumulate tie points
      state.tiePoints += result.points;
      // lead remains the same
    } else if (result.winner !== null) {
      const team = teamOfPlayer(result.winner);
      state.scores[team] += result.points + state.tiePoints;
      state.tiePoints = 0;
      // Update lead: lead only changes when winner belongs to another team
      state.leadPlayer = nextLead(state.leadPlayer, result.winner);
      // Draw cards for next trick if deck has cards
      if (state.deck.length > 0) {
        drawAfterTrick(state, result.winner);
      }
    }
  }
}

/**
 * Generate a human‑readable log for a full hand.  Includes seed, trump,
 * moves and final scores.  This extends the demo version by including
 * all cards played in sequence.
 */
export function generateMatchLog(state: MatchState): string {
  let out = `Seed: ${state.seed}\nTrump: ${state.trump}\n`;
  state.log.forEach((entry, idx) => {
    out += `Move ${idx + 1}: Player ${entry.player + 1} played ${entry.card.rank}${suitSymbol(entry.card.suit)}\n`;
  });
  out += `Scores – Team A: ${state.scores[0]}, Team B: ${state.scores[1]}\n`;
  return out;
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