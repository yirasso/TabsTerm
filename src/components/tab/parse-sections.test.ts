import { describe, expect, it } from "vitest";
import { parseSections } from "./parse-sections";

describe("parseSections", () => {
  it("splits content on [section] headers", () => {
    const content = "[Intro]\ne|--0--|\nB|-----|\n\n[Verse]\ne|--3--|";
    const sections = parseSections(content);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.label).toBe("intro");
    expect(sections[0]?.body).toBe("e|--0--|\nB|-----|");
    expect(sections[1]?.label).toBe("verse");
    expect(sections[1]?.body).toBe("e|--3--|");
  });

  it("wraps headerless content in a single 'tab' section", () => {
    const sections = parseSections("e|--0--|\nB|--1--|");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.label).toBe("tab");
  });

  it("keeps interior spacing intact", () => {
    const body = "e|--0--|\n\ne|--2--|";
    const sections = parseSections(`[Solo]\n${body}`);
    expect(sections[0]?.body).toBe(body);
  });

  it("returns [] for null or empty content", () => {
    expect(parseSections(null)).toEqual([]);
    expect(parseSections("")).toEqual([]);
    expect(parseSections("\n\n")).toEqual([]);
  });
});
