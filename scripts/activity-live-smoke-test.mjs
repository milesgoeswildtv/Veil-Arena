import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTIVITY_LIVE_CLIENT } from "../src/activity-live-client.js";
import { liveActivityHtml } from "../src/activity-live.js";

new Function(ACTIVITY_LIVE_CLIENT);
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
assert(entryPointEntry.includes('/setup/activity'));
assert(entryPointEntry.includes('/admin/activity/register'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert(wrangler.includes('main = "src/activity-entrypoint-entry.js"'));

console.log("Live Discord Activity smoke tests passed.");
