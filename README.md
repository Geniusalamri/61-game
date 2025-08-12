# 61 Game

This repository hosts a **production‑ready 3D HTML implementation of the Omani card game 61**.  It is organised as a monorepo using PNPM workspaces and is designed to be portable across modern mobile and desktop browsers.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/) package manager (recommended for workspaces)
- A modern web browser for running and testing the game
- On Linux/macOS you may need additional system packages to run Playwright (see [Playwright docs](https://playwright.dev/))

## Getting started

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd 61-game
pnpm install
```

### Running the web client

The web client lives in `apps/web` and uses [Vite](https://vitejs.dev/) with TypeScript and Three.js.  To start the development server:

```bash
pnpm --filter @61-game/web dev
```

This will open a local development server (usually on port 5173) where you can explore the 3D table UI.  Hot‑reloading is enabled for rapid iteration.

### Running unit tests

Unit tests are written with [Vitest](https://vitest.dev/) and live under individual package directories.  To run all unit tests:

```bash
pnpm test
```

### Running the simulation CLI

During engine development, a small simulation utility is available to exercise the deterministic rules on a few sample rounds.  It lives in the engine package and runs several demo matches using distinct seeds, printing a human‑readable log of the moves and final scores.

Run it with pnpm:

```bash
pnpm sim            # runs 5 demo matches and prints logs
pnpm sim 10         # runs 10 demo matches
```

Each demo prints the seed, the trump suit, every move (player and card), and the cumulative scores.  This is useful for sanity‑checking logic and for property‑based test generation.

### Running end‑to‑end tests

[Playwright](https://playwright.dev/) is configured for E2E smoke tests.  To run the E2E tests headlessly:

```bash
pnpm exec playwright install --with-deps
pnpm test:e2e
```

### Linting and formatting

We enforce code style via [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/).  Lint the entire workspace:

```bash
pnpm lint
```

Format code (if necessary):

```bash
pnpm format
```

### Building for production

To produce an optimised build of the web client:

```bash
pnpm --filter @61-game/web build
```

The output will be emitted into `apps/web/dist`.  You can serve this folder with any static file server.

## Repository structure

The monorepo is organised into several top‑level folders:

- `apps/` – runnable applications.  For now this includes only the web client, but later may include a Socket.IO server (`apps/server`).
- `packages/` – shared libraries and pure logic modules.  The `engine` package holds the deterministic rules engine; `shared` contains common types, constants and utilities; `ui` will house reusable 3D components.
- `tests/` – end‑to‑end tests with Playwright live here.
- `.github/workflows/` – continuous integration configuration.
- `GDD.md` – the game design document describing the rules and several worked examples.

## Next steps

Loop 0 sets up the scaffolding and CI.  The next loop focuses on implementing the pure rules engine in `packages/engine` with high unit test coverage.  See `ASSUMPTIONS.md` for any documented simplifications during implementation.
