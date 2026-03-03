import { describe, expect, it } from "vitest";

import { cleanBotText } from "../src/utils/text";

describe("cleanBotText", () => {
  it("removes control characters and collapses blank lines", () => {
    const dirty = "Hello\u0000 world\r\n\r\n\r\nLine 2\u0007";
    expect(cleanBotText(dirty)).toBe("Hello world\n\nLine 2");
  });

  it("limits output length", () => {
    const long = "a".repeat(5000);
    const cleaned = cleanBotText(long, { maxLength: 100 });
    expect(cleaned.length).toBe(100);
    expect(cleaned.endsWith("...")).toBe(true);
  });
});

