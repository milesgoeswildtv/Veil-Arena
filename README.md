# Veil Arena

Arena is the shared game engine behind Veil's Discord and Telegram elimination games.

## Themes

- `vibe_queen_slots` — Vibe Queen Slots / Haunted Arena
- `full_tilt` — Full Tilt Arena
- `dwallet` — DWallet Telegram Arena

The DWallet theme contains exactly **13,000** narration templates across kills, self-eliminations, community showdowns, multi-pins, revivals, normal events, and rare DWallet glitches.

## Telegram / DWallet setup

The Telegram integration uses the same Arena engine and D1 database as Discord. Telegram matches are scoped to the Telegram group and use the `dwallet` theme automatically.

Before registering the Telegram webhook, configure these Cloudflare Worker secrets. Never commit either value to the repository:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

`TELEGRAM_WEBHOOK_SECRET` should be a long random value containing only letters, numbers, underscores, and hyphens. `ADMIN_SECRET` must also already be configured for the setup page.

After deployment, open:

```text
https://<your-worker-domain>/setup/telegram
```

Enter the existing `ADMIN_SECRET` and press **REGISTER TELEGRAM**. Veil will register `/telegram/webhook` with Telegram and publish these bot commands:

- `/arena` — open DWallet Arena registration
- `/arena rules` — show DWallet Arena rules
- `/arenastats` — show the user's stats for that Telegram group
- `/arenaleaderboard` — show that Telegram group's leaderboard

Add Veil to the DWallet Telegram group. The host who runs `/arena` is entered automatically. Other players use the inline **ENTER ARENA** button, and only the host can start the match.

## Telegram cooldown

A completed Telegram Arena starts a **30-minute cooldown for that Telegram group**. The cooldown is not per-player and does not block Arena in other Telegram groups or Discord servers.

## Development

```bash
npm install
npm test
npm run dev
```

`npm test` runs the original Arena smoke suite plus the Telegram/DWallet suite. CI also syntax-checks the production modules before running the tests.
