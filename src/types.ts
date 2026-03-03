export type AgentName = "onchain" | "market" | "trust";

export type Verdict = "lower_risk" | "caution" | "high_risk" | "extreme_risk";

export interface ScanRequest {
  contractAddress: string;
  requestUserId: number;
}

export interface AgentResult {
  agent: AgentName;
  score: number;
  reasons: string[];
  rawSignals: Record<string, unknown>;
}

export interface ScanReport {
  contractAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  overallScore: number;
  verdict: Verdict;
  agents: AgentResult[];
  highlights: string[];
  generatedAt: string;
  pair?: {
    dexId: string;
    pairAddress: string;
    url: string;
  };
}

export interface ChatReply {
  text: string;
  mode: "llm" | "fallback";
}

export interface RugcheckRisk {
  name: string;
  value?: string;
  description?: string;
  level?: string;
  score?: number;
}

export interface RugcheckTopHolder {
  owner?: string;
  amount?: number;
  percentage?: number;
}

export interface RugcheckTokenMeta {
  name?: string;
  symbol?: string;
  mutable?: boolean;
}

export interface RugcheckVerification {
  verified?: boolean;
  jupiterVerified?: boolean;
  [key: string]: unknown;
}

export interface RugcheckReport {
  mint: string;
  rugged: boolean;
  scoreNormalised: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  risks: RugcheckRisk[];
  totalHolders: number | null;
  topHolders: RugcheckTopHolder[];
  totalMarketLiquidity: number | null;
  totalStableLiquidity: number | null;
  graphInsidersDetected: boolean;
  insiderNetworksCount: number;
  creator: string | null;
  tokenMeta: RugcheckTokenMeta | null;
  verification: RugcheckVerification | null;
}

export interface DexSocial {
  type: string;
  url: string;
}

export interface DexTokenInfo {
  address: string;
  name?: string;
  symbol?: string;
}

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: DexTokenInfo;
  quoteToken: DexTokenInfo;
  priceUsd: number | null;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number | null;
  priceChange1h: number | null;
  buys24h: number;
  sells24h: number;
  pairCreatedAt: number | null;
  fdv: number | null;
  marketCap: number | null;
  websiteCount: number;
  socials: DexSocial[];
}

