import { describe, expect, it } from "vitest";
import { isValidHandle } from "./profile";

/**
 * The same shape the database enforces as a check constraint. These two are
 * written down separately on purpose — this one to tell somebody before they
 * submit, that one to hold for anyone who skips the screen — so it is worth a
 * test that they agree on the cases that matter.
 */
describe("isValidHandle", () => {
  it("accepts what the signup trigger produces", () => {
    expect(isValidHandle("tomas.v.girao")).toBe(true);
    expect(isValidHandle("tomas.v.girao1")).toBe(true);
    expect(isValidHandle("user")).toBe(true);
    expect(isValidHandle("a_b-c.d")).toBe(true);
  });

  it("refuses anything that is not lowercase", () => {
    // Handles are compared by eye more than by machine, and `Tomas` next to
    // `tomas` is two people who look like one.
    expect(isValidHandle("Tomas")).toBe(false);
    expect(isValidHandle("TOMAS")).toBe(false);
  });

  it("refuses too short and too long", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("abc")).toBe(true);
    expect(isValidHandle("x".repeat(32))).toBe(true);
    expect(isValidHandle("x".repeat(33))).toBe(false);
  });

  it("refuses spaces and punctuation that is not . _ -", () => {
    expect(isValidHandle("has space")).toBe(false);
    expect(isValidHandle("ola@mundo")).toBe(false);
    expect(isValidHandle("slash/es")).toBe(false);
    expect(isValidHandle("")).toBe(false);
  });

  it("refuses a handle that only looks right on one line", () => {
    // `\n` ends a line for a JS regex anchored with `$`, so `bad\ngood` would
    // pass a `/^…$/` without the multiline guard being thought about.
    expect(isValidHandle("tomas\nrm -rf")).toBe(false);
  });
});
