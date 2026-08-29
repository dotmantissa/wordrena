# Wordrena

Wordrena is a creature battler for people who would rather describe a move than choose one from a list.

You craft a creature, write its abilities in ordinary language, and let GenLayer validators turn those words into numbers that can survive a fight. The arena uses live weather readings for its biomes. The tribunal gives players a real way to question a balance decision.

## The game

1. Craft a creature by choosing an element and a name.
2. Write up to four moves in plain English.
3. Let the validator panel decide power, mana, accuracy, cooldown, effects, scaling, and a power budget.
4. Send your creature into a weather affected biome.
5. Watch the recorded fight play back turn by turn.
6. Appeal a move when its numbers do not match its description.

Creatures gain experience from every fight. The arena writes wins, losses, battles, and experience back to the Bestiary.

## What is on chain

The three Intelligent Contracts are:

1. `Bestiary.py` stores creatures and moves. The forge uses the equivalence principle to reach a comparable balance reading from different validator responses.
2. `Arena.py` runs the deterministic battle simulation and reads weather through the non deterministic web oracle.
3. `Tribunal.py` stores appeals and asks a fresh validator jury to review disputed move numbers.

The current StudioNet deployment is recorded in `deploy/addresses.json`.

## Web application

The Next.js application lives in `web`.

The public pages read directly from StudioNet. Player writes go through a small server action allowlist. The server verifies the Privy access token, creates one custodial player wallet, encrypts its private key with AES 256 GCM, and stores the encrypted value in Neon Postgres. The browser only sees the player address and a signed session.

Email is the only login method. The application does not ask players to connect an external wallet or approve individual transactions.

## Run it locally

Install the root dependencies and the web dependencies.

```bash
npm install
cd web
npm install
```

Create `.env` from `.env.example` for contract scripts. Create `web/.env.local` from `web/.env.example` for the application. Keep both files out of git.

Start the web app:

```bash
cd web
npm run dev
```

The application uses the StudioNet contracts in `deploy/addresses.json` unless explicit address variables are set in `web/.env.local`.

## Verification

Contract lint:

```bash
npm run lint:contracts
```

Direct contract tests:

```bash
npm test
```

Web lint, typecheck, and production build:

```bash
cd web
npm run lint
npm run typecheck
npm run build
```

The direct suite covers crafting, forging, balance clamping, deterministic fights, weather reads, experience, access control, appeals, bonds, cooldowns, and treasury handling.

## Repository notes

`deploy/deploy.mjs` deploys and wires all three contracts on StudioNet. `scripts/smoke.mjs` drives the live craft, forge, duel, and record flow.

The graphics are part of the game system. Creature art is generated from the creature name and element, biome scenes use their stored weather values, and battle replay controls consume the actual combat log written by the arena.
