# Veil Arena

Arena is the shared game engine behind Veil's Discord and Telegram elimination games.

## Themes

- `vibe_queen_slots` — Vibe Queen Slots / Haunted Arena
- `full_tilt` — Full Tilt Arena
- `dwallet` — DWallet Telegram Arena

The DWallet theme contains exactly **26,000** narration templates across kills, self-eliminations, Community Showdowns, multi-pins, revivals, normal events, rare DWallet glitches, and the DWallet HQ expansion.

## DWallet Telegram architecture

DWallet uses a Telegram **Main Mini App** so the group chat does not get flooded by Arena narration.

The Telegram group receives the Arena launcher/status card plus major completion/payout messages. Registration, live round text, eliminations, Mass Brawls, revivals, roster state, sponsorship entry and Community Showdown votes happen inside the Mini App window. Discord keeps its existing chat-based Arena behavior.

The Mini App validates Telegram's signed `initData` server-side before trusting the user identity. Interactive actions also verify that the user belongs to the Telegram group, and the Arena binds itself to the verified Telegram chat context after the first interaction.

## Production Telegram setup

Configure these Cloudflare Worker secrets. Never commit the values to the repository:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_SECRET
```

Deploy production:

```bash
npm run deploy
```

In BotFather configure Veil's Main Mini App URL to:

```text
https://<production-worker-domain>/tg
```

Then open:

```text
https://<production-worker-domain>/setup/telegram
```

Enter `ADMIN_SECRET` and press **REGISTER TELEGRAM**. This registers `/telegram/webhook` and publishes the production command menu.

Add Veil to the DWallet Telegram group and make Veil a **group administrator**. Arena uses Telegram membership checks to stop forwarded Mini App links from being used by outsiders.

## Private Telegram QA / Test Mode

The repository has a named Wrangler environment called `test`. It deploys as a separate Worker (`veil-arena-test`) with `ARENA_TEST_MODE=true`. The QA Worker uses its own Durable Object namespace. It intentionally uses the same D1 database, but Telegram games are scoped by group ID, so the private test group remains separate from the production DWallet group.

Set the **test bot's** secrets on the test environment:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --env test
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env test
npx wrangler secret put ADMIN_SECRET --env test
```

Deploy Test Mode:

```bash
npm run deploy:test
```

Use the test Worker URL printed by Wrangler. In BotFather, set the **test bot's** Main Mini App URL to:

```text
https://<test-worker-domain>/tg
```

Then open:

```text
https://<test-worker-domain>/setup/telegram
```

Enter the test environment's `ADMIN_SECRET` and press **REGISTER TELEGRAM**.

Add the test bot to the private test Telegram and make it an administrator. In the test group, `/arena` automatically creates a **QA Arena** and bypasses the production 30-minute cooldown.

The Arena host sees a private QA panel inside the Mini App. During registration it can:

- add 4 synthetic test contestants
- fill the roster to 12 after the human testers join
- remove synthetic contestants
- abort/reset the QA Arena with no cooldown

During a running QA Arena the host can force:

- the next normal round immediately
- Mass Brawl / HQ Lockdown
- Community Showdown with a synthetic spectator crowd
- Second Chance / Revival
- Crek's Lair monitor takeover
- Peach's red-button takeover
- rare DWallet glitch presentation
- Final Five without eliminating a real tester
- abort/reset

QA bots are **real Arena engine participants**. They can eliminate players, be eliminated, survive Mass Brawls, be revived, enter Community Showdowns and win the Arena. Their Telegram-style IDs are synthetic numeric IDs so the real Mini App vote path can target them during QA.

Test Mode is gated by the Worker environment. The QA panel and QA API are not exposed by the production Worker unless `ARENA_TEST_MODE` is explicitly enabled there.

## Sponsorships

Sponsorships are sponsor-defined fixed-dollar pledges, not percentages or preset prize pools. Examples:

- Sam: Winner — $5
- Sam: Most Eliminations — $2
- Crek: Winner — $10

Sponsors choose only the categories they want. Multiple sponsors may stack on one Arena. Sponsorships are editable during registration and lock when START is pressed. Statistical ties split that sponsor's entered award. At the end, Veil posts a payout report showing who is owed what.

Supported award categories currently include Winner, Runner-Up, Most Eliminations, Most Revivals, Most Community Showdowns Survived, and Most Mass Brawls Survived.

## Telegram commands

- `/arena` — create or reopen a DWallet Arena
- `/arenastatus` — show registration/live/cooldown state
- `/arenarules` — view DWallet Arena rules
- `/arenahelp` — show Arena commands
- `/arenastats` — personal stats for that Telegram group
- `/arenaleaderboard` — group leaderboard
- `/arenahistory` — five most recent completed Arenas
- `/arenalog` — latest completed narration log
- `/arenalog 2` — previous completed narration log

Convenience aliases also work through `/arena`, including `/arena status`, `/arena stats`, `/arena leaderboard`, `/arena history`, `/arena log 2`, `/arena rules`, and `/arena help`.

## Telegram cooldown

A completed **production** Telegram Arena starts a 30-minute cooldown for that Telegram group. The private QA Worker bypasses this when creating QA Arenas so testing can restart immediately.

## Development

```bash
npm install
npm test
npm run dev
npm run dev:test
```

`npm test` runs the core Arena suite, Telegram/DWallet Mini App suite, sponsorship suite, and QA Test Mode suite. CI also syntax-checks production and QA modules before running the tests.
