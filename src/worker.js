const BASELINE = "2026-09-13-clean-reset";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "veil-arena",
        baseline: BASELINE,
        gameCore: "preserved",
        discord: "not-configured",
        telegram: "not-configured",
        databaseBound: Boolean(env.DB)
      });
    }

    return new Response(
      "Veil Arena core is online. External platform integrations are intentionally disconnected while they are rebuilt.",
      {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-veil-baseline": BASELINE
        }
      }
    );
  }
};
