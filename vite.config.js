import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function discordWebhookProxy() {
  return {
    name: "discord-webhook-proxy",
    configureServer(server) {
      server.middlewares.use("/api/discord-webhook", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("POST only");
          return;
        }

        try {
          const body = await readRequestBody(req);
          const webhookUrl = String(body.webhookUrl || "");
          const payload = body.payload || {};

          if (!webhookUrl.startsWith(DISCORD_WEBHOOK_PREFIX)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("유효한 Discord webhook URL만 사용할 수 있습니다.");
            return;
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
            res.statusCode = response.status;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(errorText || "Discord webhook request failed");
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(error instanceof Error ? error.message : "Webhook proxy failed");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), discordWebhookProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true,
  },
});
