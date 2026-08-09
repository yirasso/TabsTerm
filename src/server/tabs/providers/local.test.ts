import { describe, expect, it } from "vitest";
import { localProvider } from "./local";

describe("localProvider", () => {
  it("finds a song by exact title", async () => {
    const results = await localProvider.search("Greensleeves");
    expect(results[0]?.title).toBe("Greensleeves");
  });

  it("is accent- and case-insensitive", async () => {
    const results = await localProvider.search("ODE TO JOY");
    expect(results[0]?.id).toBe("ode-to-joy");
  });

  it("matches on partial tokens across title and artist", async () => {
    const results = await localProvider.search("pachelbel canon");
    expect(results.map((r) => r.id)).toContain("canon-in-d-bass");
  });

  it("returns nothing for an empty query", async () => {
    expect(await localProvider.search("   ")).toEqual([]);
  });

  it("omits tab content from search results", async () => {
    const [first] = await localProvider.search("Greensleeves");
    expect(first).not.toHaveProperty("content");
  });

  it("returns full content from getTab", async () => {
    const tab = await localProvider.getTab("greensleeves");
    expect(tab?.content).toContain("e|");
  });

  it("returns null for an unknown id", async () => {
    expect(await localProvider.getTab("nope")).toBeNull();
  });
});
