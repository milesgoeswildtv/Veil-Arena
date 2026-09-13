import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame } from "../src/core/engine.js";
import { arenaTestModeEnabled, markNewTestGame } from "../src/test-mode.js";
import { TEST_PANEL_CLIENT } from "../src/test-panel-client.js";

assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "true" }), true);
assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "1" }), true);
assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "false" }), false);
assert.equal(arenaTestModeEnabled({}), false);

const game = createGame({ guildId: "tg:-100-test", channelId: "tg:-100-test", hostId: "123", themeId: "dwallet", platform: "telegram" });
markNewTestGame(game);
assert.equal(game.testMode.enabled, true);
assert.equal(game.testMode.qa, true);
assert.equal(game.testMode.simulatedCrowd, true);

new Function(TEST_PANEL_CLIENT);
for (const action of ["add_bots","fill_12","remove_bots","next_round","mass_brawl","community_showdown","revival","preview_crek","preview_peach","preview_glitch","final_five","abort"]) {
  assert(TEST_PANEL_CLIENT.includes(action), `QA client missing action ${action}`);
}

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const unifiedEntry = readFileSync(new URL("../src/veil-worker.js", import.meta.url), "utf8");
const botsEntry = readFileSync(new URL("../src/discord-bots-entry.js", import.meta.url), "utf8");
const telegramWorker = readFileSync(new URL("../src/telegram-official-worker.js", import.meta.url), "utf8");
const telegramMiniApp = readFileSync(new URL("../src/telegram-official-miniapp.js", import.meta.url), "utf8");
const officialEntry = readFileSync(new URL("../src/activity-official-entry.js", import.meta.url), "utf8");
const officialBrowser = readFileSync(new URL("../src/activity-official-browser.js", import.meta.url), "utf8");
const serverConfig = readFileSync(new URL("../src/server-config.js", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

assert(wrangler.includes('main = "src/veil-worker.js"'));
assert(!wrangler.includes("[env.test]"));
assert(!wrangler.includes('name = "veil-arena-test-bot"'));
assert(unifiedEntry.includes('from "./discord-bots-entry.js"'));
assert(unifiedEntry.includes('from "./telegram-official-worker.js"'));
assert(unifiedEntry.includes('url.pathname === "/tg"'));
assert(unifiedEntry.includes('url.pathname.startsWith("/telegram/")'));

assert(telegramWorker.includes('url.pathname === "/telegram/webhook"'));
assert(telegramWorker.includes('url.pathname === "/telegram/miniapp/state"'));
assert(telegramWorker.includes('url.pathname === "/telegram/miniapp/action"'));
assert(telegramWorker.includes("configureTelegramBot"));
assert(telegramWorker.includes("telegramArenaLaunchUrl"));
assert(!telegramWorker.includes("telegram-group-context-entry"));
assert(!telegramWorker.includes("resignInitData"));

assert(telegramMiniApp.includes("validateTelegramInitData"));
assert(telegramMiniApp.includes("chat_instance"));
assert(telegramMiniApp.includes("chat_type"));
assert(telegramMiniApp.includes("We require those values"));
assert(!telegramMiniApp.includes("params.set(\"chat_type\""));
assert(!telegramMiniApp.includes("resignInitData"));

assert(botsEntry.includes('from "./activity-official-entry.js"'));
assert(botsEntry.includes("addFakeContestants"));
assert(officialEntry.includes('BUILD = "20260913-official-1"'));
assert(officialEntry.includes('url.pathname === "/api/token"'));
assert(officialEntry.includes('url.pathname === "/api/session"'));
assert(officialEntry.includes("OFFICIAL_ACTIVITY_CLIENT_SOURCE"));
assert(officialBrowser.includes('import { DiscordSDK } from "@discord/embedded-app-sdk"'));
assert(officialBrowser.includes("new DiscordSDK(clientId)"));
assert(officialBrowser.includes("await discordSdk.ready()"));
assert(officialBrowser.includes("discordSdk.commands.authorize"));
assert(officialBrowser.includes("discordSdk.commands.authenticate"));
assert(!officialBrowser.includes("guilds.members.read"));
assert(!officialBrowser.includes("rpc.voice.read"));

assert(serverConfig.includes('VEIL_ACTIVITY_TEST_GUILD_ID = "1504257112094539798"'));
assert(packageJson.includes('"@discord/embedded-app-sdk": "2.5.0"'));
assert(packageJson.includes('"build:activity-client"'));
assert(!packageJson.includes('"deploy:test"'));
assert(!packageJson.includes('"dev:test"'));

console.log("Single-Worker Telegram/Discord configuration smoke tests passed.");
