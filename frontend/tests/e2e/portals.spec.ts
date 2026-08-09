import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Authenticated portal smoke tests.
 *
 * These hit the live backend (default http://localhost:8000/api/v1) and
 * require demo accounts seeded via the backend seed scripts. Keep the number
 * of auth logins low per run - the backend rate-limits login at 5/min.
 */
test.describe("role portals", () => {
  test("admin portal loads after login", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("crm portal loads after login", async ({ page }) => {
    await loginAs(page, "crm");
    await expect(page).toHaveURL(/\/crm/);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("sales portal loads after login", async ({ page }) => {
    await loginAs(page, "sales");
    await expect(page).toHaveURL(/\/sales/);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });
});