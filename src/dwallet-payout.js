const DEFAULT_BASE_URL = "https://api.dwallet.bot";

function apiBase(env) { return String(env.DWALLET_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""); }
function apiKey(env) { const key = String(env.DWALLET_API_KEY || "").trim(); if (!key) throw new Error("DWALLET_API_KEY is not configured."); return key; }
function configuredAuth(env) { const key = apiKey(env); const header = String(env.DWALLET_API_KEY_HEADER || "x-api-key").trim(); const prefix = String(env.DWALLET_API_KEY_PREFIX || ""); return { [header]: `${prefix}${key}` }; }

export function normalizeDwalletAmount(value) {
  const amount = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || !/[1-9]/.test(amount)) throw new Error("Enter a valid positive crypto amount.");
  return amount;
}
export function normalizeDwalletCurrency(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,16}$/.test(currency)) throw new Error("Enter a valid DWallet currency ticker.");
  return currency;
}

async function requestOnce(env, path, init, auth) {
  const response = await fetch(`${apiBase(env)}${path}`, { ...init, headers: { accept: "application/json", "content-type": "application/json", ...auth, ...(init.headers || {}) } });
  const body = await response.json().catch(() => null);
  return { response, body };
}
async function dwalletRequest(env, path, init = {}) {
  let { response, body } = await requestOnce(env, path, init, configuredAuth(env));
  if (response.status === 401 && !env.DWALLET_API_KEY_HEADER) ({ response, body } = await requestOnce(env, path, init, { authorization: `Bearer ${apiKey(env)}` }));
  if (!response.ok || body?.success === false) { const error = new Error(body?.message || `DWallet HTTP ${response.status}`); error.status = response.status; error.body = body; throw error; }
  return body;
}
function decimalToUnits(amount, decimals) { const d = Math.max(0, Math.min(30, Number(decimals) || 0)); const [whole, fraction = ""] = String(amount).split("."); return `${whole}${(fraction + "0".repeat(d)).slice(0, d)}`.replace(/^0+(?=\d)/, "") || "0"; }
function rowMatchesAmount(row, amount) { return row?.decimals != null ? String(row.amount) === decimalToUnits(amount, row.decimals) : String(row?.amount || "") === String(amount); }

export async function discoverDwalletPotUserId(env) {
  const configured = String(env.DWALLET_POT_USER_ID || "").trim();
  if (configured) return configured;
  for (const direction of ["sent", "received"]) {
    try {
      const result = await dwalletRequest(env, `/tips?${new URLSearchParams({ direction, limit: "1" })}`, { method: "GET" });
      const row = Array.isArray(result?.data) ? result.data[0] : null;
      const id = direction === "sent" ? row?.from_user_id : row?.to_user_id;
      if (id) return String(id);
    } catch {}
  }
  return null;
}

async function recentFundingMatches(env, payout) {
  const qs = new URLSearchParams({ direction: "received", from_user_id: String(payout.hostId), limit: "100" });
  const result = await dwalletRequest(env, `/tips?${qs}`, { method: "GET" });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const configuredMs = Date.parse(payout.configuredAt || "") || 0;
  return rows.filter(row => String(row?.from_user_id || "") === String(payout.hostId) && String(row?.currency || "").toUpperCase() === payout.currency && rowMatchesAmount(row, payout.amount) && (!(configuredMs && Date.parse(row?.timestamp || "")) || Date.parse(row.timestamp) >= configuredMs - 5000));
}

export async function verifyArenaFunding(env, game, saveGame) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout || game?.platform !== "discord") return null;
  if (["funded", "sending", "paid", "refunded"].includes(payout.status)) return payout;
  const matches = await recentFundingMatches(env, payout);
  if (!matches.length) { payout.status = "awaiting_funding"; payout.error = null; await saveGame(env.DB, game); return payout; }
  if (matches.length > 1) { payout.status = "funding_ambiguous"; payout.error = "Multiple matching incoming DWallet tips were found. Refusing to choose one automatically."; await saveGame(env.DB, game); return payout; }
  const funding = matches[0];
  payout.status = "funded";
  payout.fundingTipId = funding.tip_id ?? null;
  payout.fundedAt = funding.timestamp || new Date().toISOString();
  payout.potUserId = payout.potUserId || await discoverDwalletPotUserId(env);
  payout.error = null;
  await saveGame(env.DB, game);
  return payout;
}

