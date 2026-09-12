import assert from "node:assert/strict";
import { createGame, openCrowdVote } from "../src/core/engine.js";
import { getTheme, themeNarrationCount } from "../src/themes/index.js";
import { DWALLET_NARRATION_COUNT } from "../src/themes/dwallet.js";
import { buildMassBrawl } from "../src/themes/brawls.js";
import { rulesForTheme } from "../src/rules.js";
import {
  telegramRegistrationKeyboard,
  telegramCrowdVoteKeyboard,
  telegramArenaLauncherKeyboard,
  telegramArenaStartParam,
  discordishToTelegramHtml
} from "../src/telegram.js";
import { TELEGRAM_ARENA_COOLDOWN_MS, formatCooldown } from "../src/cooldown.js";
import { miniAppHtml, validateTelegramInitData } from "../src/miniapp.js";

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

game.players[game.hostId] = { id: game.hostId, displayName: "Host", alive: true };
game.aliveIds.push(game.hostId);
for (let i = 0; i < 12; i++) {
  const id = String(900000000000000 + i);
  game.players[id] = { id, displayName: `Player ${i + 1}`, alive: true };
  game.aliveIds.push(id);
}

// Legacy callback buttons remain valid as a fallback, but DWallet's primary UI is the Mini App launcher.
const registration = telegramRegistrationKeyboard(game);
for (const row of registration.inline_keyboard) {
  for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);
}
const voting = telegramCrowdVoteKeyboard(game);
for (const row of voting.inline_keyboard) {
  for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);
}

const startParam = telegramArenaStartParam(game.id);
assert(startParam.startsWith("arena_"));
assert(startParam.length <= 64);
const launcher = telegramArenaLauncherKeyboard(`https://t.me/veil_example?startapp=${startParam}&mode=fullscreen`);
assert.equal(launcher.inline_keyboard[0][0].text, "⚔️ ENTER / WATCH ARENA");
assert(launcher.inline_keyboard[0][0].url.includes("mode=fullscreen"));

const app = miniAppHtml();
assert(app.includes("DWALLET • VEIL"));
assert(app.includes("/telegram/miniapp/state"));
assert(app.includes("/telegram/miniapp/action"));
assert(app.includes("requestFullscreen"));
assert(app.includes("Community Showdown"));

const vote = openCrowdVote(game);
assert(vote.openedAt > 0);
assert.equal(vote.closesAt - vote.openedAt, 30000);

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

// Validate the Telegram WebApp HMAC implementation with a synthetic signed initData payload.
const botToken = "123456:TEST_TOKEN_FOR_LOCAL_SMOKE_ONLY";
const authDate = Math.floor(Date.now() / 1000);
const userJson = JSON.stringify({ id: 123456789, first_name: "Arena", username: "arena_test" });
const unsigned = new URLSearchParams({
  auth_date: String(authDate),
  chat_instance: "9876543210123456789",
  chat_type: "supergroup",
  start_param: startParam,
  user: userJson
});
const check = [...unsigned.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
const enc = new TextEncoder();
async function hmac(keyBytes, data){const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);return crypto.subtle.sign("HMAC",key,enc.encode(data));}
const secret = await hmac(enc.encode("WebAppData"), botToken);
const digest = await hmac(secret, check);
const hash = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
unsigned.set("hash", hash);
const validated = await validateTelegramInitData(unsigned.toString(), botToken, authDate);
assert.equal(validated.user.id, "123456789");
assert.equal(validated.chatType, "supergroup");
assert.equal(validated.startParam, startParam);

console.log(`Telegram/DWallet Mini App smoke tests passed. DWallet narration: ${DWALLET_NARRATION_COUNT}. Cooldown: ${formatCooldown(TELEGRAM_ARENA_COOLDOWN_MS)}.`);
