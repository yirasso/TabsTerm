import { describe, expect, it } from "vitest";
import { COMMANDS, parseCommand, searchTermFor } from "./commands";

describe("parseCommand", () => {
  it("splits a command and its argument", () => {
    // Nothing takes an argument today, but the parser still has to separate one
    // — that is how `/new something` is recognised as a command rather than a
    // search for those words.
    expect(parseCommand("/new")).toEqual({ cmd: "/new", arg: "" });
    expect(parseCommand("/theme dark")).toEqual({ cmd: "/theme", arg: "dark" });
  });

  it("returns null for plain queries", () => {
    expect(parseCommand("greensleeves")).toBeNull();
  });
});

describe("searchTermFor", () => {
  it("passes plain queries through", () => {
    expect(searchTermFor(" greensleeves ")).toBe("greensleeves");
  });

  it("searches for nothing when the input is a command", () => {
    // Including commands that were removed and ones that never existed: a slash
    // means "command", and a command the app does not know does nothing rather
    // than searching for its own name.
    for (const cmd of ["/new", "/theme", "/tab greensleeves", "/artist trad", "/fav", "/zzz"]) {
      expect(searchTermFor(cmd)).toBe("");
    }
  });
});

describe("COMMANDS", () => {
  it("does not offer commands that were removed", () => {
    const words = COMMANDS.map((c) => c.name.split(" ")[0]);
    for (const gone of [
      "/fav",
      "/tab",
      "/artist",
      "/auth",
      "/src",
      "/listen",
      "/chords",
      "/login",
      "/provider",
    ]) {
      expect(words).not.toContain(gone);
    }
    // A guard that would pass on an empty list is not a guard.
    expect(words).toEqual(["/new", "/rand", "/man", "/theme"]);
  });

  it("has no command that takes an argument", () => {
    // The completion engine dropped its second step with the last such command.
    for (const c of COMMANDS) expect(c.name).not.toContain("<");
  });
});
