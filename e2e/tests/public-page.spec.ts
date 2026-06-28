/**
 * E2E tests for the public home page.
 *
 * No authentication required.
 * The page fetches data server-side using an app token.
 * In tests, we intercept the Next.js internal API call to avoid needing
 * a real Azure AD client secret.
 */

import { test, expect } from "@playwright/test";

test.describe("Public home page", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the internal Next.js API route that gets the app token + calls Spring Boot.
    // This allows the test to run without Azure AD or a running Spring Boot server.
    await page.route("**/api/public-data", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "This is public data fetched by the Next.js server using an application token.",
          items: [
            { id: 1, title: "Spring Boot",  description: "Java backend framework" },
            { id: 2, title: "Next.js",      description: "React framework for production" },
            { id: 3, title: "Azure MSAL",   description: "Microsoft authentication library" },
          ],
          tokenType: "application (client credentials)",
          tokenSubject: "mock-service-principal",
        }),
      });
    });
  });

  test("page loads and shows public data section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /azure msal/i })).toBeVisible();
    await expect(page.getByText(/public api data/i)).toBeVisible();
  });

  test("displays all three items from the API", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Spring Boot")).toBeVisible();
    await expect(page.getByText("Next.js")).toBeVisible();
    await expect(page.getByText("Azure MSAL")).toBeVisible();
  });

  test("shows the token type badge", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText(/application \(client credentials\)/i)
    ).toBeVisible();
  });

  test("shows a Sign in button", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /sign in with microsoft/i })
    ).toBeVisible();
  });

  test("shows error fallback when API is unavailable", async ({ page }) => {
    // Override to simulate backend failure
    await page.route("**/api/public-data", (route) =>
      route.fulfill({ status: 500 })
    );

    await page.goto("/");

    await expect(
      page.getByText(/could not load data/i)
    ).toBeVisible();
  });

  test("page title is set correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/azure msal/i);
  });
});
