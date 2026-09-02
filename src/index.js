export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "veil-arena",
        status: "ready"
      });
    }

    return new Response("Veil Arena is online.", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
