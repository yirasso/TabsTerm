import { expect, test } from "@playwright/test";

// Ragged lengths and a two-digit fret — the two things that break the grid.
const RAGGED = `[riff]
e|--0--3--12
B|--1
G|--0--0--2--
D|--2
A|--3
E|-----------`;

test("write, align, publish, then find it in search", async ({ page }) => {
  await page.goto("/new");

  await page.getByLabel("title").fill("Test Riff");
  await page.getByLabel("artist").fill("Nobody");
  await page.getByLabel("tablature").fill(RAGGED);

  // The grid check names the mismatched widths rather than just complaining.
  await expect(page.getByText(/stave lines are .* characters/)).toBeVisible();

  await page.getByRole("button", { name: "align grid" }).click();
  await expect(page.getByText("grid is square.")).toBeVisible();

  // Every position is now two characters, so a 12 measures the same as a 0 and
  // the strings still line up under each other.
  const aligned = await page.getByLabel("tablature").inputValue();
  const staves = aligned.split("\n").filter((l) => /^[A-Ga-g]\|/.test(l));
  expect(new Set(staves.map((l) => l.length)).size).toBe(1);
  expect(staves[0]).toContain("12");
  expect(staves[0]).toContain("0-");

  await page.getByRole("button", { name: "publish" }).click();
  await expect(page).toHaveURL(/\/draft\/[a-z0-9]+/);
  await expect(page.getByRole("heading", { name: "Test Riff" })).toBeVisible();
  // A stave means the player has notes, so the badge must say so.
  await expect(page.getByTitle("tab + audio")).toBeVisible();

  await page.goto("/?q=test+riff");
  await expect(page.getByRole("button", { name: /Test Riff/ })).toBeVisible();
});

test("the stave helper inserts a square grid", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "+ stave" }).click();

  const value = await page.getByLabel("tablature").inputValue();
  const lines = value.trim().split("\n");
  expect(lines).toHaveLength(6);
  expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  await expect(page.getByText("grid is square.")).toBeVisible();
});

test("publishing is refused until there is something to publish", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByRole("button", { name: "publish" })).toBeDisabled();

  await page.getByLabel("title").fill("Only a title");
  await expect(page.getByRole("button", { name: "publish" })).toBeDisabled();

  await page.getByRole("button", { name: "+ stave" }).click();
  await expect(page.getByRole("button", { name: "publish" })).toBeEnabled();
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
  await expect(page.getByLabel("tablature")).toBeVisible();
});
