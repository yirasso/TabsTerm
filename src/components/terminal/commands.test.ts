import { describe, expect, it } from "vitest";
import { parseCommand, searchTermFor } from "./commands";

describe("parseCommand", () => {
  it("splits a command and its argument", () => {
    expect(parseCommand("/tab ode to joy")).toEqual({ cmd: "/tab", arg: "ode to joy" });
    expect(parseCommand("/src songsterr")).toEqual({ cmd: "/src", arg: "songsterr" });
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
    expect(searchTermFor("/src local")).toBe("");
  });

  it("does not search for commands that were removed", () => {
    expect(searchTermFor("/chords house")).toBe("");
  });
});
