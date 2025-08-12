# Game Design Document (GDD) – 61

## Overview

**61** is a traditional Omani trick‑taking card game played by two teams of three players each.  The objective is for a team to accumulate **61 or more points** before the opponents.  Points are earned by winning tricks containing high‑value cards.

This document codifies the deterministic rules used in this project and provides ten worked examples covering common and edge‑case scenarios.  The rules herein are considered authoritative for implementation purposes.

## Components

- **Players**: 6 total, seated alternately (A, B, A, B, A, B) to form two teams of three.
- **Deck**: A 36‑card subset of a standard 52‑card deck consisting of the ranks A, K, Q, J, 7, 6, 5, 4, 3 in each suit (♠ ♥ ♦ ♣).  The remaining ranks (10, 9, 8, 2 and Jokers) are excluded from play and form the **punishment bank**.
- **Points**: Cards award points to the team winning the trick: A = 11, 7 = 10, K = 4, J = 3, Q = 2; all other ranks are worth 0.

## Setup

1. **Shuffling & Dealing** – Shuffle the 36‑card deck and deal 3 cards to each player clockwise.  Place the remaining cards face‑down to form a draw pile.  Reveal the top card of the draw pile and place it face‑up; its suit becomes the **Ruler (trump)** for the entire hand.
2. **Draw pile** – After each trick players will draw from the pile to restore their hands to 3 cards.  The winner of a trick draws first, followed clockwise by others.
3. **Lead** – The player to the dealer’s left leads the first trick.  Thereafter the lead only changes when the winning team changes; within a team the same player continues to lead as long as their team keeps winning successive tricks.

## Trick play

1. **Leading** – The leader may play any card from their hand.
2. **Following suit** – Players must follow the suit of the led card if they have one; otherwise they may play any card.
3. **Winning** – If no trumps are played, the highest card of the led suit wins the trick.  If any trumps are played, the highest trump wins.  Card strength follows the order A > K > Q > J > 7 > 6 > 5 > 4 > 3.
4. **Tie** – If two or more cards tie for highest (e.g. A♥ led and another A♥ is played from the opposing team), the trick is considered a **tie**.  The engine detects this deterministic collision.  Points for the tied trick are unclaimed until a non‑tie trick resolves.  The next trick’s winner collects the points and must immediately submit **two punishment cards** following the punishment flow.
5. **Drawing** – After resolving a trick, players draw from the pile until their hands return to 3 cards.  The trick winner draws first, followed clockwise by the remaining players.

## Scoring

After each trick (or resolved tie), the team winning the trick (or the next non‑tie trick) collects the cumulative points from all cards in that trick (and any outstanding tied trick).  Scores accumulate across tricks until one team reaches **61 or more** points; that team wins the match.

## Punishment flow

At the end of each round or match (configurable), the losing team must submit punishment cards into the **bank** according to the following strict sequence:

1. All 10s,
2. Then all 9s,
3. Then all 8s,
4. Then a single 2.

When a 2 is submitted, any previously submitted punishment cards are returned to the losing team and the punishment queue resets.

During the match, these punishment cards are merely visual – they are not part of the playing deck.  The 2‑card is placed behind the second player of the receiving team in the UI to visually signal the reset.

## Non‑functional requirements

- **Determinism** – Given a seed and the sequence of actions, the engine must produce identical outcomes.  This allows matches to be replayed for debugging or auditing.
- **Accessibility** – The interface must support keyboard navigation on desktop, provide appropriate ARIA roles, and supply colour‑blind‑friendly palettes.  An Arabic (RTL) localisation must be available.
- **Performance** – Target 60 FPS on mid‑range mobile devices by employing object pooling, texture atlases and efficient Three.js scenes.

## Worked examples

The following scenarios illustrate the core rules.  All examples assume the ruler (trump) suit is **Spades (♠)** unless stated otherwise.  Player order is P1 (lead), P2, P3, P4, P5, P6; teams alternate (P1,P3,P5 are Team A; P2,P4,P6 are Team B).  Scores reflect the cumulative tally after the trick resolves.

### Example 1 – Standard trick with no trumps

