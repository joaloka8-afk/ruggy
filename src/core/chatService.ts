import type { Logger } from "pino";
import OpenAI from "openai";

import type { ChatReply } from "../types";
import { getMessageVisualPack } from "../content/memeMedia";
import { cleanBotText } from "../utils/text";

interface ChatServiceOptions {
  apiKey?: string;
  model: string;
  maxTurns: number;
  logger?: Logger;
}

type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = [
  "You are Ruggy, a practical Solana meme coin risk assistant inside Telegram.",
  "Keep answers concise, factual, and easy to understand.",
  "Use clean plain text with short paragraphs.",
  "You may use tasteful crypto slang and emojis, but stay readable and professional.",
  "Never promise safety or guaranteed returns.",
  "If users ask about a token, suggest using /scan <contract_address> for a risk report.",
].join(" ");

export class ChatService {
  private readonly client?: OpenAI;
  private readonly memory = new Map<number, MemoryMessage[]>();
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly logger?: Logger;

  constructor(options: ChatServiceOptions) {
    this.model = options.model;
    this.maxTurns = options.maxTurns;
    this.logger = options.logger;

    if (options.apiKey) {
      this.client = new OpenAI({ apiKey: options.apiKey });
    }
  }

  async getReply(userId: number, userMessage: string): Promise<ChatReply> {
    const visual = getMessageVisualPack(userMessage);

    if (!this.client) {
      return {
        text: this.decorateReply(this.buildFallbackReply(userMessage), visual.emoji, visual.slangLine),
        mode: "fallback",
        media: {
          gifUrl: visual.gifUrl,
          svgPath: visual.svgPath,
          emoji: visual.emoji,
        },
      };
    }

    try {
      const history = this.memory.get(userId) ?? [];
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: userMessage },
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        max_tokens: 280,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return {
          text: this.decorateReply(this.buildFallbackReply(userMessage), visual.emoji, visual.slangLine),
          mode: "fallback",
          media: {
            gifUrl: visual.gifUrl,
            svgPath: visual.svgPath,
            emoji: visual.emoji,
          },
        };
      }

      this.pushMemory(userId, { role: "user", content: userMessage });
      this.pushMemory(userId, { role: "assistant", content });

      return {
        text: this.decorateReply(content, visual.emoji, visual.slangLine),
        mode: "llm",
        media: {
          gifUrl: visual.gifUrl,
          svgPath: visual.svgPath,
          emoji: visual.emoji,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      this.logger?.warn({ error: message }, "LLM chat failed; switching to fallback response");
      return {
        text: this.decorateReply(this.buildFallbackReply(userMessage), visual.emoji, visual.slangLine),
        mode: "fallback",
        media: {
          gifUrl: visual.gifUrl,
          svgPath: visual.svgPath,
          emoji: visual.emoji,
        },
      };
    }
  }

  private pushMemory(userId: number, entry: MemoryMessage): void {
    const existing = this.memory.get(userId) ?? [];
    const next = [...existing, entry];
    const maxEntries = this.maxTurns * 2;
    this.memory.set(userId, next.slice(-maxEntries));
  }

  private buildFallbackReply(userMessage: string): string {
    const normalized = userMessage.toLowerCase();
    if (normalized.includes("hello") || normalized.includes("hi")) {
      return "Hi, I am Ruggy. Drop a Solana CA or use /scan <CA> and I will run the risk report.";
    }

    if (normalized.includes("help")) {
      return "Use /scan <contract_address> to analyze a token. You can also paste a CA directly in chat.";
    }

    if (normalized.includes("score")) {
      return "Ruggy gives a 0-100 safety score. 100 is safer and 0 is highest risk. Use /scan <CA> for the full breakdown.";
    }

    return "I can chat and help with meme coin risk checks. Paste a Solana contract address to get a full Ruggy report. Not financial advice.";
  }

  private decorateReply(message: string, emoji: string, slangLine: string): string {
    const decorated = `${emoji} ${message}\n\n${slangLine}`;
    return cleanBotText(decorated);
  }
}
