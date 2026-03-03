import type { AgentResult, RugcheckReport } from "../types";
import { clampNumber } from "../utils/math";

function toPercent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
}

function computeHolderConcentration(report: RugcheckReport): { top1: number; top5: number; top10: number } {
  const sortedPercentages = report.topHolders
    .map((holder) => toPercent(holder.percentage))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);

  const sumFirst = (count: number) => sortedPercentages.slice(0, count).reduce((sum, current) => sum + current, 0);

  return {
    top1: sortedPercentages[0] ?? 0,
    top5: sumFirst(5),
    top10: sumFirst(10),
  };
}

function classifyRiskLevel(level: string | undefined): "high" | "warn" | "low" {
  const normalized = (level ?? "").toLowerCase();
  if (["danger", "critical", "high", "severe"].some((label) => normalized.includes(label))) {
    return "high";
  }
  if (["warn", "medium", "caution"].some((label) => normalized.includes(label))) {
    return "warn";
  }
  return "low";
}

export function runOnchainAgent(report: RugcheckReport): AgentResult {
  let score = 100 - report.scoreNormalised;
  const reasons: string[] = [];

  if (report.rugged) {
    score = Math.min(score, 10);
    reasons.push("Rugcheck marks this token as rugged.");
  }

  if (report.mintAuthority) {
    score -= 18;
    reasons.push("Mint authority is active, so supply can still be changed.");
  } else {
    reasons.push("Mint authority appears revoked.");
  }

  if (report.freezeAuthority) {
    score -= 15;
    reasons.push("Freeze authority is active.");
  } else {
    reasons.push("Freeze authority appears revoked.");
  }

  const concentration = computeHolderConcentration(report);
  if (concentration.top1 > 0.35) {
    score -= 18;
    reasons.push("Top holder concentration is very high.");
  } else if (concentration.top1 > 0.2) {
    score -= 8;
    reasons.push("Top holder concentration is elevated.");
  }

  if (concentration.top10 > 0.7) {
    score -= 10;
    reasons.push("Top 10 holders control most of the supply.");
  }

  const highRiskCount = report.risks.filter((risk) => classifyRiskLevel(risk.level) === "high").length;
  const warnRiskCount = report.risks.filter((risk) => classifyRiskLevel(risk.level) === "warn").length;

  if (highRiskCount > 0) {
    score -= Math.min(30, highRiskCount * 12);
    reasons.push(`${highRiskCount} high-severity risk flag(s) detected.`);
  }
  if (warnRiskCount > 0) {
    score -= Math.min(16, warnRiskCount * 4);
    reasons.push(`${warnRiskCount} warning-level risk flag(s) detected.`);
  }
  if (report.risks.length >= 8) {
    score -= 8;
    reasons.push("Large number of total risk flags present.");
  }

  if (report.totalHolders !== null) {
    if (report.totalHolders < 100) {
      score -= 12;
      reasons.push("Very low holder count.");
    } else if (report.totalHolders < 500) {
      score -= 6;
      reasons.push("Low holder count.");
    }
  }

  if (report.tokenMeta?.mutable === false) {
    score += 4;
    reasons.push("Metadata appears immutable.");
  }

  if (report.verification?.verified || report.verification?.jupiterVerified) {
    score += 6;
    reasons.push("Verification signals are present.");
  }

  const finalScore = Math.round(clampNumber(score));
  if (reasons.length === 0) {
    reasons.push("No strong on-chain risk signals were detected.");
  }

  return {
    agent: "onchain",
    score: finalScore,
    reasons,
    rawSignals: {
      rugged: report.rugged,
      rugcheckScoreNormalised: report.scoreNormalised,
      mintAuthorityActive: Boolean(report.mintAuthority),
      freezeAuthorityActive: Boolean(report.freezeAuthority),
      totalHolders: report.totalHolders,
      top1HolderShare: concentration.top1,
      top10HolderShare: concentration.top10,
      riskCount: report.risks.length,
      highRiskCount,
      warnRiskCount,
    },
  };
}

