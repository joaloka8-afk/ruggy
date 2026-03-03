import axios from "axios";
import type { Logger } from "pino";

import { createHttpClient, type HttpClient } from "./httpClient";
import type { DexPair, DexSocial, DexTokenInfo } from "../types";
import { toFiniteNumber } from "../utils/math";

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/latest/dex";

type RawObject = Record<string, unknown>;

function asObject(value: unknown): RawObject | undefined {
  return value !== null && typeof value === "object" ? (value as RawObject) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseToken(raw: unknown): DexTokenInfo {
  const token = asObject(raw) ?? {};

  return {
    address: asString(token.address) ?? "",
    name: asString(token.name),
    symbol: asString(token.symbol),
  };
}

function parseSocials(info: RawObject): DexSocial[] {
  if (!Array.isArray(info.socials)) {
    return [];
  }

  return info.socials
    .map((rawSocial) => {
      const social = asObject(rawSocial);
      if (!social) {
        return undefined;
      }

      const url = asString(social.url);
      if (!url) {
        return undefined;
      }

      return {
        type: asString(social.type) ?? "unknown",
        url,
      };
    })
    .filter((social): social is DexSocial => Boolean(social));
}

function parseWebsiteCount(info: RawObject): number {
  if (!Array.isArray(info.websites)) {
    return 0;
  }

  return info.websites.length;
}

function normalizePair(rawPair: unknown): DexPair | undefined {
  const pair = asObject(rawPair);
  if (!pair) {
    return undefined;
  }

  const chainId = asString(pair.chainId);
  const dexId = asString(pair.dexId);
  const url = asString(pair.url);
  const pairAddress = asString(pair.pairAddress);

  if (!chainId || !dexId || !url || !pairAddress) {
    return undefined;
  }

  const txns = asObject(pair.txns);
  const h24Tx = txns ? asObject(txns.h24) : undefined;

  const priceChange = asObject(pair.priceChange);
  const volume = asObject(pair.volume);
  const liquidity = asObject(pair.liquidity);
  const info = asObject(pair.info) ?? {};

  return {
    chainId,
    dexId,
    url,
    pairAddress,
    baseToken: parseToken(pair.baseToken),
    quoteToken: parseToken(pair.quoteToken),
    priceUsd: toFiniteNumber(pair.priceUsd) ?? null,
    liquidityUsd: toFiniteNumber(liquidity?.usd) ?? 0,
    volume24h: toFiniteNumber(volume?.h24) ?? 0,
    priceChange24h: toFiniteNumber(priceChange?.h24) ?? null,
    priceChange1h: toFiniteNumber(priceChange?.h1) ?? null,
    buys24h: toFiniteNumber(h24Tx?.buys) ?? 0,
    sells24h: toFiniteNumber(h24Tx?.sells) ?? 0,
    pairCreatedAt: toFiniteNumber(pair.pairCreatedAt) ?? null,
    fdv: toFiniteNumber(pair.fdv) ?? null,
    marketCap: toFiniteNumber(pair.marketCap) ?? null,
    websiteCount: parseWebsiteCount(info),
    socials: parseSocials(info),
  };
}

function sortPairsByQuality(a: DexPair, b: DexPair): number {
  const byLiquidity = b.liquidityUsd - a.liquidityUsd;
  if (byLiquidity !== 0) {
    return byLiquidity;
  }

  return b.volume24h - a.volume24h;
}

export class DexscreenerService {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient = createHttpClient(DEXSCREENER_BASE_URL), private readonly logger?: Logger) {
    this.httpClient = httpClient;
  }

  async getBestSolanaPair(contractAddress: string): Promise<DexPair | null> {
    try {
      const { data } = await this.httpClient.get<RawObject>(`/tokens/${contractAddress}`);
      const rawPairs = Array.isArray(data.pairs) ? data.pairs : [];

      const normalizedPairs = rawPairs
        .map(normalizePair)
        .filter((pair): pair is DexPair => Boolean(pair))
        .filter((pair) => pair.chainId.toLowerCase() === "solana")
        .sort(sortPairsByQuality);

      return normalizedPairs[0] ?? null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          return null;
        }
        throw new Error(`DexScreener request failed with status ${status ?? "unknown"}.`);
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger?.error({ error: errorMessage }, "DexScreener fetch failed");
      throw new Error("Failed to fetch DexScreener data.");
    }
  }
}

