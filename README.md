# Veil Arena

Arena is the shared game engine behind Veil's Discord and Telegram elimination games.

## Themes

- `vibe_queen_slots` — Vibe Queen Slots / Haunted Arena
- `full_tilt` — Full Tilt Arena
- `dwallet` — DWallet Telegram Arena

The DWallet theme contains exactly **13,000** narration templates across kills, self-eliminations, community showdowns, multi-pins, revivals, normal events, and rare DWallet glitches.

## DWallet Telegram architecture

DWallet uses a Telegram **Main Mini App** so the group chat does not get flooded by Arena narration.

The Telegram group receives only the Arena launcher/status card and the final winner/cooldown announcement. Registration, live round text, eliminations, Mass Brawls, revivals, roster state and Community Showdown votes happen inside the Mini App window. Discord keeps its existing chat-based Arena behavior.

The Mini App validates Telegram's signed `initData` server-side before trusting the user identity. Interactive actions also verify that the user belongs to the Telegram group, and the Arena binds itself to the verified Telegram chat context after the first interaction.

## Telegram / DWallet setup

The Telegram integration uses the same Arena engine and D1 database as Discord. Telegram matches are scoped to the Telegram group and use the `dwallet` theme automatically.

Before registering Telegram, configure these Cloudflare Worker secrets. Never commit either value to the repository:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

`TELEGRAM_WEBHOOK_SECRET` should be a long random value containing only letters, numbers, underscores, and hyphens. `ADMIN_SECRET` must also already be configured for the setup page.

After deployment, open:

```text
https://<your-worker-domain>/setup/telegram
```

In Telegram, configure Veil's Main Mini App through:

```text
@BotFather
/mybots
→ Veil
→ Bot Settings
→ Configure Mini App
→ Enable Mini App
```

Because BotFather can impose a short URL limit, use the compact Mini App alias:

```text
https://<your-worker-domain>/tg
```

`/tg` serves the same Mini App as `/telegram/arena`.

Then return to `/setup/telegram`, enter the existing `ADMIN_SECRET`, and press **REGISTER TELEGRAM**. Veil will register `/telegram/webhook` and publish the full command menu.

## DWallet Telegram commands

- `/arena` — create a DWallet Arena or reopen the active one
- `/arenastatus` — show whether registration is open, a match is live, or the group is on cooldown
- `/arenarules` — show the DWallet Arena rules; `/arena rules` also works
- `/arenahelp` — show the full command list and aliases
- `/arenastats` — show the user's stats for that Telegram group
- `/arenaleaderboard` — show that group's leaderboard, including win rate after at least 3 Arenas
- `/arenahistory` — show the five most recent completed Arenas
- `/arenalog` — upload the latest completed match narration as a text file
- `/arenalog 2` — upload the previous completed match; larger numbers go farther back

Convenience aliases also work through `/arena`, including `/arena status`, `/arena stats`, `/arena leaderboard`, `/arena history`, `/arena log 2`, `/arena rules`, and `/arena help`.

Personal stats track Arenas played, wins, losses, win rate, total eliminations, most eliminations in one Arena, total revivals, and Community Showdowns survived. Leaderboards rank Arenas played, wins, win rate, total eliminations, best single-game eliminations, revivals, and Community Showdowns survived.

Add Veil to the DWallet Telegram group and make Veil a **group administrator**. The admin role is recommended because Telegram only guarantees reliable `getChatMember` lookups for other users when the bot is an administrator; Arena uses that check to stop forwarded Mini App links from being used by outsiders.

The host who runs `/arena` is entered automatically. Everyone taps **ENTER / WATCH ARENA**, which opens the live game inside Telegram. The host starts the match from inside that window.

## Telegram cooldown

A completed Telegram Arena starts a **30-minute cooldown for that Telegram group**. The cooldown is not per-player and does not block Arena in other Telegram groups or Discord servers.

## Development

```bash
npm install
npm test
npm run dev
```

`npm test` runs the original Arena smoke suite plus the Telegram/DWallet Mini App suite. CI also syntax-checks the production modules before running the tests.
