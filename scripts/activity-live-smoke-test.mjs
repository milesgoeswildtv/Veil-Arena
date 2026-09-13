import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OFFICIAL_DISCORD_SDK_SOURCE, OFFICIAL_DISCORD_SDK_VERSION } from "../src/generated/discord-sdk-source.js";
import { activityCleanClientSource } from "../src/activity-clean-client.js";
import { cleanActivityHtml } from "../src/activity-clean-ui.js";
import { VEIL_ACTIVITY_TEST_GUILD_ID, themeForGuild } from "../src/server-config.js";

assert.equal(VEIL_ACTIVITY_TEST_GUILD_ID, "1504257112094539798");
assert.equal(themeForGuild(VEIL_ACTIVITY_TEST_GUILD_ID), "dwallet");
assert.equal(OFFICIAL_DISCORD_SDK_VERSION, "2.5.0");
assert(OFFICIAL_DISCORD_SDK_SOURCE.includes("__VEIL_OFFICIAL_DISCORD_SDK__"));
assert(OFFICIAL_DISCORD_SDK_SOURCE.length > 10000);

const client = activityCleanClientSource();
new Function(client);
for (const needle of [
  "new DiscordSDK(clientId",
  "sdk.ready()",
  "sdk.commands.authorize",
  "applications.commands",
  "guilds.members.read",
  "rpc.voice.read",
  'jsonFetch("/api/token"',
  "sdk.commands.authenticate",
  'jsonFetch("/activity/state")',
  'jsonFetch("/activity/action"',
  "FILL TO 12",
  "ADD 4 TEST BOTS",
  "START ARENA",
  "ABORT / RESET ARENA",
  "COMMUNITY SHOWDOWN"
]) assert(client.includes(needle), `clean Activity client missing ${needle}`);
assert(!client.includes("window.location.reload"));
assert(!client.includes("/activity/sdk.js"));
assert(!client.includes("import("));

const html = cleanActivityHtml("123456789012345678", "test-build", "/activity/test-clean.js");
assert(html.includes('data-discord-client-id="123456789012345678"'));
assert(html.includes('data-activity-build="test-build"'));
assert(html.includes('src="/activity/test-clean.js"'));
assert(html.includes("LIVE ROSTER"));
assert(html.includes("CLEAN CLIENT STARTING"));

const cleanEntry = readFileSync(new URL("../src/activity-clean-entry.js", import.meta.url), "utf8");
assert(cleanEntry.includes('from "./activity-bootstrap-fix-entry.js"'));
assert(cleanEntry.includes('BUILD = "20260913-19"'));
assert(cleanEntry.includes('/activity/veil-clean-${BUILD}.js'));
assert(cleanEntry.includes('url.pathname === "/api/token"'));
assert(cleanEntry.includes('"/activity/oauth/token"'));
assert(cleanEntry.includes('url.pathname === "/activity/clean-health"'));
assert(cleanEntry.includes("OFFICIAL_DISCORD_SDK_SOURCE"));
assert(cleanEntry.includes("activityCleanClientSource"));
assert(cleanEntry.includes("cleanActivityHtml"));
assert(cleanEntry.includes("VEIL CONNECTION FACTS"));
assert(cleanEntry.includes("Arena client started"));
assert(cleanEntry.includes("__VEIL_MARK_CLIENT_STARTED__"));
assert(cleanEntry.includes("__VEIL_MARK_CLIENT_ERROR__"));
assert(!cleanEntry.includes("FORCED window.parent + * AND RESENT"));

const bootstrapEntry = readFileSync(new URL("../src/activity-bootstrap-fix-entry.js", import.meta.url), "utf8");
assert(bootstrapEntry.includes('url.pathname === "/activity/oauth/token"'));
assert(bootstrapEntry.includes('discordBearer("/users/@me"'));
assert(bootstrapEntry.includes('discordBearer("/users/@me/guilds"'));
assert(!bootstrapEntry.includes('discordBot(`/channels/'));

const liveEntry = readFileSync(new URL("../src/activity-live-entry.js", import.meta.url), "utf8");
assert(liveEntry.includes('url.pathname === "/activity/state"'));
assert(liveEntry.includes('url.pathname === "/activity/action"'));

const resetEntry = readFileSync(new URL("../src/activity-reset-entry.js", import.meta.url), "utf8");
assert(resetEntry.includes('body.action === "abort"'));
assert(resetEntry.includes('status === "cancelled"'));

const entryPointEntry = readFileSync(new URL("../src/activity-entrypoint-entry.js", import.meta.url), "utf8");
assert(entryPointEntry.includes("type: 4"));
assert(entryPointEntry.includes("handler: 2"));

const doctorEntry = readFileSync(new URL("../src/activity-doctor-entry.js", import.meta.url), "utf8");
assert(doctorEntry.includes("EMBEDDED_FLAG"));
assert(doctorEntry.includes("/applications/@me"));
assert(doctorEntry.includes("VERIFY + FORCE REPAIR ACTIVITY"));

const botsEntry = readFileSync(new URL("../src/discord-bots-entry.js", import.meta.url), "utf8");
assert(botsEntry.includes('from "./activity-clean-entry.js"'));
assert(botsEntry.includes("addFakeContestants"));

const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
assert(packageJson.includes('"@discord/embedded-app-sdk": "2.5.0"'));
assert(packageJson.includes('"build:discord-sdk"'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert(wrangler.includes('main = "src/discord-bots-entry.js"'));

console.log("Clean Discord Activity smoke tests passed.");
