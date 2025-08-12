#!/usr/bin/env node
import {
  initDemoMatch,
  playDemoTrick,
  generateHumanLog,
  TrickPlay,
} from './index';

function runDemo(seed: string) {
  const state = initDemoMatch(seed);
  // Play first trick: each player plays their first card in seat order
  const plays1: TrickPlay[] = [];
  for (let p = 0; p < 6; p++) {
    plays1.push({ player: p, card: state.hands[p][0] });
  }
  playDemoTrick(state, plays1);
  // Play second trick if any cards remain (they will)
  const plays2: TrickPlay[] = [];
  for (let p = 0; p < 6; p++) {
    if (state.hands[p].length > 0) {
      plays2.push({ player: p, card: state.hands[p][0] });
    }
  }
  playDemoTrick(state, plays2);
  console.log(generateHumanLog(state));
}

// Run simulation for N seeds provided via CLI or default to 5.
const count = parseInt(process.argv[2] ?? '5', 10);
for (let i = 0; i < count; i++) {
  runDemo(`demo-${i}`);
}