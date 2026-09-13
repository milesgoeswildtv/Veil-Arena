const DISCORD_API = "https://discord.com/api/v10";

export const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3 };
export const InteractionResponseType = { PONG: 1 };

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function verifyDiscordRequest(request, keyHex, raw) {
  if (!keyHex) return false;
  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  if (!sig || !ts) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(sig), new TextEncoder().encode(ts + raw));
  } catch {
    return false;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

export function interactionMessage(content, components = [], ephemeral = false) {
  return jsonResponse({ type: 4, data: { content, components, flags: ephemeral ? 64 : 0, allowed_mentions: { parse: [] } } });
}

export function interactionUpdate(content, components = []) {
  return jsonResponse({ type: 7, data: { content, components, allowed_mentions: { parse: [] } } });
}

export function button(customId, label, style = 2, disabled = false, emoji = null) {
  const item = { type: 2, custom_id: customId, label, style, disabled };
  if (emoji) item.emoji = { name: emoji };
  return item;
}

export function actionRow(...components) { return { type: 1, components }; }

export function userFromInteraction(i) {
  const member = i.member;
  const user = member?.user || i.user;
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: member?.nick || user.global_name || user.username
  };
}

export function canManageGuild(interaction) {
  try {
    const bits = BigInt(interaction?.member?.permissions || "0");
    return Boolean(bits & 8n) || Boolean(bits & 32n);
  } catch {
    return false;
  }
}

export async function discordRequest(path, token, init = {}) {
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: { authorization: `Bot ${token}`, "content-type": "application/json", ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function createChannelMessage(channelId, token, payload) {
  return discordRequest(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
  });
}

const sponsorAmount = (name, description) => ({ name, description, type: 10, required: false, min_value: 0.01, max_value: 100000 });

export function arenaCommands() {
  return [
    {
      name: "arena",
      description: "Enter the Arena.",
      type: 1,
      options: [
        { name: "start", description: "Open Arena registration in this channel.", type: 1 },
        { name: "status", description: "Show the active Arena status in this channel.", type: 1 },
        { name: "forceclose", description: "Host/admin: force-close a stuck Arena in this channel.", type: 1 },
        { name: "bots", description: "Host: add synthetic contestants during registration.", type: 1, options: [
          { name: "amount", description: "How many bots to add (default 10).", type: 4, required: false, min_value: 1, max_value: 50 }
        ] },
        { name: "sponsor", description: "Sponsor optional cash prizes for this Arena.", type: 1, options: [
          sponsorAmount("winner", "Dollar amount for the Arena winner."),
          sponsorAmount("runner_up", "Dollar amount for the runner-up."),
          sponsorAmount("most_kills", "Dollar amount for most eliminations."),
          sponsorAmount("most_revivals", "Dollar amount for most revivals."),
          sponsorAmount("most_showdowns", "Dollar amount for most showdowns survived."),
          sponsorAmount("most_mass_brawls", "Dollar amount for most Mass Brawls survived.")
        ] },
        { name: "payout", description: "Host: create an automatic DWallet winner prize.", type: 1, options: [
          { name: "amount", description: "Crypto amount, e.g. 5 or 0.001.", type: 3, required: true, min_length: 1, max_length: 32 },
          { name: "currency", description: "DWallet ticker, e.g. USDT, SOL, XRP.", type: 3, required: true, min_length: 2, max_length: 16 }
        ] },
        { name: "fund", description: "Host: verify DWallet winner-prize funding.", type: 1 },
        { name: "rules", description: "Show the Arena rules.", type: 1 }
      ]
    }
  ];
}

export async function registerGuildCommands(appId, guildId, token) {
  return discordRequest(`/applications/${appId}/guilds/${guildId}/commands`, token, {
    method: "PUT",
    body: JSON.stringify(arenaCommands())
  });
}
