import fs from "fs";
import os from "os";
import path from "path";

import { describe, expect, it } from "vitest";

import { ChatMemoryStore } from "../src/core/chatMemoryStore";

function uniqueTempFile(name: string): string {
  return path.join(os.tmpdir(), `ruggy-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe("ChatMemoryStore", () => {
  it("persists and reloads user memory", () => {
    const filePath = uniqueTempFile("memory");
    const first = new ChatMemoryStore(filePath, 4);
    first.append(101, { role: "user", content: "hello" });
    first.append(101, { role: "assistant", content: "gm degen" });

    const second = new ChatMemoryStore(filePath, 4);
    const history = second.getHistory(101);

    expect(history.length).toBe(2);
    expect(history[0]?.content).toBe("hello");
    expect(history[1]?.content).toBe("gm degen");

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it("enforces max history per user", () => {
    const filePath = uniqueTempFile("memory-cap");
    const store = new ChatMemoryStore(filePath, 2);
    store.append(202, { role: "user", content: "a" });
    store.append(202, { role: "assistant", content: "b" });
    store.append(202, { role: "user", content: "c" });

    const history = store.getHistory(202);
    expect(history.map((item) => item.content)).toEqual(["b", "c"]);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});

