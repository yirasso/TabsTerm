import { describe, expect, it } from "vitest";
import { deriveCapability } from "../types";
import { localProvider } from "./local";

const STAVE = `e|--0--|
B|--1--|
G|--0--|
D|--2--|
A|--3--|
E|-----|`;

describe("deriveCapability", () => {
  it("is 'full' when there is a stave the player can turn into notes", () => {
    expect(deriveCapability({ content: STAVE, externalOnly: false })).toBe("full");
  });

  it("is 'text' for content with nothing playable in it", () => {
    expect(deriveCapability({ content: "[Verse]\nAm  C  G", externalOnly: false })).toBe("text");
  });

  it("is 'link' when the source only lets us point at it", () => {
    expect(deriveCapability({ content: STAVE, externalOnly: true })).toBe("link");
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
    expect(results.map((r) => r.id)).toContain("canon-in-d");
  });

  it("returns nothing for an empty query", async () => {
    expect(await localProvider.search("   ")).toEqual([]);
  });

  it("omits tab content from search results", async () => {
    const [first] = await localProvider.search("Greensleeves");
    expect(first).not.toHaveProperty("content");
  });

  it("labels a stave-bearing tab as playable", async () => {
    const [first] = await localProvider.search("Greensleeves");
    expect(first?.capability).toBe("full");
  });

  it("has nothing in the library the player cannot play", async () => {
    // The library is guitar tablature only, so every entry must carry a stave.
    for (const title of ["greensleeves", "scarborough", "ode to joy", "canon"]) {
      const [found] = await localProvider.search(title);
      expect(found?.capability).toBe("full");
    }
  });

  it("returns full content from getTab", async () => {
    const tab = await localProvider.getTab("greensleeves");
    expect(tab?.content).toContain("e|");
  });

  it("returns null for an unknown id", async () => {
    expect(await localProvider.getTab("nope")).toBeNull();
  });
});

describe("localProvider.random", () => {
  it("always returns a tab from its own library", async () => {
    for (let i = 0; i < 20; i++) {
      const tab = await localProvider.random?.();
      expect(tab).not.toBeNull();
      expect(await localProvider.getTab(tab?.id ?? "")).toEqual(tab);
    }
  });

  it("never hands back something the reader cannot read", async () => {
    for (let i = 0; i < 20; i++) {
      const tab = await localProvider.random?.();
      expect(tab?.externalOnly).toBe(false);
      expect(tab?.content).toBeTruthy();
    }
  });

  it("reaches more than one tab over repeated draws", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const tab = await localProvider.random?.();
      if (tab) seen.add(tab.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
