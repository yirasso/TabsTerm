import { expect, type Page, test } from "@playwright/test";

// Ragged lengths and a two-digit fret — the two things that break the grid.
const RAGGED = `[riff]
e|--0--3--12
B|--1
G|--0--0--2--
D|--2
A|--3
E|-----------`;

/** A stave with frets on it, which is what makes a tab playable. */
const PLAYABLE = `e|0-------3-------7-------12------|
B|--------------------------------|
G|--------------------------------|
D|--------------------------------|
A|--------------------------------|
E|--------------------------------|`;

/** Two staves and a line of prose, so each has to be removable on its own. */
const TWO_STAVES = `e|-----------
B|-----------
G|-----------
D|-----------
A|-----------
E|-----------

play it softly

e|-----------
B|-----------
G|-----------
D|-----------
A|-----------
E|-----------`;

/** A cell in the grid. Exact, or "position 1" also matches "position 10". */
const cell = (string: number, position: number, fret?: number) => ({
  name: `string ${string}, position ${position}${fret === undefined ? "" : `, fret ${fret}`}`,
  exact: true,
});

/**
 * The tab as it is actually stored. There is no text box to read any more, and
 * the store is the thing that would be published, so it is the honest source.
 */
function content(page: Page): Promise<string> {
  return page.evaluate(() => {
    const drafts: Record<string, { content: string; updatedAt: number }> =
      JSON.parse(localStorage.getItem("tabsterm-drafts") ?? "{}")?.state?.drafts ?? {};
    return Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.content ?? "";
  });
}

/** Open the editor on a draft that already has something in it. */
async function openWith(page: Page, tab: string) {
  await page.addInitScript((text) => {
    // Runs on every navigation, so seed only when there is nothing there — or
    // it would wipe whatever the editor saved on the way to the next page.
    if (localStorage.getItem("tabsterm-drafts")) return;
    localStorage.setItem(
      "tabsterm-drafts",
      JSON.stringify({
        state: {
          drafts: {
            seed: {
              id: "seed",
              title: "Seeded",
              artist: "",
              type: "tab",
              tuning: ["E", "A", "D", "G", "B", "E"],
              capo: 0,
              content: text,
              published: false,
              updatedAt: 1,
            },
          },
        },
        version: 1,
      }),
    );
  }, tab);
  await page.goto("/new?id=seed");
}

const staveLines = (tab: string) => tab.split("\n").filter((l) => /^[A-Ga-g]\|/.test(l));

test("a ragged tab squares itself up when touched, and can be saved and found", async ({
  page,
}) => {
  await openWith(page, RAGGED);

  // The grid check names the mismatched widths rather than just complaining.
  await expect(page.getByText(/stave lines are .* characters/)).toBeVisible();

  // There is no align button any more: writing through the grid is what squares
  // the stave, because a cell is written back at a fixed width whatever it
  // replaced. One edit anywhere rewrites the whole stave.
  // The bottom string is all dashes in this fixture, so its cells carry the
  // bare label — `cell()` matches exactly, and a cell holding a fret is named
  // differently.
  await page.getByRole("button", cell(6, 1)).click();
  await page.keyboard.press("5");
  await expect(page.getByText("grid is square.")).toBeVisible();

  // Polled, because autosave is debounced and the store is a moment behind.
  await expect
    .poll(() => content(page).then((t) => new Set(staveLines(t).map((l) => l.length)).size))
    .toBe(1);

  const lines = staveLines(await content(page));
  expect(lines[0]).toContain("12");

  await page.getByLabel("title").fill("Test Riff");
  await page.getByRole("button", { name: "save" }).click();
  await expect(page).toHaveURL(/\/draft\/[a-z0-9]+/);
  await expect(page.getByRole("heading", { name: "Test Riff" })).toBeVisible();
  // A stave means the player has notes, so the bar must offer to play them.
  await expect(page.getByRole("button", { name: "▶ play" })).toBeVisible();

  await page.goto("/?q=test+riff");
  await expect(page.getByRole("button", { name: /Test Riff/ })).toBeVisible();
});

test("the editor opens with nothing to click and says so", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByText(/nothing here yet/i)).toBeVisible();
  // No text box: the grid is the only way in.
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("the editor asks for a title, an artist, a tuning and a capo — and no more", async ({
  page,
}) => {
  await page.goto("/new");

  await expect(page.getByLabel("title")).toBeVisible();
  await expect(page.getByLabel("artist")).toBeVisible();
  await expect(page.getByLabel("tuning")).toBeVisible();
  await expect(page.getByLabel("capo")).toBeVisible();

  // Difficulty is gone: it was a judgement nobody was asking for about a tab
  // only its own author reads.
  await expect(page.getByText("level", { exact: true })).toHaveCount(0);

  // Both name their field rather than proposing a value. "Greensleeves" and
  // "Traditional" read as data someone might leave in by accident.
  await expect(page.getByLabel("title")).toHaveAttribute("placeholder", "title");
  await expect(page.getByLabel("artist")).toHaveAttribute("placeholder", "artist");
});

test("the stave helper inserts a square grid", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  await expect(page.getByRole("button", cell(1, 1))).toBeVisible();
  await expect.poll(() => content(page).then(staveLines)).toHaveLength(6);

  const lines = staveLines(await content(page));
  expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  await expect(page.getByText("grid is square.")).toBeVisible();
});

