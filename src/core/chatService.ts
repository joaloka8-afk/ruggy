import type { Logger } from "pino";
import OpenAI from "openai";

import type { ChatReply } from "../types";

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
    if (!this.client) {
      return { text: this.buildFallbackReply(userMessage), mode: "fallback" };
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
        return { text: this.buildFallbackReply(userMessage), mode: "fallback" };
      }

      this.pushMemory(userId, { role: "user", content: userMessage });
      this.pushMemory(userId, { role: "assistant", content });

      return { text: content, mode: "llm" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      this.logger?.warn({ error: message }, "LLM chat failed; switching to fallback response");
      return { text: this.buildFallbackReply(userMessage), mode: "fallback" };
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
      return "Hi, I am Ruggy. Send a Solana contract address or use /scan <CA> and I will generate a risk report.";
    }

    if (normalized.includes("help")) {
      return "Use /scan <contract_address> to analyze a token. You can also paste the CA directly in chat.";
    }

    if (normalized.includes("score")) {
      return "Ruggy gives a 0-100 safety score. 100 is safer and 0 is highest risk. Use /scan <CA> for details.";
    }

    return "I can chat and help with meme coin risk checks. Paste a Solana contract address to get a full Ruggy report. Not financial advice.";
  }
}
