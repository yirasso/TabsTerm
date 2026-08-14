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

test("tablature renders in a real monospace font", async ({ page }) => {
  // Not a style preference: a proportional font makes `0` wider than `-`, so
  // stave lines with frets on them come out longer and the bar lines stop
  // agreeing. It fails silently, and only in the browser — which is why this
  // measures pixels rather than trusting the CSS.
  await page.goto("/song/local/canon-in-d");

  const measured = await page.evaluate(() => {
    const pre = document.querySelector("main pre.tab-content");
    if (!pre) return null;
    const style = getComputedStyle(pre);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    return {
      dash: ctx.measureText("-").width,
      zero: ctx.measureText("0").width,
      bar: ctx.measureText("|").width,
    };
  });

  expect(measured).not.toBeNull();
  expect(measured?.zero).toBe(measured?.dash);
  expect(measured?.bar).toBe(measured?.dash);
});

test("every stave line ends in the same place", async ({ page }) => {
  await page.goto("/song/local/canon-in-d");

  const widths = await page.evaluate(() => {
    const pre = document.querySelector("main pre.tab-content");
    const node = pre?.firstChild;
    if (!pre || !node) return [];

    const out: number[] = [];
    let offset = 0;
    for (const line of (pre.textContent ?? "").split("\n")) {
      if (/^[A-Ga-g]\|/.test(line)) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + line.length);
        out.push(Math.round(range.getBoundingClientRect().width));
      }
      offset += line.length + 1;
    }
    return out;
  });

  expect(widths.length).toBeGreaterThan(4);
  expect(new Set(widths).size).toBe(1);
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
  // Generous, because this waits on a real audio clock while the transcription
  // specs are saturating the CPU in another worker.
  await expect(page.locator('[data-testid="tab-cursor"]')).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "■ stop" }).click();
  await expect(page.locator('[data-testid="tab-cursor"]')).toHaveCount(0);
});

test("tab completes a partial command, and cycles the whole list", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/ra");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/rand");

  // No command takes an argument any more, so a bare slash is where cycling
  // lives: every command in turn, and shift walks back.
  await prompt.fill("/");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/new");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/list");
  await prompt.press("Shift+Tab");
  await expect(prompt).toHaveValue("/new");
});

test("the prompt no longer offers the commands that were removed", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  // Searching is what typing does; /tab and /artist were a longer way to say it.
  for (const gone of ["/fa", "/ta", "/art", "/au"]) {
    await prompt.fill(gone);
    await prompt.press("Tab");
    await expect(prompt).toHaveValue(gone);
  }

  await prompt.fill("greensleeves");
  await prompt.press("Enter");
  await expect(page.getByText(/results ·/)).toBeVisible();
});

test("the prompt no longer offers a source filter", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  // Which sources are searched is the operator's call, set by TAB_PROVIDERS.
  await prompt.fill("/sr");
  await prompt.press("Tab");
  await expect(prompt).toHaveValue("/sr");

  await prompt.fill("/src local");
  await prompt.press("Enter");
  await expect(page).toHaveURL(/^[^?]*\/(\?.*)?$/);
});

test("the results header still says which sources answered", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

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

test("/list shows the whole library on the results screen", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/list");
  await prompt.press("Enter");

  await expect(page.getByText("list --all")).toBeVisible();
  await expect(page.getByText(/\d+ tabs · sources: local/)).toBeVisible();

  // Every shipped tab, not the handful a query would have matched.
  for (const title of ["Greensleeves", "Scarborough Fair", "Ode to Joy"]) {
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }
});

test("listing is a bare results URL, so it can be shared", async ({ page }) => {
  await page.goto("/?view=results");

  await expect(page.getByText("list --all")).toBeVisible();
  await expect(page.getByRole("link", { name: /Greensleeves/ })).toBeVisible();
});

test("/list leaves the prompt empty, which is what puts it in listing mode", async ({ page }) => {
  await page.goto("/?q=greensleeves&view=results");
  await expect(page.getByText(/find/)).toBeVisible();

  await page.goto("/");
  await page.getByLabel("search for a song").fill("/list");
  await page.getByLabel("search for a song").press("Enter");

  await expect(page).toHaveURL(/view=results/);
  await expect(page).not.toHaveURL(/q=/);
});

test("/rand opens some tab from the hosted library", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  // The command is `/rand`; the route it lands on is still `/random`.
  await prompt.fill("/rand");
  await prompt.press("Enter");

  await expect(page).toHaveURL(/\/song\/local\/[a-z-]+/);
  await expect(page.locator(".tab-content").first()).toBeVisible();
});

test("the old /random command no longer runs", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/random");
  await prompt.press("Enter");

  // An unrecognised command does nothing — it must not search for its own name.
  await expect(page).toHaveURL(/^[^?]*\/(\?.*)?$/);
});

test("the /random route says so when the narrowed source cannot be browsed", async ({ page }) => {
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

test("the wordmark goes home, and drops whatever was being searched", async ({ page }) => {
  await page.goto("/?q=greensleeves&view=results");
  await expect(page.getByText(/results ·/)).toBeVisible();

  await page.getByRole("link", { name: "tabsterm" }).click();

  // Bare `/`, so the prompt comes back empty rather than holding the last query.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("search for a song")).toHaveValue("");
});

test("the wordmark goes home from a tab, too", async ({ page }) => {
  await page.goto("/song/local/greensleeves");
  await page.getByRole("link", { name: "tabsterm" }).click();
  await expect(page.getByLabel("search for a song")).toBeVisible();
});

test("the theme button cycles themes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /theme: paper/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "crt");
});
