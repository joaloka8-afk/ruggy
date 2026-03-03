import fs from "fs";
import os from "os";
import path from "path";

import { describe, expect, it } from "vitest";

import { ChatMemoryStore } from "../src/core/chatMemoryStore";

function uniqueTempFile(name: string): string {
  return path.join(os.tmpdir(), `ruggy-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe("ChatMemoryStore", () => {
  it("persists and reloads user memory", async () => {
    const filePath = uniqueTempFile("memory");
    const first = new ChatMemoryStore({
      backend: "file",
      filePath,
      maxEntriesPerUser: 4,
    });
    await first.append(101, { role: "user", content: "hello" });
    await first.append(101, { role: "assistant", content: "gm degen" });

    const second = new ChatMemoryStore({
      backend: "file",
      filePath,
      maxEntriesPerUser: 4,
    });
    const history = await second.getHistory(101);

    expect(history.length).toBe(2);
    expect(history[0]?.content).toBe("hello");
    expect(history[1]?.content).toBe("gm degen");
    await first.close();
    await second.close();

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it("enforces max history per user", async () => {
    const filePath = uniqueTempFile("memory-cap");
    const store = new ChatMemoryStore({
      backend: "file",
      filePath,
      maxEntriesPerUser: 2,
    });
    await store.append(202, { role: "user", content: "a" });
    await store.append(202, { role: "assistant", content: "b" });
    await store.append(202, { role: "user", content: "c" });

    const history = await store.getHistory(202);
    expect(history.map((item) => item.content)).toEqual(["b", "c"]);
    await store.close();

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});
