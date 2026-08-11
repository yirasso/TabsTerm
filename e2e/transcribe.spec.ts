import { expect, test } from "@playwright/test";

/**
 * Builds a WAV in the page and hands it to the file input, so the whole chain —
 * decode, model, fretting, ASCII — runs for real without shipping a fixture.
 */
const SYNTH = `(midiGroups, seconds, wave, inputId) => {
  const RATE = 22050;
  const ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds * midiGroups.length), RATE);
  midiGroups.forEach((group, i) => {
    const t = i * seconds;
    for (const midi of group) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8 / group.length, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + seconds - 0.02);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + seconds);
    }
  });
  return ctx.startRendering().then((buf) => {
    const d = buf.getChannelData(0);
    const n = d.length;
    const ab = new ArrayBuffer(44 + n * 2);
    const view = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); str(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, "data"); view.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    const dt = new DataTransfer();
    dt.items.add(new File([ab], "test.wav", { type: "audio/wav" }));
    const input = document.getElementById(inputId);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
}`;

test("the page promises that audio stays on the machine", async ({ page }) => {
  await page.goto("/listen");
  await expect(page.getByText(/audio never leaves this browser/i)).toBeVisible();
  // The two paths must not be confused with each other.
  await expect(page.getByText(/CHORDS, not tablature/)).toBeVisible();
  await page.getByRole("button", { name: /my guitar, live/i }).click();
  await expect(page.getByText(/real TABLATURE/)).toBeVisible();
});

test("a solo melody becomes tablature with the right frets", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/listen");
  await page.getByRole("button", { name: /my guitar, live/i }).click();

  // E4 G4 B4 E5 — all reachable on the top string at frets 0, 3, 7 and 12.
  await page.evaluate(
    ([fn, notes]) =>
      // biome-ignore lint/security/noGlobalEval: driving the page's own APIs
      eval(fn as string)(notes, 0.6, "triangle", "solo-file"),
    [SYNTH, [[64], [67], [71], [76]]] as const,
  );

  await expect(page).toHaveURL(/\/new\?id=/, { timeout: 90_000 });

  const value = await page.getByLabel("tablature").inputValue();
  expect(value).toContain("[take 1]");
  // Every detected pitch must land on a fret that actually produces it.
  for (const fret of ["0", "3", "7", "12"]) {
    expect(value).toContain(fret);
  }
  await expect(page.getByText("grid is square.")).toBeVisible();
});

test("a chord progression becomes a chord sheet", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/listen");

  // Am, C, G, F as plain triads.
  await page.evaluate(
    ([fn, chords]) =>
      // biome-ignore lint/security/noGlobalEval: driving the page's own APIs
      eval(fn as string)(chords, 2, "sawtooth", "audio-file"),
    [
      SYNTH,
      [
        [57, 60, 64],
        [60, 64, 67],
        [55, 59, 62],
        [53, 57, 60],
      ],
    ] as const,
  );

  await expect(page).toHaveURL(/\/new\?id=/, { timeout: 90_000 });

  const value = await page.getByLabel("tablature").inputValue();
  expect(value).toContain("[chords]");
  for (const chord of ["Am", "C", "F"]) {
    expect(value).toContain(chord);
  }
});

test("/listen reaches the page from the prompt", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("/listen");
  await prompt.press("Enter");
  await expect(page).toHaveURL(/\/listen/);
});
