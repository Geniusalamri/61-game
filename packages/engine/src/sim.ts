#!/usr/bin/env node
import {
  initMatch,
  playHand,
  generateMatchLog,
} from './index';

function runMatch(seed: string) {
  const state = initMatch(seed);
  playHand(state);
  console.log(generateMatchLog(state));
}

// Run simulation for N seeds provided via CLI or default to 5.
const count = parseInt(process.argv[2] ?? '5', 10);
for (let i = 0; i < count; i++) {
  runMatch(`demo-${i}`);
}