async function sendTipToUser(env, game, payout, toUserId, note) {
  return dwalletRequest(env, "/tips", { method: "POST", body: JSON.stringify({ to_user_id: String(toUserId), amount: payout.amount, currency: payout.currency, note, channel_id: String(game.channelId), guild_id: String(game.guildId) }) });
}
async function reconcileRecentTip(env, payout, toUserId) {
  const result = await dwalletRequest(env, `/tips?${new URLSearchParams({ direction: "sent", to_user_id: String(toUserId), limit: "20" })}`, { method: "GET" });
  const attemptMs = Date.parse(payout.attemptedAt || "") || 0;
  const matches = (Array.isArray(result?.data) ? result.data : []).filter(row => String(row?.to_user_id || "") === String(toUserId) && String(row?.currency || "").toUpperCase() === payout.currency && rowMatchesAmount(row, payout.amount) && (!(attemptMs && Date.parse(row?.timestamp || "")) || Date.parse(row.timestamp) >= attemptMs - 30000));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error("Multiple matching recent DWallet tips found; refusing an automatic retry.");
  return null;
}
async function persistPayout(env, game, saveGame, payout) { await saveGame(env.DB, game); return payout; }
async function completeOutgoingTip(env, game, payout, toUserId, note, finalStatus, saveGame) {
  payout.status = "sending"; payout.attemptedAt = new Date().toISOString(); payout.error = null; await saveGame(env.DB, game);
  try {
    const result = await sendTipToUser(env, game, payout, toUserId, note);
    payout.status = finalStatus; payout.tipId = result?.transaction?.tip_id ?? result?.data?.tip_id ?? result?.tip_id ?? null; payout.paidAt = new Date().toISOString();
    return persistPayout(env, game, saveGame, payout);
  } catch (firstError) {
    if (firstError?.status && firstError.status < 500) { payout.status = "failed"; payout.error = String(firstError?.message || firstError); return persistPayout(env, game, saveGame, payout); }
    try {
      const existing = await reconcileRecentTip(env, payout, toUserId);
      if (existing) { payout.status = finalStatus; payout.tipId = existing.tip_id ?? null; payout.paidAt = existing.timestamp || new Date().toISOString(); payout.reconciled = true; return persistPayout(env, game, saveGame, payout); }
      const retry = await sendTipToUser(env, game, payout, toUserId, note);
      payout.status = finalStatus; payout.tipId = retry?.transaction?.tip_id ?? retry?.data?.tip_id ?? retry?.tip_id ?? null; payout.paidAt = new Date().toISOString(); payout.retried = true;
      return persistPayout(env, game, saveGame, payout);
    } catch (error) { payout.status = "needs_reconciliation"; payout.error = String(error?.message || error || firstError); return persistPayout(env, game, saveGame, payout); }
  }
}

export async function payArenaWinner(env, game, saveGame) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout || game?.platform !== "discord" || ["paid", "refunded"].includes(payout.status)) return payout || null;
  if (payout.status !== "funded") { payout.status = "failed"; payout.error = "Winner payout was not funded by the host before the Arena started."; await saveGame(env.DB, game); return payout; }
  const winner = game.players?.[game.winnerId];
  if (!game.winnerId || !winner) return null;
  payout.amount = normalizeDwalletAmount(payout.amount); payout.currency = normalizeDwalletCurrency(payout.currency);
  if (winner.simulated) return completeOutgoingTip(env, game, payout, payout.hostId, `Veil Arena ${String(game.id).slice(0, 12)} refund - synthetic winner`, "refunded", saveGame);
  return completeOutgoingTip(env, game, payout, game.winnerId, `Veil Arena ${String(game.id).slice(0, 12)} winner payout`, "paid", saveGame);
}

export function fundingStatusText(game) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout) return "";
  if (payout.status === "funded") return `✅ **Prize pot funded:** ${payout.amount} ${payout.currency}${payout.fundingTipId ? ` (incoming tip #${payout.fundingTipId})` : ""}`;
  if (payout.status === "funding_ambiguous") return `⚠️ **Prize funding needs review:** ${payout.error}`;
  return `⏳ **Prize pot awaiting host funding:** ${payout.amount} ${payout.currency}`;
}
export function payoutStatusText(game) {
  const payout = game?.dwalletWinnerPayout;
  if (!payout) return "";
  const winner = game.players?.[game.winnerId];
  if (payout.status === "paid") return `💜 **DWallet payout sent:** ${payout.amount} ${payout.currency} → **${winner?.displayName || "winner"}**${payout.tipId ? ` (tip #${payout.tipId})` : ""}`;
  if (payout.status === "refunded") return `↩️ **DWallet prize refunded to host:** ${payout.amount} ${payout.currency}${payout.tipId ? ` (tip #${payout.tipId})` : ""}`;
  if (payout.status === "failed") return `⚠️ **DWallet payout failed:** ${payout.error}`;
  if (payout.status === "needs_reconciliation") return `⚠️ **DWallet payout needs reconciliation before resend.** ${payout.error || ""}`.trim();
  return "";
}
