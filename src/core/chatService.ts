import type { Logger } from "pino";
import OpenAI from "openai";

import type { ChatMemoryMessage, ChatReply } from "../types";
import { ChatMemoryStore } from "./chatMemoryStore";
import { getMessageVisualPack } from "../content/memeMedia";
import { cleanBotText } from "../utils/text";

interface ChatServiceOptions {
  apiKey?: string;
  model: string;
  maxTurns: number;
  memoryFilePath: string;
  logger?: Logger;
}

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
  private readonly model: string;
  private readonly memoryStore: ChatMemoryStore;
  private readonly logger?: Logger;

  constructor(options: ChatServiceOptions) {
    this.model = options.model;
    this.logger = options.logger;
    this.memoryStore = new ChatMemoryStore(options.memoryFilePath, options.maxTurns * 2, options.logger);

    if (options.apiKey) {
      this.client = new OpenAI({ apiKey: options.apiKey });
    }
  }

  async getReply(userId: number, userMessage: string): Promise<ChatReply> {
    const visual = getMessageVisualPack(userMessage);
    const history = this.memoryStore.getHistory(userId);

    if (!this.client) {
      const fallbackText = this.buildFallbackReply(userMessage, history);
      this.pushMemory(userId, { role: "user", content: userMessage });
      this.pushMemory(userId, { role: "assistant", content: fallbackText });

      return {
        text: this.decorateReply(fallbackText, visual.emoji, visual.slangLine),
        mode: "fallback",
        media: {
          gifUrl: visual.gifUrl,
          svgPath: visual.svgPath,
          emoji: visual.emoji,
        },
      };
    }

    try {
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
        const fallbackText = this.buildFallbackReply(userMessage, history);
        this.pushMemory(userId, { role: "user", content: userMessage });
        this.pushMemory(userId, { role: "assistant", content: fallbackText });

        return {
          text: this.decorateReply(fallbackText, visual.emoji, visual.slangLine),
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
      const fallbackText = this.buildFallbackReply(userMessage, history);
      this.pushMemory(userId, { role: "user", content: userMessage });
      this.pushMemory(userId, { role: "assistant", content: fallbackText });

      return {
        text: this.decorateReply(fallbackText, visual.emoji, visual.slangLine),
        mode: "fallback",
        media: {
          gifUrl: visual.gifUrl,
          svgPath: visual.svgPath,
          emoji: visual.emoji,
        },
      };
    }
  }

  private pushMemory(userId: number, entry: ChatMemoryMessage): void {
    this.memoryStore.append(userId, entry);
  }

  private buildFallbackReply(userMessage: string, history: ChatMemoryMessage[]): string {
    const normalized = userMessage.toLowerCase();
    const lastUserQuestion = [...history]
      .reverse()
      .find((entry) => entry.role === "user" && entry.content.trim().length > 0)?.content;

    if (
      normalized.includes("remember") ||
      normalized.includes("before") ||
      normalized.includes("earlier") ||
      normalized.includes("previous")
    ) {
      if (lastUserQuestion) {
        return `Yep. Last thing you asked was: "${lastUserQuestion}". Want me to continue from there or run /scan on a CA?`;
      }
      return "I do not have earlier history for you yet. Send a CA and I will start building context.";
    }

    if (normalized.includes("hello") || normalized.includes("hi")) {
      return "Hi, I am Ruggy. Drop a Solana CA or use /scan <CA> and I will run the risk report.";
    }

    if (normalized.includes("help")) {
      return "Use /scan <contract_address> to analyze a token. You can also paste a CA directly in chat.";
    }

    if (normalized.includes("score")) {
      return "Ruggy gives a 0-100 safety score. 100 is safer and 0 is highest risk. Use /scan <CA> for the full breakdown.";
    }

    if (lastUserQuestion) {
      return `Last time we talked about: "${lastUserQuestion}". If you want, paste a token CA now and I will analyze it.`;
    }

    return "I can chat and help with meme coin risk checks. Paste a Solana contract address to get a full Ruggy report. Not financial advice.";
  }

  private decorateReply(message: string, emoji: string, slangLine: string): string {
    const decorated = `${emoji} ${message}\n\n${slangLine}`;
    return cleanBotText(decorated);
  }
}
