import { describe, expect, it } from "vitest";
import { safeNextPath, slugify } from "./utils";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/song/mine/2a3fk1")).toBe("/song/mine/2a3fk1");
    expect(safeNextPath("/?q=greensleeves&view=results")).toBe("/?q=greensleeves&view=results");
  });

  it("refuses a protocol-relative URL, which is the one that matters", () => {
    // A browser reads `//evil.com` as absolute, so redirecting there leaves the
    // site — with our address sitting in the referrer of somebody else's login
    // page.
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("//evil.com/pretend/sign-in")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
  });

  it("refuses an absolute URL", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("falls back when there is nothing to go back to", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});

describe("slugify", () => {
  it("strips accents and lowercases", () => {
    expect(slugify("Tomás Girão")).toBe("tomas-girao");
  });
});
