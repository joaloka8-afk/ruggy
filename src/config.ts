import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_PATH: z.string().default("/telegram/webhook"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CHAT_MEMORY_TURNS: z.coerce.number().int().min(1).max(20).default(8),
});

export interface AppConfig {
  telegramBotToken: string;
  openAi: {
    apiKey?: string;
    model: string;
    chatMemoryTurns: number;
  };
  runtime: {
    port: number;
    logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  };
  webhook: {
    enabled: boolean;
    path: string;
    baseUrl?: string;
    fullUrl?: string;
  };
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildWebhookUrl(baseUrl: string, path: string): string {
  const safeBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, safeBase).toString();
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment config: ${issues}`);
  }

  const env = parsed.data;
  const webhookPath = normalizePath(env.WEBHOOK_PATH);
  const webhookEnabled = Boolean(env.TELEGRAM_WEBHOOK_URL);

  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    openAi: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      chatMemoryTurns: env.CHAT_MEMORY_TURNS,
    },
    runtime: {
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
    },
    webhook: {
      enabled: webhookEnabled,
      path: webhookPath,
      baseUrl: env.TELEGRAM_WEBHOOK_URL,
      fullUrl:
        webhookEnabled && env.TELEGRAM_WEBHOOK_URL
          ? buildWebhookUrl(env.TELEGRAM_WEBHOOK_URL, webhookPath)
          : undefined,
    },
  };
}

