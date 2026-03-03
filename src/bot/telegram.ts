import type { Logger } from "pino";
import { Telegraf, type Context } from "telegraf";

import { formatScanReport } from "../core/reportFormatter";
import { ScanEngine } from "../core/scanEngine";
import { ChatService } from "../core/chatService";
import { getMessageVisualPack, getScoreVisualPack } from "../content/memeMedia";
import { extractFirstSolanaAddress, isValidSolanaAddress } from "../utils/address";
import { cleanBotText } from "../utils/text";
import { GifResolver } from "../services/gifResolver";

interface BotDependencies {
  telegramBotToken: string;
  scanEngine: ScanEngine;
  chatService: ChatService;
  gifResolver: GifResolver;
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

async function sendCleanText(ctx: Context, text: string): Promise<void> {
  await ctx.reply(cleanBotText(text));
}

async function sendGifIfAvailable(
  ctx: Context,
  sourceText: string,
  gifResolver: GifResolver,
  fallbackGifUrl: string | undefined,
  logger: Logger,
): Promise<void> {
  const resolvedGifUrl = await gifResolver.resolveGifUrlFromText(sourceText, fallbackGifUrl);
  if (!resolvedGifUrl) {
    return;
  }

  try {
    await ctx.replyWithAnimation(resolvedGifUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GIF send error";
    logger.debug({ error: message }, "Failed to send GIF animation");
  }
}

async function runScan(
  ctx: Context,
  contractAddress: string,
  scanEngine: ScanEngine,
  gifResolver: GifResolver,
  logger: Logger,
): Promise<void> {
  if (!isValidSolanaAddress(contractAddress)) {
    await sendCleanText(
      ctx,
      "Invalid Solana contract address. Please send a valid CA (base58, 32-byte public key).",
    );
    return;
  }

  const scanVisual = getMessageVisualPack("scan token report");
  await ctx.replyWithChatAction("typing");
  await sendCleanText(ctx, `${scanVisual.emoji} Scanning token with 3 Ruggy agents. This can take a few seconds...`);

  try {
    const report = await scanEngine.scanToken({
      contractAddress,
      requestUserId: ctx.from?.id ?? 0,
    });

    await sendCleanText(ctx, formatScanReport(report));
    await sendGifIfAvailable(
      ctx,
      `${report.tokenSymbol ?? "token"} ${report.verdict} ${report.overallScore}`,
      gifResolver,
      getScoreVisualPack(report.overallScore).gifUrl,
      logger,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error";
    await sendCleanText(ctx, `Scan failed: ${message}`);
  }
}

export function createTelegramBot(dependencies: BotDependencies): Telegraf<Context> {
  const { telegramBotToken, scanEngine, chatService, gifResolver, logger } = dependencies;
  const bot = new Telegraf<Context>(telegramBotToken);

  bot.start(async (ctx) => {
    const visual = getMessageVisualPack("hello gm");
    await sendCleanText(
      ctx,
      [
        `${visual.emoji} Ruggy is online.`,
        "Send /scan <SOLANA_CA> or just paste a Solana contract address.",
        "Ruggy returns a 0-100 safety score (100 = safer, 0 = highest risk).",
        "You can also chat with Ruggy for guidance and meme coin vibes.",
      ].join("\n"),
    );
    await sendGifIfAvailable(ctx, "hello gm crypto", gifResolver, visual.gifUrl, logger);
  });

  bot.help(async (ctx) => {
    const visual = getMessageVisualPack("help");
    await sendCleanText(
      ctx,
      [
        `${visual.emoji} Commands:`,
        "/start - Intro",
        "/help - Usage",
        "/scan <CA> - Analyze a Solana token contract address",
        "",
        "Tip: You can paste the CA directly and Ruggy will auto-scan.",
      ].join("\n"),
    );
    await sendGifIfAvailable(ctx, "crypto bot help command", gifResolver, visual.gifUrl, logger);
  });

  bot.command("scan", async (ctx) => {
    const text = getTextMessage(ctx);
    const parts = text?.trim().split(/\s+/) ?? [];
    const contractAddress = parts[1];

    if (!contractAddress) {
      await sendCleanText(ctx, "Usage: /scan <SOLANA_CONTRACT_ADDRESS>");
      return;
    }

    await runScan(ctx, contractAddress, scanEngine, gifResolver, logger);
  });

  bot.on("text", async (ctx) => {
    const text = getTextMessage(ctx)?.trim();
    if (!text || text.startsWith("/")) {
      return;
    }

    const contractAddress = extractFirstSolanaAddress(text);
    if (contractAddress) {
      await runScan(ctx, contractAddress, scanEngine, gifResolver, logger);
      return;
    }

    const reply = await chatService.getReply(ctx.from?.id ?? 0, text);
    await sendCleanText(ctx, reply.text);
    await sendGifIfAvailable(ctx, text, gifResolver, reply.media?.gifUrl, logger);
  });

  bot.catch((error, ctx) => {
    const message = error instanceof Error ? error.message : "Unknown Telegram error";
    logger.error({ error: message, updateId: ctx.update.update_id }, "Telegram bot error");
  });

  return bot;
}
