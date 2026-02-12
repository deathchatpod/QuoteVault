import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows the app header and search form", async ({ page }) => {
    await page.goto("/");

    // The main heading should be visible
    await expect(
      page.getByRole("heading", { name: /Quote Research & Verification/i })
    ).toBeVisible();

    // The search form card should be visible
    // Note: "Search for Quotes" is inside a collapsible trigger (button),
    // so it loses heading semantics — we match by text instead.
    await expect(page.getByText(/Search for Quotes/i).first()).toBeVisible();

    // The search input should be present and usable
    const searchInput = page.getByPlaceholder(
      /Enter a topic, author name, or work title/i
    );
    await expect(searchInput).toBeVisible();

    // The "Start Research" button should exist
    await expect(
      page.getByRole("button", { name: /Start Research/i })
    ).toBeVisible();
  });

  test("search button is disabled when the search box is empty", async ({
    page,
  }) => {
    await page.goto("/");

    // With no text entered, the button should be disabled
    const startButton = page.getByRole("button", { name: /Start Research/i });
    await expect(startButton).toBeDisabled();

    // Type something into the search box
    const searchInput = page.getByPlaceholder(
      /Enter a topic, author name, or work title/i
    );
    await searchInput.fill("Shakespeare");

    // Now the button should be enabled
    await expect(startButton).toBeEnabled();

    // Clear the input and confirm button goes back to disabled
    await searchInput.fill("");
    await expect(startButton).toBeDisabled();
  });
});
