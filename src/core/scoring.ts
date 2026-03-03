import type { AgentResult, Verdict } from "../types";
import { clampNumber } from "../utils/math";

const AGENT_WEIGHTS = {
  onchain: 45,
  market: 35,
  trust: 20,
} as const;

function findAgentScore(results: AgentResult[], agentName: AgentResult["agent"]): number {
  return results.find((result) => result.agent === agentName)?.score ?? 0;
}

export function mapScoreToVerdict(score: number): Verdict {
  if (score >= 80) {
    return "lower_risk";
  }
  if (score >= 60) {
    return "caution";
  }
  if (score >= 40) {
    return "high_risk";
  }
  return "extreme_risk";
}

export function calculateOverallScore(
  agentResults: AgentResult[],
  options: { rugged: boolean },
): { overallScore: number; verdict: Verdict } {
  const weightedScore =
    (findAgentScore(agentResults, "onchain") * AGENT_WEIGHTS.onchain +
      findAgentScore(agentResults, "market") * AGENT_WEIGHTS.market +
      findAgentScore(agentResults, "trust") * AGENT_WEIGHTS.trust) /
    100;

  const rounded = Math.round(clampNumber(weightedScore));
  const ruggedAdjustedScore = options.rugged ? Math.min(rounded, 15) : rounded;

  return {
    overallScore: ruggedAdjustedScore,
    verdict: mapScoreToVerdict(ruggedAdjustedScore),
  };
}

