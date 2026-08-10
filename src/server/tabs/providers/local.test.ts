import { describe, expect, it } from "vitest";
import { deriveCapability } from "../types";
import { localProvider } from "./local";

describe("deriveCapability", () => {
  it("is 'text' for tablature we host without audio", () => {
    expect(deriveCapability({ content: "e|--0--|", externalOnly: false })).toBe("text");
  });

  it("is 'link' when the source only lets us point at it", () => {
    expect(deriveCapability({ content: "e|--0--|", externalOnly: true })).toBe("link");
  });

  it("is 'link' when there is no content to render", () => {
    expect(deriveCapability({ content: null, externalOnly: false })).toBe("link");
  });
});

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

  it("labels its own tablature as readable but silent", async () => {
    const [first] = await localProvider.search("Greensleeves");
    expect(first?.capability).toBe("text");
  });

  it("returns full content from getTab", async () => {
    const tab = await localProvider.getTab("greensleeves");
    expect(tab?.content).toContain("e|");
  });

  it("returns null for an unknown id", async () => {
    expect(await localProvider.getTab("nope")).toBeNull();
  });
});
