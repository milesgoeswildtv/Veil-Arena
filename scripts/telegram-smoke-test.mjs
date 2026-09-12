import assert from "node:assert/strict";
import { createGame } from "../src/core/engine.js";
import { getTheme, themeNarrationCount } from "../src/themes/index.js";
import { DWALLET_NARRATION_COUNT } from "../src/themes/dwallet.js";
import { buildMassBrawl } from "../src/themes/brawls.js";
import { rulesForTheme } from "../src/rules.js";
import { telegramRegistrationKeyboard, telegramCrowdVoteKeyboard, discordishToTelegramHtml } from "../src/telegram.js";
import { TELEGRAM_ARENA_COOLDOWN_MS, formatCooldown } from "../src/cooldown.js";

const dw = getTheme("dwallet");
assert.equal(DWALLET_NARRATION_COUNT, 13000);
assert.equal(themeNarrationCount(dw), 13000);
assert.equal(dw.playerKills.length, 5000);
assert.equal(dw.selfKills.length, 2400);
assert.equal(dw.pinDuels.length, 1500);
assert.equal(dw.multiPins.length, 1200);
assert.equal(dw.revivalDuels.length, 1200);
assert.equal(dw.normalEvents.length, 1000);
assert.equal(dw.rareEvents.length, 700);
assert.equal(dw.id, "dwallet");

const game = createGame({
  guildId: "tg:-1001234567890",
  channelId: "tg:-1001234567890",
  hostId: "1234567890123456",
  themeId: "dwallet",
  platform: "telegram"
});
assert.equal(game.platform, "telegram");
assert.equal(game.themeId, "dwallet");

game.players[game.hostId] = { id: game.hostId, displayName: "Host" };
game.aliveIds.push(game.hostId);
for (let i = 0; i < 12; i++) {
  const id = String(900000000000000 + i);
  game.players[id] = { id, displayName: `Player ${i + 1}` };
  game.aliveIds.push(id);
}

const registration = telegramRegistrationKeyboard(game);
for (const row of registration.inline_keyboard) {
  for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);
}
const voting = telegramCrowdVoteKeyboard(game);
for (const row of voting.inline_keyboard) {
  for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);
}

assert.equal(TELEGRAM_ARENA_COOLDOWN_MS, 30 * 60 * 1000);
assert.equal(formatCooldown(30 * 60 * 1000), "30m");
assert(rulesForTheme("dwallet").includes("30-minute cooldown"));
assert(rulesForTheme("dwallet").includes("THE CHAT CHOOSES"));

const names = ["A", "B", "C", "D", "E", "F"];
const survivors = ["A", "C"];
const dwBrawl = buildMassBrawl("dwallet", names, survivors, () => 0);
const vqsBrawl = buildMassBrawl("vibe_queen_slots", names, survivors, () => 0);
const ftBrawl = buildMassBrawl("full_tilt", names, survivors, () => 0);
assert(dwBrawl.includes("DWallet"));
assert.notEqual(dwBrawl, vqsBrawl);
assert.notEqual(dwBrawl, ftBrawl);

const formatted = discordishToTelegramHtml("# 💜 DWALLET ARENA\n**Player** vs ~~***Eliminated***~~");
assert(formatted.includes("<b>💜 DWALLET ARENA</b>"));
assert(formatted.includes("<b>Player</b>"));
assert(formatted.includes("<s><b><i>Eliminated</i></b></s>"));

console.log(`Telegram/DWallet smoke tests passed. DWallet narration: ${DWALLET_NARRATION_COUNT}. Cooldown: ${formatCooldown(TELEGRAM_ARENA_COOLDOWN_MS)}.`);
