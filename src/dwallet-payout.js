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

export function isDwalletUsdAmount(value) {
  return /^\$\d+(?:\.\d{1,2})?$/.test(String(value ?? "").trim().replace(/,/g, ""));
}

export function normalizeDwalletAmount(value) {
  let amount = String(value ?? "").trim().replace(/,/g, "");
  if (/^\d+(?:\.\d{1,2})?\$$/.test(amount)) amount = `$${amount.slice(0, -1)}`;

  if (isDwalletUsdAmount(amount)) {
    const dollars = amount.slice(1);
    if (!/[1-9]/.test(dollars)) throw new Error("Winner payout must be greater than zero.");
    return `$${dollars}`;
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) {
    throw new Error("Enter a crypto amount like 0.001, or a dollar amount like $1 or $5.");
  }
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

  // The current public docs confirm API-key auth and dollar-amount handling.
  // If x-api-key is rejected and no explicit header was configured, try Bearer once.
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

function unitsToDecimal(units, decimals) {
  const d = Math.max(0, Math.min(30, Number(decimals) || 0));
  const digits = String(units ?? "0").replace(/^0+(?=\d)/, "") || "0";
  if (!d) return digits;
  const padded = digits.padStart(d + 1, "0");
  const whole = padded.slice(0, -d) || "0";
  const fraction = padded.slice(-d).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function rowAssetAmount(row) {
  if (row?.decimals != null) return unitsToDecimal(row.amount, row.decimals);
  return String(row?.amount || "");
}

function transferAmount(payout) {
  return String(payout?.fundedAmount || payout?.amount || "");
}

function rowMatchesAmount(row, amount) {
  if (isDwalletUsdAmount(amount)) return false;
  if (row?.decimals != null) return String(row.amount) === decimalToUnits(amount, row.decimals);
  return String(row?.amount || "") === String(amount);
}

export async function discoverDwalletPotUserId(env) {
  const configured = String(env.DWALLET_POT_USER_ID || "").trim();
  if (configured) return configured;

  for (const direction of ["sent", "received"]) {
    try {
      const qs = new URLSearchParams({ direction, limit: "1" });
      const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
      const row = Array.isArray(result?.data) ? result.data[0] : null;
      const id = direction === "sent" ? row?.from_user_id : row?.to_user_id;
      if (id) return String(id);
    } catch {}
  }
  return null;
}

async function recentFundingMatches(env, payout) {
  const qs = new URLSearchParams({
    direction: "received",
    from_user_id: String(payout.hostId),
    limit: "100"
  });
  const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const configuredMs = Date.parse(payout.configuredAt || "") || 0;
  const usdPrize = isDwalletUsdAmount(payout.amount);

  return rows.filter(row => {
    if (String(row?.from_user_id || "") !== String(payout.hostId)) return false;
    if (String(row?.currency || "").toUpperCase() !== payout.currency) return false;
    const ts = Date.parse(row?.timestamp || "") || 0;
    if (configuredMs && ts && ts < configuredMs - 5000) return false;

    // For a raw crypto prize we can verify the exact asset amount directly.
    // For a $ prize, DWallet converts the host's dollar instruction to crypto at
    // the live rate. GET /tips then reports the resulting asset units, so we bind
    // the single matching post-configuration transfer and preserve those exact
    // crypto units for the winner payout.
    if (!usdPrize && !rowMatchesAmount(row, payout.amount)) return false;
    return true;
  });
}

export async function verifyArenaFunding(env, game, saveGame) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout || game?.platform !== "discord") return null;
  if (["funded", "sending", "paid", "refunded"].includes(payout.status)) return payout;

  const matches = await recentFundingMatches(env, payout);
  if (!matches.length) {
    payout.status = "awaiting_funding";
    payout.error = null;
    await saveGame(env.DB, game);
    return payout;
  }
  if (matches.length > 1) {
    payout.status = "funding_ambiguous";
    payout.error = "Multiple matching incoming DWallet tips were found. Refusing to choose one automatically.";
    await saveGame(env.DB, game);
    return payout;
  }

  const funding = matches[0];
  payout.status = "funded";
  payout.fundingTipId = funding.tip_id ?? null;
  payout.fundedAt = funding.timestamp || new Date().toISOString();
  payout.potUserId = payout.potUserId || await discoverDwalletPotUserId(env);
  payout.fundedAmount = rowAssetAmount(funding) || (isDwalletUsdAmount(payout.amount) ? null : payout.amount);
  payout.error = null;
  await saveGame(env.DB, game);
  return payout;
}

