import { Page, expect } from "@playwright/test";

export const DEMO_USERS: Record<string, { email: string; password: string; path: string }> = {
  admin: { email: "admin@amplivo.in", password: "Amplivo!Admin2026", path: "/admin" },
  sales: { email: "sales@amplivo.in", password: "Amplivo!Sales2026", path: "/sales" },
  hr: { email: "hr@amplivo.in", password: "Amplivo!Hr2026", path: "/hr" },
  employee: { email: "employee@amplivo.in", password: "Amplivo!Emp2026", path: "/employee" },
  crm: { email: "crm@amplivo.in", password: "Amplivo!Crm2026", path: "/crm" },
  finance: { email: "finance@amplivo.in", password: "Amplivo!Fin2026", path: "/crm/payments" },
};

/**
 * Logs in through the real UI using a demo account and waits for the
 * role-scoped redirect to settle. Returns the page in the authenticated state.
 */
export async function loginAs(page: Page, role: keyof typeof DEMO_USERS): Promise<void> {
  const demo = DEMO_USERS[role];
  await page.goto("/login");
  await page
    .getByPlaceholder("you@company.com")
    .fill(demo.email);
  await page
    .getByPlaceholder(/••••••/)
    .fill(demo.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(new RegExp(`^.*${escapeRegExp(demo.path)}`), { timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}