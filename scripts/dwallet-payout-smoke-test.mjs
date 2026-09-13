import assert from "node:assert/strict";
import {
  normalizeDwalletAmount,
  isDwalletUsdAmount,
  verifyArenaFunding,
  payArenaWinner
} from "../src/dwallet-payout.js";

assert.equal(normalizeDwalletAmount("$1"), "$1");
assert.equal(normalizeDwalletAmount("1$"), "$1");
assert.equal(normalizeDwalletAmount("$5.25"), "$5.25");
assert.equal(normalizeDwalletAmount("0.001"), "0.001");
assert.equal(isDwalletUsdAmount("$1"), true);
assert.throws(() => normalizeDwalletAmount("$0"));

const configuredAt = new Date(Date.now() - 1000).toISOString();
const fundingAt = new Date().toISOString();
const game = {
  id: "usd-prize-test",
  platform: "discord",
  guildId: "guild",
  channelId: "channel",
  winnerId: "winner",
  players: { winner: { id: "winner", displayName: "Winner", simulated: false } },
  dwalletWinnerPayout: {
    amount: "$1",
    currency: "SOL",
    hostId: "host",
    hostName: "Host",
    potUserId: "pot",
    configuredAt,
    status: "awaiting_funding"
  }
};

const env = { DWALLET_API_KEY: "test-key", DB: {} };
let postedTip = null;
let saved = 0;
const saveGame = async () => { saved += 1; };

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(url);
  if (parsed.pathname === "/tips" && (init.method || "GET") === "GET") {
    return new Response(JSON.stringify({
      success: true,
      data: [{
        tip_id: 7001,
        timestamp: fundingAt,
        from_user_id: "host",
        to_user_id: "pot",
        currency: "SOL",
        amount: "65498",
        decimals: 6
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (parsed.pathname === "/tips" && init.method === "POST") {
    postedTip = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: true, transaction: { tip_id: 7002 } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
  throw new Error(`Unexpected DWallet test request: ${url}`);
};

const funded = await verifyArenaFunding(env, game, saveGame);
assert.equal(funded.status, "funded");
assert.equal(funded.amount, "$1");
assert.equal(funded.fundedAmount, "0.065498");
assert.equal(funded.fundingTipId, 7001);

const paid = await payArenaWinner(env, game, saveGame);
assert.equal(paid.status, "paid");
assert.equal(postedTip.amount, "0.065498");
assert.equal(postedTip.currency, "SOL");
assert.equal(postedTip.to_user_id, "winner");
assert(saved >= 3);

console.log("DWallet USD payout smoke test passed.");
