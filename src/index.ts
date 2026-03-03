import type { Server } from "http";

import { createTelegramBot } from "./bot/telegram";
import { loadConfig } from "./config";
import { ChatService } from "./core/chatService";
import { ScanEngine } from "./core/scanEngine";
import { createLogger } from "./logger";
import { DexscreenerService } from "./services/dexscreener";
import { RugcheckService } from "./services/rugcheck";
import { closeHttpServer, startHttpServer } from "./server/webhook";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.runtime.logLevel);

  const rugcheckService = new RugcheckService(undefined, logger);
  const dexscreenerService = new DexscreenerService(undefined, logger);
  const scanEngine = new ScanEngine(rugcheckService, dexscreenerService);

  const chatService = new ChatService({
    apiKey: config.openAi.apiKey,
    model: config.openAi.model,
    maxTurns: config.openAi.chatMemoryTurns,
    logger,
  });

  const bot = createTelegramBot({
    telegramBotToken: config.telegramBotToken,
    scanEngine,
    chatService,
    logger,
  });

  let server: Server | undefined;

  if (config.webhook.enabled && config.webhook.fullUrl) {
    await bot.telegram.setWebhook(config.webhook.fullUrl);
    logger.info(
      { webhookUrl: config.webhook.fullUrl, webhookPath: config.webhook.path },
      "Telegram webhook configured",
    );

    server = await startHttpServer({
      port: config.runtime.port,
      logger,
      mode: "webhook",
      bot,
      webhookPath: config.webhook.path,
    });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
    await bot.launch({ dropPendingUpdates: false });
    logger.info("Telegram polling started");

    server = await startHttpServer({
      port: config.runtime.port,
      logger,
      mode: "polling",
      bot,
    });
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down Ruggy");

    try {
      bot.stop(signal);
    } catch {
      logger.warn("Telegram bot stop failed");
    }

    if (server) {
      await closeHttpServer(server).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown close server error";
        logger.warn({ error: message }, "Failed to close HTTP server cleanly");
      });
    }

    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  const logger = createLogger("error");
  logger.error({ error: message }, "Ruggy failed to start");
  process.exit(1);
});

