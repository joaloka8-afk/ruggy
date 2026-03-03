import type { Logger } from "pino";
import { Telegraf, type Context } from "telegraf";

import { formatScanReport } from "../core/reportFormatter";
import { ScanEngine } from "../core/scanEngine";
import { ChatService } from "../core/chatService";
import { extractFirstSolanaAddress, isValidSolanaAddress } from "../utils/address";

interface BotDependencies {
  telegramBotToken: string;
  scanEngine: ScanEngine;
  chatService: ChatService;
  logger: Logger;
}

function getTextMessage(ctx: Context): string | undefined {
  if (!("message" in ctx.update)) {
    return undefined;
  }

  const message = ctx.update.message;
  if (!message || !("text" in message)) {
    return undefined;
  }

  return message.text;
}

async function runScan(ctx: Context, contractAddress: string, scanEngine: ScanEngine): Promise<void> {
  if (!isValidSolanaAddress(contractAddress)) {
    await ctx.reply("Invalid Solana contract address. Please send a valid CA (base58, 32-byte public key).");
    return;
  }

  await ctx.replyWithChatAction("typing");
  await ctx.reply("Scanning token with 3 Ruggy agents. This can take a few seconds...");

  try {
    const report = await scanEngine.scanToken({
      contractAddress,
      requestUserId: ctx.from?.id ?? 0,
    });

    await ctx.reply(formatScanReport(report));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error";
    await ctx.reply(`Scan failed: ${message}`);
  }
}

export function createTelegramBot(dependencies: BotDependencies): Telegraf<Context> {
  const { telegramBotToken, scanEngine, chatService, logger } = dependencies;
  const bot = new Telegraf<Context>(telegramBotToken);

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Ruggy is online.",
        "Send /scan <SOLANA_CA> or just paste a Solana contract address.",
        "Ruggy returns a 0-100 safety score (100 = safer, 0 = highest risk).",
        "You can also chat with Ruggy for guidance.",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "Commands:",
        "/start - Intro",
        "/help - Usage",
        "/scan <CA> - Analyze a Solana token contract address",
        "",
        "Tip: You can just paste the CA directly, and Ruggy will scan it.",
      ].join("\n"),
    );
  });

  bot.command("scan", async (ctx) => {
    const text = getTextMessage(ctx);
    const parts = text?.trim().split(/\s+/) ?? [];
    const contractAddress = parts[1];

    if (!contractAddress) {
      await ctx.reply("Usage: /scan <SOLANA_CONTRACT_ADDRESS>");
      return;
    }

    await runScan(ctx, contractAddress, scanEngine);
  });

  bot.on("text", async (ctx) => {
    const text = getTextMessage(ctx)?.trim();
    if (!text || text.startsWith("/")) {
      return;
    }

    const contractAddress = extractFirstSolanaAddress(text);
    if (contractAddress) {
      await runScan(ctx, contractAddress, scanEngine);
      return;
    }

    const reply = await chatService.getReply(ctx.from?.id ?? 0, text);
    await ctx.reply(reply.text);
  });

  bot.catch((error, ctx) => {
    const message = error instanceof Error ? error.message : "Unknown Telegram error";
    logger.error({ error: message, updateId: ctx.update.update_id }, "Telegram bot error");
  });

  return bot;
}

