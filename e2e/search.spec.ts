import { expect, test } from "@playwright/test";

// The dev server for these tests runs with TAB_PROVIDERS=local (see
// playwright.config.ts), so results come only from src/data/seed-tabs.ts.

test("search finds a local tab and opens it", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("search for a song").fill("greensleeves");

  const result = page.getByRole("link", { name: /Traditional — Greensleeves/i });
  await expect(result).toBeVisible();

  await result.click();

  await expect(page).toHaveURL(/\/song\/local\/greensleeves/);
  await expect(page.getByRole("heading", { name: "Greensleeves" })).toBeVisible();
  await expect(page.getByText("E|-")).toBeVisible();
});

test("the query is kept in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("search for a song").fill("ode to joy");
  await expect(page).toHaveURL(/q=ode(\+|%20)to(\+|%20)joy/);
});

test("an unknown song reports no results", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("search for a song").fill("zzzzqqq");
  await expect(page.getByText(/No tabs found/i)).toBeVisible();
});
