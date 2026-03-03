import axios from "axios";
import type { Logger } from "pino";

import { createHttpClient, type HttpClient } from "./httpClient";
import type { RugcheckReport, RugcheckRisk, RugcheckTopHolder } from "../types";
import { clampNumber, toFiniteNumber } from "../utils/math";

const RUGCHECK_BASE_URL = "https://api.rugcheck.xyz/v1/tokens";

type RawObject = Record<string, unknown>;

function asObject(value: unknown): RawObject | undefined {
  return value !== null && typeof value === "object" ? (value as RawObject) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return asString(value) ?? null;
}

function parseRisk(input: unknown): RugcheckRisk | undefined {
  const risk = asObject(input);
  if (!risk) {
    return undefined;
  }

  const name = asString(risk.name);
  if (!name) {
    return undefined;
  }

  return {
    name,
    value: asString(risk.value),
    description: asString(risk.description),
    level: asString(risk.level),
    score: toFiniteNumber(risk.score),
  };
}

function normalizePercentage(value: unknown): number | undefined {
  const raw = toFiniteNumber(value);
  if (raw === undefined) {
    return undefined;
  }

  return raw > 1 ? raw / 100 : raw;
}

function parseTopHolder(input: unknown): RugcheckTopHolder | undefined {
  const holder = asObject(input);
  if (!holder) {
    return undefined;
  }

  return {
    owner: asString(holder.owner) ?? asString(holder.address),
    amount: toFiniteNumber(holder.amount) ?? toFiniteNumber(holder.balance),
    percentage:
      normalizePercentage(holder.percentage) ??
      normalizePercentage(holder.pct) ??
      normalizePercentage(holder.percent) ??
      normalizePercentage(holder.share),
  };
}

export class RugcheckService {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient = createHttpClient(RUGCHECK_BASE_URL), private readonly logger?: Logger) {
    this.httpClient = httpClient;
  }

  async getTokenReport(contractAddress: string): Promise<RugcheckReport> {
    try {
      const { data } = await this.httpClient.get<RawObject>(`/${contractAddress}/report`);
      return this.normalizeReport(data, contractAddress);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = status === 400 ? "No Rugcheck report found for this contract address." : `Rugcheck request failed with status ${status ?? "unknown"}.`;
        throw new Error(message);
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger?.error({ error: errorMessage }, "Rugcheck fetch failed");
      throw new Error("Failed to fetch Rugcheck data.");
    }
  }

  private normalizeReport(raw: RawObject, fallbackMint: string): RugcheckReport {
    const risks = Array.isArray(raw.risks) ? raw.risks.map(parseRisk).filter((risk): risk is RugcheckRisk => Boolean(risk)) : [];

    const topHolders = Array.isArray(raw.topHolders)
      ? raw.topHolders.map(parseTopHolder).filter((holder): holder is RugcheckTopHolder => Boolean(holder))
      : [];

    const verificationObj = asObject(raw.verification);
    const tokenMetaObj = asObject(raw.tokenMeta);

    const insiderNetworksCount = Array.isArray(raw.insiderNetworks)
      ? raw.insiderNetworks.length
      : toFiniteNumber(raw.insiderNetworksCount) ?? 0;

    const scoreNormalised = clampNumber(
      toFiniteNumber(raw.score_normalised) ?? toFiniteNumber(raw.scoreNormalized) ?? toFiniteNumber(raw.score) ?? 100,
      0,
      100,
    );

    return {
      mint: asString(raw.mint) ?? fallbackMint,
      rugged: Boolean(raw.rugged),
      scoreNormalised,
      mintAuthority: asNullableString(raw.mintAuthority),
      freezeAuthority: asNullableString(raw.freezeAuthority),
      risks,
      totalHolders: toFiniteNumber(raw.totalHolders) ?? null,
      topHolders,
      totalMarketLiquidity: toFiniteNumber(raw.totalMarketLiquidity) ?? null,
      totalStableLiquidity: toFiniteNumber(raw.totalStableLiquidity) ?? null,
      graphInsidersDetected: Boolean(raw.graphInsidersDetected),
      insiderNetworksCount,
      creator: asNullableString(raw.creator),
      tokenMeta: tokenMetaObj
        ? {
            name: asString(tokenMetaObj.name),
            symbol: asString(tokenMetaObj.symbol),
            mutable: typeof tokenMetaObj.mutable === "boolean" ? tokenMetaObj.mutable : undefined,
          }
        : null,
      verification: verificationObj
        ? {
            verified: typeof verificationObj.verified === "boolean" ? verificationObj.verified : undefined,
            jupiterVerified:
              typeof verificationObj.jupiterVerified === "boolean" ? verificationObj.jupiterVerified : undefined,
            ...verificationObj,
          }
        : null,
    };
  }
}

