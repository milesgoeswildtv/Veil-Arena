import app, { ArenaCoordinator } from "./discord-bots-entry.js";

export { ArenaCoordinator };

const BASE_BUILD = "20260913-13";
const TRACE_BUILD = "20260913-14";
const BASE_CLIENT_PATH = `/activity/veil-arena-${BASE_BUILD}.js`;
const TRACE_CLIENT_PATH = `/activity/veil-arena-${TRACE_BUILD}.js`;

function noStore(headers = new Headers()) {
  headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  headers.set("x-veil-activity-build", TRACE_BUILD);
  headers.set("x-veil-rpc-trace", "1");
  return headers;
}

function rpcTracerBootstrap() {
  const state = {
    messages: [],
    sdk: null,
    info: null,
    fallback: "NONE",
    note: "RPC tracer armed before SDK constructor.",
    startedAt: Date.now()
  };

  function safeRead(fn, fallback = "UNAVAILABLE") {
    try { return fn(); } catch { return fallback; }
  }

  function ensureBox() {
    const parent = document.getElementById("veilLaunchDebug") || document.body;
    let box = document.getElementById("veilRpcTrace");
    if (!box) {
      box = document.createElement("div");
      box.id = "veilRpcTrace";
      box.style.cssText = "margin-top:8px;border-top:1px solid #463458;padding-top:7px;color:#bfe6ff;white-space:pre-wrap";
      parent.appendChild(box);
    }
    return box;
  }

  function messageLine(message) {
    const bits = [`+${message.ms}ms`, `origin=${message.origin}`, `opcode=${message.opcode}`];
    if (message.cmd) bits.push(`cmd=${message.cmd}`);
    if (message.evt) bits.push(`evt=${message.evt}`);
    if (message.hasNonce) bits.push("nonce=yes");
    if (message.errorCode) bits.push(`error=${message.errorCode}`);
    return bits.join(" ");
  }

  function render(note) {
    if (note) state.note = note;
    const box = ensureBox();
    const info = state.info || {};
    const lines = [
      "RPC TRACE // 20260913-14",
      `location origin: ${info.locationOrigin || window.location.origin || "MISSING"}`,
      `expected proxy: ${info.expectedProxy || "waiting for SDK setup"}`,
      `proxy match: ${info.proxyMatch == null ? "WAITING" : info.proxyMatch ? "YES" : "NO"}`,
      `document.referrer: ${info.referrer || document.referrer || "MISSING"}`,
      `ancestor origin: ${info.ancestorOrigin || "MISSING"}`,
      `parent === self: ${info.parentIsSelf == null ? "WAITING" : info.parentIsSelf ? "YES" : "NO"}`,
      `parent opener: ${info.parentHasOpener == null ? "WAITING" : info.parentHasOpener ? "YES" : "NO"}`,
      `SDK sourceOrigin: ${info.sourceOrigin || "WAITING"}`,
      `SDK source === parent: ${info.sourceIsParent == null ? "WAITING" : info.sourceIsParent ? "YES" : "NO"}`,
      `messages received: ${state.messages.length}`,
      `fallback handshake: ${state.fallback}`,
      `status: ${state.note}`
    ];
    for (const message of state.messages.slice(-5)) lines.push(messageLine(message));
    box.textContent = lines.join("\n");
  }

  function discordOrigin(value) {
    return /^https:\/\/(?:ptb\.|canary\.)?(?:discord\.com|discordapp\.com)$/i.test(String(value || ""));
  }

  window.addEventListener("message", event => {
    const tuple = Array.isArray(event.data) ? event.data : null;
    const payload = tuple && tuple[1] && typeof tuple[1] === "object" ? tuple[1] : null;
    const message = {
      ms: Date.now() - state.startedAt,
      origin: event.origin || "EMPTY",
      opcode: tuple ? String(tuple[0]) : "NON_ARRAY",
      cmd: payload?.cmd ? String(payload.cmd) : "",
      evt: payload?.evt ? String(payload.evt) : "",
      hasNonce: Boolean(payload?.nonce),
      errorCode: payload?.evt === "ERROR" && payload?.data?.code ? String(payload.data.code) : ""
    };
    state.messages.push(message);
    if (state.messages.length > 20) state.messages.shift();
    render(`Discord RPC message received from ${message.origin}.`);
  }, true);

  globalThis.__VEIL_RPC_TRACE__ = {
    state,
    render,
    setProxyMismatch(clientId) {
      const expected = `${clientId}.discordsays.com`;
      state.info = {
        locationOrigin: window.location.origin,
        expectedProxy: `https://${expected}`,
        proxyMatch: false,
        referrer: document.referrer || "MISSING",
        ancestorOrigin: safeRead(() => window.location.ancestorOrigins?.[0] || "MISSING"),
        parentIsSelf: window.parent === window,
        parentHasOpener: Boolean(safeRead(() => window.parent?.opener, null))
      };
      render("ACTIVITY URL OVERRIDE / PROXY MISMATCH DETECTED.");
    },
    attach(sdk, clientId) {
      state.sdk = sdk;
      const ancestorOrigin = safeRead(() => window.location.ancestorOrigins?.[0] || "MISSING");
      const expectedHost = `${clientId}.discordsays.com`;
      state.info = {
        locationOrigin: window.location.origin,
        expectedProxy: `https://${expectedHost}`,
        proxyMatch: window.location.hostname === expectedHost,
        referrer: document.referrer || "MISSING",
        ancestorOrigin,
        parentIsSelf: window.parent === window,
        parentHasOpener: Boolean(safeRead(() => window.parent?.opener, null)),
        sourceOrigin: safeRead(() => sdk?.sourceOrigin || "MISSING"),
        sourceIsParent: safeRead(() => sdk?.source === window.parent, false)
      };
      render("Official SDK constructor completed; its first READY handshake was sent.");

      setTimeout(() => {
        if (state.messages.length || !state.info?.proxyMatch) return;
        const sourceOrigin = safeRead(() => sdk?.sourceOrigin || "");
        const handshake = safeRead(() => sdk?.handshake, null);
        if ((sourceOrigin === "*" || !sourceOrigin) && typeof handshake === "function") {
          const trustedAncestor = discordOrigin(ancestorOrigin) ? ancestorOrigin : "https://discord.com";
          try {
            sdk.sourceOrigin = trustedAncestor;
            handshake.call(sdk);
            state.fallback = trustedAncestor;
            state.info.sourceOrigin = trustedAncestor;
            render(`No RPC reply after 3s. Retried READY once against ${trustedAncestor}.`);
          } catch (error) {
            state.fallback = `FAILED: ${error?.message || String(error)}`;
            render("Fallback READY handshake could not be sent.");
          }
        }
      }, 3000);

      setTimeout(() => {
        if (!state.messages.length) {
          render("NO RPC MESSAGE RECEIVED FROM DISCORD after 7s. The iframe loaded, but Discord's parent RPC bridge has not answered.");
        }
      }, 7000);
    }
  };

  render();
}

