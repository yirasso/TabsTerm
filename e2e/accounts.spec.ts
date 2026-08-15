import { expect, test } from "@playwright/test";

/**
 * The suite that needs a real account server, and is skipped without one.
 *
 * `npm run test:e2e` pins the Supabase variables empty so the committed suite
 * is deterministic and offline; these assertions are about what happens when
 * that server *does* exist and nobody is signed into it, which that pinned
 * configuration cannot express. Run them with:
 *
 *   E2E_ACCOUNTS=1 npx playwright test e2e/accounts.spec.ts
 *
 * Signing in is still not covered, and cannot be: Google's consent screen is
 * not drivable headlessly. Being *turned away* is, and that is the rule worth
 * pinning — it is the one that would silently stop applying.
 */
test.skip(process.env.E2E_ACCOUNTS !== "1", "needs a configured account server (E2E_ACCOUNTS=1)");

test("writing needs an account", async ({ page }) => {
  await page.goto("/new");

  await expect(page.getByText(/writing a tab needs an account/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();

  // Not the editor, by any of the doors into it.
  await expect(page.getByRole("button", { name: "+ stave" })).toHaveCount(0);
  await expect(page.getByLabel("title")).toHaveCount(0);

  // And no draft id minted into the URL for a tab that cannot be written.
  await expect(page).toHaveURL(/\/new$/);
});

test("a tab id in the URL does not get past it either", async ({ page }) => {
  await page.goto("/new?id=someone-elses");

  await expect(page.getByText(/writing a tab needs an account/i)).toBeVisible();
  await expect(page.getByLabel("title")).toHaveCount(0);
});

test("reading needs no account", async ({ page }) => {
  // The other half of the rule, and the half worth protecting: the library is
  // open, and only writing asks who you are.
  await page.goto("/song/local/greensleeves");

  await expect(page.getByRole("heading", { name: /greensleeves/i })).toBeVisible();
  await expect(page.getByText(/needs an account/i)).toHaveCount(0);
});

test("the prompt still reaches the gate rather than a dead end", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByLabel("search for a song");
  await prompt.fill("/new");
  await prompt.press("Enter");

  await expect(page).toHaveURL(/\/new/);
  await expect(page.getByText(/writing a tab needs an account/i)).toBeVisible();
});
