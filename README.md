# Veil Arena — clean core baseline

This repository was intentionally reset on 2026-09-13 after the Discord/Telegram integration layer accumulated too many experimental wrappers.

## What is canonical and preserved

The Arena game itself remains intact:

- `src/core/engine.js` — canonical game state and combat rules
- `src/core/simulation.js` — simulated contestants/crowd support
- `src/core/orchestrator.js` — platform-neutral round orchestration
- `src/content/**` — base narration
- `src/themes/**` — Vibe Queen Slots, Full Tilt, and DWallet content
- `src/rules.js` — player-facing game rules
- `src/sponsorships.js` — sponsorship and payout calculations
- `src/storage.js` + `migrations/` — game persistence/schema
- `src/logs.js` — game/stat logging
- `src/cooldown.js` — generic Arena cooldown storage
- `assets/` — retained game artwork

## What is intentionally gone

There is currently **no Discord bot, Discord Activity, Telegram bot, Telegram Mini App, OAuth flow, webhook handler, SDK proxy, setup doctor, test bot, or integration-specific UI** in production.

Those integrations will be rebuilt deliberately from their official documentation using fresh credentials. No old integration wrapper is part of the active Worker.

## Production baseline

`src/worker.js` is the only Cloudflare Worker entrypoint. It exposes a simple `/health` endpoint so deployment can be verified before any external platform is connected.

Cloudflare Git Builds can keep the current commands:

- Build: `npm run build:activity-client`
- Deploy: `npx wrangler deploy`

The build command is intentionally a no-op until a new Activity frontend is introduced.

## Credentials

No credentials belong in this repository. Fresh Discord/Telegram secrets should be added only through Cloudflare encrypted secrets/environment variables when those integrations are rebuilt.
