import axios, { type AxiosInstance } from "axios";
import type { Logger } from "pino";

interface GifResolverOptions {
  giphyApiKey?: string;
  logger?: Logger;
  httpClient?: AxiosInstance;
}

interface GiphyTranslateResponse {
  data?: {
    images?: {
      original?: {
        url?: string;
      };
      downsized_medium?: {
        url?: string;
      };
      fixed_height?: {
        url?: string;
      };
    };
  };
}

const ADDRESS_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const COMMAND_PATTERN = /\/[a-z]+/gi;

const QUERY_RULES: Array<{ pattern: RegExp; query: string }> = [
  { pattern: /(rug|scam|honeypot|warning|danger|risk)/i, query: "crypto scam warning" },
  { pattern: /(hello|hi|hey|gm|good morning|yo)/i, query: "crypto gm meme" },
  { pattern: /(moon|pump|bull|green candle|send it|ape)/i, query: "crypto to the moon meme" },
  { pattern: /(dump|rekt|red|loss|bag holder)/i, query: "crypto rekt meme" },
  { pattern: /(bitcoin|btc)/i, query: "bitcoin meme" },
  { pattern: /(solana|sol)/i, query: "solana meme" },
  { pattern: /(doge|shib|pepe|bonk|meme coin)/i, query: "meme coin reaction" },
  { pattern: /(scan|analy|report|score|contract|ca|token)/i, query: "detective analysis meme" },
];

export function buildGifQueryFromText(text: string): string {
  for (const rule of QUERY_RULES) {
    if (rule.pattern.test(text)) {
      return rule.query;
    }
  }

  const normalized = text
    .replace(ADDRESS_PATTERN, " token ")
    .replace(COMMAND_PATTERN, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized.length === 0) {
    return "crypto meme reaction";
  }

  return normalized.split(" ").slice(0, 5).join(" ");
}

export class GifResolver {
  private readonly giphyApiKey?: string;
  private readonly logger?: Logger;
  private readonly httpClient: AxiosInstance;
  private readonly cache = new Map<string, string>();

  constructor(options: GifResolverOptions) {
    this.giphyApiKey = options.giphyApiKey;
    this.logger = options.logger;
    this.httpClient =
      options.httpClient ??
      axios.create({
        baseURL: "https://api.giphy.com/v1/gifs",
        timeout: 7_000,
      });
  }

  async resolveGifUrlFromText(userText: string, fallbackUrl?: string): Promise<string | undefined> {
    const query = buildGifQueryFromText(userText);
    if (!this.giphyApiKey) {
      return fallbackUrl;
    }

    const cached = this.cache.get(query);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await this.httpClient.get<GiphyTranslateResponse>("/translate", {
        params: {
          api_key: this.giphyApiKey,
          s: query,
          rating: "pg-13",
        },
      });

      const gifUrl =
        data?.data?.images?.downsized_medium?.url ??
        data?.data?.images?.fixed_height?.url ??
        data?.data?.images?.original?.url;

      if (!gifUrl) {
        return fallbackUrl;
      }

      this.cache.set(query, gifUrl);
      return gifUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown GIF resolve error";
      this.logger?.warn({ error: message, query }, "Failed to resolve related GIF from Giphy");
      return fallbackUrl;
    }
  }
}

