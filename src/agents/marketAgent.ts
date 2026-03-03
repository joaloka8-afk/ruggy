import type { AgentResult, DexPair } from "../types";
import { clampNumber } from "../utils/math";

function getPairAgeHours(pair: DexPair): number | null {
  if (!pair.pairCreatedAt) {
    return null;
  }
  return (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60);
}

export function runMarketAgent(pair: DexPair | null): AgentResult {
  if (!pair) {
    return {
      agent: "market",
      score: 30,
      reasons: ["No active Solana pair found on DexScreener for this contract."],
      rawSignals: {},
    };
  }

  let score = 60;
  const reasons: string[] = [];

  if (pair.liquidityUsd < 10_000) {
    score -= 25;
    reasons.push("Liquidity is extremely low.");
  } else if (pair.liquidityUsd < 50_000) {
    score -= 15;
    reasons.push("Liquidity is low.");
  } else if (pair.liquidityUsd < 200_000) {
    score -= 8;
    reasons.push("Liquidity is moderate.");
  } else if (pair.liquidityUsd > 2_000_000) {
    score += 12;
    reasons.push("Liquidity depth is strong.");
  } else if (pair.liquidityUsd > 500_000) {
    score += 8;
    reasons.push("Liquidity depth is healthy.");
  }

  const volumeLiquidityRatio = pair.liquidityUsd > 0 ? pair.volume24h / pair.liquidityUsd : 0;
  if (volumeLiquidityRatio < 0.1) {
    score -= 10;
    reasons.push("24h volume is very low relative to liquidity.");
  } else if (volumeLiquidityRatio < 0.3) {
    score -= 4;
    reasons.push("24h volume is low relative to liquidity.");
  } else if (volumeLiquidityRatio > 15) {
    score -= 8;
    reasons.push("24h volume appears abnormally high versus liquidity.");
  } else if (volumeLiquidityRatio > 4) {
    score += 4;
    reasons.push("24h volume and liquidity look reasonably active.");
  }

  const absChange24h = Math.abs(pair.priceChange24h ?? 0);
  if (absChange24h > 80) {
    score -= 18;
    reasons.push("Very high 24h volatility.");
  } else if (absChange24h > 40) {
    score -= 10;
    reasons.push("High 24h volatility.");
  } else if (absChange24h > 20) {
    score -= 4;
    reasons.push("Elevated 24h volatility.");
  }

  const absChange1h = Math.abs(pair.priceChange1h ?? 0);
  if (absChange1h > 25) {
    score -= 8;
    reasons.push("Large 1h price swing.");
  }

  const totalTrades = pair.buys24h + pair.sells24h;
  if (totalTrades > 30) {
    const imbalance = Math.abs(pair.buys24h - pair.sells24h) / totalTrades;
    if (imbalance > 0.75) {
      score -= 10;
      reasons.push("Trade flow is extremely one-sided.");
    } else if (imbalance > 0.55) {
      score -= 6;
      reasons.push("Trade flow is heavily imbalanced.");
    }
  }

  const ageHours = getPairAgeHours(pair);
  if (ageHours !== null) {
    if (ageHours < 2) {
      score -= 16;
      reasons.push("Trading pair is very new.");
    } else if (ageHours < 12) {
      score -= 8;
      reasons.push("Trading pair is newly launched.");
    } else if (ageHours < 48) {
      score -= 4;
      reasons.push("Trading pair is still early.");
    }
  }

  if (pair.fdv && pair.liquidityUsd > 0) {
    const fdvLiquidityRatio = pair.fdv / pair.liquidityUsd;
    if (fdvLiquidityRatio > 300) {
      score -= 10;
      reasons.push("FDV appears very high versus liquidity.");
    } else if (fdvLiquidityRatio > 120) {
      score -= 6;
      reasons.push("FDV appears high versus liquidity.");
    }
  }

  if (pair.marketCap && pair.liquidityUsd > 0) {
    const marketCapLiquidityRatio = pair.marketCap / pair.liquidityUsd;
    if (marketCapLiquidityRatio > 100) {
      score -= 6;
      reasons.push("Market cap appears stretched relative to liquidity.");
    }
  }

  const finalScore = Math.round(clampNumber(score));
  if (reasons.length === 0) {
    reasons.push("No major market-structure red flags were detected.");
  }

  return {
    agent: "market",
    score: finalScore,
    reasons,
    rawSignals: {
      liquidityUsd: pair.liquidityUsd,
      volume24h: pair.volume24h,
      volumeLiquidityRatio,
      priceChange24h: pair.priceChange24h,
      priceChange1h: pair.priceChange1h,
      buys24h: pair.buys24h,
      sells24h: pair.sells24h,
      pairCreatedAt: pair.pairCreatedAt,
      fdv: pair.fdv,
      marketCap: pair.marketCap,
    },
  };
}

