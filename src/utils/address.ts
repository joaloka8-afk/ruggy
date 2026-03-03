import bs58 from "bs58";

const SOLANA_BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!SOLANA_BASE58_PATTERN.test(trimmed)) {
    return false;
  }

  try {
    const decoded = bs58.decode(trimmed);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

export function extractFirstSolanaAddress(text: string): string | undefined {
  const matches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
  if (!matches) {
    return undefined;
  }

  return matches.find((candidate) => isValidSolanaAddress(candidate));
}

