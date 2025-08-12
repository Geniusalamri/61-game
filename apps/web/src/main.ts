import { create } from 'zustand';
import {
  Card,
  MatchState,
  initMatch,
  legalMoves,
  playCard,
  generateMatchLog,
} from '@61-game/engine';
import type { Suit } from '@61-game/shared';

// ---------- Store ----------
interface GameStore {
  match: MatchState | null;
  language: 'en' | 'ar';
  logText: string;
  /**
   * Cards of the current trick being played. When the trick completes, this
   * collection is moved into playedTricks and reset. Each entry records the
   * player and the card they played.
   */
  currentGroup: { player: number; card: Card }[];
  /**
   * All completed trick groups. Each group contains the six cards played
   * along with a random offset to scatter the piles slightly across the table.
   */
  playedTricks: { cards: { player: number; card: Card }[]; offsetX: number; offsetY: number }[];
  initGame(seed?: string): void;
  selectCard(player: number, card: Card): void;
  toggleLanguage(): void;
  downloadLog(): void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  language: 'en',
  logText: '',
  currentGroup: [],
  playedTricks: [],
  initGame: (seed = `game-${Date.now()}`) => {
    const match = initMatch(seed);
    set({ match, logText: '', currentGroup: [], playedTricks: [] });
  },
  selectCard: (player, card) => {
    const state = get().match;
    if (!state) return;
    const moves = legalMoves(state, player);
    if (!moves.some((c) => c.rank === card.rank && c.suit === card.suit)) return;
    // record the player's card into the current trick group
    const currGrp = get().currentGroup;
    currGrp.push({ player, card });
    playCard(state, player, card);
    // if trick completed (six cards played), finalize the group
    if (!state.currentTrick || state.currentTrick.length === 0) {
      // create random offset for the new trick pile
      const offsetX = (Math.random() - 0.5) * 40; // random shift between -20 and 20 px
      const offsetY = (Math.random() - 0.5) * 40; // random shift between -20 and 20 px
      const newGroup = { cards: [...currGrp], offsetX, offsetY };
      const tricks = get().playedTricks;
      tricks.push(newGroup);
      // reset current group
      set({ playedTricks: tricks, currentGroup: [] });
    } else {
      // update current group only
      set({ currentGroup: currGrp });
    }
    // helper function to auto-play AI turns with delay
    const autoPlayNext = () => {
      const st = get().match;
      if (!st) return;
      // determine next player
      const trick = st.currentTrick ?? [];
      const nextPlayer = (st.leadPlayer + trick.length) % 6;
      const cardsRemaining = st.hands.reduce((acc, h) => acc + h.length, 0);
      // If the hand ended, record log and finish
      if (cardsRemaining === 0 && (!st.currentTrick || st.currentTrick.length === 0)) {
        const log = generateMatchLog(st);
        set({ logText: log });
        return;
      }
      // Stop if it's player's turn again
      if (nextPlayer === 0) return;
      // compute legal moves for AI
      const nextMoves = legalMoves(st, nextPlayer);
      if (nextMoves.length === 0) return;
      const nextCard = nextMoves[0];
      // schedule AI play after a delay
      setTimeout(() => {
        // record AI card into current group
        const currGrpAI = get().currentGroup;
        currGrpAI.push({ player: nextPlayer, card: nextCard });
        playCard(st, nextPlayer, nextCard);
        // if trick finished, finalize group
        if (!st.currentTrick || st.currentTrick.length === 0) {
          const offsetX = (Math.random() - 0.5) * 40;
          const offsetY = (Math.random() - 0.5) * 40;
          const newGroup = { cards: [...currGrpAI], offsetX, offsetY };
          const tricks = get().playedTricks;
          tricks.push(newGroup);
          set({ match: { ...st }, playedTricks: tricks, currentGroup: [] });
        } else {
          // otherwise just update group and match
          set({ match: { ...st }, currentGroup: currGrpAI });
        }
        autoPlayNext();
      }, 700);
    };
    // update store before starting auto-play
    set({ match: { ...state } });
    autoPlayNext();
  },
  toggleLanguage: () => {
    set((s) => ({ language: s.language === 'en' ? 'ar' : 'en' }));
  },
  downloadLog: () => {
    const log = get().logText;
    if (!log) return;
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '61-game-log.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
}));

// ---------- DOM elements ----------
const scoreAEl = document.getElementById('scoreA')!;
const scoreBEl = document.getElementById('scoreB')!;
const boardEl = document.getElementById('board')!;
const handEl = document.getElementById('hand')!;
const newGameBtn = document.getElementById('btnNew')!;
const downloadBtn = document.getElementById('btnDownload')!;
const langBtn = document.getElementById('btnLang')!;

