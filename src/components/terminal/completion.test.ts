import { describe, expect, it } from "vitest";
import { COMMANDS } from "./commands";
import { type CycleState, completionsFor, nextCompletion } from "./completion";

const ALL = COMMANDS.map((c) => c.name.split(" ")[0]);

describe("completionsFor", () => {
  it("completes a partial command", () => {
    expect(completionsFor("/ne")).toEqual(["/new"]);
    expect(completionsFor("/ra")).toEqual(["/rand"]);
  });

  it("offers every command for a bare slash", () => {
    expect(completionsFor("/")).toEqual(ALL);
    expect(ALL.length).toBeGreaterThan(1);
  });

  it("offers nothing for commands that no longer exist", () => {
    for (const gone of ["/fav", "/tab", "/artist", "/auth", "/src", "/listen", "/chords"]) {
      expect(completionsFor(gone)).toEqual([]);
    }
  });

  it("stops once there is a space, because nothing takes an argument", () => {
    expect(completionsFor("/new ")).toEqual(["/new"]);
    expect(completionsFor("/new something")).toEqual([]);
  });

  it("has nothing to offer for plain queries", () => {
    expect(completionsFor("greensleeves")).toEqual([]);
    expect(completionsFor("/zzz")).toEqual([]);
  });
});

describe("nextCompletion", () => {
  const tab = (input: string, state: CycleState) => nextCompletion(input, state, 1);

  it("returns null when there is nothing to complete", () => {
    expect(tab("greensleeves", null)).toBeNull();
  });

  it("cycles through every command from a bare slash", () => {
    let step = tab("/", null);
    expect(step?.value).toBe(ALL[0]);

    for (let i = 1; i < ALL.length; i++) {
      step = tab(step?.value ?? "", step?.state ?? null);
      expect(step?.value).toBe(ALL[i]);
    }
  });

  it("wraps around the end of the list", () => {
    let step = nextCompletion("/", null, 1);
    for (let i = 1; i < ALL.length; i++) {
      step = nextCompletion(step?.value ?? "", step?.state ?? null, 1);
    }
    step = nextCompletion(step?.value ?? "", step?.state ?? null, 1);
    expect(step?.value).toBe(ALL[0]);
  });

  it("walks backwards with shift", () => {
    expect(nextCompletion("/", null, -1)?.value).toBe(ALL.at(-1));
  });

  it("does not fire when the only candidate is already typed", () => {
    expect(tab("/new", null)).toBeNull();
  });

  it("recomputes when the cycle state belongs to a different input", () => {
    const stale: CycleState = { candidates: ALL as string[], index: 0, applied: "/new" };
    expect(tab("/ra", stale)?.value).toBe("/rand");
  });
});