function patchClient(source) {
  const target = `    discordSdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });\n    await withTimeout(discordSdk.ready(), 12000, "Discord SDK READY");`;
  const replacement = `    const expectedProxyHost = \`${"${clientId}"}.discordsays.com\`;\n    const rpcTrace = globalThis.__VEIL_RPC_TRACE__;\n    if (window.location.hostname !== expectedProxyHost) {\n      rpcTrace?.setProxyMismatch?.(clientId);\n      throw new Error(\`Discord Activity proxy mismatch: running on ${"${window.location.hostname}"}, expected ${"${expectedProxyHost}"}. Disable Application URL Override in Discord Developer Portal and launch Veil through the / URL Mapping.\`);\n    }\n    discordSdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });\n    rpcTrace?.attach?.(discordSdk, clientId);\n    await withTimeout(discordSdk.ready(), 12000, "Discord SDK READY");`;

  if (!source.includes(target)) {
    return `document.body.innerHTML = '<pre style="white-space:pre-wrap;color:#fff;background:#120b18;padding:20px">VEIL RPC TRACE BUILD ERROR // ${TRACE_BUILD}\\nCould not locate the official SDK setup block.</pre>';`;
  }

  const prelude = `(${rpcTracerBootstrap.toString()})();\n`;
  return `${prelude}${source.replace(target, replacement).replaceAll(BASE_BUILD, TRACE_BUILD)}`;
}

async function downstreamClient(request, env, ctx) {
  const url = new URL(request.url);
  url.pathname = BASE_CLIENT_PATH;
  const inner = new Request(url.toString(), request);
  return app.fetch(inner, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === TRACE_CLIENT_PATH) {
      const response = await downstreamClient(request, env, ctx);
      const source = await response.text();
      const headers = noStore(new Headers(response.headers));
      headers.set("content-type", "application/javascript; charset=utf-8");
      headers.set("x-content-type-options", "nosniff");
      headers.delete("content-length");
      return new Response(patchClient(source), { status: response.status, headers });
    }

    if (request.method === "GET" && ["/", "/activity", "/activity-preview", "/activity-preview/"].includes(url.pathname)) {
      const response = await app.fetch(request, env, ctx);
      const html = (await response.text())
        .replaceAll(BASE_BUILD, TRACE_BUILD)
        .replaceAll(BASE_CLIENT_PATH, TRACE_CLIENT_PATH);
      const headers = noStore(new Headers(response.headers));
      headers.set("content-type", "text/html; charset=utf-8");
      headers.delete("content-length");
      return new Response(html, { status: response.status, headers });
    }

    return app.fetch(request, env, ctx);
  }
};
