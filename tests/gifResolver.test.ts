import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import { buildGifQueryFromText, GifResolver } from "../src/services/gifResolver";

describe("gif resolver", () => {
  it("builds risk query from warning text", () => {
    const query = buildGifQueryFromText("this token looks like a scam rug");
    expect(query).toBe("crypto scam warning");
  });

  it("builds cleaned query from arbitrary text", () => {
    const query = buildGifQueryFromText(
      "Check this CA EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v now!! /scan",
    );
    expect(query).not.toContain("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(query.length).toBeGreaterThan(0);
  });

  it("returns fallback gif when API key is missing", async () => {
    const resolver = new GifResolver({});
    const url = await resolver.resolveGifUrlFromText("solana meme", "https://fallback.gif");
    expect(url).toBe("https://fallback.gif");
  });

  it("returns and caches giphy result when key is set", async () => {
    const getMock = vi.fn(async () => ({
      data: {
        data: {
          images: {
            downsized_medium: { url: "https://giphy.example/related.gif" },
          },
        },
      },
    }));

    const httpClient = {
      get: getMock,
    } as unknown as AxiosInstance;

    const resolver = new GifResolver({
      giphyApiKey: "test_key",
      httpClient,
    });

    const first = await resolver.resolveGifUrlFromText("bitcoin pump", "https://fallback.gif");
    const second = await resolver.resolveGifUrlFromText("bitcoin pump", "https://fallback.gif");

    expect(first).toBe("https://giphy.example/related.gif");
    expect(second).toBe("https://giphy.example/related.gif");
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});

