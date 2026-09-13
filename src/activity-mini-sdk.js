export const MINI_DISCORD_SDK_SOURCE = String.raw`
const Opcodes = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, HELLO: 3 };
const ALLOWED_ORIGINS = new Set([
  window.location.origin,
  "https://discord.com",
  "https://discordapp.com",
  "https://ptb.discord.com",
  "https://ptb.discordapp.com",
  "https://canary.discord.com",
  "https://canary.discordapp.com",
  "https://staging.discord.co",
  "https://pax.discord.com",
  "null"
]);

function nonce() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((b, i) => ([4,6,8,10].includes(i) ? "-" : "") + b.toString(16).padStart(2, "0")).join("");
}

function rpcSource() {
  return [window.parent?.opener ?? window.parent, document.referrer || "*"];
}

export class DiscordSDK {
  constructor(clientId) {
    this.clientId = String(clientId || "");
    const params = new URLSearchParams(window.location.search);
    this.frameId = params.get("frame_id");
    this.instanceId = params.get("instance_id");
    this.platform = params.get("platform");
    this.customId = params.get("custom_id");
    this.referrerId = params.get("referrer_id");
    this.guildId = params.get("guild_id");
    this.channelId = params.get("channel_id");
    this.locationId = params.get("location_id");
    this.mobileAppVersion = params.get("mobile_app_version");

    if (!this.frameId) throw new Error("frame_id query param is not defined");
    if (!this.instanceId) throw new Error("instance_id query param is not defined");
    if (!this.platform) throw new Error("platform query param is not defined");

    [this.source, this.sourceOrigin] = rpcSource();
    this.pending = new Map();
    this.readyResolved = false;
    this.readyWaiters = [];
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.handleMessage);

    this.commands = {
      authorize: args => this.sendCommand("AUTHORIZE", args),
      authenticate: args => this.sendCommand("AUTHENTICATE", args),
      getChannel: args => this.sendCommand("GET_CHANNEL", args)
    };

    this.handshake();
  }

  handshake() {
    const payload = {
      v: 1,
      encoding: "json",
      client_id: this.clientId,
      frame_id: this.frameId
    };
    const major = Number.parseInt(String(this.mobileAppVersion || "").split(".")[0], 10);
    if (this.platform === "desktop" || (Number.isFinite(major) && major >= 250)) payload.sdk_version = "2.5.0";
    this.source?.postMessage([Opcodes.HANDSHAKE, payload], this.sourceOrigin);
  }

  ready() {
    if (this.readyResolved) return Promise.resolve();
    return new Promise(resolve => this.readyWaiters.push(resolve));
  }

  sendCommand(cmd, args = {}) {
    if (!this.source) return Promise.reject(new Error("Discord RPC source is unavailable."));
    const id = nonce();
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.source.postMessage([Opcodes.FRAME, { cmd, args, nonce: id }], this.sourceOrigin);
    return promise;
  }

  handleMessage(event) {
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    if (!Array.isArray(event.data)) return;
    const [opcode, payload] = event.data;
    if (opcode !== Opcodes.FRAME || !payload || typeof payload !== "object") return;

    if (payload.cmd === "DISPATCH" && payload.evt === "READY") {
      this.readyResolved = true;
      for (const resolve of this.readyWaiters.splice(0)) resolve();
      return;
    }

    if (!payload.nonce) return;
    const pending = this.pending.get(payload.nonce);
    if (!pending) return;
    this.pending.delete(payload.nonce);

    if (payload.evt === "ERROR") {
      const message = payload.data?.message || payload.data?.code || "Discord RPC command failed.";
      pending.reject(new Error(String(message)));
      return;
    }
    pending.resolve(payload.data);
  }

  close() {
    window.removeEventListener("message", this.handleMessage);
  }
}
`;
