import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Public marketing pages - these render without any backend dependency,
 * so they are the fastest, most reliable smoke coverage.
 */
const PUBLIC_PAGES = [
  "/",
  "/about",
  "/services",
  "/portfolio",
  "/case-studies",
  "/blog",
  "/faq",
  "/contact",
  "/careers",
  "/downloads",
  "/terms-of-service",
  "/privacy-policy",
  "/refund-policy",
  "/cookie-policy",
];

for (const path of PUBLIC_PAGES) {
  test(`public page renders: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    // The app must not crash into the global error page.
    await expect(page.locator("body")).not.toContainText("Application error");
    // Every page needs a top level heading for a11y sanity.
    await expect(page.locator("h1,h2").first()).toBeVisible();
  });
}

test("login page renders demo credential helper", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Demo", exact: false }).first()).toBeVisible();
  await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
  await expect(page.getByPlaceholder(/••••••/)).toBeVisible();
});

test("invalid login shows an error message", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill("nobody@amplivo.in");
  await page.getByPlaceholder(/••••••/).fill("WrongPass1");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.locator("text=/invalid|incorrect|wrong|network/i").first()).toBeVisible({
    timeout: 30_000,
  });
});