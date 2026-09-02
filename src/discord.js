const DISCORD_API = "https://discord.com/api/v10";

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3
};

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7
};

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function verifyDiscordRequest(request, publicKeyHex, rawBody) {
  if (!publicKeyHex) return false;
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(signature), data);
  } catch {
    return false;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function interactionMessage(content, components = [], ephemeral = false, embeds = []) {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
      embeds,
      flags: ephemeral ? 64 : 0,
      allowed_mentions: { parse: [] }
    }
  });
}

export function interactionUpdate(content, components = [], embeds = []) {
  return jsonResponse({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: { content, components, embeds, allowed_mentions: { parse: [] } }
  });
}

export function button(customId, label, style = 2, disabled = false, emoji = null) {
  const component = { type: 2, custom_id: customId, label, style, disabled };
  if (emoji) component.emoji = { name: emoji };
  return component;
}

export function actionRow(...components) {
  return { type: 1, components };
}

export function userFromInteraction(interaction) {
  const member = interaction.member;
  const user = member?.user || interaction.user;
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: member?.nick || user.global_name || user.username,
    avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
  };
}

export async function discordRequest(path, token, init = {}) {
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function createChannelMessage(channelId, token, payload) {
  return discordRequest(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
  });
}

export async function editOriginalInteraction(applicationId, interactionToken, botToken, payload) {
  return discordRequest(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, botToken, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
  });
}

export function arenaCommands() {
  return [
    {
      name: "arena",
      description: "Start and manage an Arena game.",
      type: 1,
      options: [
        { name: "start", description: "Open Arena registration.", type: 1 },
        { name: "status", description: "Show the current Arena game.", type: 1 },
        { name: "cancel", description: "Cancel the current Arena game (host only).", type: 1 }
      ]
    }
  ];
}

export async function registerGuildCommands(applicationId, guildId, botToken) {
  return discordRequest(`/applications/${applicationId}/guilds/${guildId}/commands`, botToken, {
    method: "PUT",
    body: JSON.stringify(arenaCommands())
  });
}
