import { describe, expect, it } from "vitest";

import { extractFirstSolanaAddress, isValidSolanaAddress } from "../src/utils/address";

describe("address utilities", () => {
  it("accepts valid Solana addresses", () => {
    expect(isValidSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
    expect(isValidSolanaAddress("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN")).toBe(true);
  });

  it("rejects invalid Solana addresses", () => {
    expect(isValidSolanaAddress("this-is-not-an-address")).toBe(false);
    expect(isValidSolanaAddress("O0IlinvalidCharsAddress12345678901234567890")).toBe(false);
    expect(isValidSolanaAddress("11111")).toBe(false);
  });

  it("extracts the first valid contract address from free text", () => {
    const text =
      "Please scan this token: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v and ignore others.";
    expect(extractFirstSolanaAddress(text)).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });
});