async function reconcileRecentTip(env, payout, toUserId) {
  const qs = new URLSearchParams({ direction: "sent", to_user_id: String(toUserId), limit: "20" });
  const result = await dwalletRequest(env, `/tips?${qs.toString()}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const attemptMs = Date.parse(payout.attemptedAt || "") || 0;
  const actualAmount = transferAmount(payout);
  const matches = rows.filter(row => {
    if (String(row?.to_user_id || "") !== String(toUserId)) return false;
    if (String(row?.currency || "").toUpperCase() !== payout.currency) return false;
    const ts = Date.parse(row?.timestamp || "") || 0;
    if (attemptMs && ts && ts < attemptMs - 30000) return false;
    return rowMatchesAmount(row, actualAmount);
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error("Multiple matching recent DWallet tips found; refusing an automatic retry.");
  return null;
}

async function sendTipToUser(env, game, payout, toUserId, note) {
  const actualAmount = transferAmount(payout);
  if (!actualAmount || isDwalletUsdAmount(actualAmount)) {
    throw new Error("The funded crypto amount is missing; refusing to send an unbacked payout.");
  }
  return dwalletRequest(env, "/tips", {
    method: "POST",
    body: JSON.stringify({
      to_user_id: String(toUserId),
      amount: actualAmount,
      currency: payout.currency,
      note,
      channel_id: String(game.channelId),
      guild_id: String(game.guildId)
    })
  });
}

async function completeOutgoingTip(env, game, payout, toUserId, note, finalStatus) {
  payout.status = "sending";
  payout.attemptedAt = new Date().toISOString();
  payout.error = null;
  await game.__saveGame(env.DB, game);

  try {
    const result = await sendTipToUser(env, game, payout, toUserId, note);
    payout.status = finalStatus;
    payout.tipId = result?.transaction?.tip_id ?? result?.data?.tip_id ?? result?.tip_id ?? null;
    payout.paidAt = new Date().toISOString();
    await game.__saveGame(env.DB, game);
    return payout;
  } catch (firstError) {
    const retryable = !firstError?.status || firstError.status >= 500;
    if (!retryable) {
      payout.status = "failed";
      payout.error = String(firstError?.message || firstError);
      await game.__saveGame(env.DB, game);
      return payout;
    }

    try {
      const existing = await reconcileRecentTip(env, payout, toUserId);
      if (existing) {
        payout.status = finalStatus;
        payout.tipId = existing.tip_id ?? null;
        payout.paidAt = existing.timestamp || new Date().toISOString();
        payout.reconciled = true;
        await game.__saveGame(env.DB, game);
        return payout;
      }

      const retry = await sendTipToUser(env, game, payout, toUserId, note);
      payout.status = finalStatus;
      payout.tipId = retry?.transaction?.tip_id ?? retry?.data?.tip_id ?? retry?.tip_id ?? null;
      payout.paidAt = new Date().toISOString();
      payout.retried = true;
      await game.__saveGame(env.DB, game);
      return payout;
    } catch (reconcileError) {
      payout.status = "needs_reconciliation";
      payout.error = String(reconcileError?.message || reconcileError || firstError);
      await game.__saveGame(env.DB, game);
      return payout;
    }
  }
}

export async function payArenaWinner(env, game, saveGame) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout || game?.platform !== "discord") return null;
  if (["paid", "refunded"].includes(payout.status)) return payout;
  if (payout.status !== "funded") {
    payout.status = "failed";
    payout.error = "Winner payout was not funded by the host before the Arena started.";
    await saveGame(env.DB, game);
    return payout;
  }

  const winner = game.players?.[game.winnerId];
  if (!game.winnerId || !winner) return null;
  payout.amount = normalizeDwalletAmount(payout.amount);
  payout.currency = normalizeDwalletCurrency(payout.currency);
  if (!payout.fundedAmount && !isDwalletUsdAmount(payout.amount)) payout.fundedAmount = payout.amount;

  Object.defineProperty(game, "__saveGame", { value: saveGame, configurable: true });
  try {
    if (winner.simulated) {
      return completeOutgoingTip(
        env,
        game,
        payout,
        payout.hostId,
        `Veil Arena ${String(game.id).slice(0, 12)} refund - synthetic winner`,
        "refunded"
      );
    }
    return completeOutgoingTip(
      env,
      game,
      payout,
      game.winnerId,
      `Veil Arena ${String(game.id).slice(0, 12)} winner payout`,
      "paid"
    );
  } finally {
    try { delete game.__saveGame; } catch {}
  }
}

function prizeDisplay(payout) {
  if (!payout) return "";
  if (isDwalletUsdAmount(payout.amount)) {
    const actual = payout.fundedAmount ? ` (${payout.fundedAmount} ${payout.currency} locked)` : "";
    return `${payout.amount} in ${payout.currency}${actual}`;
  }
  return `${payout.amount} ${payout.currency}`;
}

export function fundingStatusText(game) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout) return "";
  if (payout.status === "funded") return `✅ **Prize pot funded:** ${prizeDisplay(payout)}${payout.fundingTipId ? ` (incoming tip #${payout.fundingTipId})` : ""}`;
  if (payout.status === "funding_ambiguous") return `⚠️ **Prize funding needs review:** ${payout.error}`;
  return `⏳ **Prize pot awaiting host funding:** ${payout.amount} in ${payout.currency}`;
}

export function payoutStatusText(game) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout) return "";
  const winner = game.players?.[game.winnerId];
  const actual = transferAmount(payout);
  const label = isDwalletUsdAmount(payout.amount)
    ? `${payout.amount} in ${payout.currency}${actual ? ` (${actual} ${payout.currency})` : ""}`
    : `${payout.amount} ${payout.currency}`;
  if (payout.status === "paid") return `💜 **DWallet payout sent from the funded prize pot:** ${label} → **${winner?.displayName || "winner"}**${payout.tipId ? ` (tip #${payout.tipId})` : ""}`;
  if (payout.status === "refunded") return `↩️ **DWallet prize refunded to the host:** ${label}${payout.tipId ? ` (tip #${payout.tipId})` : ""}`;
  if (payout.status === "failed") return `⚠️ **DWallet payout failed:** ${payout.error}`;
  if (payout.status === "needs_reconciliation") return `⚠️ **DWallet payout needs reconciliation before any resend.** ${payout.error || ""}`.trim();
  return "";
}
