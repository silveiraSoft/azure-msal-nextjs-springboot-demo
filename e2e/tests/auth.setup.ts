/**
 * auth.setup.ts — Playwright auth setup project.
 *
 * Problem with Azure AD in E2E tests:
 *   Real Azure AD login requires a browser popup, MFA, and live credentials.
 *   This is slow, fragile in CI, and exposes secrets.
 *
 * Solution — inject a fake MSAL session into sessionStorage:
 *   MSAL stores its token cache in sessionStorage under a specific key format.
 *   We write a mock cache entry directly, bypassing the real login flow.
 *   Playwright then saves the full browser storage state to a JSON file.
 *   Every test that needs auth loads this file via `storageState`.
 *
 * This approach:
 *   ✅ No real Azure AD credentials in tests
 *   ✅ Works offline / in CI
 *   ✅ Fast — no popup, no redirect
 *   ✅ Tests the app behaviour after auth, not the auth flow itself
 *
 * For E2E tests that MUST test the real Azure AD login flow:
 *   See the comment at the bottom of this file for the real-credentials approach.
 */

import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, "../fixtures/auth-state.json");

setup("inject mock MSAL auth state", async ({ page }) => {
  // Navigate to the app first so we can write to its sessionStorage
  await page.goto("/");

  // ── Build a minimal MSAL token cache ───────────────────────────────────────
  //
  // MSAL stores tokens as JSON in sessionStorage under keys like:
  //   msal.<clientId>.account.<homeAccountId>
  //   msal.<clientId>.accesstoken.<...>
  //   msal.<clientId>.idtoken.<...>
  //
  // We write a simplified version that satisfies useMsal() and useIsAuthenticated().

  const tenantId  = process.env.NEXT_PUBLIC_AZURE_TENANT_ID  ?? "mock-tenant-id";
  const clientId  = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID  ?? "mock-client-id";
  const homeAccountId = `mock-user-oid.${tenantId}`;

  // Access token — mock JWT (not validated by the frontend)
  const mockAccessToken = [
    Buffer.from('{"alg":"RS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({
      aud: process.env.NEXT_PUBLIC_BACKEND_SCOPE ?? "api://mock-backend/data.read",
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: "mock-user-oid",
      name: "Test User",
      preferred_username: "testuser@demo.com",
      oid: "mock-user-oid",
      tid: tenantId,
      scp: "data.read openid profile",
      roles: ["User"],
    })).toString("base64url"),
    "mock-signature",
  ].join(".");

  const cacheEntry = {
    [`${homeAccountId}-${tenantId}-account`]: JSON.stringify({
      homeAccountId,
      environment: "login.microsoftonline.com",
      tenantId,
      username: "testuser@demo.com",
      localAccountId: "mock-user-oid",
      name: "Test User",
    }),
    [`${homeAccountId}-${tenantId}-${clientId}-accesstoken-${tenantId}-data.read openid profile`]: JSON.stringify({
      homeAccountId,
      environment: "login.microsoftonline.com",
      clientId,
      credentialType: "AccessToken",
      secret: mockAccessToken,
      cachedAt: String(Math.floor(Date.now() / 1000)),
      expiresOn: String(Math.floor(Date.now() / 1000) + 3600),
      extendedExpiresOn: String(Math.floor(Date.now() / 1000) + 7200),
      target: "data.read openid profile",
      realm: tenantId,
    }),
  };

  // Write each cache entry to sessionStorage
  await page.evaluate((entries) => {
    Object.entries(entries).forEach(([key, value]) => {
      sessionStorage.setItem(key, value as string);
    });
  }, cacheEntry);

  // Save full browser storage state to file
  // (sessionStorage + cookies + localStorage)
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  console.log("✅ Mock MSAL auth state saved to", AUTH_FILE);
});

/*
 * ─── Alternative: real Azure AD login ────────────────────────────────────────
 *
 * If you need to test with a real Azure AD user (e.g., to verify the login
 * redirect flow itself), replace the setup above with:
 *
 *   setup("real Azure AD login", async ({ page }) => {
 *     await page.goto("/");
 *     await page.getByRole("button", { name: /sign in/i }).click();
 *
 *     // Handle the Azure AD popup
 *     const popup = await page.waitForEvent("popup");
 *     await popup.getByLabel("Email").fill(process.env.TEST_USER_EMAIL!);
 *     await popup.getByLabel("Password").fill(process.env.TEST_USER_PASSWORD!);
 *     await popup.getByRole("button", { name: /next/i }).click();
 *     await popup.waitForEvent("close");
 *
 *     await page.waitForURL("/dashboard");
 *     await page.context().storageState({ path: AUTH_FILE });
 *   });
 *
 * Store TEST_USER_EMAIL and TEST_USER_PASSWORD in a .env.test file (gitignored).
 */
