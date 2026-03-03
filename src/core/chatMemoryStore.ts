import fs from "fs";
import path from "path";
import type { Logger } from "pino";
import { Pool } from "pg";

import type { ChatMemoryMessage } from "../types";

interface ChatMemoryStorePayload {
  version: 1;
  users: Record<string, ChatMemoryMessage[]>;
}

type ChatMemoryBackend = "postgres" | "file";

interface ChatMemoryStoreOptions {
  backend: ChatMemoryBackend;
  maxEntriesPerUser: number;
  filePath: string;
  databaseUrl?: string;
  logger?: Logger;
}

export class ChatMemoryStore {
  private readonly backend: ChatMemoryBackend;
  private readonly maxEntriesPerUser: number;
  private readonly filePath: string | null;
  private readonly memory = new Map<number, ChatMemoryMessage[]>();
  private readonly pool: Pool | null;
  private readonly logger?: Logger;
  private initializePromise?: Promise<void>;

  constructor(options: ChatMemoryStoreOptions) {
    this.backend = options.backend;
    this.maxEntriesPerUser = options.maxEntriesPerUser;
    this.filePath = this.backend === "file" ? path.resolve(options.filePath) : null;
    this.logger = options.logger;

    if (this.backend === "postgres") {
      if (!options.databaseUrl) {
        throw new Error("DATABASE_URL is required for postgres chat memory backend.");
      }

      this.pool = new Pool({
        connectionString: options.databaseUrl,
        ssl:
          process.env.NODE_ENV === "production"
            ? {
                rejectUnauthorized: false,
              }
            : undefined,
      });
    } else {
      this.pool = null;
    }
  }

  async getHistory(userId: number): Promise<ChatMemoryMessage[]> {
    await this.ensureInitialized();

    if (this.backend === "postgres") {
      return this.getHistoryFromPostgres(userId);
    }

    const messages = this.memory.get(userId) ?? [];
    return [...messages];
  }

  async append(userId: number, entry: ChatMemoryMessage): Promise<void> {
    await this.ensureInitialized();

    if (this.backend === "postgres") {
      await this.appendToPostgres(userId, entry);
      return;
    }

    const existing = this.memory.get(userId) ?? [];
    const next = [...existing, entry].slice(-this.maxEntriesPerUser);
    this.memory.set(userId, next);
    this.saveToDisk();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.initialize();
    }

    await this.initializePromise;
  }

  private async initialize(): Promise<void> {
    if (this.backend === "postgres") {
      await this.initializePostgresSchema();
      return;
    }

    this.loadFromDisk();
  }

  private async initializePostgresSchema(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ruggy_chat_memory (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ruggy_chat_memory_user_id_id
      ON ruggy_chat_memory (user_id, id DESC)
    `);
  }

  private async getHistoryFromPostgres(userId: number): Promise<ChatMemoryMessage[]> {
    if (!this.pool) {
      return [];
    }

    const result = await this.pool.query<{ role: "user" | "assistant"; content: string }>(
      `
        SELECT role, content
        FROM ruggy_chat_memory
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [userId, this.maxEntriesPerUser],
    );

    return result.rows
      .map((row: { role: "user" | "assistant"; content: string }) => ({
        role: row.role,
        content: row.content,
      }))
      .reverse();
  }

  private async appendToPostgres(userId: number, entry: ChatMemoryMessage): Promise<void> {
    if (!this.pool) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO ruggy_chat_memory (user_id, role, content)
          VALUES ($1, $2, $3)
        `,
        [userId, entry.role, entry.content],
      );

      await client.query(
        `
          DELETE FROM ruggy_chat_memory
          WHERE user_id = $1
            AND id NOT IN (
              SELECT id
              FROM ruggy_chat_memory
              WHERE user_id = $1
              ORDER BY id DESC
              LIMIT $2
            )
        `,
        [userId, this.maxEntriesPerUser],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private loadFromDisk(): void {
    if (!this.filePath) {
      return;
    }

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
    if (!this.filePath) {
      return;
    }

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
