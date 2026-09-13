import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTIVITY_LIVE_CLIENT } from "../src/activity-live-client.js";
import { liveActivityHtml } from "../src/activity-live.js";
import { VEIL_ACTIVITY_TEST_GUILD_ID, themeForGuild } from "../src/server-config.js";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "../src/generated/discord-sdk-source.js";

new Function(ACTIVITY_LIVE_CLIENT);
new Function(OFFICIAL_DISCORD_SDK_SOURCE);
const html = liveActivityHtml("123456789012345678");
assert(html.includes('data-discord-client-id="123456789012345678"'));
assert(html.includes('/activity/live.js'));
assert(html.includes('LIVE ROSTER'));
assert(ACTIVITY_LIVE_CLIENT.includes('DiscordSDK'));
assert(ACTIVITY_LIVE_CLIENT.includes('/activity/oauth/token'));
assert(ACTIVITY_LIVE_CLIENT.includes('/activity/state'));
assert(ACTIVITY_LIVE_CLIENT.includes('/activity/action'));
assert(ACTIVITY_LIVE_CLIENT.includes('FILL TO 12'));
assert(ACTIVITY_LIVE_CLIENT.includes('ADD 4 TEST BOTS'));
assert(ACTIVITY_LIVE_CLIENT.includes('START ARENA'));
assert(ACTIVITY_LIVE_CLIENT.includes('Community Showdown'));

assert.equal(VEIL_ACTIVITY_TEST_GUILD_ID, "1504257112094539798");
assert.equal(themeForGuild(VEIL_ACTIVITY_TEST_GUILD_ID), "full_tilt");
assert.equal(OFFICIAL_DISCORD_SDK_VERSION, "2.5.0");
assert(OFFICIAL_DISCORD_SDK_SOURCE.includes('__VEIL_OFFICIAL_DISCORD_SDK__'));
assert(OFFICIAL_DISCORD_SDK_SOURCE.length > 10000);

const entry = readFileSync(new URL("../src/activity-live-entry.js", import.meta.url), "utf8");
assert(entry.includes('DISCORD_CLIENT_SECRET'));
assert(entry.includes('platform: "activity"'));
assert(entry.includes('url.pathname === "/activity/state"'));
assert(entry.includes('url.pathname === "/activity/action"'));
assert(entry.includes('url.pathname === "/activity/oauth/token"'));
assert(entry.includes('activitybot:'));

const resetEntry = readFileSync(new URL("../src/activity-reset-entry.js", import.meta.url), "utf8");
assert(resetEntry.includes('ABORT / RESET ARENA'));
assert(resetEntry.includes('body.action === "abort"'));
assert(resetEntry.includes('status === "cancelled"'));

const entryPointEntry = readFileSync(new URL("../src/activity-entrypoint-entry.js", import.meta.url), "utf8");
assert(entryPointEntry.includes('type: 4'));
assert(entryPointEntry.includes('handler: 2'));

const doctorEntry = readFileSync(new URL("../src/activity-doctor-entry.js", import.meta.url), "utf8");
assert(doctorEntry.includes('EMBEDDED_FLAG'));
assert(doctorEntry.includes('/applications/@me'));
assert(doctorEntry.includes('workerApplicationId'));
assert(doctorEntry.includes('botApplicationId'));
assert(doctorEntry.includes('VERIFY + FORCE REPAIR ACTIVITY'));
assert(doctorEntry.includes('/admin/activity/doctor-repair'));

const directEntry = readFileSync(new URL("../src/activity-direct-entry.js", import.meta.url), "utf8");
assert(directEntry.includes('OFFICIAL_DISCORD_SDK_SOURCE'));
assert(directEntry.includes('OFFICIAL_DISCORD_SDK_VERSION'));
assert(directEntry.includes('ACTIVITY_BUILD = "20260913-13"'));
assert(directEntry.includes('/activity/veil-arena-20260913-13.js'));
assert(directEntry.includes('__VEIL_OFFICIAL_DISCORD_SDK__'));
assert(directEntry.includes('OFFICIAL SDK / BUNDLED LOCAL'));
assert(directEntry.includes('disableConsoleLogOverride: true'));
assert(!directEntry.includes('MINI_DISCORD_SDK_SOURCE'));
assert(directEntry.includes('/applications/@me'));
assert(directEntry.includes('discord-bot-token'));
assert(directEntry.includes('Expected test guild_id: ${TEST_GUILD_ID}'));
assert(directEntry.includes('1504257112094539798'));

const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
assert(packageJson.includes('"@discord/embedded-app-sdk": "2.5.0"'));
assert(packageJson.includes('"build:discord-sdk"'));
assert(packageJson.includes('"postinstall"'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert(wrangler.includes('main = "src/activity-direct-entry.js"'));

console.log("Live Discord Activity smoke tests passed.");
