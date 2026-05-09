const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const webhookUrl = String(body.webhookUrl || "");
    const payload = body.payload || {};

    if (!webhookUrl.startsWith(DISCORD_WEBHOOK_PREFIX)) {
      return new Response("유효한 Discord webhook URL만 사용할 수 있습니다.", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText || "Discord webhook request failed", {
        status: response.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Webhook proxy failed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
