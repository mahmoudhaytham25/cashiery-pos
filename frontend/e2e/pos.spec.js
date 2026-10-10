import { test, expect } from "@playwright/test";

const API_URL = process.env.POS_API_URL || "http://localhost:5000";
const POS_USER = process.env.POS_USER || "e2e-admin";
const POS_PASS = process.env.POS_PASS || "e2e-admin-pass";

// Every test logs in through the real form. Registration is attempted first:
// the very first user on a fresh DB becomes admin automatically; afterwards
// the endpoint is admin-gated, so a non-2xx here just means the user (or the
// user table) already exists.
test.beforeEach(async ({ page, request }) => {
  await request
    .post(`${API_URL}/api/auth/register`, {
      data: { username: POS_USER, password: POS_PASS, role: "admin" },
    })
    .catch(() => {});

  await page.goto("/login");
  await page.locator("#login-username").fill(POS_USER);
  await page.locator("#login-password").fill(POS_PASS);
  await page.locator("button[type=submit]").click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")))
    .toBeTruthy();
});

const authHeaders = async (page) => ({
  Authorization: `Bearer ${await page.evaluate(() =>
    localStorage.getItem("token")
  )}`,
});

// There's no product seed — provision via the API when nothing sellable
// exists so the POS grid has at least one enabled "Add to Cart" button.
async function ensureInStockProducts(page, request) {
  const headers = await authHeaders(page);
  const res = await request.get(`${API_URL}/api/products`, { headers });
  const products = res.ok() ? await res.json() : [];
  if (Array.isArray(products) && products.some((p) => Number(p.stock) > 0)) {
    return;
  }
  for (const name of ["E2E Widget", "E2E Gadget"]) {
    const created = await request.post(`${API_URL}/api/products`, {
      headers,
      data: { name: `${name} ${Date.now()}`, price: 9.99, stock: 25 },
    });
    expect(created.ok()).toBeTruthy();
  }
}

test("cashier can add products to the cart", async ({ page, request }) => {
  await ensureInStockProducts(page, request);

  await page.goto("/pos");
  await page.getByRole("button", { name: /show all/i }).click();

  const addButtons = page.getByRole("button", { name: "Add to Cart" });
  await expect(addButtons.first()).toBeVisible();
  const clicks = Math.min(await addButtons.count(), 2);
  for (let i = 0; i < clicks; i++) {
    await addButtons.nth(i).click();
  }

  // Each button belongs to a distinct product -> one cart line per click.
  await expect(page.locator(".cart-item")).toHaveCount(clicks);
  await expect(page.getByText(`Cart (${clicks} items)`)).toBeVisible();
});

test("admin sees the dashboard", async ({ page }) => {
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" })
  ).toBeVisible();
});
