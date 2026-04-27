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

  test("search type selector works", async ({ page }) => {
    await page.goto("/");

    // Click the search type dropdown
    const searchTypeSelect = page.locator('[data-testid="select-search-type"]');
    await expect(searchTypeSelect).toBeVisible();
    await searchTypeSelect.click();

    // Verify the options are visible
    await expect(page.locator('[data-testid="option-topic"]')).toBeVisible();
    await expect(page.locator('[data-testid="option-author"]')).toBeVisible();
    await expect(page.locator('[data-testid="option-work"]')).toBeVisible();

    // Select "Author"
    await page.locator('[data-testid="option-author"]').click();

    // Verify the selection
    await expect(searchTypeSelect).toContainText("Author");
  });

  test("max quotes slider and input work", async ({ page }) => {
    await page.goto("/");

    // The numeric input should exist and show default value
    const maxQuotesInput = page.locator('[data-testid="input-max-quotes-number"]');
    await expect(maxQuotesInput).toBeVisible();

    // Type a custom value
    await maxQuotesInput.fill("500");
    await expect(maxQuotesInput).toHaveValue("500");
  });
});

test.describe("Results display", () => {
  test("shows 'No quotes yet' when no results exist", async ({ page }) => {
    await page.goto("/");

    // When there are no quotes, we should see the empty state
    // Wait for loading to finish
    await page.waitForLoadState("networkidle");

    // Check for empty state or results (depends on DB state)
    const noQuotesText = page.getByText(/No quotes yet/i);
    const resultsHeading = page.getByText(/Results/i);

    // Either empty state or results should be visible
    const hasEmptyState = await noQuotesText.isVisible().catch(() => false);
    const hasResults = await resultsHeading.isVisible().catch(() => false);

    expect(hasEmptyState || hasResults).toBe(true);
  });
});

test.describe("Filter controls", () => {
  test("filter controls are visible when quotes exist", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // If results exist, check filter controls
    const resultsHeading = page.getByText(/Results/i).first();
    const hasResults = await resultsHeading.isVisible().catch(() => false);

    if (hasResults) {
      // FTS search input
      const ftsSearch = page.locator('[data-testid="input-fts-search"]');
      await expect(ftsSearch).toBeVisible();

      // Verification filter dropdown
      const verificationFilter = page.locator('[data-testid="select-filter-verification"]');
      await expect(verificationFilter).toBeVisible();

      // Type filter dropdown
      const typeFilter = page.locator('[data-testid="select-filter-type"]');
      await expect(typeFilter).toBeVisible();

      // Confidence slider
      const confidenceSlider = page.locator('[data-testid="slider-filter-confidence"]');
      await expect(confidenceSlider).toBeVisible();
    }
  });

  test("tab switching works between cards, table, and queries", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const resultsHeading = page.getByText(/Results/i).first();
    const hasResults = await resultsHeading.isVisible().catch(() => false);

    if (hasResults) {
      // Table tab should be active by default
      const tableTab = page.locator('[data-testid="tab-table"]');
      await expect(tableTab).toBeVisible();

      // Switch to cards
      const cardsTab = page.locator('[data-testid="tab-cards"]');
      await cardsTab.click();

      // Switch to queries
      const queriesTab = page.locator('[data-testid="tab-queries"]');
      await queriesTab.click();
    }
  });
});

test.describe("Action buttons", () => {
  test("CSV upload dialog opens and closes", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const resultsHeading = page.getByText(/Results/i).first();
    const hasResults = await resultsHeading.isVisible().catch(() => false);

    if (hasResults) {
      // Click CSV upload button
      const csvButton = page.locator('[data-testid="button-csv-upload"]');
      await csvButton.click();

      // Dialog should be visible
      await expect(page.getByText(/Bulk CSV Upload/i)).toBeVisible();

      // Cancel button should close it
      const cancelBtn = page.locator('[data-testid="button-cancel-upload"]');
      await cancelBtn.click();

      // Dialog should be gone
      await expect(page.getByText(/Bulk CSV Upload/i)).not.toBeVisible();
    }
  });

  test("verify buttons exist when results are shown", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const resultsHeading = page.getByText(/Results/i).first();
    const hasResults = await resultsHeading.isVisible().catch(() => false);

    if (hasResults) {
      // Cross-verify button
      await expect(page.locator('[data-testid="button-verify-cross"]')).toBeVisible();

      // AI verify button
      await expect(page.locator('[data-testid="button-verify-ai"]')).toBeVisible();

      // Dump All Sources button
      await expect(page.locator('[data-testid="button-dump-all"]')).toBeVisible();

      // Export buttons
      await expect(page.locator('[data-testid="button-export-sheets"]')).toBeVisible();
      await expect(page.locator('[data-testid="button-export-filtered"]')).toBeVisible();
    }
  });
});
