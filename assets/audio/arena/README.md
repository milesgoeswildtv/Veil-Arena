# Arena SFX — pack 1

Original procedural electronic effects for Veil: dark digital game show, metallic accents,
short impacts and brighter revival/victory stings. No music, voices or sampled recordings.

16 WAVs: click, join, countdown, start, round, elimination (3 variants), vote,
confirm, duel, brawl, revival, final, victory and glitch.

Regenerate: `node scripts/generate-arena-sfx.mjs`.
Verify: `node scripts/arena-audio-test.mjs`.

Both clients use `src/audio/arena-audio.js` and `arena-synthesis.js` to render the
same PCM into cached Web Audio buffers on demand. WAVs are editable/listenable source
exports; runtime needs no extra asset route, CDN, download or audio dependency.

Discord imports the shared client; Telegram embeds its serialized functions in its
existing server-rendered HTML. Keep these hooks when editing the respective UI:
`observe(state)` on accepted snapshots; `confirmAction('vote')` after a successful
vote; `connectionLost()` after a failed refresh. The audio code is client-only.

Initial snapshots, new game IDs, reconnects and background catch-up are silent.
One cue plays at a time; feature cues take priority over clicks and countdown ticks.
The countdown is the last three seconds of a real crowd-vote deadline. There is no
invented pre-start timer. Preferences persist per app origin when storage is available.
Default effects volume is 40%; the first player interaction unlocks audio. Test sound
provides an explicit playback gesture. Unsupported/blocked audio leaves the game usable.

Device listening in Discord and Telegram remains necessary to tune artistic balance
and confirm each host's audio behavior. No game rules, bot commands, payouts, visual
assets or existing visual effects are modified by this module.
