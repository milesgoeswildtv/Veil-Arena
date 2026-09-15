import { awardRecipients, SPONSOR_AWARDS } from "./sponsorships.js";
import { normalizeDwalletAmount, normalizeDwalletCurrency, isDwalletUsdAmount } from "./dwallet-payout.js";
import { saveGame } from "./storage.js";

const DEFAULT_BASE_URL = "https://api.dwallet.bot";
const FINAL_PAYOUT_STATUSES = new Set(["paid", "refunded"]);

function apiBase(env) { return String(env.DWALLET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""); }
function apiKey(env) {
  const key = String(env.DWALLET_API_KEY || "").trim();
  if (!key) throw new Error("DWALLET_API_KEY is not configured.");
  return key;
}
function authHeaders(env) {
  const header = String(env.DWALLET_API_KEY_HEADER || "x-api-key").trim();
  const prefix = String(env.DWALLET_API_KEY_PREFIX || "");
  return { [header]: `${prefix}${apiKey(env)}` };
}
async function requestOnce(env, path, init, auth) {
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", ...auth, ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}
async function dwalletRequest(env, path, init = {}) {
  let { response, body } = await requestOnce(env, path, init, authHeaders(env));
  if (response.status === 401 && !env.DWALLET_API_KEY_HEADER) {
    ({ response, body } = await requestOnce(env, path, init, { authorization: `Bearer ${apiKey(env)}` }));
  }
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || `DWallet HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function unitsToDecimal(units, decimals) {
  const d = Math.max(0, Math.min(30, Number(decimals) || 0));
  const digits = String(units ?? "0").replace(/^0+(?=\d)/, "") || "0";
  if (!d) return digits;
  const padded = digits.padStart(d + 1, "0");
  const whole = padded.slice(0, -d) || "0";
  const fraction = padded.slice(-d).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
function decimalToUnits(amount, decimals) {
  const d = Math.max(0, Math.min(30, Number(decimals) || 0));
  const [whole, fraction = ""] = String(amount).split(".");
  return `${whole}${(fraction + "0".repeat(d)).slice(0, d)}`.replace(/^0+(?=\d)/, "") || "0";
}
function rowAssetAmount(row) {
  return row?.decimals != null ? unitsToDecimal(row.amount, row.decimals) : String(row?.amount || "");
}
function rowMatchesAmount(row, amount) {
  if (isDwalletUsdAmount(amount)) return true;
  if (row?.decimals != null) return String(row.amount) === decimalToUnits(amount, row.decimals);
  return String(row?.amount || "") === String(amount);
}
function pool(game) {
  if (!Array.isArray(game.telegramPrizePool)) game.telegramPrizePool = [];
  return game.telegramPrizePool;
}
function publicPrize(prize) {
  return {
    id: prize.id,
    sponsorId: prize.sponsorId,
    sponsorName: prize.sponsorName,
    awardId: prize.awardId,
    awardLabel: SPONSOR_AWARDS.find(x => x.id === prize.awardId)?.label || prize.awardId,
    amount: prize.amount,
    currency: prize.currency,
    status: prize.status,
    fundedAmount: prize.fundedAmount || null,
    fundingTipId: prize.fundingTipId || null,
    error: prize.error || null,
    recipients: prize.recipients || [],
    configuredAt: prize.configuredAt
  };
}

export function telegramPrizePoolState(game, env) {
  const prizes = pool(game).map(publicPrize);
  const funded = prizes.filter(p => p.status === "funded" || p.status === "paid").length;
  const pending = prizes.filter(p => ["awaiting_funding", "funding_ambiguous"].includes(p.status)).length;
  return {
    prizes,
    fundedCount: funded,
    pendingCount: pending,
    locked: game.status !== "registration",
    potUserId: String(env.DWALLET_POT_USER_ID || "").trim() || null,
    potTelegramUsername: String(env.DWALLET_TELEGRAM_POT_USERNAME || "").trim().replace(/^@/, "") || null,
    payoutsEnabled: env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true",
    awards: SPONSOR_AWARDS
  };
}

export function assertTelegramPrizesFunded(game) {
  const pending = pool(game).filter(p => !["funded", "paid"].includes(p.status));
  if (pending.length) throw new Error(`${pending.length} sponsored prize${pending.length === 1 ? " is" : "s are"} not funded yet. Fund or cancel them before starting Arena.`);
}

export async function createTelegramPrize(env, game, viewer, raw) {
  if (game.status !== "registration") throw new Error("Sponsorships lock when Arena starts.");
  if (!env.DWALLET_API_KEY) throw new Error("DWallet is not configured on this Worker.");
  const awardId = String(raw.awardId || "");
  if (!SPONSOR_AWARDS.some(x => x.id === awardId)) throw new Error("Choose a valid Arena award.");
  const amount = normalizeDwalletAmount(raw.amount);
  const currency = normalizeDwalletCurrency(raw.currency);
  const sponsorId = String(viewer.id);
  const existing = pool(game).find(p => p.sponsorId === sponsorId && p.awardId === awardId && !FINAL_PAYOUT_STATUSES.has(p.status));
  const record = {
    id: existing?.id || crypto.randomUUID(),
    sponsorId,
    sponsorName: viewer.displayName || "Sponsor",
    awardId,
    amount,
    currency,
    configuredAt: new Date().toISOString(),
    status: "awaiting_funding",
    fundedAmount: null,
    fundingTipId: null,
    error: null,
    recipients: []
  };
  if (existing) Object.assign(existing, record);
  else pool(game).push(record);
  await saveGame(env.DB, game);
  return record;
}

export async function cancelTelegramPrize(env, game, viewer, prizeId) {
  if (game.status !== "registration") throw new Error("Sponsorships are locked after Arena starts.");
  const prize = pool(game).find(p => p.id === String(prizeId || ""));
  if (!prize) throw new Error("Sponsorship not found.");
  if (prize.sponsorId !== String(viewer.id) && String(game.hostId) !== String(viewer.id)) throw new Error("Only the sponsor or Arena host can cancel this pledge.");
  if (prize.status === "funded") throw new Error("This sponsorship is already funded and cannot be cancelled from the Mini App.");
  game.telegramPrizePool = pool(game).filter(p => p.id !== prize.id);
  await saveGame(env.DB, game);
}

async function fundingMatches(env, prize) {
  const qs = new URLSearchParams({ direction: "received", from_user_id: String(prize.sponsorId), limit: "100" });
  const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const configuredMs = Date.parse(prize.configuredAt || "") || 0;
  return rows.filter(row => {
    if (String(row?.from_user_id || "") !== String(prize.sponsorId)) return false;
    if (String(row?.currency || "").toUpperCase() !== prize.currency) return false;
    const ts = Date.parse(row?.timestamp || "") || 0;
    if (configuredMs && ts && ts < configuredMs - 5000) return false;
    return rowMatchesAmount(row, prize.amount);
  });
}

export async function verifyTelegramPrizeFunding(env, game, viewer, prizeId) {
  if (game.status !== "registration") throw new Error("Funding verification is only available before Arena starts.");
  const prize = pool(game).find(p => p.id === String(prizeId || ""));
  if (!prize) throw new Error("Sponsorship not found.");
  if (prize.sponsorId !== String(viewer.id) && String(game.hostId) !== String(viewer.id)) throw new Error("Only the sponsor or Arena host can verify this funding.");
  if (prize.status === "funded") return prize;
  const matches = await fundingMatches(env, prize);
  if (!matches.length) {
    prize.status = "awaiting_funding";
    prize.error = "No matching DWallet funding tip found yet. If your DWallet began on Discord, use /link in @dwalletxbot first, then retry.";
  } else if (matches.length > 1) {
    prize.status = "funding_ambiguous";
    prize.error = "Multiple matching incoming DWallet tips were found. Veil will not guess which transfer funded this prize.";
  } else {
    const funding = matches[0];
    prize.status = "funded";
    prize.fundingTipId = funding.tip_id ?? null;
    prize.fundedAt = funding.timestamp || new Date().toISOString();
    prize.fundedAmount = rowAssetAmount(funding) || (isDwalletUsdAmount(prize.amount) ? null : prize.amount);
    prize.error = prize.fundedAmount ? null : "DWallet confirmed funding but did not return the locked asset amount.";
    if (!prize.fundedAmount) prize.status = "funding_ambiguous";
  }
  await saveGame(env.DB, game);
  return prize;
}

function splitAssetAmount(amount, count) {
  const raw = String(amount || "");
  const [, fraction = ""] = raw.split(".");
  const decimals = Math.min(30, fraction.length);
  const units = BigInt(decimalToUnits(raw, decimals));
  const n = BigInt(count);
  const base = units / n;
  let remainder = units % n;
  return Array.from({ length: count }, () => {
    const share = base + (remainder-- > 0n ? 1n : 0n);
    return unitsToDecimal(share.toString(), decimals);
  });
}

async function reconcileOutgoing(env, prize, recipientId, amount) {
  const qs = new URLSearchParams({ direction: "sent", to_user_id: String(recipientId), limit: "30" });
  const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const attemptMs = Date.parse(prize.attemptedAt || "") || 0;
  const matches = rows.filter(row => {
    if (String(row?.to_user_id || "") !== String(recipientId)) return false;
    if (String(row?.currency || "").toUpperCase() !== prize.currency) return false;
    const ts = Date.parse(row?.timestamp || "") || 0;
    if (attemptMs && ts && ts < attemptMs - 30000) return false;
    return rowMatchesAmount(row, amount);
  });
  return matches.length === 1 ? matches[0] : null;
}

async function sendTelegramRecipientTip(env, game, prize, recipientId, amount, note) {
  if (env.DWALLET_TELEGRAM_PAYOUTS_ENABLED !== "true") throw new Error("Telegram DWallet payouts are safety-locked until DWALLET_TELEGRAM_PAYOUTS_ENABLED=true.");
  return dwalletRequest(env, "/tips", {
    method: "POST",
    body: JSON.stringify({
      to_user_id: String(recipientId),
      amount: String(amount),
      currency: prize.currency,
      note,
      channel_id: String(game.channelId),
      guild_id: String(game.guildId)
    })
  });
}

async function payShare(env, game, prize, share, refund = false) {
  share.status = "sending";
  prize.attemptedAt = new Date().toISOString();
  await saveGame(env.DB, game);
  try {
    const result = await sendTelegramRecipientTip(env, game, prize, share.recipientId, share.amount, `Veil Telegram Arena ${String(game.id).slice(0, 12)} ${refund ? "refund" : prize.awardId}`);
    share.status = refund ? "refunded" : "paid";
    share.tipId = result?.transaction?.tip_id ?? result?.data?.tip_id ?? result?.tip_id ?? null;
    share.paidAt = new Date().toISOString();
  } catch (error) {
    const retryable = !error?.status || error.status >= 500;
    if (retryable && env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true") {
      try {
        const existing = await reconcileOutgoing(env, prize, share.recipientId, share.amount);
        if (existing) {
          share.status = refund ? "refunded" : "paid";
          share.tipId = existing.tip_id ?? null;
          share.paidAt = existing.timestamp || new Date().toISOString();
          share.reconciled = true;
          await saveGame(env.DB, game);
          return;
        }
      } catch {}
    }
    share.status = env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true" ? "needs_reconciliation" : "ready_for_payout";
    share.error = String(error?.message || error);
  }
  await saveGame(env.DB, game);
}

export async function settleTelegramPrizePool(env, game) {
  if (!game || game.platform !== "telegram" || !["finished", "cancelled", "aborted"].includes(game.status)) return game;
  const prizes = pool(game);
  if (!prizes.length) return game;
  const refund = game.status !== "finished";

  for (const prize of prizes) {
    if (prize.status !== "funded" && !Array.isArray(prize.recipients)) continue;
    if (!prize.fundedAmount) continue;
    if (!prize.recipients?.length) {
      let ids = refund ? [prize.sponsorId] : awardRecipients(game, prize.awardId).filter(id => !game.players?.[id]?.simulated);
      if (!ids.length) ids = [prize.sponsorId];
      const shares = splitAssetAmount(prize.fundedAmount, ids.length);
      prize.recipients = ids.map((id, index) => ({
        recipientId: String(id),
        displayName: refund || String(id) === String(prize.sponsorId) ? prize.sponsorName : (game.players?.[id]?.displayName || "Winner"),
        amount: shares[index],
        status: env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true" ? "queued" : "ready_for_payout",
        refund: refund || (!awardRecipients(game, prize.awardId).filter(x => !game.players?.[x]?.simulated).length)
      }));
      prize.status = env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true" ? "settling" : "ready_for_payout";
      await saveGame(env.DB, game);
    }
    if (env.DWALLET_TELEGRAM_PAYOUTS_ENABLED === "true") {
      for (const share of prize.recipients) {
        if (["paid", "refunded"].includes(share.status)) continue;
        await payShare(env, game, prize, share, Boolean(share.refund));
      }
      const done = prize.recipients.every(s => ["paid", "refunded"].includes(s.status));
      prize.status = done ? (prize.recipients.every(s => s.status === "refunded") ? "refunded" : "paid") : "needs_reconciliation";
      await saveGame(env.DB, game);
    }
  }
  return game;
}
