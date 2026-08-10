import { describe, expect, it } from "vitest";
import { QUOTES, quoteForDay } from "./quotes";

describe("quoteForDay", () => {
  it("returns the same quote all day", () => {
    const morning = quoteForDay(new Date("2026-08-10T06:00:00Z"));
    const night = quoteForDay(new Date("2026-08-10T23:59:00Z"));
    expect(morning).toEqual(night);
  });

  it("moves on the next day", () => {
    const today = quoteForDay(new Date("2026-08-10T12:00:00Z"));
    const tomorrow = quoteForDay(new Date("2026-08-11T12:00:00Z"));
    expect(today).not.toEqual(tomorrow);
  });

  it("walks the whole list before repeating", () => {
    const seen = new Set<string>();
    for (let day = 0; day < QUOTES.length; day++) {
      seen.add(quoteForDay(new Date(Date.UTC(2026, 0, 1 + day))).text);
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it("handles dates before the epoch without going negative", () => {
    const quote = quoteForDay(new Date("1969-01-01T00:00:00Z"));
    expect(QUOTES).toContainEqual(quote);
  });

  it("always has an author to attribute", () => {
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.author.length).toBeGreaterThan(0);
    }
  });
});
