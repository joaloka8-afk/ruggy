import express from "express";
import type { Server } from "http";
import type { Logger } from "pino";
import type { Context, Telegraf } from "telegraf";

interface HttpServerOptions {
  port: number;
  logger: Logger;
  mode: "webhook" | "polling";
  bot: Telegraf<Context>;
  webhookPath?: string;
}

export async function startHttpServer(options: HttpServerOptions): Promise<Server> {
  const app = express();
  app.disable("x-powered-by");

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: "ruggy",
      status: "ok",
      mode: options.mode,
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, mode: options.mode });
  });

  if (options.mode === "webhook" && options.webhookPath) {
    app.use(express.json({ limit: "1mb" }));
    app.post(options.webhookPath, async (req, res) => {
      try {
        await options.bot.handleUpdate(req.body);
        res.sendStatus(200);
      } catch {
        res.sendStatus(500);
      }
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(options.port, () => {
      options.logger.info({ port: options.port, mode: options.mode }, "HTTP server started");
      resolve(server);
    });

    server.on("error", (error) => reject(error));
  });
}

export function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
