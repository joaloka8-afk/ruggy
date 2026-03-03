import type { AgentResult, ScanReport } from "../types";

function verdictLabel(verdict: ScanReport["verdict"]): string {
  switch (verdict) {
    case "lower_risk":
      return "LOWER RISK";
    case "caution":
      return "CAUTION";
    case "high_risk":
      return "HIGH RISK";
    case "extreme_risk":
      return "EXTREME RISK";
    default:
      return "UNKNOWN";
  }
}

function prettyAgentLabel(agent: AgentResult["agent"]): string {
  switch (agent) {
    case "onchain":
      return "On-Chain Risk Agent";
    case "market":
      return "Market Behavior Agent";
    case "trust":
      return "Trust & Social Agent";
    default:
      return "Agent";
  }
}

export function formatScanReport(report: ScanReport): string {
  const lines: string[] = [];
  const titleSymbol = report.tokenSymbol ? `${report.tokenSymbol} ` : "";

  lines.push(`RUGGY SCAN REPORT | ${titleSymbol}${report.contractAddress}`);
  lines.push(`Overall Safety Score: ${report.overallScore}/100 (${verdictLabel(report.verdict)})`);
  lines.push(`Generated: ${new Date(report.generatedAt).toUTCString()}`);

  if (report.tokenName || report.tokenSymbol) {
    lines.push(`Token: ${report.tokenName ?? "Unknown"} (${report.tokenSymbol ?? "n/a"})`);
  }

  if (report.pair) {
    lines.push(`Market Pair: ${report.pair.dexId} | ${report.pair.pairAddress}`);
    lines.push(`Chart: ${report.pair.url}`);
  }

  lines.push("");
  lines.push("Agent Scores:");
  for (const agent of report.agents) {
    lines.push(`- ${prettyAgentLabel(agent.agent)}: ${agent.score}/100`);
    for (const reason of agent.reasons.slice(0, 3)) {
      lines.push(`  - ${reason}`);
    }
  }

  if (report.highlights.length > 0) {
    lines.push("");
    lines.push("Key Highlights:");
    for (const highlight of report.highlights) {
      lines.push(`- ${highlight}`);
    }
  }

  lines.push("");
  lines.push("Disclaimer: This is a risk signal, not financial advice.");

  const output = lines.join("\n");
  return output.length > 3900 ? `${output.slice(0, 3890)}...` : output;
}