**State:** P1 leads with **Q♥**, P2 plays **7♥**, P3 plays **A♥**, P4 plays **6♥**, P5 plays **K♥**, P6 plays **5♥**.

- All players follow suit (hearts); no trumps are played.
- Highest heart is **A♥** (P3), so Team A wins the trick.
- Points in the trick: A=11, 7=10, K=4, Q=2 → **27 points** for Team A.
- P3 becomes the lead for the next trick (Team A holds lead).

### Example 2 – Trump over led suit

**State:** P1 leads with **K♦**, P2 plays **J♦**, P3 plays **A♦**, P4 plays **4♠** (trump), P5 plays **Q♦**, P6 plays **5♦**.

- P1 leads diamonds; all players must follow diamonds if possible.
- P4 has no diamonds (or chooses to trump) and plays **4♠**.  This is a trump and automatically outranks all diamonds.
- No other trumps are played, so **4♠** (P4, Team B) wins.
- Points: A=11, K=4, J=3, Q=2 → **20 points** for Team B.
- Team B gains lead; P4 leads next trick.

### Example 3 – Multiple trumps, highest wins

**State:** P4 leads with **6♣**, P5 plays **3♣**, P6 plays **J♠**, P1 plays **7♠**, P2 plays **5♣**, P3 plays **4♠**.

- P4 leads clubs; players follow if able.  P6, P1 and P3 play spades (trumps).
- Among trumps **J♠**, **7♠** and **4♠**, the highest is **J♠** (P6).
- Team B wins the trick for **3 points** (J=3).  P6 leads next.

### Example 4 – Tie resolution and punishment

**State:** P1 leads **A♥**, P2 plays **A♥** (Team B), P3 plays **K♥**, P4 plays **5♥**, P5 plays **4♥**, P6 plays **3♥**.

- Two **A♥** cards are played, one from each team.  They are of equal rank and suit.
- This results in a **tie**; the trick’s points (11+11+4=26) are held in limbo.
- The next trick is played.  Suppose P2 wins that trick.  P2’s team (Team B) collects 26 points **plus** the points from the second trick.  Immediately afterwards P2 must submit **two punishment cards** according to the punishment flow.

### Example 5 – Non‑rotating lead within winning team

**State:** Team A wins trick 1 via P3.  P3 leads trick 2 and wins again for Team A.  Even though P5 is also on Team A, the lead does **not rotate** to P5.  As long as Team A keeps winning consecutively, P3 continues to lead.

### Example 6 – Lead changes on team change

**State:** P1 (Team A) leads and wins trick 1.  P1 leads trick 2 but Team B wins (say P4).  For trick 3 the lead passes to P4.  If Team B continues to win, P4 continues to lead; otherwise lead passes back to the winning team.

### Example 7 – Scoring with zero‑point cards

**State:** P1 leads **3♦**, P2 plays **4♦**, P3 plays **6♦**, P4 plays **5♦**, P5 plays **7♦**, P6 plays **Q♦**.

- All cards follow suit; no trumps.
- Highest is **Q♦** (P6).  Team B wins.
- Only Q and 7 carry points in this trick: Q=2, 7=10 → **12 points** for Team B.

### Example 8 – Punishment queue reset on 2

At the end of a match, Team A loses.  They must submit punishment cards.  The flow is: all 10s, then all 9s, then all 8s, then a single 2.  When they submit the 2, all previously submitted 10s/9s/8s are returned and the punishment queue resets.  Visually, the 2‑card is shown behind the second player of Team A in the UI.

### Example 9 – Trump marker and HUD

In the UI the current trump suit is marked on the table (e.g. by a badge showing ♠).  The HUD displays which player’s turn it is, remaining cards in the draw pile, and each team’s cumulative score.  When playing in Arabic/RTL mode, the HUD mirrors its layout.

### Example 10 – Endgame pressure

Suppose Team A has 51 points and Team B has 30.  Team B must play aggressively to prevent Team A from reaching 61.  Bots are expected to be aware of such situations and, for example, avoid wasting high trumps unless it can prevent the opponent from scoring enough points to win in the next trick.
