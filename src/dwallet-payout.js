const DEFAULT_BASE_URL = "https://api.dwallet.bot";

function apiBase(env) {
  return String(env.DWALLET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function apiKey(env) {
  const key = String(env.DWALLET_API_KEY || "").trim();
  if (!key) throw new Error("DWALLET_API_KEY is not configured.");
  return key;
}

function configuredAuth(env) {
  const key = apiKey(env);
  const header = String(env.DWALLET_API_KEY_HEADER || "x-api-key").trim();
  const prefix = String(env.DWALLET_API_KEY_PREFIX || "");
  return { [header]: `${prefix}${key}` };
}

export function normalizeDwalletAmount(value) {
  const amount = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) throw new Error("Enter a valid positive crypto amount.");
  if (!/[1-9]/.test(amount)) throw new Error("Winner payout must be greater than zero.");
  return amount;
}

export function normalizeDwalletCurrency(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,16}$/.test(currency)) throw new Error("Enter a valid DWallet currency ticker.");
  return currency;
}

async function requestOnce(env, path, init, auth) {
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...auth,
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function dwalletRequest(env, path, init = {}) {
  let { response, body } = await requestOnce(env, path, init, configuredAuth(env));

  // Swagger screenshot confirms API-key auth but not the header name. If the Worker
  // has not explicitly configured a header and x-api-key is rejected, safely try
  // Bearer auth once. A 401 means the first attempt was not executed as a payout.
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

function decimalToUnits(amount, decimals) {
  const d = Math.max(0, Math.min(30, Number(decimals) || 0));
  const [whole, fraction = ""] = String(amount).split(".");
  const padded = (fraction + "0".repeat(d)).slice(0, d);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, "") || "0";
}

async function reconcileRecentTip(env, payout, winnerId) {
  const qs = new URLSearchParams({ direction: "sent", to_user_id: String(winnerId), limit: "20" });
  const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const attemptMs = Date.parse(payout.attemptedAt || "") || 0;
  const matches = rows.filter(row => {
    if (String(row?.to_user_id || "") !== String(winnerId)) return false;
    if (String(row?.currency || "").toUpperCase() !== payout.currency) return false;
    const ts = Date.parse(row?.timestamp || "") || 0;
    if (attemptMs && ts && ts < attemptMs - 30000) return false;
    if (row?.decimals != null) return String(row.amount) === decimalToUnits(payout.amount, row.decimals);
    return String(row?.amount || "") === payout.amount;
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error("Multiple matching recent DWallet tips found; refusing an automatic retry.");
  return null;
}

async function sendTip(env, game, payout) {
  return dwalletRequest(env, "/tips", {
    method: "POST",
    body: JSON.stringify({
      to_user_id: String(game.winnerId),
      amount: payout.amount,
      currency: payout.currency,
      note: `Veil Arena ${String(game.id).slice(0, 12)} winner payout`,
      channel_id: String(game.channelId),
      guild_id: String(game.guildId)
    })
  });
}

export async function payArenaWinner(env, game, saveGame) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout || game?.platform !== "discord") return null;
  if (payout.status === "paid") return payout;
  const winner = game.players?.[game.winnerId];
  if (!game.winnerId || !winner) return null;
  if (winner.simulated) {
    payout.status = "skipped";
    payout.error = "Synthetic Arena bots cannot receive DWallet payouts.";
    await saveGame(env.DB, game);
    return payout;
  }

  payout.amount = normalizeDwalletAmount(payout.amount);
  payout.currency = normalizeDwalletCurrency(payout.currency);
  payout.status = "sending";
  payout.attemptedAt = new Date().toISOString();
  payout.error = null;
  await saveGame(env.DB, game);

  try {
    const result = await sendTip(env, game, payout);
    payout.status = "paid";
    payout.tipId = result?.transaction?.tip_id ?? result?.data?.tip_id ?? result?.tip_id ?? null;
    payout.paidAt = new Date().toISOString();
    await saveGame(env.DB, game);
    return payout;
  } catch (firstError) {
    const retryable = !firstError?.status || firstError.status >= 500;
    if (!retryable) {
      payout.status = "failed";
      payout.error = String(firstError?.message || firstError);
      await saveGame(env.DB, game);
      return payout;
    }

    try {
      const existing = await reconcileRecentTip(env, payout, game.winnerId);
      if (existing) {
        payout.status = "paid";
        payout.tipId = existing.tip_id ?? null;
        payout.paidAt = existing.timestamp || new Date().toISOString();
        payout.reconciled = true;
        await saveGame(env.DB, game);
        return payout;
      }

      const retry = await sendTip(env, game, payout);
      payout.status = "paid";
      payout.tipId = retry?.transaction?.tip_id ?? retry?.data?.tip_id ?? retry?.tip_id ?? null;
      payout.paidAt = new Date().toISOString();
      payout.retried = true;
      await saveGame(env.DB, game);
      return payout;
    } catch (reconcileError) {
      payout.status = "needs_reconciliation";
      payout.error = String(reconcileError?.message || reconcileError || firstError);
      await saveGame(env.DB, game);
      return payout;
    }
  }
}

export function payoutStatusText(game) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout) return "";
  const winner = game.players?.[game.winnerId];
  if (payout.status === "paid") return `💜 **DWallet payout sent:** ${payout.amount} ${payout.currency} → **${winner?.displayName || "winner"}**${payout.tipId ? ` (tip #${payout.tipId})` : ""}`;
  if (payout.status === "skipped") return `⚠️ **DWallet payout skipped:** ${payout.error}`;
  if (payout.status === "failed") return `⚠️ **DWallet payout failed:** ${payout.error}`;
  if (payout.status === "needs_reconciliation") return `⚠️ **DWallet payout needs reconciliation before any resend.** ${payout.error || ""}`.trim();
  return "";
}
