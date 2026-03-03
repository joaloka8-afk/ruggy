import fs from "fs";
import path from "path";
import type { Logger } from "pino";

import type { ChatMemoryMessage } from "../types";

interface ChatMemoryStorePayload {
  version: 1;
  users: Record<string, ChatMemoryMessage[]>;
}

export class ChatMemoryStore {
  private readonly memory = new Map<number, ChatMemoryMessage[]>();
  private readonly maxEntriesPerUser: number;
  private readonly filePath: string;
  private readonly logger?: Logger;

  constructor(filePath: string, maxEntriesPerUser: number, logger?: Logger) {
    this.filePath = path.resolve(filePath);
    this.maxEntriesPerUser = maxEntriesPerUser;
    this.logger = logger;
    this.loadFromDisk();
  }

  getHistory(userId: number): ChatMemoryMessage[] {
    const messages = this.memory.get(userId) ?? [];
    return [...messages];
  }

  append(userId: number, entry: ChatMemoryMessage): void {
    const existing = this.memory.get(userId) ?? [];
    const next = [...existing, entry].slice(-this.maxEntriesPerUser);
    this.memory.set(userId, next);
    this.saveToDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }

      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<ChatMemoryStorePayload>;
      const users = parsed.users ?? {};

      for (const [rawUserId, rawMessages] of Object.entries(users)) {
        const userId = Number(rawUserId);
        if (!Number.isInteger(userId) || !Array.isArray(rawMessages)) {
          continue;
        }

        const messages = rawMessages
          .filter(
            (item): item is ChatMemoryMessage =>
              Boolean(item) &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string" &&
              item.content.trim().length > 0,
          )
          .slice(-this.maxEntriesPerUser);

        this.memory.set(userId, messages);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown chat-memory load error";
      this.logger?.warn({ error: message, filePath: this.filePath }, "Failed to load chat memory file");
    }
  }

  private saveToDisk(): void {
    try {
      const users: Record<string, ChatMemoryMessage[]> = {};
      for (const [userId, messages] of this.memory.entries()) {
        users[String(userId)] = messages;
      }

      const payload: ChatMemoryStorePayload = {
        version: 1,
        users,
      };

      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(payload), "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown chat-memory save error";
      this.logger?.warn({ error: message, filePath: this.filePath }, "Failed to persist chat memory file");
    }
  }
}

