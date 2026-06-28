/**
 * E2E tests for the protected Dashboard page.
 *
 * Auth state is loaded from e2e/fixtures/auth-state.json (created by auth.setup.ts).
 * The Spring Boot API is intercepted via page.route() so tests run without a backend.
 *
 * storageState (set in playwright.config.ts for this project) injects the saved
 * MSAL token cache into the browser before each test, making the app think
 * the user is already logged in.
 */

import { test, expect } from "@playwright/test";

// Mock the Spring Boot API for all dashboard tests
test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          name: "Test User",
          email: "testuser@demo.com",
          objectId: "mock-oid-12345",
          roles: ["User"],
        },
        scopes: "data.read openid profile",
        dashboard: [
          { metric: "Active Users",    value: 1234 },
          { metric: "Monthly Revenue", value: "$45,678" },
          { metric: "Open Tickets",    value: 42 },
          { metric: "Deployments",     value: 7 },
        ],
        message: "Welcome Test User! Role: General User",
      }),
    })
  );

  // Admin endpoint — not called for User role, but mock it to avoid 404
  await page.route("**/api/dashboard/admin", (route) =>
    route.fulfill({ status: 403 })
  );
});

test.describe("Dashboard page — User role", () => {
  test("authenticated user can access /dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("displays the user's name and email", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Test User")).toBeVisible();
    await expect(page.getByText("testuser@demo.com")).toBeVisible();
  });

  test("displays the User role badge", async ({ page }) => {
    await page.goto("/dashboard");

    // Role badge rendered in the user card
    const badge = page.locator("span", { hasText: "User" }).first();
    await expect(badge).toBeVisible();
  });

  test("displays dashboard metrics", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Active Users")).toBeVisible();
    await expect(page.getByText("1234")).toBeVisible();
    await expect(page.getByText("Open Tickets")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible();
  });

  test("does NOT show admin panel for User role", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for dashboard to load
    await expect(page.getByText("Active Users")).toBeVisible();

    await expect(page.getByText(/admin panel/i)).not.toBeVisible();
  });

  test("shows a Sign out button in the header", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("button", { name: /sign out/i })
    ).toBeVisible();
  });

  test("unauthenticated user is redirected away from /dashboard", async ({
    browser,
  }) => {
    // Create a fresh context with NO stored auth state
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();

    await freshPage.goto("/dashboard");

    // The dashboard/page.tsx redirects to "/" when not authenticated
    await expect(freshPage).toHaveURL("/");

    await freshCtx.close();
  });
});

test.describe("Dashboard page — Admin role", () => {
  test.beforeEach(async ({ page }) => {
    // Override to return Admin role
    await page.route("**/api/dashboard/data", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            name: "Alice Admin",
            email: "alice@demo.com",
            objectId: "admin-oid",
            roles: ["Admin"],
          },
          scopes: "data.read",
          dashboard: [{ metric: "Active Users", value: 99 }],
          message: "Welcome Alice Admin! Role: Administrator",
        }),
      })
    );

    await page.route("**/api/dashboard/admin", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          adminMessage: "You have Admin access, Alice Admin.",
          sensitiveData: [
            { user: "alice@demo.com", role: "Admin", lastLogin: "2026-06-27" },
            { user: "bob@demo.com",   role: "User",  lastLogin: "2026-06-26" },
          ],
          systemHealth: { database: "OK", cache: "OK", apiGateway: "OK" },
        }),
      })
    );
  });

  test("Admin role sees the Admin Panel", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/admin panel/i)).toBeVisible();
  });

  test("Admin Panel shows system health", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("database: OK")).toBeVisible();
  });

  test("Admin Panel shows user list", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("alice@demo.com")).toBeVisible();
    await expect(page.getByText("bob@demo.com")).toBeVisible();
  });
});
