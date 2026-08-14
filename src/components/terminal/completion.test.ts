import { describe, expect, it } from "vitest";
import { type CycleState, completionsFor, nextCompletion } from "./completion";

const CTX = { songs: ["Greensleeves", "Ode to Joy", "Scarborough Fair"] };

describe("completionsFor", () => {
  it("completes a partial command", () => {
    expect(completionsFor("/art", CTX)).toEqual(["/artist "]);
  });

  it("leaves a trailing space only when the command takes an argument", () => {
    expect(completionsFor("/fa", CTX)).toEqual(["/fav"]);
    expect(completionsFor("/ta", CTX)).toEqual(["/tab "]);
  });

  it("offers nothing for commands that no longer exist", () => {
    expect(completionsFor("/chords", CTX)).toEqual([]);
    expect(completionsFor("/login", CTX)).toEqual([]);
    expect(completionsFor("/provider", CTX)).toEqual([]);
    expect(completionsFor("/src", CTX)).toEqual([]);
    expect(completionsFor("/listen", CTX)).toEqual([]);
  });

  it("offers every command for a bare slash", () => {
    const all = completionsFor("/", CTX);
    expect(all).toContain("/tab ");
    expect(all).toContain("/theme");
    expect(all.length).toBeGreaterThan(4);
  });

  it("completes song titles once the command has a space", () => {
    expect(completionsFor("/tab ", CTX)).toEqual([
      "/tab Greensleeves",
      "/tab Ode to Joy",
      "/tab Scarborough Fair",
    ]);
  });

  it("narrows song titles by what is already typed", () => {
    expect(completionsFor("/tab sca", CTX)).toEqual(["/tab Scarborough Fair"]);
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
    const first = tab("/tab", null);
    expect(first?.value).toBe("/tab ");

    const second = tab(first?.value ?? "", first?.state ?? null);
    expect(second?.value).toBe("/tab Greensleeves");
  });

  it("cycles through the remaining candidates on repeated presses", () => {
    let step = tab("/tab ", null);
    expect(step?.value).toBe("/tab Greensleeves");

    step = tab(step?.value ?? "", step?.state ?? null);
    expect(step?.value).toBe("/tab Ode to Joy");

    step = tab(step?.value ?? "", step?.state ?? null);
    expect(step?.value).toBe("/tab Scarborough Fair");
  });

  it("wraps around the end of the list", () => {
    let step = nextCompletion("/tab ", null, 1, CTX);
    for (let i = 0; i < 2; i++)
      step = nextCompletion(step?.value ?? "", step?.state ?? null, 1, CTX);
    expect(step?.value).toBe("/tab Scarborough Fair");

    step = nextCompletion(step?.value ?? "", step?.state ?? null, 1, CTX);
    expect(step?.value).toBe("/tab Greensleeves");
  });

  it("walks backwards with shift", () => {
    const step = nextCompletion("/tab ", null, -1, CTX);
    expect(step?.value).toBe("/tab Scarborough Fair");
  });

  it("does not fire when the only candidate is already typed", () => {
    expect(tab("/fav", null)).toBeNull();
  });

  it("recomputes when the cycle state belongs to a different input", () => {
    const stale: CycleState = {
      candidates: ["/tab Greensleeves", "/tab Ode to Joy"],
      index: 0,
      applied: "/tab Greensleeves",
    };
    expect(tab("/art", stale)?.value).toBe("/artist ");
  });
});
