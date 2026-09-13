import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame } from "../src/core/engine.js";
import { arenaTestModeEnabled, markNewTestGame } from "../src/test-mode.js";
import { TEST_PANEL_CLIENT } from "../src/test-panel-client.js";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "../src/generated/discord-sdk-source.js";

assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "true" }), true);
assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "1" }), true);
assert.equal(arenaTestModeEnabled({ ARENA_TEST_MODE: "false" }), false);
assert.equal(arenaTestModeEnabled({}), false);

const game = createGame({
  guildId: "tg:-100-test",
  channelId: "tg:-100-test",
  hostId: "123",
  themeId: "dwallet",
  platform: "telegram"
});
markNewTestGame(game);
assert.equal(game.testMode.enabled, true);
assert.equal(game.testMode.qa, true);
assert.equal(game.testMode.simulatedCrowd, true);

new Function(TEST_PANEL_CLIENT);
for (const action of [
  "add_bots",
  "fill_12",
  "remove_bots",
  "next_round",
  "mass_brawl",
  "community_showdown",
  "revival",
  "preview_crek",
  "preview_peach",
  "preview_glitch",
  "final_five",
  "abort"
]) {
  assert(TEST_PANEL_CLIENT.includes(action), `QA client missing action ${action}`);
}

assert.equal(OFFICIAL_DISCORD_SDK_VERSION, "2.5.0");
assert(OFFICIAL_DISCORD_SDK_SOURCE.includes('__VEIL_OFFICIAL_DISCORD_SDK__'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const rpcTraceEntry = readFileSync(new URL("../src/activity-rpc-trace-entry.js", import.meta.url), "utf8");
const botsEntry = readFileSync(new URL("../src/discord-bots-entry.js", import.meta.url), "utf8");
const directEntry = readFileSync(new URL("../src/activity-direct-entry.js", import.meta.url), "utf8");
const doctorEntry = readFileSync(new URL("../src/activity-doctor-entry.js", import.meta.url), "utf8");
const entryPointEntry = readFileSync(new URL("../src/activity-entrypoint-entry.js", import.meta.url), "utf8");
const resetEntry = readFileSync(new URL("../src/activity-reset-entry.js", import.meta.url), "utf8");
const liveEntry = readFileSync(new URL("../src/activity-live-entry.js", import.meta.url), "utf8");
const recoveryEntry = readFileSync(new URL("../src/discord-recovery-entry.js", import.meta.url), "utf8");
const serverConfig = readFileSync(new URL("../src/server-config.js", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

assert(wrangler.includes('main = "src/activity-rpc-trace-entry.js"'));
assert(wrangler.includes('main = "src/telegram-start-entry.js"'));
assert(rpcTraceEntry.includes('from "./discord-bots-entry.js"'));
assert(rpcTraceEntry.includes('TRACE_BUILD = "20260913-14"'));
assert(rpcTraceEntry.includes('Application URL Override'));
assert(rpcTraceEntry.includes('handshake.call(sdk)'));
assert(botsEntry.includes('from "./activity-direct-entry.js"'));
assert(botsEntry.includes('addFakeContestants'));
assert(directEntry.includes('ACTIVITY_BUILD = "20260913-13"'));
assert(directEntry.includes('/activity/veil-arena-20260913-13.js'));
assert(directEntry.includes('__VEIL_OFFICIAL_DISCORD_SDK__'));
assert(directEntry.includes('OFFICIAL SDK / BUNDLED LOCAL'));
assert(!directEntry.includes('MINI_DISCORD_SDK_SOURCE'));
assert(directEntry.includes('/applications/@me'));
assert(directEntry.includes('discord-bot-token'));
assert(directEntry.includes('correctedEnv'));
assert(directEntry.includes('1504257112094539798'));
assert(serverConfig.includes('VEIL_ACTIVITY_TEST_GUILD_ID = "1504257112094539798"'));
assert(packageJson.includes('"@discord/embedded-app-sdk": "2.5.0"'));
assert(packageJson.includes('"postinstall"'));
assert(doctorEntry.includes('EMBEDDED_FLAG'));
assert(doctorEntry.includes('workerApplicationId'));
assert(doctorEntry.includes('botApplicationId'));
assert(doctorEntry.includes('type: 4'));
assert(doctorEntry.includes('handler: 2'));
assert(entryPointEntry.includes('from "./activity-reset-entry.js"'));
assert(resetEntry.includes('from "./activity-live-entry.js"'));
assert(resetEntry.includes('ABORT / RESET ARENA'));
assert(resetEntry.includes('body.action === "abort"'));
assert(liveEntry.includes('from "./discord-recovery-entry.js"'));
assert(recoveryEntry.includes('from "./test-entry.js"'));
assert(wrangler.includes("[env.test.vars]"));
assert(wrangler.includes('ARENA_TEST_MODE = "true"'));
assert(wrangler.includes("[[env.test.durable_objects.bindings]]"));
assert(wrangler.includes("[[env.test.d1_databases]]"));

console.log("Telegram QA Test Mode smoke tests passed.");
