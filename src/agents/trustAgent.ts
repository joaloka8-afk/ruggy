import type { AgentResult, DexPair, RugcheckReport } from "../types";
import { clampNumber } from "../utils/math";

export function runTrustAgent(report: RugcheckReport, pair: DexPair | null): AgentResult {
  let score = 50;
  const reasons: string[] = [];

  if (pair?.websiteCount && pair.websiteCount > 0) {
    score += 8;
    reasons.push("Project website is listed.");
  } else {
    score -= 8;
    reasons.push("No website listed on the main market pair.");
  }

  const socialTypes = new Set((pair?.socials ?? []).map((social) => social.type.toLowerCase()));

  if (socialTypes.has("twitter")) {
    score += 6;
    reasons.push("Twitter/X profile is listed.");
  }
  if (socialTypes.has("telegram")) {
    score += 6;
    reasons.push("Telegram community link is listed.");
  }
  if (socialTypes.has("discord")) {
    score += 4;
    reasons.push("Discord community link is listed.");
  }
  if (socialTypes.size === 0) {
    score -= 12;
    reasons.push("No social profiles are listed.");
  }

  if (report.totalStableLiquidity !== null && report.totalStableLiquidity > 100_000) {
    score += 6;
    reasons.push("Stable liquidity level looks meaningful.");
  }

  if (report.graphInsidersDetected) {
    score -= 15;
    reasons.push("Insider graph activity was detected.");
  }

  if (report.insiderNetworksCount > 0) {
    score -= Math.min(12, report.insiderNetworksCount * 4);
    reasons.push(`${report.insiderNetworksCount} insider network signal(s) detected.`);
  }

  if (report.creator) {
    score += 2;
    reasons.push("Creator identity is present in metadata.");
  } else {
    score -= 2;
    reasons.push("Creator identity is missing.");
  }

  if (report.tokenMeta?.name && report.tokenMeta?.symbol) {
    score += 3;
    reasons.push("Token metadata is present.");
  } else {
    score -= 5;
    reasons.push("Token metadata appears incomplete.");
  }

  if (report.rugged) {
    score -= 25;
    reasons.push("Token is flagged as rugged.");
  }

  const finalScore = Math.round(clampNumber(score));
  return {
    agent: "trust",
    score: finalScore,
    reasons,
    rawSignals: {
      websiteCount: pair?.websiteCount ?? 0,
      socialTypes: Array.from(socialTypes),
      totalStableLiquidity: report.totalStableLiquidity,
      graphInsidersDetected: report.graphInsidersDetected,
      insiderNetworksCount: report.insiderNetworksCount,
      creatorPresent: Boolean(report.creator),
      hasTokenMeta: Boolean(report.tokenMeta?.name && report.tokenMeta?.symbol),
      rugged: report.rugged,
    },
  };
}

