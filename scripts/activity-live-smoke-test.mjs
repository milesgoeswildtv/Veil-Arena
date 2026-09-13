import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTIVITY_LIVE_CLIENT } from "../src/activity-live-client.js";
import { liveActivityHtml } from "../src/activity-live.js";
import { MINI_DISCORD_SDK_SOURCE } from "../src/activity-mini-sdk.js";
import { VEIL_ACTIVITY_TEST_GUILD_ID, themeForGuild } from "../src/server-config.js";

new Function(ACTIVITY_LIVE_CLIENT);
new Function(MINI_DISCORD_SDK_SOURCE.replace("export class DiscordSDK", "class DiscordSDK"));
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

assert(MINI_DISCORD_SDK_SOURCE.includes('export class DiscordSDK'));
assert(MINI_DISCORD_SDK_SOURCE.includes('Opcodes.HANDSHAKE'));
assert(MINI_DISCORD_SDK_SOURCE.includes('"AUTHORIZE"'));
assert(MINI_DISCORD_SDK_SOURCE.includes('"AUTHENTICATE"'));
assert(MINI_DISCORD_SDK_SOURCE.includes('"GET_CHANNEL"'));
assert(!MINI_DISCORD_SDK_SOURCE.includes('cdn.jsdelivr.net'));
assert(!MINI_DISCORD_SDK_SOURCE.includes('esm.sh'));

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

const bootstrapEntry = readFileSync(new URL("../src/activity-bootstrap-fix-entry.js", import.meta.url), "utf8");
assert(bootstrapEntry.includes('from "./activity-doctor-entry.js"'));
assert(bootstrapEntry.includes('SDK LOAD FAILED'));
assert(bootstrapEntry.includes('CONNECTING TO DISCORD'));
assert(bootstrapEntry.includes('discordBearer("/users/@me/guilds"'));
assert(!bootstrapEntry.includes('discordBot(`/channels/${channelId}`'));

const localSdkEntry = readFileSync(new URL("../src/activity-local-sdk-entry.js", import.meta.url), "utf8");
assert(localSdkEntry.includes('MINI_DISCORD_SDK_SOURCE'));
assert(localSdkEntry.includes('local-minimal'));

const singleScriptEntry = readFileSync(new URL("../src/activity-single-script-entry.js", import.meta.url), "utf8");
assert(singleScriptEntry.includes('from "./activity-local-sdk-entry.js"'));
assert(singleScriptEntry.includes('Promise.resolve({ DiscordSDK: InlineDiscordSDK })'));
assert(singleScriptEntry.includes('20260913-10'));
assert(singleScriptEntry.includes('/activity/veil-arena-20260913-10.js'));
assert(singleScriptEntry.includes('Expected test guild_id'));
assert(singleScriptEntry.includes('1504257112094539798'));
assert(singleScriptEntry.includes('Launch guild_id'));
assert(singleScriptEntry.includes('Launch channel_id'));
assert(singleScriptEntry.includes('Worker Application ID'));
assert(singleScriptEntry.includes('x-veil-single-script'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert(wrangler.includes('main = "src/activity-single-script-entry.js"'));

console.log("Live Discord Activity smoke tests passed.");
