import { describe, expect, it } from "vitest";
import { COMMANDS, parseCommand, searchTermFor } from "./commands";

describe("parseCommand", () => {
  it("splits a command and its argument", () => {
    expect(parseCommand("/tab ode to joy")).toEqual({ cmd: "/tab", arg: "ode to joy" });
    expect(parseCommand("/artist john renbourn")).toEqual({
      cmd: "/artist",
      arg: "john renbourn",
    });
  });

  it("returns null for plain queries", () => {
    expect(parseCommand("greensleeves")).toBeNull();
  });
});

describe("searchTermFor", () => {
  it("passes plain queries through", () => {
    expect(searchTermFor(" greensleeves ")).toBe("greensleeves");
  });

  it("extracts the argument of search commands", () => {
    expect(searchTermFor("/tab greensleeves")).toBe("greensleeves");
    expect(searchTermFor("/artist traditional")).toBe("traditional");
  });

  it("returns empty for non-search commands", () => {
    expect(searchTermFor("/fav")).toBe("");
    expect(searchTermFor("/man")).toBe("");
  });

  it("does not search for commands that were removed", () => {
    // Anything unrecognised is a command, not a query — typing a dead command
    // must not quietly become a search for its name.
    expect(searchTermFor("/chords house")).toBe("");
    expect(searchTermFor("/src local")).toBe("");
    expect(searchTermFor("/listen")).toBe("");
  });
});

describe("COMMANDS", () => {
  it("does not offer commands that were removed", () => {
    // Which sources are searched is the operator's call, set by TAB_PROVIDERS;
    // transcribing lives in the /new editor rather than at a route of its own.
    const words = COMMANDS.map((c) => c.name.split(" ")[0]);
    for (const gone of ["/src", "/listen", "/chords", "/login", "/provider"]) {
      expect(words).not.toContain(gone);
    }
    // A guard that would pass on an empty list is not a guard.
    expect(words).toContain("/tab");
  });
});
