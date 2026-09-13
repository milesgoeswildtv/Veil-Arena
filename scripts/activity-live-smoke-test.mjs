import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { officialActivityHtml } from "../src/activity-official-ui.js";
import { VEIL_ACTIVITY_TEST_GUILD_ID, themeForGuild } from "../src/server-config.js";

assert.equal(VEIL_ACTIVITY_TEST_GUILD_ID, "1504257112094539798");
assert.equal(themeForGuild(VEIL_ACTIVITY_TEST_GUILD_ID), "dwallet");

const browser = readFileSync(new URL("../src/activity-official-browser.js", import.meta.url), "utf8");
for (const needle of [
  'import { DiscordSDK } from "@discord/embedded-app-sdk"',
  "new DiscordSDK(clientId)",
  "await discordSdk.ready()",
  "discordSdk.commands.authorize",
  '"identify"',
  '"guilds"',
  '"applications.commands"',
  'fetch("/api/token"',
  "discordSdk.commands.authenticate",
  'jsonFetch("/api/session"',
  'jsonFetch("/activity/state")',
  'jsonFetch("/activity/action"',
  "FILL TO 12",
  "ADD 4 TEST BOTS",
  "START ARENA",
  "ABORT / RESET ARENA",
  "COMMUNITY SHOWDOWN"
]) assert(browser.includes(needle), `official Activity browser missing ${needle}`);
assert(!browser.includes("guilds.members.read"));
assert(!browser.includes("rpc.voice.read"));
assert(!browser.includes("function.toString"));
assert(!browser.includes("esm.sh"));
assert(!browser.includes("/activity/sdk.js"));

const html = officialActivityHtml("123456789012345678", "test-build", "/activity/test-official.js");
assert(html.includes('data-discord-client-id="123456789012345678"'));
assert(html.includes('data-activity-build="test-build"'));
assert(html.includes('src="/activity/test-official.js"'));
assert(html.includes("LIVE ROSTER"));
assert(html.includes("DISCORD SDK STARTING"));

const officialEntry = readFileSync(new URL("../src/activity-official-entry.js", import.meta.url), "utf8");
assert(officialEntry.includes('from "./activity-doctor-entry.js"'));
assert(officialEntry.includes('BUILD = "20260913-official-1"'));
assert(officialEntry.includes('url.pathname === "/api/token"'));
assert(officialEntry.includes('url.pathname === "/api/session"'));
assert(officialEntry.includes('"https://discord.com/api/oauth2/token"'));
assert(officialEntry.includes('discordBearer("/users/@me"'));
assert(officialEntry.includes('discordBearer("/users/@me/guilds"'));
assert(officialEntry.includes("OFFICIAL_ACTIVITY_CLIENT_SOURCE"));
assert(!officialEntry.includes("activity-bootstrap-fix-entry"));
assert(!officialEntry.includes("activity-clean-entry"));
assert(!officialEntry.includes("activity-browser-runtime-fix-entry"));
assert(!officialEntry.includes("esm.sh"));
assert(!officialEntry.includes("toString()"));

const buildScript = readFileSync(new URL("./build-official-activity-client.mjs", import.meta.url), "utf8");
assert(buildScript.includes('entryPoints: ["src/activity-official-browser.js"]'));
assert(buildScript.includes('bundle: true'));
assert(buildScript.includes('platform: "browser"'));
assert(buildScript.includes('format: "iife"'));

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

const botsEntry = readFileSync(new URL("../src/discord-bots-entry.js", import.meta.url), "utf8");
assert(botsEntry.includes('from "./activity-official-entry.js"'));
assert(botsEntry.includes("addFakeContestants"));

const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
assert(packageJson.includes('"@discord/embedded-app-sdk": "2.5.0"'));
assert(packageJson.includes('"build:activity-client"'));
assert(packageJson.includes('"postinstall": "npm run build:activity-client"'));

const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
assert(wrangler.includes('main = "src/discord-bots-entry.js"'));

console.log("Discord-official Activity smoke tests passed.");
