import { describe, expect, it } from "vitest";
import { type CycleState, completionsFor, nextCompletion } from "./completion";

const CTX = { providers: ["local", "songsterr"], songs: ["Greensleeves", "Ode to Joy"] };

describe("completionsFor", () => {
  it("completes a partial command", () => {
    expect(completionsFor("/art", CTX)).toEqual(["/artist "]);
  });

  it("leaves a trailing space only when the command takes an argument", () => {
    expect(completionsFor("/fa", CTX)).toEqual(["/fav"]);
    expect(completionsFor("/pro", CTX)).toEqual(["/provider "]);
  });

  it("offers every command for a bare slash", () => {
    const all = completionsFor("/", CTX);
    expect(all).toContain("/tab ");
    expect(all).toContain("/theme");
    expect(all.length).toBeGreaterThan(4);
  });

  it("completes provider values once the command has a space", () => {
    expect(completionsFor("/provider ", CTX)).toEqual([
      "/provider all",
      "/provider local",
      "/provider songsterr",
    ]);
  });

  it("narrows provider values by what is already typed", () => {
    expect(completionsFor("/provider so", CTX)).toEqual(["/provider songsterr"]);
  });

  it("completes song titles for search commands", () => {
    expect(completionsFor("/tab gree", CTX)).toEqual(["/tab Greensleeves"]);
  });

  it("has nothing to offer for plain queries or unknown arguments", () => {
    expect(completionsFor("greensleeves", CTX)).toEqual([]);
    expect(completionsFor("/theme x", CTX)).toEqual([]);
    expect(completionsFor("/zzz", CTX)).toEqual([]);
  });
});

describe("nextCompletion", () => {
  const tab = (input: string, state: CycleState) => nextCompletion(input, state, 1, CTX);

  it("returns null when there is nothing to complete", () => {
    expect(tab("greensleeves", null)).toBeNull();
  });

  it("steps command word then argument, so two Tabs reach the values", () => {
    const first = tab("/provider", null);
    expect(first?.value).toBe("/provider ");

    const second = tab(first?.value ?? "", first?.state ?? null);
    expect(second?.value).toBe("/provider all");
  });

  it("cycles through the remaining candidates on repeated presses", () => {
    let step = tab("/provider ", null);
    expect(step?.value).toBe("/provider all");

    step = tab(step?.value ?? "", step?.state ?? null);
    expect(step?.value).toBe("/provider local");

    step = tab(step?.value ?? "", step?.state ?? null);
    expect(step?.value).toBe("/provider songsterr");
  });

  it("wraps around the end of the list", () => {
    let step = nextCompletion("/provider ", null, 1, CTX);
    for (let i = 0; i < 2; i++)
      step = nextCompletion(step?.value ?? "", step?.state ?? null, 1, CTX);
    expect(step?.value).toBe("/provider songsterr");

    step = nextCompletion(step?.value ?? "", step?.state ?? null, 1, CTX);
    expect(step?.value).toBe("/provider all");
  });

  it("walks backwards with shift", () => {
    const step = nextCompletion("/provider ", null, -1, CTX);
    expect(step?.value).toBe("/provider songsterr");
  });

  it("does not fire when the only candidate is already typed", () => {
    expect(tab("/fav", null)).toBeNull();
  });

  it("recomputes when the cycle state belongs to a different input", () => {
    const stale: CycleState = {
      candidates: ["/provider all", "/provider local"],
      index: 0,
      applied: "/provider all",
    };
    expect(tab("/art", stale)?.value).toBe("/artist ");
  });
});
