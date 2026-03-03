import { describe, expect, it } from "vitest";

import { calculateOverallScore, mapScoreToVerdict } from "../src/core/scoring";
import type { AgentResult } from "../src/types";

const agents: AgentResult[] = [
  { agent: "onchain", score: 80, reasons: [], rawSignals: {} },
  { agent: "market", score: 60, reasons: [], rawSignals: {} },
  { agent: "trust", score: 50, reasons: [], rawSignals: {} },
];

describe("scoring", () => {
  it("calculates weighted overall score", () => {
    const result = calculateOverallScore(agents, { rugged: false });
    expect(result.overallScore).toBe(67);
    expect(result.verdict).toBe("caution");
  });

  it("caps score when token is rugged", () => {
    const result = calculateOverallScore(
      [
        { agent: "onchain", score: 95, reasons: [], rawSignals: {} },
        { agent: "market", score: 90, reasons: [], rawSignals: {} },
        { agent: "trust", score: 85, reasons: [], rawSignals: {} },
      ],
      { rugged: true },
    );

    expect(result.overallScore).toBeLessThanOrEqual(15);
    expect(result.verdict).toBe("extreme_risk");
  });

  it("maps score boundaries to verdict bands", () => {
    expect(mapScoreToVerdict(80)).toBe("lower_risk");
    expect(mapScoreToVerdict(60)).toBe("caution");
    expect(mapScoreToVerdict(40)).toBe("high_risk");
    expect(mapScoreToVerdict(39)).toBe("extreme_risk");
  });
});

