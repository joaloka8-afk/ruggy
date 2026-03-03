import { describe, expect, it } from "vitest";

import { runMarketAgent } from "../src/agents/marketAgent";
import { runOnchainAgent } from "../src/agents/onchainAgent";
import { runTrustAgent } from "../src/agents/trustAgent";
import type { DexPair, RugcheckReport } from "../src/types";

const safeReport: RugcheckReport = {
  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  rugged: false,
  scoreNormalised: 12,
  mintAuthority: null,
  freezeAuthority: null,
  risks: [],
  totalHolders: 12000,
  topHolders: [{ percentage: 0.08 }, { percentage: 0.06 }, { percentage: 0.05 }],
  totalMarketLiquidity: 800000,
  totalStableLiquidity: 300000,
  graphInsidersDetected: false,
  insiderNetworksCount: 0,
  creator: "CreatorAddress123",
  tokenMeta: { name: "Jupiter", symbol: "JUP", mutable: false },
  verification: { verified: true },
};

const riskyReport: RugcheckReport = {
  ...safeReport,
  rugged: true,
  scoreNormalised: 80,
  mintAuthority: "MintAuth",
  freezeAuthority: "FreezeAuth",
  risks: [{ name: "Mint can be changed", level: "danger", description: "critical" }],
  totalHolders: 42,
  topHolders: [{ percentage: 0.55 }, { percentage: 0.2 }, { percentage: 0.1 }],
  graphInsidersDetected: true,
  insiderNetworksCount: 3,
  creator: null,
  verification: null,
};

const healthyPair: DexPair = {
  chainId: "solana",
  dexId: "raydium",
  url: "https://dexscreener.com/solana/example",
  pairAddress: "PairAddress",
  baseToken: { address: safeReport.mint, name: "Jupiter", symbol: "JUP" },
  quoteToken: { address: "So11111111111111111111111111111111111111112", name: "SOL", symbol: "SOL" },
  priceUsd: 0.25,
  liquidityUsd: 500000,
  volume24h: 900000,
  priceChange24h: 4.5,
  priceChange1h: 0.8,
  buys24h: 500,
  sells24h: 530,
  pairCreatedAt: Date.now() - 1000 * 60 * 60 * 48,
  fdv: 35000000,
  marketCap: 24000000,
  websiteCount: 1,
  socials: [
    { type: "twitter", url: "https://x.com/example" },
    { type: "telegram", url: "https://t.me/example" },
  ],
};

describe("agents", () => {
  it("reduces on-chain score for risky contracts", () => {
    const safeResult = runOnchainAgent(safeReport);
    const riskyResult = runOnchainAgent(riskyReport);
    expect(riskyResult.score).toBeLessThan(safeResult.score);
  });

  it("returns low market score when pair is missing", () => {
    const marketResult = runMarketAgent(null);
    expect(marketResult.score).toBeLessThanOrEqual(30);
  });

  it("increases trust score when social footprint exists", () => {
    const trusted = runTrustAgent(safeReport, healthyPair);
    const untrusted = runTrustAgent(
      { ...safeReport, creator: null, tokenMeta: null, totalStableLiquidity: 0 },
      { ...healthyPair, websiteCount: 0, socials: [] },
    );

    expect(trusted.score).toBeGreaterThan(untrusted.score);
  });
});

