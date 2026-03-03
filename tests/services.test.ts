import { describe, expect, it, vi } from "vitest";

import { DexscreenerService } from "../src/services/dexscreener";
import type { HttpClient } from "../src/services/httpClient";
import { RugcheckService } from "../src/services/rugcheck";

function mockHttpClient(payload: unknown): HttpClient {
  return {
    get: vi.fn(async () => ({ data: payload })) as HttpClient["get"],
  };
}

describe("service adapters", () => {
  it("normalizes Rugcheck fields", async () => {
    const service = new RugcheckService(
      mockHttpClient({
        mint: "MintAddress",
        rugged: false,
        score_normalised: 22,
        mintAuthority: null,
        freezeAuthority: "FreezeAuth",
        totalHolders: 321,
        topHolders: [{ pct: 25 }],
        risks: [{ name: "Mutable metadata", level: "warn", description: "Mutable" }],
        graphInsidersDetected: true,
        insiderNetworks: [{ id: 1 }, { id: 2 }],
      }),
    );

    const report = await service.getTokenReport("MintAddress");
    expect(report.scoreNormalised).toBe(22);
    expect(report.freezeAuthority).toBe("FreezeAuth");
    expect(report.topHolders[0]?.percentage).toBe(0.25);
    expect(report.insiderNetworksCount).toBe(2);
  });

  it("picks highest-liquidity Solana pair from DexScreener", async () => {
    const service = new DexscreenerService(
      mockHttpClient({
        pairs: [
          {
            chainId: "solana",
            dexId: "dex_a",
            url: "https://a",
            pairAddress: "A",
            baseToken: { address: "token", symbol: "AAA", name: "AAA" },
            quoteToken: { address: "sol", symbol: "SOL", name: "SOL" },
            liquidity: { usd: 1000 },
            volume: { h24: 10000 },
            txns: { h24: { buys: 10, sells: 15 } },
          },
          {
            chainId: "solana",
            dexId: "dex_b",
            url: "https://b",
            pairAddress: "B",
            baseToken: { address: "token", symbol: "AAA", name: "AAA" },
            quoteToken: { address: "sol", symbol: "SOL", name: "SOL" },
            liquidity: { usd: 9000 },
            volume: { h24: 8000 },
            txns: { h24: { buys: 25, sells: 25 } },
          },
          {
            chainId: "ethereum",
            dexId: "dex_eth",
            url: "https://eth",
            pairAddress: "ETH",
            baseToken: { address: "token", symbol: "AAA", name: "AAA" },
            quoteToken: { address: "eth", symbol: "ETH", name: "ETH" },
            liquidity: { usd: 999999 },
            volume: { h24: 999999 },
            txns: { h24: { buys: 1, sells: 1 } },
          },
        ],
      }),
    );

    const pair = await service.getBestSolanaPair("token");
    expect(pair?.pairAddress).toBe("B");
    expect(pair?.chainId).toBe("solana");
  });
});

