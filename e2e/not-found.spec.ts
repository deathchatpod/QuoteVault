import { test, expect } from "@playwright/test";

test.describe("404 page", () => {
  test("shows a not-found message for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    // Should display the 404 heading
    await expect(
      page.getByRole("heading", { name: /404 Page Not Found/i })
    ).toBeVisible();
  });
});
