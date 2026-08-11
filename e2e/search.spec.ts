import { expect, test } from "@playwright/test";

// The e2e web server runs with TAB_PROVIDERS=local (playwright.config.ts),
// so every result below comes from src/data/seed-tabs.ts.

test("a single match opens straight from the prompt", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("greensleeves");

  await expect(page.getByRole("button", { name: /greensleeves/i })).toBeVisible();
  await prompt.press("Enter");

  await expect(page).toHaveURL(/\/song\/local\/greensleeves/);
  await expect(page.getByRole("heading", { name: "Greensleeves" })).toBeVisible();
  await expect(page.locator(".tab-content").first()).toBeVisible();
});

test("multiple matches land on the results screen", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("traditional");

  await expect(page.getByRole("button", { name: /greensleeves/i })).toBeVisible();
  await prompt.press("Enter");

  await expect(page).toHaveURL(/view=results/);
  const row = page.getByRole("link", { name: /house of the rising sun/i });
  await expect(row).toBeVisible();
  await row.click();

  await expect(page).toHaveURL(/\/song\/local\/house-of-the-rising-sun/);
});

test("the query is kept in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("search for a song").fill("ode to joy");
  await expect(page).toHaveURL(/q=ode(\+|%20)to(\+|%20)joy/);
});

test("an unknown song reports no match", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("zzzzqqq");

  await expect(page.getByText(/no match for/i)).toBeVisible();
  await prompt.press("Enter");

  await expect(page).toHaveURL(/view=results/);
  await expect(page.getByText(/no match in index/i)).toBeVisible();
});

test("results and the tab page say what the reader gets", async ({ page }) => {
  await page.goto("/?q=greensleeves&view=results");

  const row = page.getByRole("link", { name: /Greensleeves/i }).first();
  await expect(row).toContainText("audio");

  await row.click();
  await expect(page.getByTitle("tab + audio")).toBeVisible();
});

test("every tab in the library is playable", async ({ page }) => {
  // The library is guitar tablature only, so nothing should land on the silent
  // branch. If one does, either the tab is broken or the parser is.
  for (const id of ["greensleeves", "scarborough-fair", "ode-to-joy", "canon-in-d"]) {
    await page.goto(`/song/local/${id}`);
    await expect(page.getByTitle("tab + audio")).toBeVisible();
    await expect(page.getByRole("button", { name: "▶ play" })).toBeVisible();
  }
});

test("the digital guitar plays a tab and walks a cursor across it", async ({ page }) => {
  await page.goto("/song/local/greensleeves");

  // The badge must not promise sound the player cannot deliver.
  await expect(page.getByTitle("tab + audio")).toBeVisible();

  const play = page.getByRole("button", { name: "▶ play" });
  await play.click();

  // A visible cursor means the scheduler is running off the audio clock: if the
  // AudioContext were suspended, currentTime would not advance and the cursor
  // would never appear.
  await expect(page.getByRole("button", { name: "■ stop" })).toBeVisible();
  await expect(page.locator('[data-testid="tab-cursor"]')).toBeVisible();

  await page.getByRole("button", { name: "■ stop" }).click();
  await expect(page.locator('[data-testid="tab-cursor"]')).toHaveCount(0);
});

test("tab completes a partial command", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/art");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/artist ");
});

test("tab cycles through the provider values", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/src");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/src ");

  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/src all");

  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/src local");

  // Shift+Tab walks back.
  await prompt.press("Shift+Tab");
  await expect(prompt).toHaveValue("/src all");
});

test("/src narrows which source is searched", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/src local");
  await prompt.press("Enter");
  // Running the command clears the prompt and records the choice.
  await expect(prompt).toHaveValue("");

  await prompt.fill("greensleeves");
  await prompt.press("Enter");
  await expect(page.getByText(/sources: local/)).toBeVisible();
});

test("a client cannot switch on a source the server disabled", async ({ request }) => {
  // Asking for a source that is not enabled must yield nothing rather than
  // quietly falling back to every provider.
  const res = await request.get("/api/search?q=greensleeves&provider=nope");
  expect(res.ok()).toBe(true);
  expect((await res.json()).results).toEqual([]);
});

test("the idle prompt shows the day's quote, and typing replaces it", async ({ page }) => {
  await page.goto("/");

  const fortune = page.getByRole("blockquote");
  await expect(page.getByText("$ fortune")).toBeVisible();
  await expect(fortune).toBeVisible();
  // Server-rendered, so it carries an attribution from the first byte.
  await expect(fortune.locator("footer")).toContainText("—");

  await page.getByLabel("search for a song").fill("greensleeves");
  await expect(fortune).toBeHidden();
});

test("/random opens some tab from the hosted library", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/random");
  await prompt.press("Enter");

  await expect(page).toHaveURL(/\/song\/local\/[a-z-]+/);
  await expect(page.locator(".tab-content").first()).toBeVisible();
});

test("/random says so when the narrowed source cannot be browsed", async ({ page }) => {
  // A source that is not enabled has nothing to draw from, and that is a state,
  // not a crash.
  await page.goto("/random?src=nope");

  await expect(page.getByText(/nothing to draw from/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /back to prompt/i })).toBeVisible();
});

test("the header carries no source chip", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^src:/ })).toHaveCount(0);
});

test("the theme button cycles themes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /theme: paper/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "crt");
});
