import { describe, expect, it } from "vitest";
import type { PitchEvent } from "@/lib/tab/fretting";
import { dropRestrikes } from "./notes";

const at = (midi: number, time: number, duration = 0.4): PitchEvent => ({
  midi,
  time,
  duration,
});

describe("dropRestrikes", () => {
  it("drops a note that starts while the same pitch is still ringing", () => {
    // One struck string the model heard re-attacking mid-decay.
    expect(dropRestrikes([at(64, 1.0, 0.9), at(64, 1.13)])).toHaveLength(1);
  });

  it("keeps a genuine repeat once the first note has died away", () => {
    expect(dropRestrikes([at(64, 0, 0.3), at(64, 0.5)])).toHaveLength(2);
  });

  it("keeps a fast repeat that a fixed time window would have eaten", () => {
    // A sixteenth note at 120bpm is 125ms apart — real playing, short notes.
    expect(dropRestrikes([at(64, 0, 0.1), at(64, 0.125, 0.1)])).toHaveLength(2);
  });

  it("leaves different pitches struck together alone", () => {
    // An open E minor triad, which must survive intact to reach three strings.
    expect(dropRestrikes([at(64, 1.0), at(59, 1.01), at(55, 1.02)])).toHaveLength(3);
  });

  it("tracks each pitch separately", () => {
    const notes = dropRestrikes([at(64, 0, 0.5), at(67, 0.02), at(64, 0.04)]);
    // The G survives; the second E does not, because the first is still ringing.
    expect(notes.map((n) => n.midi)).toEqual([64, 67]);
  });

  it("passes an empty take through", () => {
    expect(dropRestrikes([])).toEqual([]);
  });
});
