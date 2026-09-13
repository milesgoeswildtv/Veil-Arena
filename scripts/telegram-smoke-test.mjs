import assert from "node:assert/strict";
import { createGame, openCrowdVote } from "../src/core/engine.js";
import { getTheme, themeNarrationCount } from "../src/themes/index.js";
import { DWALLET_NARRATION_COUNT, DWALLET_HQ_EXPANSION_COUNT } from "../src/themes/dwallet-hq.js";
import { buildMassBrawl } from "../src/themes/brawls.js";
import { rulesForTheme } from "../src/rules.js";
import { buildArenaLog } from "../src/logs.js";
import {
  TELEGRAM_COMMANDS,
  TELEGRAM_ALLOWED_UPDATES,
  telegramRegistrationKeyboard,
  telegramCrowdVoteKeyboard,
  telegramArenaLauncherKeyboard,
  telegramArenaStartParam,
  decorateDWalletTelegramText,
  discordishToTelegramHtml
} from "../src/telegram.js";
import { TELEGRAM_ARENA_COOLDOWN_MS, formatCooldown } from "../src/cooldown.js";
import { miniAppHtml } from "../src/miniapp.js";
import { validateTelegramInitData } from "../src/telegram-official-miniapp.js";
import { injectMiniAppHubHtml } from "../src/hub.js";

const dw = getTheme("dwallet");
assert.equal(DWALLET_HQ_EXPANSION_COUNT, 13000);
assert.equal(DWALLET_NARRATION_COUNT, 26000);
assert.equal(themeNarrationCount(dw), 26000);
assert.equal(dw.playerKills.length, 10000);
assert.equal(dw.selfKills.length, 4800);
assert.equal(dw.pinDuels.length, 3000);
assert.equal(dw.multiPins.length, 2400);
assert.equal(dw.revivalDuels.length, 2400);
assert.equal(dw.normalEvents.length, 2000);
assert.equal(dw.rareEvents.length, 1400);
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

const registration = telegramRegistrationKeyboard(game);
for (const row of registration.inline_keyboard) for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);
const voting = telegramCrowdVoteKeyboard(game);
for (const row of voting.inline_keyboard) for (const button of row) assert(Buffer.byteLength(button.callback_data, "utf8") <= 64);

const startParam = telegramArenaStartParam(game.id);
assert(startParam.startsWith("arena_"));
assert(startParam.length <= 64);
const launcher = telegramArenaLauncherKeyboard(`https://t.me/veil_example?startapp=${startParam}&mode=fullscreen`);
assert.equal(launcher.inline_keyboard[0][0].text, "⚔️ ENTER / WATCH ARENA");
assert(launcher.inline_keyboard[0][0].url.includes("startapp="));
assert(!("web_app" in launcher.inline_keyboard[0][0]), "Group launcher must be a direct URL, not a web_app button");
assert.deepEqual(TELEGRAM_ALLOWED_UPDATES, ["message", "callback_query", "my_chat_member"]);

const commandNames = TELEGRAM_COMMANDS.map(x => x.command);
for (const required of ["arena", "arenastatus", "arenarules", "arenahelp", "arenastats", "arenaleaderboard", "arenahistory", "arenalog"]) {
  assert(commandNames.includes(required), `Missing Telegram command: ${required}`);
}
assert.equal(new Set(commandNames).size, commandNames.length);

const app = miniAppHtml();
assert(app.includes("DWALLET • VEIL"));
assert(app.includes("/telegram/miniapp/state"));
assert(app.includes("/telegram/miniapp/action"));
assert(app.includes("requestFullscreen"));
assert(app.includes("COMMUNITY SHOWDOWN"));
assert(app.includes("HQ LOCKDOWN"));
assert(app.includes("RECOVERY PROTOCOL"));
assert(app.includes("FINAL FIVE"));
assert(app.includes("PEACH CONTROL // ARMED"));
assert(app.includes("CREK CONTROL WALL // RECORDING"));

const hubApp = injectMiniAppHubHtml(app);
assert(hubApp.includes('data-hub-tab="arena"'));
assert(hubApp.includes('data-hub-tab="stats"'));
assert(hubApp.includes('data-hub-tab="leaderboard"'));
assert(hubApp.includes('data-hub-tab="rules"'));

const vote = openCrowdVote(game);
assert(vote.openedAt > 0);
assert.equal(vote.closesAt - vote.openedAt, 30000);
assert.equal(TELEGRAM_ARENA_COOLDOWN_MS, 30 * 60 * 1000);
assert.equal(formatCooldown(30 * 60 * 1000), "30m");
const dwRules = rulesForTheme("dwallet");
assert(dwRules.includes("30-minute cooldown"));
assert(dwRules.includes("THE CHAT CHOOSES"));

const names = ["A", "B", "C", "D", "E", "F"];
const survivors = ["A", "C"];
const dwBrawl = buildMassBrawl("dwallet", names, survivors, () => 0);
const vqsBrawl = buildMassBrawl("vibe_queen_slots", names, survivors, () => 0);
const ftBrawl = buildMassBrawl("full_tilt", names, survivors, () => 0);
assert(dwBrawl.includes("DWallet"));
assert.notEqual(dwBrawl, vqsBrawl);
assert.notEqual(dwBrawl, ftBrawl);

const decorated = decorateDWalletTelegramText("# 💜 DWALLET ARENA\nRegistration is open.\nThe Arena is running inside the Mini App.");
assert(decorated.startsWith("`DWALLET HQ // VEIL TERMINAL`"));
assert(decorated.includes("__REGISTRATION OPEN__"));

const formatted = discordishToTelegramHtml("# 💜 DWALLET ARENA\n**Player** vs ~~***Eliminated***~~\n__LIVE__\n||classified||\n> HQ feed online\n>! expanded only when tapped");
assert(formatted.includes("<b><u>💜 DWALLET ARENA</u></b>"));
assert(formatted.includes("<b>Player</b>"));
assert(formatted.includes("<s><b><i>Eliminated</i></b></s>"));
assert(formatted.includes("<u>LIVE</u>"));
assert(formatted.includes("<tg-spoiler>classified</tg-spoiler>"));
assert(formatted.includes("<blockquote>HQ feed online</blockquote>"));
assert(formatted.includes("<blockquote expandable>expanded only when tapped</blockquote>"));

const completed = { ...game, status: "finished", round: 9, winnerId: game.hostId, displayLog: [{ round: 9, text: "🏆 **HOST WINS THE ARENA.**", at: new Date().toISOString() }] };
const dwLog = buildArenaLog(completed, 1);
assert(dwLog.startsWith("DWALLET ARENA — MATCH LOG"));
assert(dwLog.includes("Winner: Host"));

const botToken = "local-smoke-test-token";
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
assert.equal(validated.chatInstance, "9876543210123456789");
assert.equal(validated.startParam, startParam);

console.log(`Telegram/DWallet official Mini App smoke tests passed. DWallet narration: ${DWALLET_NARRATION_COUNT}. Commands: ${commandNames.length}.`);