test("saving is refused until there is something to save", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByRole("button", { name: "save" })).toBeDisabled();

  await page.getByLabel("title").fill("Only a title");
  await expect(page.getByRole("button", { name: "save" })).toBeDisabled();

  await page.getByRole("button", { name: "+ stave" }).click();
  await expect(page.getByRole("button", { name: "save" })).toBeEnabled();
});

test("the controls that could only be on are gone", async ({ page }) => {
  await page.goto("/new");

  // Autoscroll and align-grid were both toggles for something that has to be
  // true anyway: a cursor you cannot see is not a cursor, and the grid can no
  // longer be written out of square.
  await expect(page.getByRole("button", { name: /autoscroll/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "align grid" })).toHaveCount(0);
});

test("clicking a position and typing a fret writes it into the tab", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  // Third string, fourth position — a cell that starts out empty.
  await page.getByRole("button", cell(3, 4)).click();
  await page.keyboard.press("7");

  await expect(page.getByRole("button", cell(3, 4, 7))).toBeVisible();
  await expect.poll(() => content(page).then((t) => staveLines(t)[2])).toContain("7");
});

test("a two-digit fret does not push the other strings sideways", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  // The failure this whole design exists to prevent: `12` is two characters
  // where `-` was one, and in raw text every string below would now be off.
  await page.getByRole("button", cell(1, 2)).click();
  await page.keyboard.press("1");
  await page.keyboard.press("2");

  await expect(page.getByRole("button", cell(1, 2, 12))).toBeVisible();
  await expect
    .poll(() => content(page).then((t) => new Set(staveLines(t).map((l) => l.length)).size))
    .toBe(1);
  await expect(page.getByText("grid is square.")).toBeVisible();
});

test("the selected position blinks, and only that one", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  const blinking = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button[aria-label^="string"]')]
        .filter((el) => getComputedStyle(el).animationName === "tt-caret")
        .map((el) => el.getAttribute("aria-label")),
    );

  expect(await blinking()).toEqual([]);

  await page.getByRole("button", cell(2, 3)).click();
  expect(await blinking()).toEqual(["string 2, position 3"]);

  // The blink follows the selection rather than piling up behind it.
  await page.keyboard.press("ArrowRight");
  expect(await blinking()).toEqual(["string 2, position 4"]);
});

test("arrows move between positions and backspace clears one", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  await page.getByRole("button", cell(1, 1)).click();
  await page.keyboard.press("5");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("3");

  // Keys go to whatever is focused, so this fails unless the focus followed
  // the selection.
  await expect(page.getByRole("button", cell(1, 1, 5))).toBeVisible();
  await expect(page.getByRole("button", cell(2, 2, 3))).toBeVisible();

  await page.keyboard.press("Backspace");
  await expect(page.getByRole("button", cell(2, 2, 3))).toHaveCount(0);
});

test("there are no sections to write", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByRole("button", { name: "+ section" })).toHaveCount(0);
});

test("a stave and a line of prose can each be removed on their own", async ({ page }) => {
  await openWith(page, TWO_STAVES);

  const staves = () => content(page).then((t) => staveLines(t).length);
  expect(await staves()).toBe(12);

  // The remove control belongs to whichever block you clicked, so taking the
  // prose out leaves both staves standing.
  await page.getByRole("button", { name: "remove text" }).click();
  await expect.poll(() => content(page)).not.toContain("play it softly");
  await expect.poll(staves).toBe(12);

  await page.getByRole("button", { name: "remove stave" }).first().click();
  await expect.poll(staves).toBe(6);
});

test("two staves added in a row stay two staves", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();
  await page.getByRole("button", { name: "+ stave" }).click();

  // Without a blank line between them the parser reads one twelve-string stave,
  // which falls back to a six-string tuning and plays half of itself.
  await expect(page.getByRole("button", { name: "remove stave" })).toHaveCount(2);
  await expect.poll(() => content(page).then(staveLines)).toHaveLength(12);
});

test("the editor plays what is being written, and walks a cursor over it", async ({ page }) => {
  await page.goto("/new");

  // Nothing to play yet, so the bar says so rather than offering a dead button.
  await expect(page.getByText("no stave to play — text only")).toBeVisible();

  // An empty stave is still nothing to play — it is the frets that make sound.
  await page.getByRole("button", { name: "+ stave" }).click();
  await expect(page.getByText("no stave to play — text only")).toBeVisible();

  await page.getByRole("button", cell(1, 1)).click();
  await page.keyboard.press("5");
  await page.getByRole("button", { name: "▶ play" }).click();

  // Chromium headless has no audio device, so the cursor is what proves the
  // player is running. It marks a column, so it lands on every string at once.
  await expect(page.getByRole("button", { name: "■ stop" })).toBeVisible();
  await expect(page.locator('[data-testid="tab-cursor"]').first()).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "■ stop" }).click();
  await expect(page.locator('[data-testid="tab-cursor"]')).toHaveCount(0);
});

test("the editor's tempo control changes the tempo", async ({ page }) => {
  await openWith(page, PLAYABLE);

  await expect(page.getByText("96 bpm")).toBeVisible();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.getByText("100 bpm")).toBeVisible();
});

test("a draft from another browser is explained, not crashed", async ({ page }) => {
  await page.goto("/draft/doesnotexist");
  await expect(page.getByText(/no such draft in this browser/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /write a new one/i })).toBeVisible();
});

test("/new reaches the editor from the prompt", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("/new");
  await prompt.press("Enter");
  await expect(page).toHaveURL(/\/new/);
  await expect(page.getByRole("button", { name: "+ stave" })).toBeVisible();
});