// Central elements
const drawPileEl = document.getElementById('drawPile')!;
const trumpEl = document.getElementById('trumpCard')!;
const tableCardsEl = document.getElementById('tableCards')!;

// Create board slots on startup
// Seat positions around the board; offsets tuned to leave room for central deck/trump
const slotPositions: { top?: string; bottom?: string; left?: string; right?: string }[] = [
  { bottom: '10%', left: 'calc(50% - 50px)' },      // player 0 bottom center
  { bottom: '18%', right: '8%' },                   // player 1 bottom right
  { top: '30%', right: '8%' },                      // player 2 right center
  { top: '10%', left: 'calc(50% - 50px)' },         // player 3 top center
  { top: '30%', left: '8%' },                       // player 4 left center
  { bottom: '18%', left: '8%' },                    // player 5 bottom left
];
const slotEls: HTMLElement[] = [];
function initBoard() {
  // Remove existing slot elements if any (do not remove central area)
  slotEls.splice(0, slotEls.length);
  const existingSlots = boardEl.querySelectorAll('.slot');
  existingSlots.forEach((el) => el.remove());
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    Object.assign(slot.style, slotPositions[i]);
    boardEl.appendChild(slot);
    slotEls.push(slot as HTMLElement);
  }
}

// Render UI based on store state
function render() {
  const { match, language } = useGameStore.getState();
  if (!match) return;
  // Update scores
  scoreAEl.textContent = String(match.scores[0]);
  scoreBEl.textContent = String(match.scores[1]);
  // Update player's hand (player 0)
  handEl.innerHTML = '';
  const myHand = [...match.hands[0]];
  // sort by suit and strength similar to engine order
  myHand.sort((a, b) => {
    const suitOrder: Record<Suit, number> = {
      spades: 0,
      hearts: 1,
      diamonds: 2,
      clubs: 3,
    };
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    // compare ranks by engine order (higher rank first)
    const order: Record<string, number> = {
      A: 0,
      '7': 1,
      K: 2,
      Q: 3,
      J: 4,
      '6': 5,
      '5': 6,
      '4': 7,
      '3': 8,
    };
    return order[a.rank] - order[b.rank];
  });
  myHand.forEach((card) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    const top = document.createElement('div');
    top.className = 'top';
    top.textContent = card.rank;
    const middle = document.createElement('div');
    middle.className = 'middle';
    middle.textContent = suitSymbol(card.suit);
    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    bottom.textContent = card.rank;
    // colorize suits
    const color = card.suit === 'hearts' || card.suit === 'diamonds' ? '#c62828' : '#111';
    top.style.color = color;
    middle.style.color = color;
    bottom.style.color = color;
    cardDiv.appendChild(top);
    cardDiv.appendChild(middle);
    cardDiv.appendChild(bottom);
    // disable if not player's turn
    const trick = match.currentTrick ?? [];
    const turnPlayer = (match.leadPlayer + trick.length) % 6;
    if (turnPlayer !== 0) {
      cardDiv.classList.add('dim');
    } else {
      cardDiv.onclick = () => {
        useGameStore.getState().selectCard(0, card);
      };
    }
    // highlight if trump
    if (card.suit === match.trump) {
      cardDiv.style.border = '2px solid #4cc9f0';
    }
    handEl.appendChild(cardDiv);
  });
  // Update board slots
  for (let i = 0; i < 6; i++) {
    const slot = slotEls[i];
    slot.innerHTML = '';
    const teamKey = i % 2 === 0 ? 'A' : 'B';
    slot.style.borderColor = teamKey === 'A' ? 'rgba(230,57,70,0.5)' : 'rgba(42,157,244,0.5)';
    const label = document.createElement('div');
    label.textContent = `Seat ${i + 1} • ${teamKey}`;
    label.style.fontSize = '0.7rem';
    slot.appendChild(label);
  }
  // Update draw pile count
  drawPileEl.setAttribute('data-count', String(match.deck.length));
  // Update trump card face
  trumpEl.innerHTML = '';
  if (match.trumpCard) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    const top = document.createElement('div');
    top.className = 'top';
    top.textContent = match.trumpCard.rank;
    const mid = document.createElement('div');
    mid.className = 'middle';
    mid.textContent = suitSymbol(match.trumpCard.suit);
    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    bottom.textContent = match.trumpCard.rank;
    const col = match.trumpCard.suit === 'hearts' || match.trumpCard.suit === 'diamonds' ? '#c62828' : '#111';
    top.style.color = col;
    mid.style.color = col;
    bottom.style.color = col;
    cardDiv.appendChild(top);
    cardDiv.appendChild(mid);
    cardDiv.appendChild(bottom);
    trumpEl.appendChild(cardDiv);
  }
  // Update table cards: draw each completed trick group stacked with random offsets
  tableCardsEl.innerHTML = '';
  const { playedTricks, currentGroup } = useGameStore.getState();
  // Create DOM elements for each group
  playedTricks.forEach((group, groupIdx) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.transform = `translate(${group.offsetX}px, ${group.offsetY}px)`;
    container.style.zIndex = String(groupIdx + 1);
    container.style.pointerEvents = 'none';
    // assign a slight random rotation to the whole group for variation
    const groupRotation = (Math.random() - 0.5) * 10; // -5 to 5 degrees
    container.style.transform += ` rotate(${groupRotation}deg)`;
    // For each card in the group, create a radial fan
    const n = group.cards.length;
    const angleStep = 12;
    const startAngle = -((n - 1) / 2) * angleStep;
    group.cards.forEach((entry, idx) => {
      const { card } = entry;
      const angle = startAngle + idx * angleStep;
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.style.position = 'absolute';
      cardDiv.style.left = '0';
      cardDiv.style.top = '0';
      cardDiv.style.transformOrigin = 'left bottom';
      cardDiv.style.transform = `rotate(${angle}deg) translateX(-40px)`;
      cardDiv.style.zIndex = String(idx + 1);
      const tt = document.createElement('div');
      tt.className = 'top';
      tt.textContent = card.rank;
      const mm = document.createElement('div');
      mm.className = 'middle';
      mm.textContent = suitSymbol(card.suit);
      const bb = document.createElement('div');
      bb.className = 'bottom';
      bb.textContent = card.rank;
      const colr = card.suit === 'hearts' || card.suit === 'diamonds' ? '#c62828' : '#111';
      tt.style.color = colr;
      mm.style.color = colr;
      bb.style.color = colr;
      cardDiv.appendChild(tt);
      cardDiv.appendChild(mm);
      cardDiv.appendChild(bb);
      container.appendChild(cardDiv);
    });
    tableCardsEl.appendChild(container);
  });
  // Also render the current group (current trick) on top if not yet completed
  if (currentGroup.length > 0) {
    const cContainer = document.createElement('div');
    cContainer.style.position = 'absolute';
    cContainer.style.left = '0';
    cContainer.style.top = '0';
    cContainer.style.zIndex = String(playedTricks.length + 1);
    cContainer.style.pointerEvents = 'none';
    const n = currentGroup.length;
    const angleStep = 12;
    const startAngle = -((n - 1) / 2) * angleStep;
    currentGroup.forEach((entry, idx) => {
      const { card } = entry;
      const angle = startAngle + idx * angleStep;
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.style.position = 'absolute';
      cardDiv.style.left = '0';
      cardDiv.style.top = '0';
      cardDiv.style.transformOrigin = 'left bottom';
      cardDiv.style.transform = `rotate(${angle}deg) translateX(-40px)`;
      cardDiv.style.zIndex = String(idx + 1);
      const tt = document.createElement('div');
      tt.className = 'top';
      tt.textContent = card.rank;
      const mm = document.createElement('div');
      mm.className = 'middle';
      mm.textContent = suitSymbol(card.suit);
      const bb = document.createElement('div');
      bb.className = 'bottom';
      bb.textContent = card.rank;
      const colr = card.suit === 'hearts' || card.suit === 'diamonds' ? '#c62828' : '#111';
      tt.style.color = colr;
      mm.style.color = colr;
      bb.style.color = colr;
      cardDiv.appendChild(tt);
      cardDiv.appendChild(mm);
      cardDiv.appendChild(bb);
      cContainer.appendChild(cardDiv);
    });
    tableCardsEl.appendChild(cContainer);
  }
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
  }
}

// Initialise
function init() {
  initBoard();
  // Start a demo game
  useGameStore.getState().initGame('demo');
  // Render initial state
  render();
  // Subscribe to store changes
  useGameStore.subscribe(render);
  // Hook up buttons
  newGameBtn.addEventListener('click', () => {
    useGameStore.getState().initGame();
  });
  downloadBtn.addEventListener('click', () => {
    useGameStore.getState().downloadLog();
  });
  langBtn.addEventListener('click', () => {
    useGameStore.getState().toggleLanguage();
    langBtn.textContent = useGameStore.getState().language === 'en' ? 'AR' : 'EN';
  });
}

init();