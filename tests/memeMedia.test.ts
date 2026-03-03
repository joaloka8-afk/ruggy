import { describe, expect, it } from "vitest";

import { getMessageVisualPack, getScoreVisualPack } from "../src/content/memeMedia";

describe("meme media", () => {
  it("returns visual pack for chat message", () => {
    const pack = getMessageVisualPack("gm what do you think about this token");
    expect(pack.emoji.length).toBeGreaterThan(0);
    expect(pack.slangLine.length).toBeGreaterThan(0);
    expect(pack.gifUrl.startsWith("https://")).toBe(true);
  });

  it("maps scores to caution and bullish packs", () => {
    const low = getScoreVisualPack(20);
    const high = getScoreVisualPack(90);

    expect(low.gifUrl).not.toBe(high.gifUrl);
    expect(low.emoji.length).toBeGreaterThan(0);
    expect(high.emoji.length).toBeGreaterThan(0);
  });
});

