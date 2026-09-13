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
  const text = await response.text().catch(() => "");
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, body, text };
}

function apiError(response, body, text, path) {
  const detail = body?.detail || body?.error || body?.message || text || `HTTP ${response.status}`;
  const error = new Error(`DWallet ${path} HTTP ${response.status}: ${String(detail).slice(0, 300)}`);
  error.status = response.status;
  error.body = body;
  return error;
}

async function dwalletRequest(env, path, init = {}) {
  let { response, body, text } = await requestOnce(env, path, init, configuredAuth(env));
  if (response.status === 401 && !env.DWALLET_API_KEY_HEADER) {
    ({ response, body, text } = await requestOnce(env, path, init, { authorization: `Bearer ${apiKey(env)}` }));
  }
  if (!response.ok || body?.success === false) throw apiError(response, body, text, path);
  return body;
}

export function normalizeDirectTipAmount(value) {
  let amount = String(value ?? "").trim().replace(/,/g, "");
  if (/^\d+(?:\.\d{1,2})?\$$/.test(amount)) amount = `$${amount.slice(0, -1)}`;
  if (/^\$\d+(?:\.\d{1,2})?$/.test(amount)) {
    if (!/[1-9]/.test(amount)) throw new Error("Tip amount must be greater than zero.");
    return amount;
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || !/[1-9]/.test(amount)) {
    throw new Error("Enter a crypto amount like 0.01, or a dollar amount like $1 or $5.");
  }
  return amount;
}

export function normalizeDirectTipCurrency(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,16}$/.test(currency)) throw new Error("Enter a valid DWallet asset ticker, like SOL, USDT, XRP, or BTC.");
  return currency;
}

function adminEntries(env) {
  return String(env.VEIL_TIP_ADMIN_IDS || "")
    .split(/[\s,;]+/)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

export function veilTipAdminConfigured(env) {
  return adminEntries(env).length > 0;
}

export function isVeilTipAdmin(env, platform, userId) {
  const id = String(userId || "").trim().toLowerCase();
  const p = String(platform || "").trim().toLowerCase();
  if (!id) return false;
  const entries = adminEntries(env);
  return entries.includes(id) || entries.includes(`${p}:${id}`);
}

export function veilTipAdminEntry(platform, userId) {
  return `${String(platform || "").toLowerCase()}:${String(userId || "")}`;
}

export async function sendDirectDwalletTip(env, { toUserId, amount, currency }) {
  const normalizedAmount = normalizeDirectTipAmount(amount);
  const normalizedCurrency = normalizeDirectTipCurrency(currency);
  const recipient = String(toUserId || "").trim();
  if (!/^\d+$/.test(recipient)) throw new Error("Recipient user ID is invalid.");

  // Keep the money-moving request deliberately minimal. Discord/Telegram context and
  // notes are useful to Veil, but they are not required to execute a DWallet tip and
  // can make an otherwise valid transfer fail if the upstream schema changes.
  const body = {
    to_user_id: recipient,
    amount: normalizedAmount,
    currency: normalizedCurrency
  };

  // Intentionally one attempt only. A network timeout or upstream 5xx can be
  // ambiguous; automatically retrying a money transfer risks sending twice.
  const result = await dwalletRequest(env, "/tips", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return {
    amount: normalizedAmount,
    currency: normalizedCurrency,
    tipId: result?.transaction?.tip_id ?? result?.data?.tip_id ?? result?.tip_id ?? null,
    result
  };
}
