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

test("a result row opens the tab it names", async ({ page }) => {
  await page.goto("/?q=greensleeves&view=results");

  await page
    .getByRole("link", { name: /Greensleeves/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Greensleeves" })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ play" })).toBeVisible();
});

test("a tab page says nothing about where the tab came from", async ({ page }) => {
  await page.goto("/song/local/greensleeves");

  // Every tab is the reader's own, so authorship and source are noise. What is
  // left is how to play it.
  await expect(page.getByText(/source:/i)).toHaveCount(0);
  await expect(page.getByText(/transcribed by/i)).toHaveCount(0);
  await expect(page.getByText(/tab \+ audio/i)).toHaveCount(0);
  await expect(page.getByText(/tuning E A D G B E/)).toBeVisible();
});

test("every tab in the library is playable", async ({ page }) => {
  // The library is guitar tablature only, so nothing should land on the silent
  // branch. If one does, either the tab is broken or the parser is.
  for (const id of ["greensleeves", "scarborough-fair", "ode-to-joy", "canon-in-d"]) {
    await page.goto(`/song/local/${id}`);
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
    // Prose blocks render in a `pre.tab-content` too, so pick the first one
    // that actually holds a stave.
    const pre = [...document.querySelectorAll("main pre.tab-content")].find((el) =>
      /^[A-Ga-g]\|/m.test(el.textContent ?? ""),
    );
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

test("a stave fits the reading column, so tablature never scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/song/local/canon-in-d");

  // A stave that has to be dragged left and right is unreadable — the whole
  // point of the fixed grid is counting straight down a column. The column is
  // sized to a stave rather than the stave squeezed into the column.
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("main pre.tab-content")].map(
      (el) => el.scrollWidth - el.clientWidth,
    ),
  );

  expect(overflow.length).toBeGreaterThan(0);
  for (const over of overflow) expect(over).toBe(0);
});

test("the digital guitar plays a tab and walks a cursor across it", async ({ page }) => {
  await page.goto("/song/local/greensleeves");

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

test("the header offers the repo, and opens it away from the app", async ({ page }) => {
  await page.goto("/");

  const star = page.getByRole("link", { name: /star this repo/i });
  await expect(star).toHaveAttribute("href", /github\.com/);
  // Leaving the site in the same tab would drop whatever was being read, and
  // `noopener` is what stops the opened page from reaching back through
  // `window.opener`.
  await expect(star).toHaveAttribute("target", "_blank");
  await expect(star).toHaveAttribute("rel", /noopener/);
});

test("the man page documents writing, and no longer a focus mode that is gone", async ({
  page,
}) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("/man");
  await prompt.press("Enter");

  const dialog = page.getByRole("dialog", { name: "man tabsterm" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/WRITING/)).toBeVisible();
  await expect(dialog.getByText(/READING/)).toHaveCount(0);
  await expect(dialog.getByText(/clears the page down to the stave/i)).toHaveCount(0);
});

test("with no account server, the modal says so instead of offering a dead button", async ({
  page,
}) => {
  // This is the configuration a clean clone runs in, and the one this suite is
  // pinned to. The account button still exists, because tabs in a browser are
  // still an answer to "where is my work" — it just has to be an honest one.
  await page.goto("/");
  await page.getByRole("button", { name: "account" }).click();

  const dialog = page.getByRole("dialog", { name: "account" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/no account server configured/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /continue with google/i })).toHaveCount(0);

  // No password anywhere near this product any more.
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await expect(dialog.getByText("signup", { exact: true })).toHaveCount(0);
});

test("there is no focus mode", async ({ page }) => {
  await page.goto("/song/local/greensleeves");

  // It widened the reading column past the width a stave measures and hid the
  // path to the tab — a second way to look at one screen, for a page that has
  // nothing on it but the tablature already.
  await expect(page.getByRole("button", { name: /focus/ })).toHaveCount(0);
  await page.keyboard.press("f");
  await expect(page.getByText("open local/greensleeves")).toBeVisible();
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
  await expect(page.getByText(/\d+ results/)).toBeVisible();
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

test("the results header counts what came back, and names no source", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("greensleeves");
  await prompt.press("Enter");

  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await expect(page.getByText(/sources:/)).toHaveCount(0);
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

  const quote = page.getByRole("blockquote");
  await expect(quote).toBeVisible();
  // Server-rendered, so it carries an attribution from the first byte.
  await expect(quote.locator("footer")).toContainText("—");

  // No `$ fortune` above it: nobody ran that command, and labelling the one
  // quiet thing on the screen as output made it read as noise.
  await expect(page.getByText("$ fortune")).toHaveCount(0);

  await page.getByLabel("search for a song").fill("greensleeves");
  await expect(quote).toBeHidden();
});

test("/list shows the whole library on the results screen", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/list");
  await prompt.press("Enter");

  await expect(page.getByText("list --all")).toBeVisible();
  await expect(page.getByText(/\d+ tabs/)).toBeVisible();

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
  await expect(page.getByText(/\d+ results/)).toBeVisible();

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

test("everyone arrives on crt, and the header no longer offers a switch", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "crt");
  await expect(page.getByRole("button", { name: /theme/i })).toHaveCount(0);
});

test("the theme is still reachable, from the prompt", async ({ page }) => {
  // Taking the button out must not strand the setting. `/theme` is the way in
  // from here; `t` is the way in from a tab, where the prompt is not eating
  // the keystroke.
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");

  await prompt.fill("/theme");
  await prompt.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "crt");
});
