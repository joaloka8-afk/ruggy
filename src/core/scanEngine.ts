import { runMarketAgent } from "../agents/marketAgent";
import { runOnchainAgent } from "../agents/onchainAgent";
import { runTrustAgent } from "../agents/trustAgent";
import { calculateOverallScore } from "./scoring";
import type { ScanReport, ScanRequest } from "../types";
import { DexscreenerService } from "../services/dexscreener";
import { RugcheckService } from "../services/rugcheck";

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter((item) => item.length > 0)));
}

function buildHighlights(reasons: string[]): string[] {
  return uniqueStrings(reasons).slice(0, 5);
}

export class ScanEngine {
  constructor(
    private readonly rugcheckService: RugcheckService,
    private readonly dexscreenerService: DexscreenerService,
  ) {}

  async scanToken(request: ScanRequest): Promise<ScanReport> {
    const [rugcheck, pair] = await Promise.all([
      this.rugcheckService.getTokenReport(request.contractAddress),
      this.dexscreenerService.getBestSolanaPair(request.contractAddress),
    ]);

    const onchain = runOnchainAgent(rugcheck);
    const market = runMarketAgent(pair);
    const trust = runTrustAgent(rugcheck, pair);
    const agents = [onchain, market, trust];

    const scoring = calculateOverallScore(agents, { rugged: rugcheck.rugged });

    const highlights = buildHighlights([
      ...onchain.reasons.slice(0, 2),
      ...market.reasons.slice(0, 2),
      ...trust.reasons.slice(0, 2),
      ...rugcheck.risks.slice(0, 3).map((risk) => risk.description ?? risk.name),
    ]);

    return {
      contractAddress: rugcheck.mint,
      tokenName: pair?.baseToken.name ?? rugcheck.tokenMeta?.name,
      tokenSymbol: pair?.baseToken.symbol ?? rugcheck.tokenMeta?.symbol,
      overallScore: scoring.overallScore,
      verdict: scoring.verdict,
      agents,
      highlights,
      generatedAt: new Date().toISOString(),
      pair: pair
        ? {
            dexId: pair.dexId,
            pairAddress: pair.pairAddress,
            url: pair.url,
          }
        : undefined,
    };
  }
}

